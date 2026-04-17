/**
 * Google Drive Sync Engine
 * Handles OAuth2 authentication and JSON file persistence on Drive.
 */

const SYNC_CONFIG = {
    CLIENT_ID: '639694745913-bnetaj2roioqvc3dg7diaiec0c62c9eo.apps.googleusercontent.com', // User provided ID
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    FILE_NAME: 'pos_backup_yc.json'
};

let tokenClient;
let gapiInited = false;
let gisInited = false;
let isAuthenticating = false; 
let isCloudSetupComplete = localStorage.getItem('yc_cloud_setup') === 'true';

// 1. Initialize API & Identity
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({
            discoveryDocs: [SYNC_CONFIG.DISCOVERY_DOC],
        });
        gapiInited = true;
        checkSyncStatus();
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: SYNC_CONFIG.CLIENT_ID,
        scope: SYNC_CONFIG.SCOPES,
        callback: '', // defined at runtime
    });
    gisInited = true;
    checkSyncStatus();
}

function checkSyncStatus() {
    if (gapiInited && gisInited) {
        const storedTokenStr = localStorage.getItem('google_access_token');
        if (storedTokenStr) {
            try {
                const storedToken = JSON.parse(storedTokenStr);
                if (storedToken.expiry > Date.now() + 300000) {
                    gapi.client.setToken({ access_token: storedToken.access_token });
                    updateSyncUI('synced');
                    checkSetupRequired();
                    return;
                }
            } catch(e) {}
        }
        
        // If we reached here, token is missing or expired.
        // Try to refresh silently ONLY if we have already setup cloud
        if (isCloudSetupComplete && !isAuthenticating) {
            try {
                tokenClient.requestAccessToken({ prompt: '' });
            } catch(e) {}
        }
        checkSetupRequired();
    }
}

function checkSetupRequired() {
    const overlay = document.getElementById('setup-overlay');
    if (!overlay) return;
    
    if (gapi.client.getToken() || isCloudSetupComplete) {
        overlay.classList.add('hidden');
    } else {
        overlay.classList.remove('hidden');
    }
}

// Ensure scripts are loaded
window.onload = () => {
    if (typeof gapi !== 'undefined') gapiLoaded();
    if (typeof google !== 'undefined') gisLoaded();
    
    // Add online listener for auto-sync
    window.addEventListener('online', () => {
        console.log('Back online. Syncing...');
        autoSync();
    });
};

