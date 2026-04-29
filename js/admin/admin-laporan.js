// admin-laporan.js
// Berisi fungsi laporan harian lengkap dan cetak laporan.
// Laporan dibuat sesuai kebutuhan laporan sistem: reservasi, transaksi, status, dan pendapatan.

async function loadLaporanByDate() {
    const date = document.getElementById('filterDate')?.value;
    const container = document.getElementById('laporanContainer');

    if (!date || !container) return;

    container.innerHTML = `
        <p style="padding:20px; text-align:center;">
            Memuat laporan harian...
        </p>
    `;

    try {
        const reservations = await fetchReservationsByDate(date);
        const rows = await mergeReservationsWithPayments(reservations);

        renderLaporan(rows, date);

    } catch (err) {
        console.error(err);

        container.innerHTML = `
            <p style="padding:20px; text-align:center; color:red;">
                Gagal memuat laporan: ${escapeHtml(err.message)}
            </p>
        `;
    }
}

async function fetchReservationsByDate(date) {
    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .eq('play_date', date)
        .order('start_time', { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return data || [];
}

async function mergeReservationsWithPayments(reservations) {
    const reservationIds = reservations.map(r => r.id).filter(Boolean);

    if (reservationIds.length === 0) {
        return [];
    }

    const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .in('reservation_id', reservationIds);

    if (error) {
        throw new Error(error.message);
    }

    const paymentMap = {};

    (payments || []).forEach(payment => {
        paymentMap[payment.reservation_id] = payment;
    });

    return reservations.map(reservation => ({
        reservation,
        payment: paymentMap[reservation.id] || null
    }));
}

function renderLaporan(rows, date) {
    const container = document.getElementById('laporanContainer');
    if (!container) return;

    if (!rows || rows.length === 0) {
        container.innerHTML = `
            <p style="padding:20px; text-align:center;">
                Tidak ada reservasi pada tanggal ini.
            </p>
        `;
        return;
    }

    const summary = calculateLaporanSummary(rows);

    let html = `
        <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 5px;">Laporan Harian Lengkap</h3>
            <p style="margin: 0; color: #64748b;">
                Tanggal: <strong>${escapeHtml(date)}</strong>
            </p>
        </div>

        <div class="dashboard-cards" style="margin-bottom: 20px;">
            <div class="card">
                <h4>Total Reservasi</h4>
                <h2>${summary.totalReservasi}</h2>
            </div>

            <div class="card">
                <h4>Total Pembayaran Masuk</h4>
                <h2>Rp ${summary.totalPembayaran.toLocaleString()}</h2>
            </div>

            <div class="card">
                <h4>Pendapatan Aktif</h4>
                <h2>Rp ${summary.totalPendapatan.toLocaleString()}</h2>
            </div>

            <div class="card">
                <h4>Pending</h4>
                <h2>${summary.pendingCount}</h2>
            </div>

            <div class="card">
                <h4>Paid</h4>
                <h2>${summary.paidCount}</h2>
            </div>

            <div class="card">
                <h4>Finished</h4>
                <h2>${summary.finishedCount}</h2>
            </div>

            <div class="card">
                <h4>Refund</h4>
                <h2>${summary.refundCount}</h2>
            </div>

            <div class="card">
                <h4>Credit</h4>
                <h2>${summary.creditCount}</h2>
            </div>
        </div>

        <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 10px; border: 1px solid #ddd;">Booking</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Pelanggan</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Unit</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Jadwal</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Metode Bayar</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Pembayaran</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Total Reservasi</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(row => {
        const r = row.reservation;
        const p = row.payment;

        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">
                    <strong>${escapeHtml(r.booking_code)}</strong>
                </td>

                <td style="padding: 10px; border: 1px solid #ddd;">
                    ${escapeHtml(r.customer_name)}<br>
                    <small>${escapeHtml(r.phone)}</small>
                </td>

                <td style="padding: 10px; border: 1px solid #ddd;">
                    ${r.playstation_units ? escapeHtml(r.playstation_units.unit_code) : '-'}
                </td>

                <td style="padding: 10px; border: 1px solid #ddd;">
                    ${escapeHtml(r.play_date)}<br>
                    <small>${formatTime(r.start_time)} - ${formatTime(r.end_time)}</small>
                </td>

                <td style="padding: 10px; border: 1px solid #ddd;">
                    <span class="badge ${getLaporanStatusBadge(r.reservation_status)}">
                        ${getLaporanStatusLabel(r.reservation_status)}
                    </span>
                </td>

                <td style="padding: 10px; border: 1px solid #ddd;">
                    ${p ? escapeHtml(p.payment_method || '-') : '-'}
                </td>

                <td style="padding: 10px; border: 1px solid #ddd;">
                    ${p ? `Rp ${Number(p.amount || 0).toLocaleString()}` : '-'}
                </td>

                <td style="padding: 10px; border: 1px solid #ddd;">
                    Rp ${Number(r.total_price || 0).toLocaleString()}
                </td>
            </tr>
        `;
    });

   html += `
        </tbody>

        <tfoot>
            <tr style="background: #eff6ff; font-weight: bold;">
                <td colspan="6" style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    TOTAL PEMBAYARAN MASUK
                </td>
                <td style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    Rp ${summary.totalPembayaran.toLocaleString()}
                </td>
                <td style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    Rp ${summary.totalReservasiValue.toLocaleString()}
                </td>
            </tr>

            <tr style="background: #f0fdf4; font-weight: bold;">
                <td colspan="7" style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    TOTAL PENDAPATAN AKTIF PAID + FINISHED
                </td>
                <td style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    Rp ${summary.totalPendapatan.toLocaleString()}
                </td>
            </tr>

            <tr style="background: #fff7ed; font-weight: bold;">
                <td colspan="7" style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    TOTAL REFUND
                </td>
                <td style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    Rp ${summary.totalRefund.toLocaleString()}
                </td>
            </tr>

            <tr style="background: #fefce8; font-weight: bold;">
                <td colspan="7" style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    TOTAL DIKONVERSI KE KREDIT
                </td>
                <td style="padding: 10px 14px; border: 1px solid #ddd; text-align: left;">
                    Rp ${summary.totalCredit.toLocaleString()}
                </td>
            </tr>
        </tfoot>
    `;

    container.innerHTML = html;
}

