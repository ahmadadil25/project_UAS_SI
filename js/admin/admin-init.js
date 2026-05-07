// admin-init.js
// File utama untuk inisialisasi halaman admin.

window.onload = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'flex';

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

    // Saat masuk admin, langsung tampilkan tab Data Reservasi
    switchTab('reservasiTab', 'btn-res');
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