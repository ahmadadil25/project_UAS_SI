let unitsData = [];
let currentBookingsData = [];
let currentReservationId = null;
let currentTotal = 0;
let userCredit = 0; 

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
        selectUnit(unitsData[0], firstUnitCard, false); // false = jangan pop-up di awal load
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
        div.onclick = () => selectUnit(unit, div, true); // true = munculkan pop up saat diklik
        
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

// Fungsi ketika unit diklik
function selectUnit(unit, el, showPopup = false) {
    document.querySelectorAll('.unit-card').forEach(card => card.classList.remove('selected'));
    if(el) el.classList.add('selected');
    
    document.getElementById('selectedUnitId').value = unit.id;
    document.getElementById('selectedUnitPrice').value = unit.price_per_hour;
    calculatePrice();

    // Munculkan Pop-up jika ditekan oleh pelanggan
    if (showPopup) {
        openModal(unit);
    }
}

// ==========================================
// LOGIKA POP-UP MODAL
// ==========================================
function openModal(unit) {
    if(!unit) return;
    const modal = document.getElementById('scheduleModal');
    const title = document.getElementById('modalTitle');
    const list = document.getElementById('modalList');
    
    title.innerText = `Rincian ${unit.unit_code}`;
    
    // Filter booking berdasarkan unit yang diklik
    const unitBookings = currentBookingsData.filter(r => r.unit_id === unit.id);
    
    list.innerHTML = '';
    if(unitBookings.length === 0) {
        list.innerHTML = `<li style="color: var(--success); font-weight:bold; list-style:none; margin-left:-20px; text-align:center;">✅ Kosong seharian, jam berapapun bebas dipesan!</li>`;
    } else {
        unitBookings.forEach(b => {
            list.innerHTML += `<li>Terisi pada jam: <strong style="color: var(--danger);">${b.start_time.substring(0,5)} - ${b.end_time.substring(0,5)}</strong></li>`;
        });
    }
    
    // Tampilkan animasi pop up
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('scheduleModal').style.display = 'none';
}

// Fitur tambahan: Klik di area luar kotak putih untuk menutup modal
window.onclick = function(event) {
    const modal = document.getElementById('scheduleModal');
    if (event.target === modal) {
        closeModal();
    }
}


// ==========================================
// STATUS CARD SINGKAT 
// ==========================================
async function checkUnitStatuses() {
    const playDate = document.getElementById('playDate').value;
    if(!playDate) return;

    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`status-${unit.id}`);
        if(statusDiv) statusDiv.innerHTML = `<small style="color: gray;">Memuat...</small>`;
    });

    const { data, error } = await supabase
        .from('reservations')
        .select('unit_id, start_time, end_time')
        .eq('play_date', playDate)
        .in('reservation_status', ['pending_payment', 'paid'])
        .order('start_time', { ascending: true });

    if (error) return console.error(error);
    currentBookingsData = data; // Simpan data ke memori agar bisa dibaca modal

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHourStr = now.toTimeString().substring(0, 5); 

    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`status-${unit.id}`);
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

// ==========================================
// LOGIKA FORM & DB (Tetap Sama)
// ==========================================
document.getElementById('custPhone').addEventListener('blur', async (e) => {
    const phone = e.target.value;
    if(phone.length > 5) {
        const { data, error } = await supabase.from('credits').select('amount').eq('phone', phone).eq('credit_status', 'unused');
        if (error) return;
        
        userCredit = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const creditDisplay = document.getElementById('creditAvailableDisplay');
        
        if(userCredit > 0) {
            creditDisplay.style.display = 'block';
            creditDisplay.innerText = `🎁 Saldo kredit terpakai: Rp ${userCredit.toLocaleString()}`;
        } else {
            creditDisplay.style.display = 'none';
        }
        calculatePrice();
    }
});

function calculatePrice() {
    const price = document.getElementById('selectedUnitPrice').value || 0;
    const duration = document.getElementById('duration').value || 1; 
    currentTotal = price * duration;
    
    let finalPay = currentTotal - userCredit;
    if(finalPay < 0) finalPay = 0;

    document.getElementById('totalPriceDisplay').innerText = `Total Tagihan: Rp ${finalPay.toLocaleString()}`;
}

