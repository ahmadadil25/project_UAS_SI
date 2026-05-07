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

function switchTab(tabId, btnId) {
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
    const selectedBtn = document.getElementById(btnId);

    if (selectedBtn) {
        selectedBtn.classList.add('active');
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

window.switchTab = switchTab;