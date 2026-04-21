let allReservations = [];
let unitsData = [];
let walkinTotal = 0;
let currentWalkinBookings = []; // Menyimpan data jadwal hari ini untuk walk-in

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
    
    // Set default tanggal hari ini untuk form Walk-in
    const today = new Date().toISOString().split('T')[0];
    const playDateInput = document.getElementById('playDate');
    playDateInput.value = today;
    
    // Trigger perubahan status kalau tanggal diganti
    playDateInput.addEventListener('change', checkWalkinUnitStatuses);
    
    await loadWalkinUnits();
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

function switchTab(tabId, btnId) {
    document.querySelectorAll('.admin-tab').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    document.getElementById(btnId).classList.add('active');
}

// ==========================================
// LOGIKA TABEL RESERVASI & DASHBOARD
// ==========================================
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
    
    const todayStr = new Date().toISOString().split('T')[0];
    let count = 0, revenue = 0;

    data.forEach(r => {
        // Hitung statistik dashboard
        if (r.play_date === todayStr) {
            count++;
            if(r.reservation_status === 'paid' || r.reservation_status === 'finished') revenue += r.total_price;
        }

        // Tampilkan ke tabel
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
        checkWalkinUnitStatuses(); // Refresh status unit card Walk-in
    }
}

// ==========================================
// LOGIKA TAMBAH WALK-IN (Diambil dari customer.js)
// ==========================================
async function loadWalkinUnits() {
    const { data, error } = await supabase.from('playstation_units').select('*').order('unit_code');
    if (error) return alert("Gagal load unit!");
    
    unitsData = data;
    const container = document.getElementById('walkinUnitContainer');
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

    // Reset teks ke Memuat...
    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`walkin-status-${unit.id}`);
        if(statusDiv) statusDiv.innerHTML = `<small style="color: gray;">Memuat...</small>`;
    });

    const { data, error } = await supabase
        .from('reservations')
        .select('unit_id, start_time, end_time')
        .eq('play_date', playDate)
        .in('reservation_status', ['pending_payment', 'paid'])
        .order('start_time', { ascending: true });

    if (error) return console.error(error);
    currentWalkinBookings = data;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
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
                if (ongoing) {
                    statusDiv.innerHTML = `<span class="text-danger">🔴 Terpakai s/d ${ongoing.end_time.substring(0,5)}</span>`;
                } else {
                    statusDiv.innerHTML = `<span style="color: #d97706; font-weight: bold;">🟡 Ada Jadwal</span>`;
                }
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

// Fungsi bantu hitung jam
function addHours(timeStr, hours) {
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(Number(h) + Number(hours), Number(m));
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

async function handleWalkinReservation(e) {
    e.preventDefault();
    const unitId = document.getElementById('selectedUnitId').value;
    if(!unitId) return alert("Pilih unit PS terlebih dahulu dengan mengklik salah satu kotak!");

    const btn = document.getElementById('btnSubmitWalkin');
    btn.disabled = true;
    btn.innerText = "Memproses...";
    
    const playDate = document.getElementById('playDate').value;
    const startTimeStr = document.getElementById('startTime').value;
    const dur = document.getElementById('duration').value;
    
    // Pastikan format jam HH:MM:SS untuk disubmit ke database
    const startTime = startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr;
    const endTime = addHours(startTime, dur);
    
    // Cek Bentrok Jadwal (sama dengan customer.js)
    const { data: conflicts, error: conflictErr } = await supabase
        .from('reservations')
        .select('id')
        .eq('unit_id', unitId)
        .eq('play_date', playDate)
        .in('reservation_status', ['pending_payment', 'paid'])
        .lt('start_time', endTime)
        .gt('end_time', startTime);

    if (conflictErr || (conflicts && conflicts.length > 0)) {
        alert(`❌ MAAF! Unit pada jam tersebut sudah dipesan.`);
        btn.disabled = false;
        btn.innerText = "Simpan Reservasi (Langsung Paid)";
        return;
    }

    const bookingCode = 'WINK' + Math.random().toString(36).substr(2, 4).toUpperCase();
    
    const { error } = await supabase.from('reservations').insert([{
        booking_code: bookingCode,
        customer_name: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        unit_id: unitId,
        play_date: playDate,
        start_time: startTime,
        end_time: endTime, // << Ini yang sebelumnya bikin error Not Null Constraint
        duration_hours: dur,
        total_price: walkinTotal,
        reservation_status: 'paid', // Walk-in otomatis Paid
        payment_status: 'paid'
    }]);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("✅ Reservasi Walk-in Berhasil Disimpan!");
        document.getElementById('walkinForm').reset();
        document.getElementById('totalPriceDisplay').innerText = "Total Tagihan: Rp 0";
        document.querySelectorAll('#walkinUnitContainer .unit-card').forEach(c => c.classList.remove('selected'));
        
        await loadAdminData(); // Refresh Data Tabel
        switchTab('reservasiTab', 'btn-res'); // Pindah ke tab Data Reservasi
    }
    
    btn.disabled = false;
    btn.innerText = "Simpan Reservasi (Langsung Paid)";
}