function addHours(timeStr, hours) {
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(Number(h) + Number(hours), Number(m));
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

async function handleReservation(e) {
    e.preventDefault();
    const unitId = document.getElementById('selectedUnitId').value;
    const playDate = document.getElementById('playDate').value;
    const startTimeStr = document.getElementById('startTime').value;
    const duration = document.getElementById('duration').value;
    
    const startTime = startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr;
    const endTime = addHours(startTime, duration);

    document.getElementById('btnSubmitForm').disabled = true;
    document.getElementById('btnSubmitForm').innerText = "Memproses...";

    const { data: conflicts, error: conflictErr } = await supabase
        .from('reservations')
        .select('id')
        .eq('unit_id', unitId)
        .eq('play_date', playDate)
        .in('reservation_status', ['pending_payment', 'paid'])
        .lt('start_time', endTime)
        .gt('end_time', startTime);

    if (conflictErr) {
        alert("Gagal mengecek jadwal!");
        resetBtn(); return;
    }

    if (conflicts && conflicts.length > 0) {
        alert(`❌ MAAF! Unit pada jam tersebut sudah dipesan. Silakan cek rincian jadwal dan pilih jam lain.`);
        resetBtn(); return;
    }

    const bookingCode = 'PS' + Math.random().toString(36).substr(2, 5).toUpperCase();
    
    const { data, error } = await supabase.from('reservations').insert([{
        booking_code: bookingCode,
        customer_name: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        unit_id: unitId,
        play_date: playDate,
        start_time: startTime,
        end_time: endTime,
        duration_hours: duration,
        total_price: currentTotal
    }]).select();

    if (error) {
        alert("Gagal membuat reservasi: " + error.message);
        resetBtn(); return;
    }

    currentReservationId = data[0].id;
    
    let finalPay = currentTotal - userCredit;
    if(finalPay <= 0) {
        processPayment(0, "Kredit Penuh");
    } else {
        document.getElementById('qrisAmount').innerText = `Rp ${finalPay.toLocaleString()}`;
        document.getElementById('qrisBookingCode').innerText = bookingCode;
        resetBtn();
        showSection('payment');
    }
}

function resetBtn() {
    document.getElementById('btnSubmitForm').disabled = false;
    document.getElementById('btnSubmitForm').innerText = "Lanjut Pembayaran";
}

async function confirmPayment() {
    let finalPay = currentTotal - userCredit;
    await processPayment(finalPay, "QRIS");
}

async function processPayment(amount, method) {
    await supabase.from('payments').insert([{
        reservation_id: currentReservationId,
        amount: amount,
        payment_method: method
    }]);

    await supabase.from('reservations')
        .update({ reservation_status: 'paid', payment_status: 'paid' })
        .eq('id', currentReservationId);

    if(userCredit > 0) {
        const phone = document.getElementById('custPhone').value;
        await supabase.from('credits')
            .update({ credit_status: 'used', used_at: new Date() })
            .eq('phone', phone)
            .eq('credit_status', 'unused');
    }

    const { data } = await supabase.from('reservations').select('booking_code').eq('id', currentReservationId);
    document.getElementById('finalBookingCode').innerText = data[0].booking_code;
    showSection('success');
}

async function checkReservation() {
    const phone = document.getElementById('checkPhone').value;
    if(!phone) return alert("Nomor HP wajib diisi!");

    const { data, error } = await supabase.from('reservations').select('*, playstation_units(unit_code)').eq('phone', phone).order('created_at', { ascending: false });
    const resultDiv = document.getElementById('checkResult');
    
    if(!data || data.length === 0) return resultDiv.innerHTML = "<p>Data tidak ditemukan. Pastikan Nomor HP benar.</p>";

    let html = '<table><tr><th>Kode</th><th>Unit</th><th>Tanggal</th><th>Jam</th><th>Status</th><th>Aksi</th></tr>';
    data.forEach(r => {
        let btnStr = '';
        if(r.reservation_status === 'paid' || r.reservation_status === 'pending_payment') {
            btnStr = `<button class="btn btn-danger" style="padding:5px;" onclick='cancelReservation(${JSON.stringify(r)})'>Batalkan</button>`;
        }
        let statusBadge = r.reservation_status === 'paid' ? 'badge-paid' : 
                         (r.reservation_status === 'cancelled_refund' || r.reservation_status === 'converted_to_credit' ? 'badge-cancelled' : 'badge-pending');

        html += `<tr>
            <td><strong>${r.booking_code}</strong></td>
            <td>${r.playstation_units.unit_code}</td>
            <td>${r.play_date}</td>
            <td>${r.start_time.substring(0,5)} - ${r.end_time.substring(0,5)}</td>
            <td><span class="badge ${statusBadge}">${r.reservation_status}</span></td>
            <td>${btnStr}</td>
        </tr>`;
    });
    html += '</table>';
    resultDiv.innerHTML = html;
}

async function cancelReservation(reservation) {
    if(!confirm("Yakin ingin membatalkan reservasi ini?")) return;

    const playDateTime = new Date(`${reservation.play_date}T${reservation.start_time}`);
    const now = new Date();
    const diffHours = (playDateTime - now) / (1000 * 60 * 60);

    let newStatus = '';
    let message = '';

    if (diffHours >= 1) {
        newStatus = 'cancelled_refund';
        message = 'Reservasi dibatalkan. Dana akan di-refund.';
    } else {
        newStatus = 'converted_to_credit';
        message = 'Dibatalkan kurang dari 1 jam. Nominal diubah menjadi saldo kredit.';
        await supabase.from('credits').insert([{ reservation_id: reservation.id, phone: reservation.phone, amount: reservation.total_price }]);
    }

    await supabase.from('reservations').update({ reservation_status: newStatus }).eq('id', reservation.id);
    alert(message);
    checkReservation(); 
}

// REALTIME
supabase.channel('public:reservations')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
      checkUnitStatuses();
  })
  .subscribe();