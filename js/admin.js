let allReservations = [];

// Cek Status Login saat halaman dibuka
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
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPass').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert("Login Gagal: " + error.message);
    } else {
        location.reload(); 
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    location.reload();
}

function switchTab(tabId, btnId) {
    // Sembunyikan semua tab & nonaktifkan semua tombol nav
    document.querySelectorAll('.admin-tab').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Tampilkan tab target & aktifkan tombolnya
    document.getElementById(tabId).style.display = 'block';
    document.getElementById(btnId).classList.add('active');
}

async function loadAdminData() {
    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .order('play_date', { ascending: false })
        .order('start_time', { ascending: false });

    if (error) return console.error(error);
    allReservations = data;

    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';
    
    let todayCount = 0;
    let todayRevenue = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    data.forEach(r => {
        // Hitung Statistik Dashboard
        if (r.play_date === todayStr) {
            todayCount++;
            if(r.reservation_status === 'paid' || r.reservation_status === 'finished') {
                todayRevenue += r.total_price;
            }
        }

        // Tampilkan di Tabel
        tbody.innerHTML += `
            <tr>
                <td><strong>${r.booking_code}</strong></td>
                <td>${r.customer_name}<br><small>${r.phone}</small></td>
                <td>${r.playstation_units.unit_code}</td>
                <td>${r.play_date}<br><small>${r.start_time.substring(0,5)} - ${r.end_time.substring(0,5)}</small></td>
                <td>Rp ${r.total_price.toLocaleString()}</td>
                <td>
                    <select class="status-dropdown" onchange="updateStatus('${r.id}', this.value)">
                        <option value="pending_payment" ${r.reservation_status === 'pending_payment' ? 'selected' : ''}>Pending</option>
                        <option value="paid" ${r.reservation_status === 'paid' ? 'selected' : ''}>Paid</option>
                        <option value="finished" ${r.reservation_status === 'finished' ? 'selected' : ''}>Finished</option>
                        <option value="cancelled_refund" ${r.reservation_status === 'cancelled_refund' ? 'selected' : ''}>Refund</option>
                        <option value="converted_to_credit" ${r.reservation_status === 'converted_to_credit' ? 'selected' : ''}>Credit</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="alert('Kode Booking: ${r.booking_code}')">Detail</button>
                </td>
            </tr>
        `;
    });

    document.getElementById('todayCount').innerText = todayCount;
    document.getElementById('todayRevenue').innerText = `Rp ${todayRevenue.toLocaleString()}`;
}

async function loadCreditData() {
    const { data, error } = await supabase.from('credits').select('*').order('created_at', { ascending: false });
    if (error) return;

    const tbody = document.getElementById('kreditTableBody');
    tbody.innerHTML = '';
    
    data.forEach(c => {
        let statusBadge = c.credit_status === 'unused' ? '<span class="badge badge-paid">Tersedia</span>' : '<span class="badge badge-cancelled">Sudah Pakai</span>';
        tbody.innerHTML += `
            <tr>
                <td>${c.phone}</td>
                <td><strong>Rp ${c.amount.toLocaleString()}</strong></td>
                <td>${statusBadge}</td>
                <td><small>${new Date(c.created_at).toLocaleDateString('id-ID')}</small></td>
            </tr>
        `;
    });
}

async function updateStatus(id, newStatus) {
    const { error } = await supabase.from('reservations').update({ reservation_status: newStatus }).eq('id', id);
    if(error) alert("Gagal update: " + error.message);
    else loadAdminData(); // Auto-refresh dashboard
}

function cetakLaporanHarian() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayData = allReservations.filter(r => r.play_date === todayStr && (r.reservation_status === 'paid' || r.reservation_status === 'finished'));

    let total = 0;
    let rows = todayData.map((r, i) => {
        total += r.total_price;
        return `<tr>
            <td style="border:1px solid #ddd; padding:8px;">${i+1}</td>
            <td style="border:1px solid #ddd; padding:8px;">${r.booking_code}</td>
            <td style="border:1px solid #ddd; padding:8px;">${r.playstation_units.unit_code}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:right;">Rp ${r.total_price.toLocaleString()}</td>
        </tr>`;
    }).join('');

    document.getElementById('printArea').innerHTML = `
        <h1 style="text-align:center;">Laporan Pendapatan Rental PS</h1>
        <p style="text-align:center;">Tanggal: ${todayStr}</p>
        <table style="width:100%; border-collapse:collapse; margin-top:20px;">
            <thead style="background:#f4f4f4;">
                <tr>
                    <th style="border:1px solid #ddd; padding:8px;">No</th>
                    <th style="border:1px solid #ddd; padding:8px;">Booking</th>
                    <th style="border:1px solid #ddd; padding:8px;">Unit</th>
                    <th style="border:1px solid #ddd; padding:8px; text-align:right;">Nominal</th>
                </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;">Tidak ada data</td></tr>'}</tbody>
            <tfoot>
                <tr>
                    <th colspan="3" style="text-align:right; border:1px solid #ddd; padding:8px;">TOTAL PENDAPATAN:</th>
                    <th style="border:1px solid #ddd; padding:8px; text-align:right;">Rp ${total.toLocaleString()}</th>
                </tr>
            </tfoot>
        </table>
    `;
    window.print();
}