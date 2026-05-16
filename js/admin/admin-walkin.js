// admin-walkin.js
// Berisi fungsi pemilihan unit dan input reservasi walk-in.
// Tampilan dibuat konsisten dengan halaman pesan pelanggan.

async function loadWalkinUnits() {
    const { data, error } = await supabase
        .from('playstation_units')
        .select('*')
        .order('unit_code');

    if (error) {
        await adminAlert("Gagal memuat data unit.", "Gagal Load Unit");
        return;
    }

    window.adminState.unitsData = data || [];

    const container = document.getElementById('walkinUnitContainer');
    if (!container) return;

    container.innerHTML = '';

    window.adminState.unitsData.forEach(unit => {
        const div = document.createElement('div');
        div.className = 'unit-card admin-walkin-unit-card';
        div.id = `walkin-card-${unit.id}`;

        const typeText = String(unit.unit_code || '').includes('5')
            ? 'PREMIUM SLOT'
            : 'CLASSIC SLOT';

        div.innerHTML = `
            <div class="uc-clickable">
                <div class="uc-header">
                    <span class="uc-type">${typeText}</span>
                    <div id="walkin-status-${unit.id}" class="uc-badge badge-gray">
                        Memuat...
                    </div>
                </div>

                <div class="uc-body">
                    <h2 class="uc-code">${escapeWalkinHtml(unit.unit_code)}</h2>
                    <div class="uc-price">
                        Rp ${Number(unit.price_per_hour || 0).toLocaleString('id-ID')}
                        <span>/jam</span>
                    </div>
                </div>
            </div>

            <div class="uc-footer">
                <button
                    type="button"
                    class="uc-btn uc-btn-jadwal"
                    onclick="openWalkinScheduleModal('${unit.id}', event)">
                    Lihat Jadwal
                </button>
            </div>
        `;

        div.onclick = () => {
            selectWalkinUnit(unit, div);
        };

        container.appendChild(div);
    });

    // Pilih unit pertama otomatis supaya tampilannya seperti halaman pesan.
    if (window.adminState.unitsData.length > 0) {
        const firstUnit = window.adminState.unitsData[0];
        const firstCard = document.getElementById(`walkin-card-${firstUnit.id}`);

        if (firstUnit && firstCard) {
            selectWalkinUnit(firstUnit, firstCard);
        }
    }

    await checkWalkinUnitStatuses();
}

function selectWalkinUnit(unit, cardElement) {
    document
        .querySelectorAll('#walkinUnitContainer .unit-card')
        .forEach(card => {
            card.classList.remove('selected');
        });

    cardElement.classList.add('selected');

    const selectedUnitId = document.getElementById('selectedUnitId');
    const selectedUnitPrice = document.getElementById('selectedUnitPrice');
    const summaryUnit = document.getElementById('walkinSummaryUnitCode');

    if (selectedUnitId) selectedUnitId.value = unit.id;
    if (selectedUnitPrice) selectedUnitPrice.value = unit.price_per_hour;
    if (summaryUnit) summaryUnit.innerText = unit.unit_code;

    calculateWalkinPrice();
}

async function checkWalkinUnitStatuses() {
    const playDate = document.getElementById('playDate')?.value;
    if (!playDate) return;

    const { data, error } = await supabase
        .from('reservations')
        .select('unit_id, start_time, end_time, reservation_status')
        .eq('play_date', playDate)
        .eq('reservation_status', 'paid')
        .order('start_time', { ascending: true });

    if (error) return console.error(error);

    window.adminState.walkinBookingsData = data || [];

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const currentHourStr = now.toTimeString().substring(0, 5);

    window.adminState.unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`walkin-status-${unit.id}`);
        if (!statusDiv) return;

        const unitBookings = (data || []).filter(r => r.unit_id === unit.id);

        if (unitBookings.length === 0) {
            statusDiv.className = 'uc-badge badge-available';
            statusDiv.innerText = 'TERSEDIA';
            return;
        }

        if (playDate === todayStr) {
            const ongoingPaid = unitBookings.find(booking => {
                const start = String(booking.start_time || '').substring(0, 5);
                const end = String(booking.end_time || '').substring(0, 5);

                return currentHourStr >= start && currentHourStr < end;
            });

            if (ongoingPaid) {
                statusDiv.className = 'uc-badge badge-used';
                statusDiv.innerText = `DIPAKAI SD ${String(ongoingPaid.end_time || '').substring(0, 5)}`;
            } else {
                statusDiv.className = 'uc-badge badge-booked';
                statusDiv.innerText = 'ADA JADWAL';
            }
        } else {
            statusDiv.className = 'uc-badge badge-booked';
            statusDiv.innerText = 'ADA JADWAL';
        }
    });
}

