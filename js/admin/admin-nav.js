// admin-nav.js
// Berisi fungsi navigasi tab pada dashboard admin.

const ADMIN_TABS = [
    'dashboardTab',
    'reservasiTab',
    'walkinTab',
    'paymentTab',
    'kreditTab',
    'laporanTab'
];

const ADMIN_BUTTONS = [
    'btn-dash',
    'btn-res',
    'btn-walkin',
    'btn-payment',
    'btn-kredit',
    'btn-laporan'
];

const ADMIN_TAB_BUTTON_MAP = {
    dashboardTab: 'btn-dash',
    reservasiTab: 'btn-res',
    walkinTab: 'btn-walkin',
    paymentTab: 'btn-payment',
    kreditTab: 'btn-kredit',
    laporanTab: 'btn-laporan'
};

const ADMIN_ACTIVE_TAB_KEY = 'pshubAdminActiveTab';

function switchTab(tabId, btnId, options = {}) {
    const resolvedBtnId = btnId || ADMIN_TAB_BUTTON_MAP[tabId] || 'btn-dash';

    // Paksa semua tab hilang dulu
    ADMIN_TABS.forEach(id => {
        const tab = document.getElementById(id);

        if (tab) {
            tab.style.display = 'none';
            tab.classList.remove('active-tab');
        }
    });

    // Matikan active semua tombol sidebar
    ADMIN_BUTTONS.forEach(id => {
        const btn = document.getElementById(id);

        if (btn) {
            btn.classList.remove('active');
        }
    });

    // Tampilkan tab yang dipilih saja
    const selectedTab = document.getElementById(tabId);

    if (selectedTab) {
        selectedTab.style.display = 'block';
        selectedTab.classList.add('active-tab');
    }

    // Aktifkan tombol sidebar yang dipilih
    const selectedBtn = document.getElementById(resolvedBtnId);

    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }

    if (options.save !== false && ADMIN_TAB_BUTTON_MAP[tabId]) {
        localStorage.setItem(ADMIN_ACTIVE_TAB_KEY, tabId);
    }

    // Load data sesuai tab
    if (tabId === 'reservasiTab' && typeof applyReservationFilters === 'function') {
        applyReservationFilters();
    }

    if (tabId === 'paymentTab' && typeof loadPaymentData === 'function') {
        loadPaymentData();
    }

    if (tabId === 'kreditTab' && typeof loadCreditData === 'function') {
        loadCreditData();
    }

    if (tabId === 'laporanTab' && typeof loadLaporanByDate === 'function') {
        loadLaporanByDate();
    }

    window.scrollTo(0, 0);
}

function getSavedAdminTab() {
    const savedTab = localStorage.getItem(ADMIN_ACTIVE_TAB_KEY);

    if (savedTab && ADMIN_TAB_BUTTON_MAP[savedTab]) {
        return savedTab;
    }

    return 'dashboardTab';
}

window.switchTab = switchTab;
window.getSavedAdminTab = getSavedAdminTab;
window.ADMIN_TAB_BUTTON_MAP = ADMIN_TAB_BUTTON_MAP;
window.ADMIN_ACTIVE_TAB_KEY = ADMIN_ACTIVE_TAB_KEY;
