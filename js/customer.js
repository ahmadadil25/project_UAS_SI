let unitsData = [];
let currentBookingsData = [];
let currentTotal = 0;
let userCredit = 0; 
let tempReservationData = null; // Variabel baru untuk menyimpan data sementara sebelum dibayar

function showSection(id) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

window.onload = async () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('playDate').value = today;
    document.getElementById('playDate').addEventListener('change', checkUnitStatuses);
    
    await loadUnits();
};

async function loadUnits() {
    const { data, error } = await supabase.from('playstation_units').select('*').order('unit_code');
    if (error) return alert("Gagal load database!");
    
    unitsData = data;
    renderUnits();

    if(unitsData.length > 0) {
        const firstUnitCard = document.getElementById(`card-${unitsData[0].id}`);
        selectUnit(unitsData[0], firstUnitCard, false);
    }
    checkUnitStatuses();
}

function renderUnits() {
    const container = document.getElementById('unitContainer');
    container.innerHTML = '';
    unitsData.forEach(unit => {
        const div = document.createElement('div');
        div.className = 'unit-card';
        div.id = `card-${unit.id}`;
        div.onclick = () => selectUnit(unit, div, true);
        
        div.innerHTML = `
            <div>
                <strong>${unit.unit_code}</strong><br>
                <span class="price-tag">Rp ${unit.price_per_hour.toLocaleString()}/jam</span>
            </div>
            <div class="unit-status" id="status-${unit.id}">
                <small style="color: gray;">Memuat status...</small>
            </div>
        `;
        container.appendChild(div);
    });
}

function selectUnit(unit, el, showPopup = false) {
    document.querySelectorAll('.unit-card').forEach(card => card.classList.remove('selected'));
    if(el) {
        el.classList.add('selected');
        // Update teks tombol unit terpilih
        document.querySelectorAll('.uc-btn').forEach(btn => btn.innerText = "Pilih Unit Ini");
        el.querySelector('.uc-btn').innerText = "Unit Terpilih";
    }
    
    document.getElementById('selectedUnitId').value = unit.id;
    document.getElementById('selectedUnitPrice').value = unit.price_per_hour;
    document.getElementById('summaryUnitCode').innerText = unit.unit_code;
    calculatePrice();

    if (showPopup) openModal(unit);
}

function openModal(unit) {
    if(!unit) return;
    const modal = document.getElementById('scheduleModal');
    const title = document.getElementById('modalTitle');
    const list = document.getElementById('modalList');
    
    title.innerText = `Rincian ${unit.unit_code}`;
    const unitBookings = currentBookingsData.filter(r => r.unit_id === unit.id);
    
    list.innerHTML = '';
    if(unitBookings.length === 0) {
        list.innerHTML = `<li style="color: var(--success); font-weight:bold; list-style:none; margin-left:-20px; text-align:center;">✅ Kosong seharian, jam berapapun bebas dipesan!</li>`;
    } else {
        unitBookings.forEach(b => {
            list.innerHTML += `<li>Terisi pada jam: <strong style="color: var(--danger);">${b.start_time.substring(0,5)} - ${b.end_time.substring(0,5)}</strong></li>`;
        });
    }
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('scheduleModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('scheduleModal');
    if (event.target === modal) closeModal();
}

async function checkUnitStatuses() {
    const playDate = document.getElementById('playDate').value;
    if(!playDate) return;

    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`status-${unit.id}`);
        if(statusDiv) statusDiv.innerHTML = `<small style="color: gray;">Memuat...</small>`;
    });

    // PENTING: Hanya baca status yang benar-benar 'paid' 
    const { data, error } = await supabase
        .from('reservations')
        .select('unit_id, start_time, end_time')
        .eq('play_date', playDate)
        .eq('reservation_status', 'paid')
        .order('start_time', { ascending: true });

    if (error) return console.error(error);
    currentBookingsData = data; 

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHourStr = now.toTimeString().substring(0, 5); 

    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`status-${unit.id}`);
        if(!statusDiv) return;

        const unitBookings = data.filter(r => r.unit_id === unit.id);
        
        if (unitBookings.length === 0) {
            statusDiv.className = "uc-badge badge-available";
            statusDiv.innerText = "TERSEDIA";
        } else {
            if (playDate === todayStr) {
                let ongoing = unitBookings.find(b => currentHourStr >= b.start_time.substring(0,5) && currentHourStr < b.end_time.substring(0,5));
                if (ongoing) {
                    statusDiv.className = "uc-badge badge-used";
                    statusDiv.innerText = `DIPAKAI SD ${ongoing.end_time.substring(0,5)}`;
                } else {
                    statusDiv.className = "uc-badge badge-booked";
                    statusDiv.innerText = "ADA JADWAL";
                }
            } else {
                statusDiv.className = "uc-badge badge-booked";
                statusDiv.innerText = "ADA JADWAL";
            }
        }
    });
}