function ensureWalkinScheduleModalExists() {
    if (document.getElementById('walkinScheduleModal')) return;

    const modal = document.createElement('div');
    modal.id = 'walkinScheduleModal';
    modal.className = 'modal-overlay walkin-schedule-modal';
    modal.style.display = 'none';
    modal.style.zIndex = '99999';

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div>
                    <h3 id="walkinScheduleModalTitle">Detail Jadwal</h3>
                    <p class="modal-subtitle">Status ketersediaan berdasarkan tanggal walk-in</p>
                </div>
                <button type="button" class="close-btn" onclick="closeWalkinScheduleModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div id="walkinScheduleModalList" class="walkin-schedule-list"></div>
                <button type="button" class="btn btn-primary full-width" onclick="closeWalkinScheduleModal()">
                    Tutup & Lanjutkan
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
        if (event.target === modal) {
            closeWalkinScheduleModal();
        }
    });
}

async function openWalkinScheduleModal(unitId, event) {
    if (event) event.stopPropagation();

    ensureWalkinScheduleModalExists();

    const unit = (window.adminState.unitsData || []).find(item => item.id === unitId);
    if (!unit) return;

    await checkWalkinUnitStatuses();

    const modal = document.getElementById('walkinScheduleModal');
    const title = document.getElementById('walkinScheduleModalTitle');
    const list = document.getElementById('walkinScheduleModalList');

    title.innerText = `Jadwal ${unit.unit_code}`;

    const unitBookings = (window.adminState.walkinBookingsData || [])
        .filter(reservation => reservation.unit_id === unit.id);

    if (unitBookings.length === 0) {
        list.innerHTML = `
            <div class="walkin-schedule-empty">
                <strong>Kosong seharian!</strong>
                <span>Jam berapapun masih bebas dipakai.</span>
            </div>
        `;
    } else {
        list.innerHTML = unitBookings.map(booking => `
            <div class="walkin-schedule-item">
                <div class="walkin-schedule-icon">Jam</div>
                <div class="walkin-schedule-text">
                    <span>Terisi pada jam:</span>
                    <strong>${String(booking.start_time || '').substring(0, 5)} - ${String(booking.end_time || '').substring(0, 5)}</strong>
                </div>
            </div>
        `).join('');
    }

    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    document.body.style.overflow = 'hidden';
}

function closeWalkinScheduleModal() {
    const modal = document.getElementById('walkinScheduleModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

function calculateWalkinPrice() {
    const price = Number(document.getElementById('selectedUnitPrice')?.value || 0);
    const duration = Number(document.getElementById('duration')?.value || 1);

    window.adminState.walkinTotal = price * duration;

    const summaryDuration = document.getElementById('walkinSummaryDuration');
    const summarySubtotal = document.getElementById('walkinSummarySubtotal');
    const totalPriceDisplay = document.getElementById('totalPriceDisplay');

    if (summaryDuration) {
        summaryDuration.innerText = duration;
    }

    if (summarySubtotal) {
        summarySubtotal.innerText = `Rp ${window.adminState.walkinTotal.toLocaleString('id-ID')}`;
    }

    if (totalPriceDisplay) {
        totalPriceDisplay.innerText = `Rp ${window.adminState.walkinTotal.toLocaleString('id-ID')}`;
    }
}

async function handleWalkinReservation(e) {
    e.preventDefault();

    const unitId = document.getElementById('selectedUnitId')?.value;

    if (!unitId) {
        await adminAlert("Pilih unit PS terlebih dahulu.", "Unit Belum Dipilih");
        return;
    }

    setWalkinButtonLoading(true);

    try {
        const customerName = document.getElementById('custName')?.value?.trim();
        const customerPhone = document.getElementById('custPhone')?.value?.trim();
        const playDate = document.getElementById('playDate')?.value;
        const startTimeStr = document.getElementById('startTime')?.value;
        const duration = Number(document.getElementById('duration')?.value || 1);
        const totalPrice = Number(window.adminState.walkinTotal || 0);

        if (!customerName || !customerPhone || !playDate || !startTimeStr || !duration) {
            setWalkinButtonLoading(false);
            await adminAlert("Lengkapi semua data reservasi walk-in terlebih dahulu.", "Data Belum Lengkap");
            return;
        }

        if (totalPrice <= 0) {
            setWalkinButtonLoading(false);
            await adminAlert("Total tagihan belum valid. Pilih unit PS terlebih dahulu.", "Total Belum Valid");
            return;
        }

        const startTime = startTimeStr.length === 5 ? startTimeStr + ":00" : startTimeStr;
        const endTime = calculateEndTime(startTime, duration);

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
                duration_hours: duration,
                total_price: totalPrice,
                reservation_status: 'paid',
                payment_status: 'paid'
            }])
            .select()
            .single();

        if (reservationError) {
            setWalkinButtonLoading(false);
            await adminAlert("Error: " + reservationError.message, "Gagal Membuat Reservasi");
            return;
        }

        const paymentCreated = await createWalkinPayment(insertedReservation, totalPrice);

        if (!paymentCreated) {
            await adminAlert(
                "Reservasi walk-in berhasil dibuat, tetapi data pembayaran gagal dicatat. " +
                "Silakan cek tabel payments atau input pembayaran secara manual.",
                "Pembayaran Belum Tercatat"
            );
        } else {
            await adminAlert("Reservasi walk-in berhasil dan pembayaran tercatat.", "Berhasil");
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
        setWalkinButtonLoading(false);
        await adminAlert(err.message || "Terjadi kesalahan saat membuat reservasi walk-in.", "Terjadi Kesalahan");
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
        .eq('reservation_status', 'paid')
        .lt('start_time', endTime)
        .gt('end_time', startTime);

    if (conflictErr) {
        setWalkinButtonLoading(false);
        await adminAlert("Gagal mengecek jadwal: " + conflictErr.message, "Gagal Cek Jadwal");
        return true;
    }

    if (conflicts && conflicts.length > 0) {
        setWalkinButtonLoading(false);
        const jadwalBentrok = conflicts
            .map(reservation => {
                const statusLabel = 'Paid';

                return `${reservation.booking_code} - ${reservation.customer_name} (${String(reservation.start_time).substring(0, 5)} - ${String(reservation.end_time).substring(0, 5)}) [${statusLabel}]`;
            })
            .join('\n');

        await adminAlert(
            `Jadwal bentrok!` + "\n\n" +
            `Unit ini sudah terisi pada jadwal berikut:` + "\n" + jadwalBentrok + "\n\n" +
            `Silakan pilih jam atau unit lain.`,
            "Jadwal Bentrok"
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
            amount: amount,
            created_at: new Date().toISOString()
        }]);

    if (paymentError) {
        console.error("Gagal insert pembayaran walk-in:", paymentError);
        return false;
    }

    return true;
}

