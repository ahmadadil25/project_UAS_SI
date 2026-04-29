// admin-walkin.js
// Berisi fungsi pemilihan unit dan input reservasi walk-in.

async function loadWalkinUnits() {
    const { data, error } = await supabase
        .from('playstation_units')
        .select('*')
        .order('unit_code');

    if (error) return alert("Gagal load unit!");

    window.adminState.unitsData = data || [];

    const container = document.getElementById('walkinUnitContainer');
    if (!container) return;

    container.innerHTML = '';

    window.adminState.unitsData.forEach(unit => {
        const div = document.createElement('div');
        div.className = 'unit-card';
        div.id = `walkin-card-${unit.id}`;

        div.innerHTML = `
            <div>
                <strong>${unit.unit_code}</strong><br>
                <span class="price-tag">Rp ${Number(unit.price_per_hour || 0).toLocaleString()}/jam</span>
            </div>

            <div class="unit-status" id="walkin-status-${unit.id}">
                <small style="color: gray;">Memuat status...</small>
            </div>
        `;

        div.onclick = () => {
            document
                .querySelectorAll('#walkinUnitContainer .unit-card')
                .forEach(c => c.classList.remove('selected'));

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
    const playDate = document.getElementById('playDate')?.value;
    if (!playDate) return;

    const { data, error } = await supabase
        .from('reservations')
        .select('unit_id, start_time, end_time, reservation_status')
        .eq('play_date', playDate)
        .in('reservation_status', ['pending_payment', 'paid']);

    if (error) return console.error(error);

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const currentHourStr = now.toTimeString().substring(0, 5);

    window.adminState.unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`walkin-status-${unit.id}`);
        if (!statusDiv) return;

        const unitBookings = (data || []).filter(r => r.unit_id === unit.id);

        if (unitBookings.length === 0) {
            statusDiv.innerHTML = `<span class="text-success">✅ Tersedia</span>`;
            return;
        }

        if (playDate === todayStr) {
            const ongoingPaid = unitBookings.find(b => {
                const start = String(b.start_time || '').substring(0, 5);
                const end = String(b.end_time || '').substring(0, 5);

                return (
                    b.reservation_status === 'paid' &&
                    currentHourStr >= start &&
                    currentHourStr < end
                );
            });

            if (ongoingPaid) {
                statusDiv.innerHTML = `
                    <span class="text-danger">
                        🔴 Terpakai s/d ${String(ongoingPaid.end_time || '').substring(0, 5)}
                    </span>
                `;
            } else {
                statusDiv.innerHTML = `
                    <span style="color: #d97706; font-weight: bold;">
                        🟡 Ada Jadwal
                    </span>
                `;
            }
        } else {
            statusDiv.innerHTML = `
                <span style="color: #d97706; font-weight: bold;">
                    🟡 Ada Jadwal
                </span>
            `;
        }
    });
}

function calculateWalkinPrice() {
    const price = Number(document.getElementById('selectedUnitPrice')?.value || 0);
    const dur = Number(document.getElementById('duration')?.value || 1);

    window.adminState.walkinTotal = price * dur;

    const totalPriceDisplay = document.getElementById('totalPriceDisplay');
    if (totalPriceDisplay) {
        totalPriceDisplay.innerText = `Total Tagihan: Rp ${window.adminState.walkinTotal.toLocaleString()}`;
    }
}

async function handleWalkinReservation(e) {
    e.preventDefault();

    const unitId = document.getElementById('selectedUnitId')?.value;

    if (!unitId) {
        return alert("Pilih unit PS terlebih dahulu!");
    }

    const btn = document.getElementById('btnSubmitWalkin');
    setWalkinButtonLoading(true);

    try {
        const customerName = document.getElementById('custName')?.value?.trim();
        const customerPhone = document.getElementById('custPhone')?.value?.trim();
        const playDate = document.getElementById('playDate')?.value;
        const startTimeStr = document.getElementById('startTime')?.value;
        const dur = Number(document.getElementById('duration')?.value || 1);
        const totalPrice = Number(window.adminState.walkinTotal || 0);

        if (!customerName || !customerPhone || !playDate || !startTimeStr || !dur) {
            alert("Lengkapi semua data reservasi walk-in terlebih dahulu.");
            setWalkinButtonLoading(false);
            return;
        }

        if (totalPrice <= 0) {
            alert("Total tagihan belum valid. Pilih unit PS terlebih dahulu.");
            setWalkinButtonLoading(false);
            return;
        }

        const startTime = startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr;
        const endTime = calculateEndTime(startTime, dur);

        const isConflict = await checkWalkinConflict(unitId, playDate, startTime, endTime);
        if (isConflict) {
            setWalkinButtonLoading(false);
            return;
        }

        const bookingCode = generateWalkinBookingCode();

        const { data: insertedReservation, error: reservationError } = await supabase
            .from('reservations')
            .insert([{
                booking_code: bookingCode,
                customer_name: customerName,
                phone: customerPhone,
                unit_id: unitId,
                play_date: playDate,
                start_time: startTime,
                end_time: endTime,
                duration_hours: dur,
                total_price: totalPrice,
                reservation_status: 'paid',
                payment_status: 'paid'
            }])
            .select()
            .single();

        if (reservationError) {
            alert("Error: " + reservationError.message);
            setWalkinButtonLoading(false);
            return;
        }

        const paymentCreated = await createWalkinPayment(insertedReservation, totalPrice);

        if (!paymentCreated) {
            alert(
                "Reservasi walk-in berhasil dibuat, tetapi data pembayaran gagal dicatat. " +
                "Silakan cek tabel payments atau input pembayaran secara manual."
            );
        } else {
            alert("✅ Reservasi Walk-in Berhasil dan Pembayaran Tercatat!");
        }

        resetWalkinForm();

        await loadAdminData();

        if (typeof loadPaymentData === 'function') {
            await loadPaymentData();
        }

        if (typeof loadCreditData === 'function') {
            await loadCreditData();
        }

        if (typeof checkWalkinUnitStatuses === 'function') {
            await checkWalkinUnitStatuses();
        }

        switchTab('reservasiTab', 'btn-res');

    } catch (err) {
        console.error(err);
        alert(err.message || "Terjadi kesalahan saat membuat reservasi walk-in.");
    } finally {
        setWalkinButtonLoading(false);
    }
}

