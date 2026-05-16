let unitsData = [];
let currentBookingsData = [];
let currentTotal = 0;
let userCredit = 0; 
let tempReservationData = null;
let countdownInterval;

// Helper: Menampilkan toast notifikasi
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// Fungsi pindah halaman (tanpa error event)
function showSection(id) {
    // Sembunyikan semua section
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    
    // Tampilkan yang dituju
    const targetSection = document.getElementById(id);
    if(targetSection) targetSection.classList.add('active');
    
    // Sinkronisasi navigasi atas
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active', 'outline'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.add('outline'));
    
    const activeBtn = document.getElementById(`nav-${id}`);
    if (activeBtn) {
        activeBtn.classList.remove('outline');
        activeBtn.classList.add('active');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.onload = async () => {
    lucide.createIcons();
    const dateInput = document.getElementById('playDate');
    const timeInput = document.getElementById('startTime');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    if (dateInput) {
        dateInput.value = todayStr;
        dateInput.min = todayStr; 
    }

    if (timeInput) {
        timeInput.value = currentTimeStr;
        timeInput.min = currentTimeStr; 
    }

    if (dateInput && timeInput) {
        dateInput.addEventListener('change', (e) => {
            if (e.target.value === todayStr) {
                timeInput.min = currentTimeStr; 
                if (timeInput.value < currentTimeStr) timeInput.value = currentTimeStr;
            } else {
                timeInput.removeAttribute('min');
            }
            checkUnitStatuses(); 
        });
    }
    
    await loadUnits();
};

async function loadUnits() {
    const container = document.getElementById('unitContainer');
    container.innerHTML = '<div class="loading-state">Memuat data konsol...</div>';

    const { data, error } = await supabase.from('playstation_units').select('*').order('unit_code');
    if (error) {
        container.innerHTML = '<div class="error-state">Gagal memuat database. Coba muat ulang halaman.</div>';
        return;
    }
    
    unitsData = data;
    renderUnits();

    // Pilih otomatis unit pertama jika ada
    if(unitsData.length > 0) {
        selectUnit(unitsData[0].id, false);
    }
    await checkUnitStatuses();
}

function renderUnits() {
    const container = document.getElementById('unitContainer');
    container.innerHTML = '';

    unitsData.forEach(unit => {
        const div = document.createElement('div');
        div.className = 'unit-card';
        div.id = `card-${unit.id}`;
        
        let typeText = unit.unit_code.includes('5') ? 'PREMIUM SLOT' : 'CLASSIC SLOT';
        
        // PERBAIKAN: Tambahkan tanda kutip tunggal (' ') mengapit ${unit.id}
        div.innerHTML = `
            <div class="uc-clickable" onclick="selectUnit('${unit.id}', true)">
                <div class="uc-header">
                    <span class="uc-type"><i data-lucide="monitor-play" class="icon-sm"></i> ${typeText}</span>
                    <div id="status-${unit.id}" class="uc-badge badge-gray">Memuat...</div>
                </div>
                <div class="uc-body">
                    <h2 class="uc-code">${unit.unit_code}</h2>
                    <div class="uc-price">Rp ${unit.price_per_hour.toLocaleString()}<span>/jam</span></div>
                </div>
            </div>
            <div class="uc-footer">
                <button class="btn btn-outline full-width uc-btn-jadwal" onclick="openModal('${unit.id}')">
                    <i data-lucide="calendar"></i> Lihat Jadwal
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function selectUnit(unitId, isUserAction = false) {
    const unit = unitsData.find(u => u.id === unitId);
    if(!unit) return;

    // Reset visual state
    document.querySelectorAll('.unit-card').forEach(card => card.classList.remove('selected'));
    
    const cardEl = document.getElementById(`card-${unit.id}`);
    if(cardEl) cardEl.classList.add('selected');
    
    // Update Hidden inputs & Form Summary
    document.getElementById('selectedUnitId').value = unit.id;
    document.getElementById('selectedUnitPrice').value = unit.price_per_hour;
    document.getElementById('summaryUnitCode').innerText = unit.unit_code;
    
    calculatePrice();

    // Auto-scroll ke form HANYA jika klik manual oleh user dan di layar mobile
    if (isUserAction && window.innerWidth <= 992) {
        const formContainer = document.getElementById('formContainerWrapper');
        if(formContainer) formContainer.scrollIntoView({behavior: "smooth", block: "start"});
    }
}

function openModal(unitId) {
    const unit = unitsData.find(u => u.id === unitId);
    if(!unit) return;

    const modal = document.getElementById('scheduleModal');
    const title = document.getElementById('modalTitle');
    const list = document.getElementById('modalList');
    
    title.innerText = `Jadwal ${unit.unit_code}`;
    const unitBookings = currentBookingsData.filter(r => r.unit_id === unit.id);
    
    list.innerHTML = '';
    if(unitBookings.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i data-lucide="check-circle" style="color:var(--success); width:48px;height:48px; margin-bottom:10px;"></i>
                <p><strong>Kosong seharian!</strong><br>Jam berapapun bebas dipesan.</p>
            </div>`;
    } else {
        unitBookings.forEach(b => {
            list.innerHTML += `
                <div class="schedule-item">
                    <div class="s-icon"><i data-lucide="clock"></i></div>
                    <div class="s-text">
                        <span>Terisi pada jam:</span>
                        <strong>${b.start_time.substring(0,5)} - ${b.end_time.substring(0,5)}</strong>
                    </div>
                </div>`;
        });
    }
    
    lucide.createIcons();
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('scheduleModal').classList.remove('show');
}

window.onclick = function(event) {
    const modal = document.getElementById('scheduleModal');
    if (event.target === modal) closeModal();
}

async function checkUnitStatuses() {
    const playDate = document.getElementById('playDate').value;
    if(!playDate) return;

    // Set loading visual
    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`status-${unit.id}`);
        if(statusDiv) {
            statusDiv.className = "uc-badge badge-gray";
            statusDiv.innerHTML = "Memuat...";
        }
    });

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
    document.getElementById('totalPriceDisplay').innerText = `Rp ${currentTotal.toLocaleString()}`;
}