function calculateEndTime(startTime, durationHours) {
    const [hour, minute] = startTime.split(':');

    const date = new Date();
    date.setHours(Number(hour) + Number(durationHours), Number(minute), 0, 0);

    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

function generateWalkinBookingCode() {
    return 'WINK' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function resetWalkinForm() {
    const form = document.getElementById('walkinForm');
    if (form) form.reset();

    document.querySelectorAll('#walkinUnitContainer .unit-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedUnitId = document.getElementById('selectedUnitId');
    const selectedUnitPrice = document.getElementById('selectedUnitPrice');
    const totalPriceDisplay = document.getElementById('totalPriceDisplay');
    const summaryUnit = document.getElementById('walkinSummaryUnitCode');
    const summaryDuration = document.getElementById('walkinSummaryDuration');
    const summarySubtotal = document.getElementById('walkinSummarySubtotal');

    if (selectedUnitId) selectedUnitId.value = '';
    if (selectedUnitPrice) selectedUnitPrice.value = '';
    if (summaryUnit) summaryUnit.innerText = '-';
    if (summaryDuration) summaryDuration.innerText = '1';
    if (summarySubtotal) summarySubtotal.innerText = 'Rp 0';

    window.adminState.walkinTotal = 0;

    if (totalPriceDisplay) {
        totalPriceDisplay.innerText = 'Rp 0';
    }

    const today = new Date().toLocaleDateString('en-CA');
    const playDate = document.getElementById('playDate');

    if (playDate) {
        playDate.value = today;
    }

    // Pilih ulang unit pertama setelah form direset.
    if (window.adminState.unitsData.length > 0) {
        const firstUnit = window.adminState.unitsData[0];
        const firstCard = document.getElementById(`walkin-card-${firstUnit.id}`);

        if (firstUnit && firstCard) {
            selectWalkinUnit(firstUnit, firstCard);
        }
    }

    checkWalkinUnitStatuses();
}

function setWalkinButtonLoading(isLoading) {
    const btn = document.getElementById('btnSubmitWalkin');
    if (!btn) return;

    btn.disabled = isLoading;
    btn.innerText = isLoading ? "Memproses..." : "Simpan Reservasi Walk-in";
}

function escapeWalkinHtml(value) {
    if (value === null || value === undefined) return '';

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

window.loadWalkinUnits = loadWalkinUnits;
window.checkWalkinUnitStatuses = checkWalkinUnitStatuses;
window.calculateWalkinPrice = calculateWalkinPrice;
window.handleWalkinReservation = handleWalkinReservation;
window.openWalkinScheduleModal = openWalkinScheduleModal;
window.closeWalkinScheduleModal = closeWalkinScheduleModal;
