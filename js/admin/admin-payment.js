// admin-payment.js
// Berisi fungsi untuk menampilkan data pembayaran pelanggan.
// Data diambil dari tabel payments, lalu dicocokkan dengan tabel reservations.

async function loadPaymentData() {
    const tbody = document.getElementById('paymentTableBody');
    const totalPaymentText = document.getElementById('totalPaymentAmount');
    const totalPaymentCount = document.getElementById('totalPaymentCount');

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align:center; padding:20px;">
                Memuat data pembayaran...
            </td>
        </tr>
    `;

    try {
        const payments = await fetchPayments();
        const rows = await mergePaymentsWithReservations(payments);

        window.adminState.paymentsData = rows;

        const filterDate = document.getElementById('paymentFilterDate')?.value || '';
        const filterMethod = document.getElementById('paymentFilterMethod')?.value || 'all';

        let filteredRows = rows;

        if (filterDate) {
            filteredRows = filteredRows.filter(row => {
                const dateSource = row.payment.created_at || row.reservation?.play_date || '';
                return formatDateOnly(dateSource) === filterDate;
            });
        }

        if (filterMethod !== 'all') {
            filteredRows = filteredRows.filter(row => {
                return String(row.payment.payment_method || '').toLowerCase() === filterMethod.toLowerCase();
            });
        }

        renderPaymentTable(filteredRows);

        const totalAmount = filteredRows.reduce((sum, row) => {
            return sum + Number(row.payment.amount || 0);
        }, 0);

        if (totalPaymentText) {
            totalPaymentText.innerText = `Rp ${totalAmount.toLocaleString()}`;
        }

        if (totalPaymentCount) {
            totalPaymentCount.innerText = filteredRows.length;
        }

    } catch (err) {
        console.error(err);

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:20px; color:red;">
                    Gagal memuat data pembayaran: ${escapeHtml(err.message)}
                </td>
            </tr>
        `;
    }
}

async function fetchPayments() {
    let result = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

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

function renderPaymentTable(rows) {
    const tbody = document.getElementById('paymentTableBody');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:20px;">
                    Belum ada data pembayaran.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    rows.forEach(row => {
        const payment = row.payment;
        const reservation = row.reservation;

        const bookingCode = reservation?.booking_code || '-';
        const customerName = reservation?.customer_name || '-';
        const phone = reservation?.phone || '-';
        const unitCode = reservation?.playstation_units?.unit_code || '-';
        const playDate = reservation?.play_date || '-';
        const startTime = reservation?.start_time ? formatTime(paymentSafe(reservation.start_time)) : '-';
        const endTime = reservation?.end_time ? formatTime(paymentSafe(reservation.end_time)) : '-';
        const status = reservation?.reservation_status || '-';

        tbody.innerHTML += `
            <tr>
                <td>
                    <strong>${escapeHtml(bookingCode)}</strong><br>
                    <small>${escapeHtml(unitCode)}</small>
                </td>

                <td>
                    ${escapeHtml(customerName)}<br>
                    <small>${escapeHtml(phone)}</small>
                </td>

                <td>
                    ${escapeHtml(playDate)}<br>
                    <small>${escapeHtml(startTime)} - ${escapeHtml(endTime)}</small>
                </td>

                <td>
                    <span class="badge badge-paid">
                        ${escapeHtml(payment.payment_method || '-')}
                    </span>
                </td>

                <td>
                    <strong>Rp ${Number(payment.amount || 0).toLocaleString()}</strong>
                </td>

                <td>
                    <span class="badge ${getPaymentReservationBadge(status)}">
                        ${getPaymentReservationLabel(status)}
                    </span>
                </td>

                <td>
                    ${formatPaymentDate(payment.created_at)}
                </td>
            </tr>
        `;
    });
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

    if (String(value).length >= 10 && String(value).includes('-')) {
        return String(value).substring(0, 10);
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

function paymentSafe(value) {
    if (value === null || value === undefined) return '';
    return value;
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