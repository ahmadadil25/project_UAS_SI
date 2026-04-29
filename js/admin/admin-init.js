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
    await loadAdminData();
    await loadCreditData();

    // Set default tanggal hari ini untuk form & laporan
    const today = new Date().toLocaleDateString('en-CA'); // format YYYY-MM-DD
    document.getElementById('playDate').value = today;
    document.getElementById('playDate').addEventListener('change', checkWalkinUnitStatuses);
    if (document.getElementById('filterDate')) {
        document.getElementById('filterDate').value = today;
    }

    await loadWalkinUnits();
    if (document.getElementById('laporanContainer')) {
        loadLaporanByDate(); // Load laporan awal
    }
}

window.initAdmin = initAdmin;
