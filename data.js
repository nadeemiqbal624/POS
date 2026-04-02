/**
 * My Business POS - Shared Data Utility
 * Handles localStorage persistence for Inventory, Sales, and Khata.
 */

const AppData = {
    // Initial Data (Empty for production)
    initialInventory: [],

    init() {
        if (!localStorage.getItem('yc_categories')) {
            localStorage.setItem('yc_categories', JSON.stringify(['عام', 'کرانہ', 'الیکٹرانکس', 'کپڑے']));
        }
        if (!localStorage.getItem('yc_inventory')) {
            localStorage.setItem('yc_inventory', JSON.stringify([]));
        }
        if (!localStorage.getItem('yc_sales')) {
            localStorage.setItem('yc_sales', JSON.stringify([]));
        }
        if (!localStorage.getItem('yc_khata')) {
            localStorage.setItem('yc_khata', JSON.stringify([]));
        }
        if (!localStorage.getItem('yc_suppliers')) {
            localStorage.setItem('yc_suppliers', JSON.stringify([]));
        }
        if (!localStorage.getItem('yc_profile')) {
            localStorage.setItem('yc_profile', JSON.stringify({
                name: 'مائی بزنس',
                logo: './icon-192.png', // Use the newly generated logo
                phone: '',
                address: ''
            }));
        }
        if (!localStorage.getItem('yc_expenses')) {
            localStorage.setItem('yc_expenses', JSON.stringify([]));
        }
    },

    getExpenses() {
        return JSON.parse(localStorage.getItem('yc_expenses'));
    },

    addExpense(expense) {
        let expenses = this.getExpenses();
        expenses.push({ ...expense, id: Date.now(), date: new Date().toLocaleDateString('ur-PK') });
        localStorage.setItem('yc_expenses', JSON.stringify(expenses));
        if (typeof autoSync === 'function') autoSync();
    },

    deleteExpense(id) {
        let expenses = this.getExpenses();
        expenses = expenses.filter(e => e.id !== id);
        localStorage.setItem('yc_expenses', JSON.stringify(expenses));
        if (typeof autoSync === 'function') autoSync();
    },

    getProfile() {
        try {
            const profile = localStorage.getItem('yc_profile');
            return profile ? JSON.parse(profile) : { name: 'مائی بزنس', phone: '', address: '', logo: 'logo.png' };
        } catch (e) {
            return { name: 'مائی بزنس', phone: '', address: '', logo: 'logo.png' };
        }
    },

    updateProfile(profile) {
        localStorage.setItem('yc_profile', JSON.stringify(profile));
        try {
            if (typeof autoSync === 'function') autoSync();
        } catch (e) {
            console.error("Sync error:", e);
        }
    },

    getSuppliers() {
        return JSON.parse(localStorage.getItem('yc_suppliers'));
    },

    getInventory() {
        return JSON.parse(localStorage.getItem('yc_inventory'));
    },

    updateStock(id, newStock) {
        let inv = this.getInventory();
        let item = inv.find(i => i.id === id);
        if (item) {
            item.stock = newStock;
            localStorage.setItem('yc_inventory', JSON.stringify(inv));
            if (typeof autoSync === 'function') autoSync();
        }
    },

    getSales() {
        return JSON.parse(localStorage.getItem('yc_sales'));
    },

    addSale(sale) {
        let sales = this.getSales();
        // Calculate Profit
        let totalCost = 0;
        sale.items.forEach(item => {
            const inventoryItem = this.getInventory().find(i => i.id === item.id);
            const cost = (inventoryItem ? (inventoryItem.costPrice || inventoryItem.price * 0.8) : item.price * 0.8);
            totalCost += (cost * item.qty);
        });
        
        const profit = sale.total - totalCost;
        
        const newSale = { 
            ...sale, 
            id: Date.now(),
            invoiceNo: 'INV-' + Math.floor(1000 + Math.random() * 9000),
            profit: profit,
            date: new Date().toLocaleDateString('ur-PK') 
        };
        
        sales.push(newSale);
        localStorage.setItem('yc_sales', JSON.stringify(sales));
        if (typeof autoSync === 'function') autoSync();
        return newSale; // Return the sale with invoiceNo
    },

    getKhata() {
        return JSON.parse(localStorage.getItem('yc_khata'));
    },

    updateKhata(name, amount, type = 'Payment', details = 'نقد وصولی') {
        let khata = this.getKhata();
        let customer = khata.find(c => c.name === name);
        if (customer) {
            if (!customer.transactions) customer.transactions = [];
            
            // Update balance
            if (type === 'Purchase') {
                customer.balance += amount;
            } else {
                customer.balance -= amount;
                if (customer.balance < 0) customer.balance = 0;
            }
            
            // Add to history
            customer.transactions.push({
                id: Date.now(),
                date: new Date().toLocaleDateString('ur-PK'),
                amount: amount,
                type: type, // 'Purchase' or 'Payment'
                details: details
            });
            
            customer.lastPay = new Date().toLocaleDateString('ur-PK');
            localStorage.setItem('yc_khata', JSON.stringify(khata));
            if (typeof autoSync === 'function') autoSync();
        } else {
            // New Customer
            const newCust = {
                id: Date.now(),
                name: name,
                balance: amount > 0 ? amount : 0,
                lastPay: 'کبھی نہیں',
                transactions: amount > 0 ? [{
                    id: Date.now(),
                    date: new Date().toLocaleDateString('ur-PK'),
                    amount: amount,
                    type: amount > 0 ? 'Purchase' : 'Initial',
                    details: 'ابتدائی بیلنس'
                }] : []
            };
            khata.push(newCust);
            localStorage.setItem('yc_khata', JSON.stringify(khata));
            if (typeof autoSync === 'function') autoSync();
        }
    },

    getKhataHistory(name) {
        const khata = this.getKhata();
        const customer = khata.find(c => c.name === name);
        return customer ? (customer.transactions || []) : [];
    },

    deleteKhata(id) {
        let khata = this.getKhata();
        khata = khata.filter(c => c.id !== id);
        localStorage.setItem('yc_khata', JSON.stringify(khata));
        if (typeof autoSync === 'function') autoSync();
    },

    addSupplier(supplier) {
        let suppliers = this.getSuppliers() || [];
        suppliers.push({ ...supplier, id: Date.now() });
        localStorage.setItem('yc_suppliers', JSON.stringify(suppliers));
        if (typeof autoSync === 'function') autoSync();
    },

    deleteSupplier(id) {
        let suppliers = this.getSuppliers() || [];
        suppliers = suppliers.filter(s => s.id !== id);
        localStorage.setItem('yc_suppliers', JSON.stringify(suppliers));
        if (typeof autoSync === 'function') autoSync();
    },

    getCategories() {
        return JSON.parse(localStorage.getItem('yc_categories'));
    },

    addCategory(name) {
        let cats = this.getCategories();
        const trimmedName = name.trim();
        if (trimmedName && !cats.includes(trimmedName)) {
            cats.push(trimmedName);
            localStorage.setItem('yc_categories', JSON.stringify(cats));
            if (typeof autoSync === 'function') autoSync();
        }
    },

    deleteCategory(name) {
        let cats = this.getCategories();
        cats = cats.filter(c => c !== name);
        localStorage.setItem('yc_categories', JSON.stringify(cats));
        if (typeof autoSync === 'function') autoSync();
    },

    addInventory(item) {
        let inv = this.getInventory();
        inv.push(item);
        localStorage.setItem('yc_inventory', JSON.stringify(inv));
        if (typeof autoSync === 'function') autoSync();
    },

    updateInventory(updatedItem) {
        let inv = this.getInventory();
        const index = inv.findIndex(i => i.id === updatedItem.id);
        if (index !== -1) {
            inv[index] = updatedItem;
            localStorage.setItem('yc_inventory', JSON.stringify(inv));
            if (typeof autoSync === 'function') autoSync();
        }
    },

    deleteInventory(id) {
        let inv = this.getInventory();
        inv = inv.filter(i => i.id !== id);
        localStorage.setItem('yc_inventory', JSON.stringify(inv));
        if (typeof autoSync === 'function') autoSync();
    }
};

// Auto-init
AppData.init();
