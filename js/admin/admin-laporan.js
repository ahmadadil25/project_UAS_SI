// admin-laporan.js
// Laporan harian dibuat full table compact agar pas saat dicetak.

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
            <div style="background:white; border:1px solid #e2e8f0; border-radius:14px; padding:30px; text-align:center;">
                <h3 style="margin-bottom:8px;">Laporan Harian Lengkap</h3>
                <p style="margin:0; color:#64748b;">
                    Tidak ada reservasi pada tanggal <strong>${escapeHtml(date)}</strong>.
                </p>
            </div>
        `;
        return;
    }

    const summary = calculateLaporanSummary(rows);

    let html = `
        <div class="laporan-print-wrapper">
            <div style="margin-bottom: 14px;">
                <h3 style="margin-bottom: 5px; font-size: 22px;">
                    Laporan Harian Lengkap
                </h3>
                <p style="margin: 0; color: #64748b; font-size: 14px;">
                    Tanggal: <strong>${escapeHtml(date)}</strong>
                </p>
            </div>

            <div style="overflow-x:auto; background:white; border:1px solid #e2e8f0; border-radius:12px;">
                <table class="laporan-table-compact"
                    style="
                        width:100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                        font-size: 12px;
                    ">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="width:10%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Booking</th>
                            <th style="width:13%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Pelanggan</th>
                            <th style="width:10%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Unit</th>
                            <th style="width:13%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Jadwal</th>
                            <th style="width:7%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Durasi</th>
                            <th style="width:10%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Status</th>
                            <th style="width:12%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Metode</th>
                            <th style="width:12%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Bayar</th>
                            <th style="width:13%; padding:8px; border:1px solid #e2e8f0; text-align:left;">Total</th>
                        </tr>
                    </thead>

                    <tbody>
    `;

    rows.forEach(row => {
        const r = row.reservation;
        const p = row.payment;

        const totalReservation = Number(r.total_price || 0);
        const paymentAmount = Number(p?.amount || 0);

        html += `
            <tr>
                <td style="padding:8px; border:1px solid #e2e8f0; word-break:break-word;">
                    <strong>${escapeHtml(r.booking_code)}</strong>
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0; word-break:break-word;">
                    <strong>${escapeHtml(r.customer_name)}</strong><br>
                    <small style="color:#64748b;">${escapeHtml(r.phone)}</small>
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0; word-break:break-word;">
                    ${r.playstation_units ? escapeHtml(r.playstation_units.unit_code) : '-'}
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0; word-break:break-word;">
                    ${escapeHtml(r.play_date)}<br>
                    <small style="color:#64748b;">
                        ${formatTime(r.start_time)} - ${formatTime(r.end_time)}
                    </small>
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0;">
                    ${Number(r.duration_hours || 0)} Jam
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0;">
                    <span class="badge ${getLaporanStatusBadge(r.reservation_status)}"
                        style="font-size:10px; padding:5px 8px; white-space:nowrap;">
                        ${getLaporanStatusLabel(r.reservation_status)}
                    </span>
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0; word-break:break-word;">
                    ${p ? escapeHtml(p.payment_method || '-') : '-'}
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0; white-space:nowrap;">
                    Rp ${paymentAmount.toLocaleString('id-ID')}
                </td>

                <td style="padding:8px; border:1px solid #e2e8f0; white-space:nowrap;">
                    Rp ${totalReservation.toLocaleString('id-ID')}
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>

                    <tfoot>
                        <tr style="background:#f8fafc; font-weight:700;">
                            <td colspan="7" style="padding:8px; border:1px solid #e2e8f0;">
                                Total Reservasi
                            </td>
                            <td colspan="2" style="padding:8px; border:1px solid #e2e8f0;">
                                ${summary.totalReservasi} Reservasi
                            </td>
                        </tr>

                        <tr style="background:#eff6ff; font-weight:700;">
                            <td colspan="7" style="padding:8px; border:1px solid #e2e8f0;">
                                Total Pembayaran Masuk
                            </td>
                            <td colspan="2" style="padding:8px; border:1px solid #e2e8f0;">
                                Rp ${summary.totalPembayaran.toLocaleString('id-ID')}
                            </td>
                        </tr>

                        <tr style="background:#f0fdf4; font-weight:700;">
                            <td colspan="7" style="padding:8px; border:1px solid #e2e8f0;">
                                Total Pendapatan Aktif Paid + Finished
                            </td>
                            <td colspan="2" style="padding:8px; border:1px solid #e2e8f0;">
                                Rp ${summary.totalPendapatan.toLocaleString('id-ID')}
                            </td>
                        </tr>

                        <tr style="background:#fff7ed; font-weight:700;">
                            <td colspan="7" style="padding:8px; border:1px solid #e2e8f0;">
                                Total Refund
                            </td>
                            <td colspan="2" style="padding:8px; border:1px solid #e2e8f0;">
                                Rp ${summary.totalRefund.toLocaleString('id-ID')}
                            </td>
                        </tr>

                        <tr style="background:#fefce8; font-weight:700;">
                            <td colspan="7" style="padding:8px; border:1px solid #e2e8f0;">
                                Total Dikonversi ke Kredit
                            </td>
                            <td colspan="2" style="padding:8px; border:1px solid #e2e8f0;">
                                Rp ${summary.totalCredit.toLocaleString('id-ID')}
                            </td>
                        </tr>

                        <tr style="background:#f1f5f9; font-weight:700;">
                            <td colspan="7" style="padding:8px; border:1px solid #e2e8f0;">
                                Ringkasan Status
                            </td>
                            <td colspan="2" style="padding:8px; border:1px solid #e2e8f0;">
                                Pending: ${summary.pendingCount} |
                                Paid: ${summary.paidCount} |
                                Finished: ${summary.finishedCount} |
                                Refund: ${summary.refundCount} |
                                Credit: ${summary.creditCount}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
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
        <style>
            @page {
                size: A4 landscape;
                margin: 8mm;
            }

            @media print {
                body {
                    background: white !important;
                }

                .laporan-print-wrapper {
                    width: 100% !important;
                    max-width: 100% !important;
                }

                .laporan-print-wrapper h3 {
                    font-size: 16px !important;
                    margin-bottom: 4px !important;
                }

                .laporan-print-wrapper p {
                    font-size: 11px !important;
                    margin-bottom: 8px !important;
                }

                .laporan-table-compact {
                    width: 100% !important;
                    table-layout: fixed !important;
                    border-collapse: collapse !important;
                    font-size: 8.5px !important;
                }

                .laporan-table-compact th,
                .laporan-table-compact td {
                    padding: 4px !important;
                    line-height: 1.25 !important;
                    word-break: break-word !important;
                    white-space: normal !important;
                }

                .laporan-table-compact .badge,
                .laporan-table-compact span.badge {
                    font-size: 7.5px !important;
                    padding: 3px 5px !important;
                    border-radius: 999px !important;
                    white-space: nowrap !important;
                }
            }
        </style>

        <div style="font-family: Arial, sans-serif; padding: 0;">
            <h2 style="text-align:center; margin:0 0 3px; font-size:18px;">
                PSHUB RENTAL
            </h2>
            <h3 style="text-align:center; margin:0 0 8px; font-size:14px;">
                Laporan Harian Reservasi dan Transaksi
            </h3>
            <p style="margin:0 0 8px; font-size:11px;">
                Tanggal: <strong>${escapeHtml(date)}</strong>
            </p>
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