function addHours(timeStr, hours) {
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(Number(h) + Number(hours), Number(m));
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

// Fungsi untuk menjalankan Timer Waktu Mundur dengan Auto-Redirect
function startCountdown(durationInMinutes) {
    clearInterval(countdownInterval); 

    let time = durationInMinutes * 60; 
    const display = document.getElementById('countdownDisplay');

    countdownInterval = setInterval(() => {
        let minutes = Math.floor(time / 60);
        let seconds = time % 60;

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        if (display) display.textContent = minutes + ":" + seconds;

        // JIKA WAKTU HABIS
        if (--time < 0) {
            clearInterval(countdownInterval);
            
            // Berikan feedback sedikit sebelum pindah halaman
            if (display) display.textContent = "00:00";
            
            // Tampilkan alert singkat lalu arahkan ke halaman gagal
            alert("Waktu pembayaran telah habis. Sesi booking Anda berakhir.");
            
            // Panggil fungsi yang sudah ada untuk menampilkan halaman gagal
            showPaymentFailed();
        }
    }, 1000);
}

async function handleReservation(e) {
    e.preventDefault();
    const unitId = document.getElementById('selectedUnitId').value;
    if(!unitId) return alert("Pilih unit konsol terlebih dahulu.");

    const playDate = document.getElementById('playDate').value;
    const startTimeStr = document.getElementById('startTime').value;
    const duration = document.getElementById('duration').value;
    const phone = document.getElementById('custPhone').value;
    const custName = document.getElementById('custName').value;
    
    const startTime = startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr;
    const endTime = addHours(startTime, duration);

    const btn = document.getElementById('btnSubmitForm');
    btn.disabled = true;
    btn.innerHTML = '<i class="lucide-loader animate-spin"></i> Memproses...';

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
        creditOpt.innerText = `Saldo Kredit (Ada Rp ${userCredit.toLocaleString()})`;
        creditOpt.disabled = false;
    } else if (userCredit > 0) {
        creditOpt.innerText = `Saldo Kredit Kurang (Hanya Rp ${userCredit.toLocaleString()})`;
        creditOpt.disabled = true;
    } else {
        creditOpt.innerText = `Saldo Kredit Kosong`;
        creditOpt.disabled = true;
    }

    document.getElementById('paymentMethod').value = 'qris';
    document.getElementById('qrisBookingCode').innerText = bookingCode;
    
    togglePaymentView(); 
    resetBtn();
    showSection('payment');

    startCountdown(1);
}

