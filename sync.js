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
let isAuthenticating = false; // Prevent double auth prompts

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
        // Try restoring token from localStorage
        const storedTokenStr = localStorage.getItem('google_access_token');
        if (storedTokenStr) {
            try {
                const storedToken = JSON.parse(storedTokenStr);
                // Check if it's valid (with 5 minute buffer)
                if (storedToken.expiry > Date.now() + 300000) {
                    gapi.client.setToken({ access_token: storedToken.access_token });
                    updateSyncUI('connected');
                    return;
                } else {
                    localStorage.removeItem('google_access_token');
                }
            } catch(e) {}
        }

        const token = gapi.client.getToken();
        if (token) {
            updateSyncUI('connected');
        } else {
            // Try silent login if we've already authorized
            try {
                autoSync();
            } catch(e) {}
        }
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
        // Save token to persist across pages
        localStorage.setItem('google_access_token', JSON.stringify({
            access_token: resp.access_token,
            expiry: Date.now() + (resp.expires_in * 1000)
        }));
        updateSyncUI('connected');
        await performFullSync();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function updateSyncUI(state) {
    const btn = document.getElementById('sync-btn');
    const status = document.getElementById('sync-status');
    const iconBg = document.getElementById('sync-icon-bg');
    const icon = document.getElementById('sync-icon');

    if (!btn || !status || !iconBg || !icon) return;

    // Reset states
    icon.className = 'material-symbols-outlined';
    iconBg.className = 'w-10 h-10 rounded-xl flex items-center justify-center';
    status.classList.remove('text-slate-500', 'text-emerald-400', 'text-amber-400', 'text-slate-400');

    if (state === 'connected') {
        btn.innerHTML = `<span class="material-symbols-outlined text-sm">sync</span> اپ ڈیٹ کریں`;
        status.innerText = 'منسلک اور محفوظ';
        status.classList.add('text-emerald-400');
        iconBg.classList.add('bg-emerald-500/20');
        icon.classList.add('text-emerald-400');
        icon.innerText = 'cloud_done';
    } else if (state === 'syncing') {
        status.innerText = 'سنک ہو رہا ہے...';
        status.classList.add('text-amber-400');
        iconBg.classList.add('bg-amber-400/20');
        icon.classList.add('text-amber-400', 'animate-spin');
        icon.innerText = 'sync';
    } else if (state === 'pending') {
        status.innerText = 'محفوظ کرنے کا انتظار...';
        status.classList.add('text-amber-400');
        iconBg.classList.add('bg-amber-400/10');
        icon.classList.add('text-amber-400', 'animate-pulse');
        icon.innerText = 'cloud_upload';
    } else {
        status.innerText = 'منسلک نہیں ہے';
        status.classList.add('text-slate-500');
        iconBg.classList.add('bg-slate-700');
        icon.classList.add('text-slate-400');
        icon.innerText = 'cloud_off';
    }
}

// 3. Drive Operations
async function restoreFromDrive() {
    if (!gapi.client || !gapi.client.getToken()) {
        alert('پہلے گوگل اکاؤنٹ منسلک کریں!');
        return;
    }

    if (!confirm('کیا آپ کلاؤڈ سے ڈیٹا ری سٹور کرنا چاہتے ہیں؟ موجودہ لوکل ڈیٹا مٹ جائے گا!')) return;

    updateSyncUI('syncing');

    try {
        const response = await gapi.client.drive.files.list({
            q: `name = '${SYNC_CONFIG.FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)',
        });
        const files = response.result.files;

        if (files && files.length > 0) {
            const fileId = files[0].id;
            const fileResp = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            const cloudData = fileResp.result;
            
            // Apply to localStorage
            if (cloudData.inventory) localStorage.setItem('yc_inventory', JSON.stringify(cloudData.inventory));
            if (cloudData.sales) localStorage.setItem('yc_sales', JSON.stringify(cloudData.sales));
            if (cloudData.khata) localStorage.setItem('yc_khata', JSON.stringify(cloudData.khata));
            if (cloudData.suppliers) localStorage.setItem('yc_suppliers', JSON.stringify(cloudData.suppliers));
            if (cloudData.categories) localStorage.setItem('yc_categories', JSON.stringify(cloudData.categories));
            if (cloudData.profile) localStorage.setItem('yc_profile', JSON.stringify(cloudData.profile));
            if (cloudData.expenses) localStorage.setItem('yc_expenses', JSON.stringify(cloudData.expenses));

            alert('ڈیٹا کامیابی سے ری سٹور ہو گیا ہے! پیج ری لوڈ ہو رہا ہے...');
            location.reload();
        } else {
            alert('کلاؤڈ پر کوئی بیک اپ موجود نہیں ہے!');
        }
    } catch (err) {
        console.error('Restore failed', err);
        alert('ڈیٹا ری سٹور کرنے میں خرابی پیش آئی!');
    } finally {
        updateSyncUI('connected');
    }
}

let isSyncing = false; // Prevent overlapping syncs

async function performFullSync() {
    if (isSyncing) return; // Prevent double trigger
    isSyncing = true;
    updateSyncUI('syncing');
    
    // Get local data
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
        // Search for existing backup file
        const response = await gapi.client.drive.files.list({
            q: `name = '${SYNC_CONFIG.FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)',
        });
        const files = response.result.files;

        if (files && files.length > 0) {
            const fileId = files[0].id;
            // Update existing
            await gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: JSON.stringify(localData)
            });
        } else {
            // Create new
            const metadata = {
                name: SYNC_CONFIG.FILE_NAME,
                mimeType: 'application/json',
            };
            const file = new Blob([JSON.stringify(localData)], { type: 'application/json' });
            
            // Multipart upload logic simplified
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
                body: form
            });
        }
        
        updateSyncUI('connected');
        localStorage.setItem('yc_last_sync', Date.now());
    } catch (err) {
        console.error('Sync failed', err);
        // Maybe token expired, don't alert spam in autoSync, just update UI
        updateSyncUI('connected'); 
    } finally {
        isSyncing = false;
    }
}

let syncTimeout = null;

// Auto-sync function to be called from data.js
async function autoSync() {
    if (!gapi.client || !gisInited) return;

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

