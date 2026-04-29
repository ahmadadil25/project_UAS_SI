// admin-realtime.js
// Berisi realtime listener untuk tabel reservations dan payments.

supabase.channel('admin:reservations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        if (typeof loadAdminData === 'function') {
            loadAdminData();
        }

        if (typeof checkWalkinUnitStatuses === 'function') {
            checkWalkinUnitStatuses();
        }

        if (typeof loadPaymentData === 'function') {
            loadPaymentData();
        }

        if (typeof loadLaporanByDate === 'function') {
            loadLaporanByDate();
        }
    })
    .subscribe();

supabase.channel('admin:payments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        if (typeof loadPaymentData === 'function') {
            loadPaymentData();
        }

        if (typeof loadLaporanByDate === 'function') {
            loadLaporanByDate();
        }
    })
    .subscribe();