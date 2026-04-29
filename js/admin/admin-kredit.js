// admin-kredit.js
// Berisi fungsi untuk menampilkan saldo kredit pelanggan.
// Ditampilkan bersama kode booking agar admin mudah melacak asal saldo kredit.

async function loadCreditData() {
    const tbody = document.getElementById('kreditTableBody');

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center; padding:20px;">
                Memuat data saldo kredit...
            </td>
        </tr>
    `;

    try {
        const credits = await fetchCredits();
        const rows = await mergeCreditsWithReservations(credits);

        renderCreditTable(rows);

    } catch (err) {
        console.error(err);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:20px; color:red;">
                    Gagal memuat saldo kredit: ${escapeHtml(err.message)}
                </td>
            </tr>
        `;
    }
}

async function fetchCredits() {
    let result = await supabase
        .from('credits')
        .select('*')
        .order('created_at', { ascending: false });

    if (result.error) {
        result = await supabase
            .from('credits')
            .select('*');
    }

    if (result.error) {
        throw new Error(result.error.message);
    }

    return result.data || [];
}

async function mergeCreditsWithReservations(credits) {
    const reservationIds = [
        ...new Set(
            credits
                .map(credit => credit.reservation_id)
                .filter(Boolean)
        )
    ];

    if (reservationIds.length === 0) {
        return credits.map(credit => ({
            credit,
            reservation: null
        }));
    }

    const { data: reservations, error } = await supabase
        .from('reservations')
        .select('id, booking_code, customer_name, phone, play_date, total_price')
        .in('id', reservationIds);

    if (error) {
        throw new Error(error.message);
    }

    const reservationMap = {};

    (reservations || []).forEach(reservation => {
        reservationMap[reservation.id] = reservation;
    });

    return credits.map(credit => ({
        credit,
        reservation: reservationMap[credit.reservation_id] || null
    }));
}

function renderCreditTable(rows) {
    const tbody = document.getElementById('kreditTableBody');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:20px;">
                    Belum ada data saldo kredit.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    rows.forEach(row => {
        const credit = row.credit;
        const reservation = row.reservation;

        const bookingCode = reservation?.booking_code || '-';
        const customerName = reservation?.customer_name || '-';
        const phone = credit.phone || reservation?.phone || '-';
        const amount = Number(credit.amount || 0);
        const status = credit.credit_status || '-';

        tbody.innerHTML += `
            <tr>
                <td>
                    <strong>${escapeHtml(bookingCode)}</strong><br>
                    <small>${reservation?.play_date ? escapeHtml(reservation.play_date) : '-'}</small>
                </td>

                <td>
                    ${escapeHtml(customerName)}<br>
                    <small>${escapeHtml(phone)}</small>
                </td>

                <td>
                    <strong>Rp ${amount.toLocaleString()}</strong>
                </td>

                <td>
                    <span class="badge ${getCreditBadgeClass(status)}">
                        ${getCreditStatusLabel(status)}
                    </span>
                </td>

                <td>
                    ${formatCreditDate(credit.created_at)}
                </td>
            </tr>
        `;
    });
}

function getCreditStatusLabel(status) {
    const labels = {
        unused: 'Tersedia',
        used: 'Terpakai'
    };

    return labels[status] || status || '-';
}

function getCreditBadgeClass(status) {
    if (status === 'unused') {
        return 'badge-paid';
    }

    if (status === 'used') {
        return 'badge-cancelled';
    }

    return 'badge-pending';
}

function formatCreditDate(value) {
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

function escapeHtml(value) {
    if (value === null || value === undefined) return '';

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

window.loadCreditData = loadCreditData;