// ==========================================
// LOGIKA TAB SALDO KREDIT & CETAK
// ==========================================
async function loadCreditData() {
    const { data } = await supabase.from('credits').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('kreditTableBody');
    tbody.innerHTML = data?.map(c => {
        let badge = c.credit_status === 'unused' ? '<span class="badge badge-paid">Tersedia</span>' : '<span class="badge badge-cancelled">Sudah Pakai</span>';
        return `<tr><td>${c.phone}</td><td><strong>Rp ${c.amount.toLocaleString()}</strong></td><td>${badge}</td></tr>`;
    }).join('') || '<tr><td colspan="3" style="text-align:center;">Belum ada data kredit.</td></tr>';
}

function cetakLaporanHarian() {
    const today = new Date().toISOString().split('T')[0];
    const data = allReservations.filter(r => r.play_date === today && (r.reservation_status === 'paid' || r.reservation_status === 'finished'));
    let total = 0;
    
    let rows = data.map((r, i) => {
        total += r.total_price;
        return `<tr>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${i+1}</td>
            <td style="border:1px solid #ddd; padding:8px;">${r.booking_code}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${r.playstation_units.unit_code}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:right;">Rp ${r.total_price.toLocaleString()}</td>
        </tr>`;
    }).join('');

    document.getElementById('printArea').innerHTML = `
        <h2 style="text-align:center; margin-bottom:5px;">Laporan Pendapatan Rental PS</h2>
        <p style="text-align:center; margin-top:0; color:gray;">Tanggal: ${today}</p>
        <table style="width:100%; border-collapse:collapse; margin-top:20px; font-family:sans-serif;">
            <thead style="background:#f4f4f4;">
                <tr>
                    <th style="border:1px solid #ddd; padding:10px;">No</th>
                    <th style="border:1px solid #ddd; padding:10px;">Kode Booking</th>
                    <th style="border:1px solid #ddd; padding:10px;">Unit</th>
                    <th style="border:1px solid #ddd; padding:10px; text-align:right;">Nominal</th>
                </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center; padding:15px;">Tidak ada transaksi hari ini</td></tr>'}</tbody>
            <tfoot>
                <tr>
                    <th colspan="3" style="text-align:right; border:1px solid #ddd; padding:10px;">TOTAL PENDAPATAN:</th>
                    <th style="border:1px solid #ddd; padding:10px; text-align:right; color:#16a34a; font-size:18px;">Rp ${total.toLocaleString()}</th>
                </tr>
            </tfoot>
        </table>
    `;
    window.print();
}

// ==========================================
// REALTIME LISTENER SUPABASE
// ==========================================
supabase.channel('admin:reservations')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
      // Refresh status kartu di Walk-in jika ada pesanan baru/perubahan status
      checkWalkinUnitStatuses();
      // Auto-refresh tabel data admin
      loadAdminData(); 
  })
  .subscribe();