async function checkWalkinConflict(unitId, playDate, startTime, endTime) {
    const { data: conflicts, error: conflictErr } = await supabase
        .from('reservations')
        .select('booking_code, customer_name, start_time, end_time, reservation_status')
        .eq('unit_id', unitId)
        .eq('play_date', playDate)
        .in('reservation_status', ['pending_payment', 'paid'])
        .lt('start_time', endTime)
        .gt('end_time', startTime);

    if (conflictErr) {
        alert("Gagal mengecek jadwal: " + conflictErr.message);
        return true;
    }

    if (conflicts && conflicts.length > 0) {
        const jadwalBentrok = conflicts
            .map(r => {
                const statusLabel = r.reservation_status === 'pending_payment'
                    ? 'Pending'
                    : 'Paid';

                return `${r.booking_code} - ${r.customer_name} (${String(r.start_time).substring(0, 5)} - ${String(r.end_time).substring(0, 5)}) [${statusLabel}]`;
            })
            .join('\n');

        alert(
            `❌ Jadwal bentrok!\n\n` +
            `Unit ini sudah terisi pada jadwal berikut:\n${jadwalBentrok}\n\n` +
            `Silakan pilih jam atau unit lain.`
        );

        return true;
    }

    return false;
}

async function createWalkinPayment(reservation, amount) {
    if (!reservation || !reservation.id) {
        console.error("Reservasi tidak valid untuk membuat pembayaran.");
        return false;
    }

    const { data: existingPayment, error: checkError } = await supabase
        .from('payments')
        .select('id')
        .eq('reservation_id', reservation.id)
        .limit(1);

    if (checkError) {
        console.error("Gagal cek pembayaran:", checkError);
        return false;
    }

    if (existingPayment && existingPayment.length > 0) {
        return true;
    }

    const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
            reservation_id: reservation.id,
            payment_method: 'Walk-in',
            amount: amount
        }]);

    if (paymentError) {
        console.error("Gagal insert pembayaran walk-in:", paymentError);
        return false;
    }

    return true;
}

function calculateEndTime(startTime, durationHours) {
    const [h, m] = startTime.split(':');

    const d = new Date();
    d.setHours(Number(h) + Number(durationHours), Number(m), 0, 0);

    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

function generateWalkinBookingCode() {
    return 'WINK' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function resetWalkinForm() {
    const form = document.getElementById('walkinForm');
    if (form) form.reset();

    document.querySelectorAll('#walkinUnitContainer .unit-card').forEach(c => {
        c.classList.remove('selected');
    });

    const selectedUnitId = document.getElementById('selectedUnitId');
    const selectedUnitPrice = document.getElementById('selectedUnitPrice');
    const totalPriceDisplay = document.getElementById('totalPriceDisplay');

    if (selectedUnitId) selectedUnitId.value = '';
    if (selectedUnitPrice) selectedUnitPrice.value = '';

    window.adminState.walkinTotal = 0;

    if (totalPriceDisplay) {
        totalPriceDisplay.innerText = 'Total Tagihan: Rp 0';
    }

    const today = new Date().toLocaleDateString('en-CA');
    const playDate = document.getElementById('playDate');

    if (playDate) {
        playDate.value = today;
    }
}

function setWalkinButtonLoading(isLoading) {
    const btn = document.getElementById('btnSubmitWalkin');
    if (!btn) return;

    btn.disabled = isLoading;
    btn.innerText = isLoading ? "Memproses..." : "Simpan Reservasi (Langsung Paid)";
}

window.loadWalkinUnits = loadWalkinUnits;
window.checkWalkinUnitStatuses = checkWalkinUnitStatuses;
window.calculateWalkinPrice = calculateWalkinPrice;
window.handleWalkinReservation = handleWalkinReservation;