// 2. Auth Flow
async function handleSyncAuth() {
    if (SYNC_CONFIG.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        alert('براہ کرم گوگل کلاؤڈ کنسول سے اپنی Client ID حاصل کریں اور کوڈ میں درج کریں۔');
        return;
    }

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) throw (resp);
        
        localStorage.setItem('google_access_token', JSON.stringify({
            access_token: resp.access_token,
            expiry: Date.now() + (resp.expires_in * 1000)
        }));
        
        updateSyncUI('connected');
        checkSetupRequired();

        // Check for existing backup on first time
        await checkForExistingBackup();
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function checkForExistingBackup() {
    updateSyncUI('syncing');
    try {
        const response = await gapi.client.drive.files.list({
            q: `name = '${SYNC_CONFIG.FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)',
        });
        const files = response.result.files;

        const isLocalEmpty = AppData.getInventory().length === 0 && AppData.getSales().length === 0;

        if (files && files.length > 0 && isLocalEmpty) {
            // Backup found and local is empty - Show choice
            showRestoreChoiceModal(files[0].id);
        } else {
            // No backup or already has data - Just start syncing
            localStorage.setItem('yc_cloud_setup', 'true');
            isCloudSetupComplete = true;
            await performFullSync();
        }
    } catch (err) {
        console.error('Backup check failed', err);
        updateSyncUI('connected');
    }
}

function showRestoreChoiceModal(fileId) {
    const modal = document.getElementById('restore-choice-modal');
    if (!modal) {
        // Fallback to simple confirm if modal not found
        if (confirm('گوگل ڈرائیو پر آپ کا پرانا بیک اپ ملا ہے۔ کیا آپ اسے واپس لانا چاہتے ہیں؟')) {
            restoreConfirmed(fileId);
        } else {
            freshStartConfirmed();
        }
        return;
    }
    
    window._pendingFileId = fileId;
    modal.classList.remove('hidden');
}

async function restoreConfirmed(fileId) {
    fileId = fileId || window._pendingFileId;
    // Set flag first so it survives the reload inside restoreFromDrive
    localStorage.setItem('yc_cloud_setup', 'true');
    isCloudSetupComplete = true;
    await restoreFromDrive(fileId);
}

async function freshStartConfirmed() {
    localStorage.setItem('yc_cloud_setup', 'true');
    isCloudSetupComplete = true;
    await performFullSync();
    const modal = document.getElementById('restore-choice-modal');
    if (modal) modal.classList.add('hidden');
}

function updateSyncUI(state) {
    const status = document.getElementById('sync-status');
    const icon = document.getElementById('sync-icon');
    if (!status || !icon) return;

    if (state === 'synced') {
        status.innerText = 'گوگل ڈرائیو کے ساتھ سنک ہے';
        status.className = 'text-[10px] text-emerald-400 font-bold';
        icon.innerText = 'cloud_done';
        icon.className = 'material-symbols-outlined text-emerald-400';
    } else if (state === 'syncing') {
        status.innerText = 'سنک ہو رہا ہے...';
        status.className = 'text-[10px] text-amber-400 italic';
        icon.innerText = 'sync';
        icon.className = 'material-symbols-outlined text-amber-400 animate-spin';
    } else if (state === 'connected') {
        status.innerText = 'منسلک ہے';
        status.className = 'text-[10px] text-slate-400';
        icon.innerText = 'cloud_queue';
        icon.className = 'material-symbols-outlined text-slate-400';
    } else {
        status.innerText = 'منسلک نہیں ہے';
        status.className = 'text-[10px] text-slate-500';
        icon.innerText = 'cloud_off';
        icon.className = 'material-symbols-outlined text-slate-500';
    }
}

// 3. Drive Operations
async function restoreFromDrive(fileId) {
    if (!gapi.client || !gapi.client.getToken()) return;

    updateSyncUI('syncing');

    try {
        if (!fileId) {
            const response = await gapi.client.drive.files.list({
                q: `name = '${SYNC_CONFIG.FILE_NAME}' and trashed = false`,
                fields: 'files(id, name)',
            });
            const files = response.result.files;
            if (!files || files.length === 0) {
                alert('کلاؤڈ پر کوئی بیک اپ موجود نہیں ہے!');
                return;
            }
            fileId = files[0].id;
        }

        const fileResp = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        // Handle different gapi response structures
        let cloudData = fileResp.result || fileResp.body;
        
        if (typeof cloudData === 'string') {
            try {
                cloudData = JSON.parse(cloudData);
            } catch (e) {
                console.error("JSON parse error:", e);
                alert('بیک اپ فائل کا فارمیٹ درست نہیں ہے!');
                return;
            }
        }
        
        if (!cloudData || typeof cloudData !== 'object') {
            alert('بیک اپ فائل خالی ہے!');
            return;
        }
        
        // Apply to localStorage
        const keys = ['inventory', 'sales', 'khata', 'suppliers', 'categories', 'profile', 'expenses'];
        let restoredCount = 0;
        let details = "بیک اپ میں درج ذیل ڈیٹا ملا:\n";
        
        keys.forEach(key => {
            if (cloudData[key]) {
                const data = cloudData[key];
                localStorage.setItem(`yc_${key}`, JSON.stringify(data));
                restoredCount++;
                if (Array.isArray(data)) {
                    details += `✅ ${key}: ${data.length} آئٹمز\n`;
                } else {
                    details += `✅ ${key}: معلومات مل گئی ہیں\n`;
                }
            } else {
                details += `❌ ${key}: نہیں ملا\n`;
            }
        });

        alert(details);
        alert('ایپ اب ری لوڈ ہوگی اور ڈیٹا نظر آ جائے گا۔');
        location.reload();
    } catch (err) {
        console.error('Restore failed', err);
        alert('واپسی کے عمل میں خرابی پیش آئی: ' + (err.message || 'Unknown error'));
    } finally {
        updateSyncUI('synced');
    }
}

let isSyncing = false;

async function performFullSync() {
    if (isSyncing || !gapi.client || !gapi.client.getToken()) return;
    isSyncing = true;
    updateSyncUI('syncing');
    
    const localData = {
        inventory: AppData.getInventory(),
        sales: AppData.getSales(),
        khata: AppData.getKhata(),
        suppliers: AppData.getSuppliers(),
        categories: AppData.getCategories(),
        profile: AppData.getProfile(),
        expenses: AppData.getExpenses(),
        timestamp: Date.now()
    };

    try {
        const response = await gapi.client.drive.files.list({
            q: `name = '${SYNC_CONFIG.FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)',
        });
        const files = response.result.files;

        if (files && files.length > 0) {
            const fileId = files[0].id;
            // Update existing using PATCH
            await gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: JSON.stringify(localData)
            });
        } else {
            // Create new (Metadata then Content for reliability)
            const metaResp = await gapi.client.drive.files.create({
                resource: {
                    name: SYNC_CONFIG.FILE_NAME,
                    mimeType: 'application/json'
                },
                fields: 'id'
            });
            
            const newFileId = metaResp.result.id;
            await gapi.client.request({
                path: `/upload/drive/v3/files/${newFileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: JSON.stringify(localData)
            });
        }
        
        updateSyncUI('synced');
        localStorage.setItem('yc_last_sync', Date.now());
    } catch (err) {
        console.error('Sync failed', err);
    } finally {
        isSyncing = false;
    }
}

let syncTimeout = null;

// Auto-sync function to be called from data.js
async function autoSync() {
    if (!gapi.client || !gisInited || !isCloudSetupComplete) return;

    if (syncTimeout) clearTimeout(syncTimeout);

    updateSyncUI('pending'); // Show wait indicator

    syncTimeout = setTimeout(async () => {
        const currentToken = gapi.client.getToken();
        
        if (currentToken) {
            await performFullSync();
        } else if (!isAuthenticating) {
            // Try to get token without prompt (silent)
            isAuthenticating = true;
            try {
                tokenClient.callback = async (resp) => {
                    isAuthenticating = false;
                    if (resp.error !== undefined) return;
                    // Save token locally
                    localStorage.setItem('google_access_token', JSON.stringify({
                        access_token: resp.access_token,
                        expiry: Date.now() + (resp.expires_in * 1000)
                    }));
                    updateSyncUI('connected');
                    await performFullSync();
                };
                tokenClient.requestAccessToken({ prompt: '' });
            } catch (err) {
                isAuthenticating = false;
            }
        }
    }, 4000); // Wait 4 seconds after last change
}