function calculateLaporanSummary(rows) {
    const summary = {
        totalReservasi: rows.length,
        totalReservasiValue: 0,
        totalPembayaran: 0,
        totalPendapatan: 0,
        totalRefund: 0,
        totalCredit: 0,
        pendingCount: 0,
        paidCount: 0,
        finishedCount: 0,
        refundCount: 0,
        creditCount: 0
    };

    rows.forEach(row => {
        const r = row.reservation;
        const p = row.payment;

        const totalPrice = Number(r.total_price || 0);
        const paymentAmount = Number(p?.amount || 0);
        const status = r.reservation_status;

        summary.totalReservasiValue += totalPrice;
        summary.totalPembayaran += paymentAmount;

        if (status === 'pending_payment') {
            summary.pendingCount++;
        }

        if (status === 'paid') {
            summary.paidCount++;
            summary.totalPendapatan += totalPrice;
        }

        if (status === 'finished') {
            summary.finishedCount++;
            summary.totalPendapatan += totalPrice;
        }

        if (status === 'cancelled_refund') {
            summary.refundCount++;
            summary.totalRefund += totalPrice;
        }

        if (status === 'converted_to_credit') {
            summary.creditCount++;
            summary.totalCredit += totalPrice;
        }
    });

    return summary;
}

function printLaporan() {
    const date = document.getElementById('filterDate')?.value || '-';
    const content = document.getElementById('laporanContainer')?.innerHTML || '';
    const printArea = document.getElementById('printArea');

    if (!printArea) return;

    printArea.innerHTML = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="text-align:center; margin-bottom: 5px;">PSHUB RENTAL</h2>
            <h3 style="text-align:center; margin-top: 0;">Laporan Harian Reservasi dan Transaksi</h3>
            <p>Tanggal: <strong>${escapeHtml(date)}</strong></p>
            <hr>
            ${content}
        </div>
    `;

    window.print();
}

function cetakLaporanHarian() {
    const today = new Date().toLocaleDateString('en-CA');
    const filterDate = document.getElementById('filterDate');

    if (filterDate) {
        filterDate.value = today;
    }

    loadLaporanByDate().then(() => {
        switchTab('laporanTab', 'btn-laporan');
    });
}

function getLaporanStatusLabel(status) {
    const labels = {
        pending_payment: 'Pending',
        paid: 'Paid',
        finished: 'Finished',
        cancelled_refund: 'Refund',
        converted_to_credit: 'Credit'
    };

    return labels[status] || status || '-';
}

function getLaporanStatusBadge(status) {
    if (status === 'paid' || status === 'finished') {
        return 'badge-paid';
    }

    if (status === 'pending_payment') {
        return 'badge-pending';
    }

    if (status === 'cancelled_refund' || status === 'converted_to_credit') {
        return 'badge-cancelled';
    }

    return 'badge-pending';
}

function formatTime(timeValue) {
    if (!timeValue) return '-';
    return String(timeValue).substring(0, 5);
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

window.loadLaporanByDate = loadLaporanByDate;
window.printLaporan = printLaporan;
window.cetakLaporanHarian = cetakLaporanHarian;