function calculatePrice() {
    const price = document.getElementById('selectedUnitPrice').value || 0;
    const duration = document.getElementById('duration').value || 1; 
    currentTotal = price * duration;
    
    document.getElementById('summaryDuration').innerText = duration;
    document.getElementById('summarySubtotal').innerText = `Rp ${currentTotal.toLocaleString()}`;
    document.getElementById('totalPriceDisplay').innerText = `Rp ${currentTotal.toLocaleString()}`;
}

function addHours(timeStr, hours) {
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(Number(h) + Number(hours), Number(m));
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

// PROSES SUBMIT (TIDAK MASUK DATABASE, HANYA SIMPAN DI MEMORI)
async function handleReservation(e) {
    e.preventDefault();
    const unitId = document.getElementById('selectedUnitId').value;
    const playDate = document.getElementById('playDate').value;
    const startTimeStr = document.getElementById('startTime').value;
    const duration = document.getElementById('duration').value;
    const phone = document.getElementById('custPhone').value;
    const custName = document.getElementById('custName').value;
    
    const startTime = startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr;
    const endTime = addHours(startTime, duration);

    document.getElementById('btnSubmitForm').disabled = true;
    document.getElementById('btnSubmitForm').innerText = "Memproses...";

    // Cek ketersediaan awal (siapa tau udah diisi orang lain)
    const { data: conflicts, error: conflictErr } = await supabase
        .from('reservations')
        .select('id')
        .eq('unit_id', unitId)
        .eq('play_date', playDate)
        .eq('reservation_status', 'paid') 
        .lt('start_time', endTime)
        .gt('end_time', startTime);

    if (conflictErr || (conflicts && conflicts.length > 0)) {
        alert(`❌ MAAF! Unit pada jam tersebut sudah dipesan. Silakan cek rincian jadwal dan pilih jam lain.`);
        resetBtn(); return;
    }

    const bookingCode = 'PS' + Math.random().toString(36).substr(2, 5).toUpperCase();
    
    // SIMPAN DATA SEMENTARA DI MEMORI LOKAL (TIDAK KE SUPABASE)
    tempReservationData = {
        booking_code: bookingCode,
        customer_name: custName,
        phone: phone,
        unit_id: unitId,
        play_date: playDate,
        start_time: startTime,
        end_time: endTime,
        duration_hours: duration,
        total_price: currentTotal
    };
    
    const { data: creditData } = await supabase.from('credits').select('amount').eq('phone', phone).eq('credit_status', 'unused');
    userCredit = creditData ? creditData.reduce((acc, curr) => acc + Number(curr.amount), 0) : 0;

    const creditOpt = document.getElementById('creditOption');
    
    if (userCredit >= currentTotal) {
        creditOpt.innerText = `Gunakan Saldo Kredit (Ada Rp ${userCredit.toLocaleString()})`;
        creditOpt.disabled = false;
    } else if (userCredit > 0) {
        creditOpt.innerText = `Kredit Tidak Cukup (Hanya Rp ${userCredit.toLocaleString()})`;
        creditOpt.disabled = true;
    } else {
        creditOpt.innerText = `Saldo Kredit Tidak Tersedia (Rp 0)`;
        creditOpt.disabled = true;
    }

    document.getElementById('paymentMethod').value = 'qris';
    document.getElementById('qrisBookingCode').innerText = bookingCode;
    
    togglePaymentView(); 
    resetBtn();
    showSection('payment');
}

function togglePaymentView() {
    const method = document.getElementById('paymentMethod').value;
    
    // Ambil elemen dengan aman
    const qrisBox = document.getElementById('qrisBoxContainer');
    const btnConfirm = document.getElementById('btnConfirmPayment');
    const btnShow = document.getElementById('btnShowQris');

    // Update nominal
    const amountDisplay = document.getElementById('qrisAmount');
    if (amountDisplay) amountDisplay.innerText = `Rp ${currentTotal.toLocaleString()}`;

    if (method === 'credit') {
        if (qrisBox) qrisBox.style.display = 'none';
        if (btnShow) btnShow.style.display = 'none';
        
        if (btnConfirm) {
            btnConfirm.style.display = 'flex';
            btnConfirm.innerHTML = `<i data-lucide="wallet"></i> Konfirmasi Pakai Kredit`;
            btnConfirm.className = "btn btn-primary full-width";
        }
    } else {
        if (qrisBox) qrisBox.style.display = 'flex'; 
        if (btnShow) btnShow.style.display = 'none'; // Tombol lama sudah tidak dipakai
        
        if (btnConfirm) {
            btnConfirm.style.display = 'flex';
            btnConfirm.innerHTML = `<i data-lucide="check-circle"></i> Saya Sudah Bayar`;
            btnConfirm.className = "btn btn-primary full-width";
        }
    }
    
    // Refresh icon dari Lucide setelah mengubah innerHTML
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function showQrisBox() {
    document.getElementById('btnShowQris').style.display = 'none';
    document.getElementById('qrisBoxContainer').style.display = 'block';
    document.getElementById('btnConfirmPayment').style.display = 'block';
}

function resetBtn() {
    document.getElementById('btnSubmitForm').disabled = false;
    document.getElementById('btnSubmitForm').innerText = "Lanjut Pembayaran";
}

async function confirmPayment() {
    const method = document.getElementById('paymentMethod').value;
    let amountPaid = currentTotal;
    let dbMethod = "QRIS";

    if (method === 'credit') {
        amountPaid = 0; 
        dbMethod = "Kredit Saldo";
    }
    
    await processPayment(amountPaid, dbMethod);
}

// PROSES INSERT KE DATABASE SETELAH KLIK BAYAR
async function processPayment(amountPaid, methodInfo) {
    document.getElementById('btnConfirmPayment').innerText = "Memproses...";
    document.getElementById('btnConfirmPayment').disabled = true;

    // 1. CEK ULANG BENTROK (Siapa tau ada yang bayar duluan pas kita lagi di halaman QRIS)
    const { data: conflicts } = await supabase
        .from('reservations')
        .select('id')
        .eq('unit_id', tempReservationData.unit_id)
        .eq('play_date', tempReservationData.play_date)
        .eq('reservation_status', 'paid')
        .lt('start_time', tempReservationData.end_time)
        .gt('end_time', tempReservationData.start_time);

    if (conflicts && conflicts.length > 0) {
        alert("❌ YAH KEDULUAN! Saat Anda di halaman pembayaran, jadwal ini baru saja dibayar orang lain. Silakan pilih jadwal lain.");
        location.reload(); 
        return;
    }

    // 2. INSERT RESERVASI KE DATABASE (Status Langsung Paid)
    const { data: resData, error: resErr } = await supabase.from('reservations').insert([{
        booking_code: tempReservationData.booking_code,
        customer_name: tempReservationData.customer_name,
        phone: tempReservationData.phone,
        unit_id: tempReservationData.unit_id,
        play_date: tempReservationData.play_date,
        start_time: tempReservationData.start_time,
        end_time: tempReservationData.end_time,
        duration_hours: tempReservationData.duration_hours,
        total_price: tempReservationData.total_price,
        reservation_status: 'paid', // Langsung masuk sebagai paid
        payment_status: 'paid'
    }]).select();

    if (resErr) {
        alert("Gagal memproses pembayaran: " + resErr.message);
        document.getElementById('btnConfirmPayment').disabled = false;
        document.getElementById('btnConfirmPayment').innerText = "Coba Lagi";
        return;
    }

    const newReservationId = resData[0].id;

    // 3. INSERT DATA PEMBAYARAN
    await supabase.from('payments').insert([{
        reservation_id: newReservationId,
        amount: amountPaid,
        payment_method: methodInfo
    }]);

    // 4. POTONG SALDO KREDIT (Jika pakai opsi kredit)
    if(document.getElementById('paymentMethod').value === 'credit') {
        await supabase.from('credits')
            .update({ credit_status: 'used', used_at: new Date() })
            .eq('phone', tempReservationData.phone)
            .eq('credit_status', 'unused');
            
        let remainder = userCredit - currentTotal;
        if (remainder > 0) {
            await supabase.from('credits').insert([{
                phone: tempReservationData.phone,
                amount: remainder,
                reservation_id: newReservationId 
            }]);
        }
    }

    const d = new Date();
    const timeStr = d.toLocaleDateString('id-ID') + ', ' + d.toLocaleTimeString('id-ID').substring(0,5);
    
    document.getElementById('succMethod').innerText = methodInfo;
    document.getElementById('succTime').innerText = timeStr;
    document.getElementById('succTotal').innerText = `Rp ${tempReservationData.total_price.toLocaleString()}`;
    
    document.getElementById('succName').innerText = tempReservationData.customer_name;
    document.getElementById('succUnit').innerText = document.getElementById('summaryUnitCode').innerText; // Ambil dari UI
    document.getElementById('succDuration').innerText = tempReservationData.duration_hours;
    document.getElementById('succPlayTime').innerText = `${tempReservationData.play_date}, ${tempReservationData.start_time.substring(0,5)} - ${tempReservationData.end_time.substring(0,5)}`;
    document.getElementById('succPhone').innerText = tempReservationData.phone;

    document.getElementById('finalBookingCode').innerText = tempReservationData.booking_code;
    showSection('success');
}

function showPaymentFailed() {
    // Populate data ke halaman gagal
    document.getElementById('failBookingCode').innerText = tempReservationData ? tempReservationData.booking_code : "N/A";
    document.getElementById('failUnitName').innerText = document.getElementById('summaryUnitCode').innerText || "PlayStation Unit";
    document.getElementById('failDuration').innerText = tempReservationData ? tempReservationData.duration_hours : "0";
    document.getElementById('failSubtotal').innerText = `Rp ${(currentTotal || 0).toLocaleString()}`;
    document.getElementById('failTotal').innerText = `Rp ${(currentTotal || 0).toLocaleString()}`;
    
    showSection('failed');
}

async function checkReservation() {
    const booking = document.getElementById('checkBooking').value;
    const phone = document.getElementById('checkPhone').value; // Ambil input nomor HP

    // Validasi: pastikan kedua field terisi
    if(!booking || !phone) {
        return alert("Kode Booking dan Nomor WhatsApp wajib diisi untuk verifikasi data!");
    }

    // Tampilkan loading sederhana pada tombol (opsional)
    const resultDiv = document.getElementById('checkResult');
    resultDiv.innerHTML = "<p class='text-center'>Mencari data...</p>";

    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .eq('booking_code', booking)
        .eq('phone', phone) // Tambahkan filter verifikasi nomor HP
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error(error);
        return resultDiv.innerHTML = "<p class='text-center text-danger'>Terjadi kesalahan koneksi.</p>";
    }
    
    if(!data || data.length === 0) {
        return resultDiv.innerHTML = `
            <div class="text-center" style="padding: 20px;">
                <p>Data tidak ditemukan.</p>
                <small style="color: var(--text-light);">Pastikan kombinasi Kode Booking dan Nomor HP sudah benar.</small>
            </div>
        `;
    }

    // Render tabel hasil (Logika tabel tetap sama seperti sebelumnya)
    let html = '<table><tr><th>Kode</th><th>Unit</th><th>Jadwal</th><th>Harga</th><th>Status</th><th>Aksi</th></tr>';
    data.forEach(r => {
        let btnStr = '';
        if(r.reservation_status === 'paid') {
            btnStr = `<button class="btn-danger" onclick='cancelReservation(${JSON.stringify(r)})'>Batalkan</button>`;
        }
        
        let statusBadge = r.reservation_status === 'paid' ? 'badge-success' : 'badge-gray';

        html += `<tr>
            <td><strong>${r.booking_code}</strong></td>
            <td>${r.playstation_units.unit_code}</td>
            <td><small>${r.play_date}<br>${r.start_time.substring(0,5)} - ${r.end_time.substring(0,5)}</small></td>
            <td>Rp ${r.total_price.toLocaleString()}</td>
            <td><span class="badge ${statusBadge}">${r.reservation_status}</span></td>
            <td>${btnStr}</td>
        </tr>`;
    });
    html += '</table>';
    resultDiv.innerHTML = html;
}

async function cancelReservation(reservation) {
    const warningText = `Yakin ingin membatalkan reservasi ini?\n\nPERINGATAN: Jika dibatalkan kurang dari 1 jam sebelum main, data Nama dan Nomor HP Anda akan disimpan agar nominal Rp ${reservation.total_price.toLocaleString()} yang sudah dibayar bisa dipakai sebagai saldo kredit di pemesanan berikutnya.`;
    
    if(!confirm(warningText)) return;

    const playDateTime = new Date(`${reservation.play_date}T${reservation.start_time}`);
    const now = new Date();
    const diffHours = (playDateTime - now) / (1000 * 60 * 60);

    let newStatus = '';
    let message = '';

    if (diffHours >= 1) {
        newStatus = 'cancelled_refund';
        message = 'Reservasi dibatalkan. Dana akan di-refund secara manual oleh admin.';
    } else {
        newStatus = 'converted_to_credit';
        message = `Pembatalan dilakukan kurang dari 1 jam.\nNominal Rp ${reservation.total_price.toLocaleString()} berhasil diubah menjadi Saldo Kredit!\n\nGunakan Nama dan No HP yang sama untuk memakai saldo ini di pemesanan berikutnya.`;
        await supabase.from('credits').insert([{ reservation_id: reservation.id, phone: reservation.phone, amount: reservation.total_price }]);
    }

    await supabase.from('reservations').update({ reservation_status: newStatus }).eq('id', reservation.id);
    alert(message);
    checkReservation(); 
}

supabase.channel('public:reservations')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
      checkUnitStatuses();
  })
  .subscribe();