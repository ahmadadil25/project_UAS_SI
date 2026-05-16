// admin-init.js
// File utama untuk inisialisasi halaman admin.

window.onload = async () => {
    // Sembunyikan semua tab lebih awal agar tidak ada flash saat restore tab
    const ALL_TABS = ['dashboardTab', 'reservasiTab', 'walkinTab', 'paymentTab', 'kreditTab', 'laporanTab'];
    ALL_TABS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'flex';

        // Langsung tampilkan tab yang tersimpan SEBELUM data di-load
        // agar tidak ada "flash" ke dashboard saat refresh
        const savedTab = typeof getSavedAdminTab === 'function'
            ? getSavedAdminTab()
            : 'dashboardTab';
        const savedBtn = window.ADMIN_TAB_BUTTON_MAP?.[savedTab] || 'btn-dash';
        switchTab(savedTab, savedBtn, { save: false });

        initAdmin();
    }
};

async function initAdmin() {
    // Set tanggal hari ini dulu sebelum data reservasi diload
    setDefaultTodayDates();

    await loadAdminData();
    await loadCreditData();

    const playDate = document.getElementById('playDate');

    if (playDate) {
        playDate.addEventListener('change', checkWalkinUnitStatuses);
    }

    await loadWalkinUnits();

    if (document.getElementById('laporanContainer')) {
        loadLaporanByDate();
    }

    // switchTab sudah dipanggil lebih awal di window.onload
    // agar tab langsung tampil tanpa flash ke dashboard
}

function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function setDefaultTodayDates() {
    const today = getTodayDateString();

    // Filter Data Reservasi
    const reservationDateFilter = document.getElementById('reservationDateFilter');
    if (reservationDateFilter) {
        reservationDateFilter.value = today;
    }

    // Form Walk-in
    const playDate = document.getElementById('playDate');
    if (playDate) {
        playDate.value = today;
        playDate.min = today;
    }

    // Filter Data Pembayaran
    const paymentDateFilter = document.getElementById('paymentDateFilter');
    if (paymentDateFilter) {
        paymentDateFilter.value = today;
    }

    // Filter Laporan Keuangan
    const filterDate = document.getElementById('filterDate');
    if (filterDate) {
        filterDate.value = today;
    }
}

window.initAdmin = initAdmin;
window.getTodayDateString = getTodayDateString;
window.setDefaultTodayDates = setDefaultTodayDates;
