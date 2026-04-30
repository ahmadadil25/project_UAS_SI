// admin-payment.js
// Berisi fungsi untuk menampilkan, memfilter, dan merangkum data pembayaran.
// Versi ini dibuat kompatibel dengan ID lama dan ID baru agar filter tanggal berfungsi.

async function loadPaymentData() {
    const tbody = document.getElementById('paymentTableBody');

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align:center; padding:24px;">
                Memuat data pembayaran...
            </td>
        </tr>
    `;

    try {
        const payments = await fetchPayments();
        const rows = await mergePaymentsWithReservations(payments);

        if (!window.adminState) {
            window.adminState = {};
        }

        window.adminState.paymentsData = rows;

        applyPaymentFilters();

    } catch (err) {
        console.error(err);

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:24px; color:red;">
                    Gagal memuat data pembayaran: ${escapeHtml(err.message)}
                </td>
            </tr>
        `;

        updatePaymentSummary([]);
    }
}

async function fetchPayments() {
    let result = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

    // Fallback jika tabel payments belum punya kolom created_at
    if (result.error) {
        result = await supabase
            .from('payments')
            .select('*');
    }

    if (result.error) {
        throw new Error(result.error.message);
    }

    return result.data || [];
}

async function mergePaymentsWithReservations(payments) {
    const reservationIds = [
        ...new Set(
            payments
                .map(payment => payment.reservation_id)
                .filter(Boolean)
        )
    ];

    if (reservationIds.length === 0) {
        return payments.map(payment => ({
            payment,
            reservation: null
        }));
    }

    const { data: reservations, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .in('id', reservationIds);

    if (error) {
        throw new Error(error.message);
    }

    const reservationMap = {};

    (reservations || []).forEach(reservation => {
        reservationMap[reservation.id] = reservation;
    });

    return payments.map(payment => ({
        payment,
        reservation: reservationMap[payment.reservation_id] || null
    }));
}

function applyPaymentFilters() {
    const allRows = window.adminState?.paymentsData || [];

    // Support ID versi lama dan versi baru
    const filterDate = getInputValue(['paymentFilterDate', 'paymentDateFilter']);
    const filterMethod = getInputValue(['paymentFilterMethod', 'paymentMethodFilter']) || 'all';

    let filteredRows = [...allRows];

    if (filterDate) {
        filteredRows = filteredRows.filter(row => {
            const dateSource = getPaymentDateSource(row);
            const paymentDate = formatDateOnly(dateSource);

            return paymentDate === filterDate;
        });
    }

    if (filterMethod !== 'all') {
        filteredRows = filteredRows.filter(row => {
            const method = String(row.payment?.payment_method || '').toLowerCase().trim();
            const selected = String(filterMethod || '').toLowerCase().trim();

            return method === selected;
        });
    }

    renderPaymentTable(filteredRows);
    updatePaymentSummary(filteredRows);
}

function renderPaymentTable(rows) {
    const tbody = document.getElementById('paymentTableBody');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:28px;">
                    Tidak ada data pembayaran sesuai filter.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    rows.forEach(row => {
        const payment = row.payment || {};
        const reservation = row.reservation || {};

        const bookingCode = reservation.booking_code || '-';
        const customerName = reservation.customer_name || '-';
        const phone = reservation.phone || '-';
        const unitCode = reservation.playstation_units?.unit_code || '-';
        const playDate = reservation.play_date || '-';
        const startTime = reservation.start_time ? formatTime(reservation.start_time) : '-';
        const endTime = reservation.end_time ? formatTime(reservation.end_time) : '-';
        const status = reservation.reservation_status || '-';
        const method = payment.payment_method || '-';
        const amount = Number(payment.amount || 0);
        const tanggalBayar = getPaymentDateSource(row);

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="payment-booking-code">
                        ${escapeHtml(bookingCode)}
                    </div>
                    <div class="payment-booking-unit">
                        ${escapeHtml(unitCode)}
                    </div>
                </td>

                <td>
                    <div class="payment-customer-name">
                        ${escapeHtml(customerName)}
                    </div>
                    <div class="payment-customer-phone">
                        ${escapeHtml(phone)}
                    </div>
                </td>

                <td>
                    <div class="payment-time-main">
                        ${escapeHtml(playDate)}
                    </div>
                    <div class="payment-time-sub">
                        ${escapeHtml(startTime)} - ${escapeHtml(endTime)}
                    </div>
                </td>

                <td>
                    <span class="method-pill ${getMethodClass(method)}">
                        ${escapeHtml(method)}
                    </span>
                </td>

                <td>
                    <div class="payment-amount">
                        Rp ${amount.toLocaleString('id-ID')}
                    </div>
                </td>

                <td>
                    <span class="status-pill ${getPaymentReservationBadge(status)}">
                        ${getPaymentReservationLabel(status)}
                    </span>
                </td>

                <td>
                    <div class="payment-date">
                        ${formatPaymentDate(tanggalBayar)}
                    </div>
                </td>
            </tr>
        `;
    });
}

function updatePaymentSummary(rows) {
    const totalCount = rows.length;
    const totalAmount = rows.reduce((sum, row) => {
        return sum + Number(row.payment?.amount || 0);
    }, 0);

    const topMethod = getTopPaymentMethod(rows);

    // Support ID versi lama
    setTextIfExists('totalPaymentCount', totalCount);
    setTextIfExists('totalPaymentAmount', `Rp ${totalAmount.toLocaleString('id-ID')}`);

    // Support ID versi baru
    setTextIfExists('paymentTotalCount', totalCount);
    setTextIfExists('paymentTotalAmount', `Rp ${totalAmount.toLocaleString('id-ID')}`);
    setTextIfExists('paymentTopMethod', topMethod);
}

function getTopPaymentMethod(rows) {
    if (!rows || rows.length === 0) return '-';

    const counter = {};

    rows.forEach(row => {
        const method = row.payment?.payment_method || '-';
        counter[method] = (counter[method] || 0) + 1;
    });

    let topMethod = '-';
    let topCount = 0;

    Object.keys(counter).forEach(method => {
        if (counter[method] > topCount) {
            topCount = counter[method];
            topMethod = method;
        }
    });

    return topMethod;
}

function getPaymentDateSource(row) {
    const payment = row?.payment || {};
    const reservation = row?.reservation || {};

    // Prioritas tanggal bayar:
    // 1. created_at dari payments
    // 2. paid_at jika ada
    // 3. payment_date jika ada
    // 4. created_at dari reservations sebagai fallback
    return (
        payment.created_at ||
        payment.paid_at ||
        payment.payment_date ||
        reservation.created_at ||
        ''
    );
}

function getInputValue(ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el.value || '';
    }

    return '';
}

function setTextIfExists(id, value) {
    const el = document.getElementById(id);

    if (el) {
        el.innerText = value;
    }
}

function getPaymentReservationLabel(status) {
    const labels = {
        pending_payment: 'Pending',
        paid: 'Paid',
        finished: 'Finished',
        cancelled_refund: 'Refund',
        converted_to_credit: 'Credit'
    };

    return labels[status] || status || '-';
}

function getPaymentReservationBadge(status) {
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

function getMethodClass(method) {
    const value = String(method || '').toLowerCase();

    if (value.includes('qris')) return 'qris';
    if (value.includes('cash')) return 'cash';
    if (value.includes('tunai')) return 'cash';
    if (value.includes('walk')) return 'walkin';
    if (value.includes('kredit')) return 'credit';

    return '';
}

function formatPaymentDate(value) {
    if (!value) return '-';

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return escapeHtml(String(value));
    }

    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateOnly(value) {
    if (!value) return '';

    const str = String(value);

    // Kalau formatnya sudah YYYY-MM-DD atau ISO dari Supabase
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const date = new Date(str);

        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-CA');
        }

        return str.substring(0, 10);
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString('en-CA');
}

function formatTime(value) {
    if (!value) return '-';
    return String(value).substring(0, 5);
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

window.loadPaymentData = loadPaymentData;
window.applyPaymentFilters = applyPaymentFilters;