function togglePaymentView() {
    const method = document.getElementById('paymentMethod').value;
    const qrisBox = document.getElementById('qrisBoxContainer');
    const btnConfirm = document.getElementById('btnConfirmPayment');
    const amountDisplay = document.getElementById('qrisAmount');
    
    if (amountDisplay) amountDisplay.innerText = `Rp ${currentTotal.toLocaleString()}`;

    if (method === 'credit') {
        if (qrisBox) qrisBox.style.display = 'none';
        if (btnConfirm) {
            btnConfirm.innerHTML = `<i data-lucide="wallet"></i> Konfirmasi Pakai Saldo Kredit`;
            btnConfirm.className = "btn btn-primary full-width";
        }
    } else {
        if (qrisBox) qrisBox.style.display = 'flex'; 
        if (btnConfirm) {
            btnConfirm.innerHTML = `<i data-lucide="check-circle"></i> Saya Sudah Bayar`;
            btnConfirm.className = "btn btn-primary full-width";
        }
    }
    lucide.createIcons();
}

function resetBtn() {
    const btn = document.getElementById('btnSubmitForm');
    btn.disabled = false;
    btn.innerHTML = 'Lanjut Pembayaran <i data-lucide="arrow-right"></i>';
    lucide.createIcons();
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

async function processPayment(amountPaid, methodInfo) {
    clearInterval(countdownInterval);
    const btn = document.getElementById('btnConfirmPayment');
    btn.innerHTML = '<i class="lucide-loader animate-spin"></i> Memverifikasi...';
    btn.disabled = true;

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
        reservation_status: 'paid', 
        payment_status: 'paid'
    }]).select();

    if (resErr) {
        showPaymentFailed();
        return;
    }

    const newReservationId = resData[0].id;

    const { error: payErr } = await supabase.from('payments').insert([{
        reservation_id: newReservationId,
        amount: amountPaid,
        payment_method: methodInfo,
        created_at: new Date().toISOString()
    }]);

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
    document.getElementById('succUnit').innerText = document.getElementById('summaryUnitCode').innerText; 
    document.getElementById('succDuration').innerText = tempReservationData.duration_hours;
    document.getElementById('succPlayTime').innerText = `${tempReservationData.play_date}, ${tempReservationData.start_time.substring(0,5)} - ${tempReservationData.end_time.substring(0,5)}`;
    document.getElementById('succPhone').innerText = tempReservationData.phone;
    document.getElementById('finalBookingCode').innerText = tempReservationData.booking_code;
    
    showSection('success');
}

function showPaymentFailed() {
    document.getElementById('failBookingCode').innerText = tempReservationData ? tempReservationData.booking_code : "N/A";
    document.getElementById('failUnitName').innerText = document.getElementById('summaryUnitCode').innerText || "PlayStation Unit";
    document.getElementById('failDuration').innerText = tempReservationData ? tempReservationData.duration_hours : "0";
    document.getElementById('failSubtotal').innerText = `Rp ${(currentTotal || 0).toLocaleString()}`;
    document.getElementById('failTotal').innerText = `Rp ${(currentTotal || 0).toLocaleString()}`;
    const desc = document.querySelector('.failed-desc');
    if(desc) desc.innerText = "Maaf, sesi pembayaran Anda telah berakhir karena melewati batas waktu 15 menit.";
    showSection('failed');
}

function copyBookingCode() {
    const code = document.getElementById('finalBookingCode').innerText;
    navigator.clipboard.writeText(code).then(() => {
        showToast("Kode Booking berhasil disalin!");
    });
}

