// Cek Sesi Login
window.onload = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'flex';
        loadAdminData();
    }
};

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPass').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert("Login Gagal: " + error.message);
    } else {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'flex';
        loadAdminData();
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
}

async function loadAdminData() {
    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .order('play_date', { ascending: false })
        .order('start_time', { ascending: false });

    if (error) return console.error(error);

    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';
    data.forEach(r => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${r.booking_code}</strong></td>
                <td>${r.customer_name}</td>
                <td>${r.phone}</td>
                <td>${r.playstation_units.unit_code}</td>
                <td>${r.play_date}<br>${r.start_time} - ${r.end_time}</td>
                <td>${r.total_price.toLocaleString()}</td>
                <td>
                    <select onchange="updateStatus('${r.id}', this.value)">
                        <option value="pending_payment" ${r.reservation_status === 'pending_payment' ? 'selected' : ''}>Pending</option>
                        <option value="paid" ${r.reservation_status === 'paid' ? 'selected' : ''}>Paid</option>
                        <option value="finished" ${r.reservation_status === 'finished' ? 'selected' : ''}>Finished</option>
                        <option value="cancelled_refund" ${r.reservation_status === 'cancelled_refund' ? 'selected' : ''}>Refund</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-success" style="padding: 2px 8px;" onclick="alert('Fitur edit detail coming soon')">Detail</button>
                </td>
            </tr>
        `;
    });
}

async function updateStatus(id, newStatus) {
    const { error } = await supabase.from('reservations').update({ reservation_status: newStatus }).eq('id', id);
    if(error) alert("Gagal update status: " + error.message);
    else console.log("Status updated!");
}