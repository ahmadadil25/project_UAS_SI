let allReservations = [];
let unitsData = [];
let walkinTotal = 0;

// 1. INISIALISASI & AUTH
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
    if (document.getElementById('filterDate')) {
        document.getElementById('filterDate').value = today;
    }
    
    await loadWalkinUnits();
    if (document.getElementById('laporanContainer')) {
        loadLaporanByDate(); // Load laporan awal
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('adminEmail').value,
        password: document.getElementById('adminPass').value
    });
    if (error) alert("Login Gagal: " + error.message);
    else location.reload();
}

function handleLogout() {
    supabase.auth.signOut().then(() => location.reload());
}

// 2. NAVIGASI TAB
function switchTab(tabId, btnId) {
    document.querySelectorAll('.admin-tab').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
    const targetBtn = document.getElementById(btnId);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

// 3. DASHBOARD & DATA RESERVASI
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
    
    const todayStr = new Date().toLocaleDateString('en-CA');
    let count = 0, revenue = 0;

    data.forEach(r => {
        if (r.play_date === todayStr) {
            count++;
            if(r.reservation_status === 'paid' || r.reservation_status === 'finished') revenue += r.total_price;
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>${r.booking_code}</strong></td>
                <td>${r.customer_name}<br><small>${r.phone}</small></td>
                <td>${r.playstation_units ? r.playstation_units.unit_code : '-'}</td>
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
                <td><button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="alert('Booking: ${r.booking_code}')">Detail</button></td>
            </tr>`;
    });

    document.getElementById('todayCount').innerText = count;
    document.getElementById('todayRevenue').innerText = `Rp ${revenue.toLocaleString()}`;
}

async function updateStatus(id, status) {
    const { error } = await supabase.from('reservations').update({ reservation_status: status }).eq('id', id);
    if(error) alert("Gagal update status: " + error.message);
    else {
        loadAdminData();
        checkWalkinUnitStatuses(); 
    }
}

// 4. LOGIKA WALK-IN
async function loadWalkinUnits() {
    const { data, error } = await supabase.from('playstation_units').select('*').order('unit_code');
    if (error) return alert("Gagal load unit!");
    
    unitsData = data;
    const container = document.getElementById('walkinUnitContainer');
    if (!container) return;
    container.innerHTML = '';
    
    unitsData.forEach(unit => {
        const div = document.createElement('div');
        div.className = 'unit-card';
        div.id = `walkin-card-${unit.id}`;
        div.innerHTML = `
            <div>
                <strong>${unit.unit_code}</strong><br>
                <span class="price-tag">Rp ${unit.price_per_hour.toLocaleString()}/jam</span>
            </div>
            <div class="unit-status" id="walkin-status-${unit.id}">
                <small style="color: gray;">Memuat status...</small>
            </div>
        `;
        div.onclick = () => {
            document.querySelectorAll('#walkinUnitContainer .unit-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            document.getElementById('selectedUnitId').value = unit.id;
            document.getElementById('selectedUnitPrice').value = unit.price_per_hour;
            calculateWalkinPrice();
        };
        container.appendChild(div);
    });
    checkWalkinUnitStatuses();
}

async function checkWalkinUnitStatuses() {
    const playDate = document.getElementById('playDate').value;
    if(!playDate) return;

    const { data, error } = await supabase
        .from('reservations')
        .select('unit_id, start_time, end_time')
        .eq('play_date', playDate)
        .eq('reservation_status', 'paid');

    if (error) return console.error(error);

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const currentHourStr = now.toTimeString().substring(0, 5); 

    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`walkin-status-${unit.id}`);
        if(!statusDiv) return;

        const unitBookings = data.filter(r => r.unit_id === unit.id);
        if (unitBookings.length === 0) {
            statusDiv.innerHTML = `<span class="text-success">✅ Tersedia</span>`;
        } else {
            if (playDate === todayStr) {
                let ongoing = unitBookings.find(b => currentHourStr >= b.start_time.substring(0,5) && currentHourStr < b.end_time.substring(0,5));
                if (ongoing) statusDiv.innerHTML = `<span class="text-danger">🔴 Terpakai s/d ${ongoing.end_time.substring(0,5)}</span>`;
                else statusDiv.innerHTML = `<span style="color: #d97706; font-weight: bold;">🟡 Ada Jadwal</span>`;
            } else {
                statusDiv.innerHTML = `<span style="color: #d97706; font-weight: bold;">🟡 Ada Jadwal</span>`;
            }
        }
    });
}

function calculateWalkinPrice() {
    const price = document.getElementById('selectedUnitPrice').value || 0;
    const dur = document.getElementById('duration').value || 1;
    walkinTotal = price * dur;
    document.getElementById('totalPriceDisplay').innerText = `Total Tagihan: Rp ${walkinTotal.toLocaleString()}`;
}

async function handleWalkinReservation(e) {
    e.preventDefault();
    const unitId = document.getElementById('selectedUnitId').value;
    if(!unitId) return alert("Pilih unit PS terlebih dahulu!");

    const btn = document.getElementById('btnSubmitWalkin');
    btn.disabled = true;
    btn.innerText = "Memproses...";
    
    const playDate = document.getElementById('playDate').value;
    const startTimeStr = document.getElementById('startTime').value;
    const dur = document.getElementById('duration').value;
    const startTime = startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr;
    
    // Hitung end time
    const [h, m] = startTime.split(':');
    const d = new Date();
    d.setHours(Number(h) + Number(dur), Number(m));
    const endTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

    const bookingCode = 'WINK' + Math.random().toString(36).substr(2, 4).toUpperCase();
    
    const { error } = await supabase.from('reservations').insert([{
        booking_code: bookingCode,
        customer_name: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        unit_id: unitId,
        play_date: playDate,
        start_time: startTime,
        end_time: endTime,
        duration_hours: dur,
        total_price: walkinTotal,
        reservation_status: 'paid',
        payment_status: 'paid'
    }]);

    if (error) alert("Error: " + error.message);
    else {
        alert("✅ Reservasi Walk-in Berhasil!");
        document.getElementById('walkinForm').reset();
        await loadAdminData();
        switchTab('reservasiTab', 'btn-res');
    }
    btn.disabled = false;
    btn.innerText = "Simpan Reservasi (Langsung Paid)";
}

// 5. SALDO KREDIT & LAPORAN
async function loadCreditData() {
    const { data } = await supabase.from('credits').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('kreditTableBody');
    if (!tbody) return;
    tbody.innerHTML = data?.map(c => `<tr><td>${c.phone}</td><td><strong>Rp ${c.amount.toLocaleString()}</strong></td><td>${c.credit_status === 'unused' ? '<span class="badge badge-paid">Tersedia</span>' : '<span class="badge badge-cancelled">Terpakai</span>'}</td></tr>`).join('') || '';
}

async function loadLaporanByDate() {
    const date = document.getElementById('filterDate').value;
    if(!date) return;

    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .eq('play_date', date)
        .in('reservation_status', ['paid', 'finished']);

    if (error) return console.error(error);

    let total = 0;
    const container = document.getElementById('laporanContainer');
    if (!container) return;

    let html = `
        <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 10px; border: 1px solid #ddd;">Booking</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Unit</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Pelanggan</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Total</th>
                </tr>
            </thead>
            <tbody>`;
    
    data.forEach(r => {
        total += r.total_price;
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${r.booking_code}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${r.playstation_units ? r.playstation_units.unit_code : '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${r.customer_name}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">Rp ${r.total_price.toLocaleString()}</td>
            </tr>`;
    });

    html += `
            </tbody>
            <tfoot>
                <tr style="background: #eff6ff; font-weight: bold;">
                    <td colspan="3" style="padding: 10px; border: 1px solid #ddd; text-align: right;">TOTAL PENDAPATAN</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Rp ${total.toLocaleString()}</td>
                </tr>
            </tfoot>
        </table>`;
    
    container.innerHTML = data.length > 0 ? html : "<p style='padding:20px; text-align:center;'>Tidak ada riwayat transaksi pada tanggal ini.</p>";
}

function printLaporan() {
    const date = document.getElementById('filterDate').value;
    const content = document.getElementById('laporanContainer').innerHTML;
    const printArea = document.getElementById('printArea');
    
    printArea.innerHTML = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="text-align:center; margin-bottom: 5px;">VORTEX PS RENTAL</h2>
            <h3 style="text-align:center; margin-top: 0;">Laporan Pendapatan Harian</h3>
            <p>Tanggal: <strong>${date}</strong></p>
            <hr>
            ${content}
        </div>
    `;
    window.print();
}

function cetakLaporanHarian() {
    // Fungsi cepat untuk cetak hari ini dari tab Dashboard/Reservasi
    const today = new Date().toLocaleDateString('en-CA');
    document.getElementById('filterDate').value = today;
    loadLaporanByDate().then(() => {
        switchTab('laporanTab', 'btn-laporan');
    });
}

// 6. REALTIME
supabase.channel('admin:reservations')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
      loadAdminData();
      checkWalkinUnitStatuses();
  }).subscribe();

// 7. EKSPOS GLOBAL (PENTING!)
window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.loadAdminData = loadAdminData;
window.updateStatus = updateStatus;
window.calculateWalkinPrice = calculateWalkinPrice;
window.handleWalkinReservation = handleWalkinReservation;
window.loadLaporanByDate = loadLaporanByDate;
window.printLaporan = printLaporan;
window.cetakLaporanHarian = cetakLaporanHarian;