async function checkReservation() {
    const booking = document.getElementById('checkBooking').value;
    const phone = document.getElementById('checkPhone').value; 
    const resultDiv = document.getElementById('checkResult');
    const btn = document.getElementById('btnSearchRes');

    if(!booking || !phone) {
        showToast("Lengkapi Kode Booking dan Nomor WhatsApp.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Mencari...';
    resultDiv.innerHTML = '<div class="loading-state">Mencari data reservasi...</div>';

    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .eq('booking_code', booking)
        .eq('phone', phone) 
        .order('created_at', { ascending: false });
        
    btn.disabled = false;
    btn.innerHTML = 'Cari Data';

    if (error) {
        return resultDiv.innerHTML = "<div class='error-state'>Terjadi kesalahan jaringan. Coba lagi.</div>";
    }
    
    if(!data || data.length === 0) {
        return resultDiv.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <i data-lucide="search-x" style="width: 40px; height: 40px; color: var(--text-light); margin-bottom: 10px;"></i>
                <p><strong>Data tidak ditemukan.</strong></p>
                <small class="text-muted">Pastikan Kode Booking dan Nomor HP sudah benar.</small>
            </div>
        `;
    }

    // Render as responsive Cards instead of Table
    let html = '<div class="reservation-cards-grid">';
    data.forEach(r => {
        let btnStr = '';
        if(r.reservation_status === 'paid') {
            btnStr = `<button class="btn btn-danger-outline full-width" onclick='cancelReservation(${JSON.stringify(r)})'><i data-lucide="x-circle"></i> Batalkan Pesanan</button>`;
        }
        
<<<<<<< HEAD
        let statusBadge = getCustomerReservationBadgeClass(r.reservation_status);

        html += `<tr>
            <td><strong>${r.booking_code}</strong></td>
            <td>${r.playstation_units.unit_code}</td>
            <td><small>${r.play_date}<br>${r.start_time.substring(0,5)} - ${r.end_time.substring(0,5)}</small></td>
            <td>Rp ${r.total_price.toLocaleString()}</td>
            <td><span class="badge ${statusBadge}">${getCustomerReservationStatusLabel(r.reservation_status)}</span></td>
            <td>${btnStr}</td>
        </tr>`;
    });
    html += '</table>';
    resultDiv.innerHTML = html;
}

function getCustomerReservationStatusLabel(status) {
    const labels = {
        paid: 'Paid',
        finished: 'Finished',
        converted_to_credit: 'Credit',
        cancelled_no_refund: 'No Refund',
        cancelled_refund: 'Refund Lama'
    };

    return labels[status] || status || '-';
}

function getCustomerReservationBadgeClass(status) {
    if (status === 'paid' || status === 'finished') {
        return 'badge-success';
    }

    return 'badge-gray';
}

function buildReservationDateTime(dateValue, timeValue) {
    if (!dateValue || !timeValue) return null;

    const dateParts = String(dateValue).split('-').map(Number);
    const timeParts = String(timeValue).split(':').map(Number);

    if (dateParts.length < 3 || timeParts.length < 2) return null;

    return new Date(
        dateParts[0],
        dateParts[1] - 1,
        dateParts[2],
        timeParts[0] || 0,
        timeParts[1] || 0,
        timeParts[2] || 0
    );
}

function isReservationStatusConstraintError(error) {
    if (!error) return false;

    const message = String(error.message || '').toLowerCase();
    const details = String(error.details || '').toLowerCase();
    const hint = String(error.hint || '').toLowerCase();

    return (
        error.code === '23514' ||
        message.includes('check constraint') ||
        details.includes('reservation_status') ||
        hint.includes('reservation_status')
    );
}

function getNoRefundStatusConstraintMessage() {
    return (
        "Status cancelled_no_refund belum bisa disimpan di database.\n\n" +
        "Tambahkan nilai cancelled_no_refund ke constraint reservation_status di Supabase, lalu coba batalkan lagi.\n\n" +
        "Reservasi belum diubah dan saldo kredit tidak dibuat."
    );
}

async function createCreditFromCancellation(reservation) {
    const { data: existingCredit, error: checkError } = await supabase
        .from('credits')
        .select('id')
        .eq('reservation_id', reservation.id)
        .limit(1);

    if (checkError) {
        throw new Error("Gagal mengecek saldo kredit: " + checkError.message);
    }

    if (existingCredit && existingCredit.length > 0) {
        return;
    }

    const { error: creditError } = await supabase.from('credits').insert([{
        reservation_id: reservation.id,
        phone: reservation.phone,
        amount: reservation.total_price,
        credit_status: 'unused'
    }]);

    if (creditError) {
        throw new Error("Gagal membuat saldo kredit: " + creditError.message);
    }
}

async function cancelReservation(reservation) {
    const warningText = "Yakin ingin membatalkan reservasi ini?\n\n" +
        "Jika pembatalan dilakukan lebih dari 1 jam sebelum jadwal main, pembayaran yang sudah dilakukan akan disimpan sebagai saldo kredit untuk pemesanan berikutnya.\n\n" +
        "Jika pembatalan dilakukan kurang dari 1 jam sebelum jadwal main, pembayaran tidak dapat dikembalikan.";

    if(!confirm(warningText)) return;

    const playDateTime = buildReservationDateTime(reservation.play_date, reservation.start_time);
    const now = new Date();

    if (!playDateTime || Number.isNaN(playDateTime.getTime())) {
        alert("Jadwal reservasi tidak valid, pembatalan dibatalkan.");
        return;
    }

    const diffHours = (playDateTime - now) / (1000 * 60 * 60);

    let newStatus = '';
    let message = '';

    try {
        if (diffHours > 1) {
            newStatus = 'converted_to_credit';
            message = `Reservasi dibatalkan.\nNominal Rp ${Number(reservation.total_price || 0).toLocaleString()} berhasil disimpan sebagai saldo kredit untuk pemesanan berikutnya.\n\nGunakan Nama dan No HP yang sama untuk memakai saldo ini.`;
            await createCreditFromCancellation(reservation);
        } else {
            newStatus = 'cancelled_no_refund';
            message = 'Reservasi dibatalkan. Pembayaran tidak dapat dikembalikan karena pembatalan dilakukan kurang dari atau sama dengan 1 jam sebelum jadwal main.';
        }

        const { error: updateError } = await supabase
            .from('reservations')
            .update({ reservation_status: newStatus })
            .eq('id', reservation.id);

        if (updateError) {
            if (newStatus === 'cancelled_no_refund' && isReservationStatusConstraintError(updateError)) {
                alert(getNoRefundStatusConstraintMessage());
                return;
            }

            throw new Error("Gagal membatalkan reservasi: " + updateError.message);
        }

        alert(message);
        checkReservation();
    } catch (err) {
        console.error(err);
        alert(err.message || "Terjadi kesalahan saat membatalkan reservasi.");
    }
}
=======
        let statusBadge = r.reservation_status === 'paid' ? 'badge-success' : 'badge-gray';
        let statusText = r.reservation_status === 'paid' ? 'AKTIF / LUNAS' : r.reservation_status.replace('_', ' ').toUpperCase();

        html += `
        <div class="res-card">
            <div class="res-card-header">
                <span class="res-code">${r.booking_code}</span>
                <span class="badge ${statusBadge}">${statusText}</span>
            </div>
            <div class="res-card-body">
                <div class="rc-row"><span>Unit Konsol</span><strong>${r.playstation_units.unit_code}</strong></div>
                <div class="rc-row"><span>Jadwal Main</span><strong>${r.play_date} • ${r.start_time.substring(0,5)} - ${r.end_time.substring(0,5)}</strong></div>
                <div class="rc-row"><span>Total Bayar</span><strong class="text-blue">Rp ${r.total_price.toLocaleString()}</strong></div>
            </div>
            <div class="res-card-footer">${btnStr}</div>
        </div>`;
    });
    html += '</div>';
    resultDiv.innerHTML = html;
    lucide.createIcons();
}

async function cancelReservation(reservation) {
    const warningText = `Yakin ingin membatalkan reservasi ini?\n\nPERINGATAN: Jika dibatalkan lebih dari 1 jam sebelum main, nominal Rp ${reservation.total_price.toLocaleString()} akan diubah menjadi Saldo Kredit untuk pemesanan berikutnya.`;
    
    if(!confirm(warningText)) return;

    const playDateTime = new Date(`${reservation.play_date}T${reservation.start_time}`);
    const now = new Date();
    const diffHours = (playDateTime - now) / (1000 * 60 * 60);

    let newStatus = '';
    let message = '';

    if (diffHours <= 1) {
        newStatus = 'cancelled_refund';
        message = 'Reservasi dibatalkan. Dana akan di-refund secara manual oleh admin.';
    } else {
        newStatus = 'converted_to_credit';
        message = `Pembatalan dilakukan lebih dari 1 jam.\nNominal Rp ${reservation.total_price.toLocaleString()} diubah menjadi Saldo Kredit!\n\nGunakan No HP yang sama untuk memakai saldo ini.`;
        await supabase.from('credits').insert([{ reservation_id: reservation.id, phone: reservation.phone, amount: reservation.total_price }]);
    }

    await supabase.from('reservations').update({ reservation_status: newStatus }).eq('id', reservation.id);
    alert(message);
    checkReservation(); 
}
>>>>>>> dc8fc890925e50fa61b16c09bd00052f47cef121

// Realtime Listener
supabase.channel('public:reservations')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
      checkUnitStatuses();
  })
  .subscribe();
