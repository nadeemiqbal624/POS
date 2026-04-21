/**
 * My Business POS - Shared UI Utility
 * Centralizes navigation highlighting, notifications, and common UI resets.
 */

const UI = {
    /**
     * Highlights the current active navigation link based on the URL path.
     */
    highlightNav() {
        const path = window.location.pathname.toLowerCase();
        const links = document.querySelectorAll('nav a');
        links.forEach(link => {
            const href = link.getAttribute('href').toLowerCase();
            // Match if path ends with href or if it's index.html and path is root
            const isActive = path.includes(href) || 
                            (href === 'index.html' && (path.endsWith('/') || path.endsWith('index.html')));
            
            if (isActive) {
                link.classList.remove('text-slate-500', 'text-amber-400');
                link.classList.add('text-amber-400');
                const icon = link.querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                link.classList.remove('text-slate-500', 'text-amber-400');
                link.classList.add('text-slate-500');
                const icon = link.querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 0";
            }
        });
    },

    /**
     * Updates the store name in the header based on the AppData profile.
     */
    updateStoreHeader() {
        if (typeof AppData === 'undefined') return;
        const profile = AppData.getProfile();
        const displayEl = document.getElementById('store-name-display');
        if (displayEl) {
            // If it's a sub-page, we might want to keep the "Back" title prefix or just show the store name
            // For now, let's keep the page-specific title if it's already set to something like "اسٹاک مینجمنٹ"
            // unless it's the dashboard.
            if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
                displayEl.innerText = profile.name || "مائی بزنس";
            }
        }
    },

    /**
     * Shows a temporary toast message.
     */
    showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-amber-400 px-6 py-3 rounded-2xl shadow-2xl border border-amber-400/20 text-xs font-bold z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300';
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-4');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    },

    /**
     * Locks the app instantly.
     */
    lockApp() {
        if (typeof AppData === 'undefined') return;
        const profile = AppData.getProfile();
        
        if (!profile.pin) {
            alert("ایپ لاک کرنے کے لیے پہلے 'سیٹنگز' میں جا کر پن کوڈ سیٹ کریں!");
            return;
        }

        // Lock it
        sessionStorage.removeItem('pos_unlocked');
        this.checkAppLock();
    },

    /**
     * Sets up PWA installation logic.
     * Expects an element with id 'install-btn'.
     */
    setupPWA() {
        let deferredPrompt;
        const installBtn = document.getElementById('install-btn');
        if (!installBtn) return;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.classList.remove('hidden');
        });

        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            }
        });

        window.addEventListener('appinstalled', () => {
            installBtn.classList.add('hidden');
        });

        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            installBtn.classList.add('hidden');
        }
    },

    /**
     * Checks if a security PIN is set, and locks the app.
     */
    checkAppLock() {
        if (typeof AppData === 'undefined') return;
        const profile = AppData.getProfile();
        if (!profile.pin) return; // No PIN set

        const isUnlocked = sessionStorage.getItem('pos_unlocked');
        if (isUnlocked === 'true') return;

        // Block scrolling on body
        document.body.style.overflow = 'hidden';

        const lockScreen = document.createElement('div');
        lockScreen.id = 'app-lock-screen';
        lockScreen.className = 'fixed inset-0 z-[99999] bg-slate-900 flex flex-col items-center justify-center p-6 urdu-font';
        lockScreen.innerHTML = `
            <div class="w-20 h-20 bg-amber-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-amber-400/20 mb-8">
                <span class="material-symbols-outlined text-slate-900 text-4xl" style="font-variation-settings: 'FILL' 1;">lock</span>
            </div>
            <h2 class="text-2xl font-bold text-white mb-2">ایپ لاک ہے</h2>
            <p class="text-xs text-slate-400 mb-8">براہ کرم ایپ کھولنے کے لیے اپنا پن کوڈ درج کریں</p>
            
            <div class="w-full max-w-xs space-y-4">
                <input type="password" id="unlock-pin" placeholder="----" class="w-full px-6 py-4 bg-slate-800 text-center text-white text-xl tracking-[0.5em] rounded-2xl border border-slate-700 outline-none focus:ring-2 focus:ring-amber-400 shadow-inner english-font">
                <p id="lock-error" class="text-rose-500 text-xs text-center hidden">پن کوڈ غلط ہے!</p>
                <button id="unlock-btn" class="w-full bg-amber-400 text-slate-900 py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg">ان لاک کریں</button>
            </div>
            <button id="forgot-pin-btn" class="mt-8 text-xs text-slate-500 hover:text-amber-400 transition-colors">پن کوڈ بھول گئے؟</button>
        `;
        document.body.appendChild(lockScreen);

        const inputEl = document.getElementById('unlock-pin');
        const btnEl = document.getElementById('unlock-btn');
        const errEl = document.getElementById('lock-error');
        const forgotBtnEl = document.getElementById('forgot-pin-btn');

        const attemptUnlock = () => {
            if (inputEl.value === profile.pin) {
                sessionStorage.setItem('pos_unlocked', 'true');
                document.body.style.overflow = '';
                lockScreen.classList.add('animate-out', 'fade-out', 'duration-300');
                setTimeout(() => lockScreen.remove(), 300);
            } else {
                errEl.classList.remove('hidden');
                inputEl.value = '';
                inputEl.focus();
            }
        };

        btnEl.addEventListener('click', attemptUnlock);
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptUnlock();
        });

        forgotBtnEl.addEventListener('click', () => {
            const code = prompt("سیکیورٹی ماسٹر ریکوری کوڈ درج کریں:");
            if (code === "112233") {
                profile.pin = '';
                AppData.updateProfile(profile);
                sessionStorage.setItem('pos_unlocked', 'true');
                document.body.style.overflow = '';
                lockScreen.remove();
                alert("آپ کا پن کوڈ کامیابی سے ختم کر دیا گیا ہے۔");
                location.reload();
            } else if (code) {
                alert("ماسٹر کوڈ غلط ہے!");
            }
        });
    },

    /**
     * Initialize common UI elements.
     */
    init() {
        this.checkAppLock();
        this.highlightNav();
        this.updateStoreHeader();
        this.setupPWA();
    },

    /**
     * Opens the native contact picker
     */
    async openContactPicker(nameFieldId, phoneFieldId) {
        if (!('contacts' in navigator && 'ContactsManager' in window)) {
            alert('آپ کا براؤزر کنٹیکٹس ڈائریکٹ امپورٹ کرنے کو سپورٹ نہیں کرتا۔ آپ کو نمبر خود سے لکھنا ہوگا۔');
            return;
        }
        try {
            const props = ['name', 'tel'];
            const opts = { multiple: false };
            const contacts = await navigator.contacts.select(props, opts);
            if (contacts.length > 0) {
                const c = contacts[0];
                if (c.name && c.name.length > 0 && nameFieldId) {
                    const nameEl = document.getElementById(nameFieldId);
                    if(nameEl && !nameEl.value) nameEl.value = c.name[0];
                }
                if (c.tel && c.tel.length > 0 && phoneFieldId) {
                    const phoneEl = document.getElementById(phoneFieldId);
                    if(phoneEl) {
                        let phone = c.tel[0].replace(/\s+/g, '').replace(/[^0-9+]/g, '');
                        phoneEl.value = phone;
                    }
                }
            }
        } catch (ex) {
            console.error(ex);
        }
    }
};

// Initialize on script load
window.addEventListener('DOMContentLoaded', () => UI.init());
