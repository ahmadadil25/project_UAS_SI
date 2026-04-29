// admin-reservasi.js
// Berisi fungsi dashboard, daftar reservasi, detail reservasi, edit status,
// serta pencarian/filter data reservasi.

async function loadAdminData() {
    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .order('play_date', { ascending: false })
        .order('start_time', { ascending: false });

    if (error) return console.error(error);

    window.adminState.allReservations = data || [];

    await updateDashboardSummary(window.adminState.allReservations);
    applyReservationFilters();
    ensureStatusModalExists();
}

function applyReservationFilters() {
    const allData = window.adminState.allReservations || [];

    const searchValue = document
        .getElementById('reservationSearchInput')
        ?.value
        ?.toLowerCase()
        ?.trim() || '';

    const statusFilter = document
        .getElementById('reservationStatusFilter')
        ?.value || 'all';

    const dateFilter = document
        .getElementById('reservationDateFilter')
        ?.value || '';

    let filteredData = allData;

    if (searchValue) {
        filteredData = filteredData.filter(r => {
            const bookingCode = String(r.booking_code || '').toLowerCase();
            const customerName = String(r.customer_name || '').toLowerCase();
            const phone = String(r.phone || '').toLowerCase();
            const unitCode = String(r.playstation_units?.unit_code || '').toLowerCase();

            return (
                bookingCode.includes(searchValue) ||
                customerName.includes(searchValue) ||
                phone.includes(searchValue) ||
                unitCode.includes(searchValue)
            );
        });
    }

    if (statusFilter !== 'all') {
        filteredData = filteredData.filter(r => r.reservation_status === statusFilter);
    }

    if (dateFilter) {
        filteredData = filteredData.filter(r => r.play_date === dateFilter);
    }

    renderReservationTable(filteredData);
    updateReservationFilterInfo(filteredData.length, allData.length);
}

function resetReservationFilters() {
    const searchInput = document.getElementById('reservationSearchInput');
    const statusFilter = document.getElementById('reservationStatusFilter');
    const dateFilter = document.getElementById('reservationDateFilter');

    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    if (dateFilter) dateFilter.value = '';

    applyReservationFilters();
}

function renderReservationTable(data) {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:20px;">
                    Tidak ada data reservasi yang sesuai dengan filter.
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(r => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${escapeHtml(r.booking_code)}</strong></td>

                <td>
                    ${escapeHtml(r.customer_name)}<br>
                    <small>${escapeHtml(r.phone)}</small>
                </td>

                <td>${r.playstation_units ? escapeHtml(r.playstation_units.unit_code) : '-'}</td>

                <td>
                    ${escapeHtml(r.play_date)}<br>
                    <small>${formatTime(r.start_time)} - ${formatTime(r.end_time)}</small>
                </td>

                <td>Rp ${Number(r.total_price || 0).toLocaleString()}</td>

                <td>
                    <span class="badge ${getStatusBadgeClass(r.reservation_status)}">
                        ${getStatusLabel(r.reservation_status)}
                    </span>
                </td>

                <td>
                    <button
                        class="btn btn-primary"
                        style="padding: 5px 9px; font-size: 11px; margin-right: 5px;"
                        onclick="showReservationDetail('${r.id}')">
                        Detail
                    </button>

                    <button
                        class="btn btn-success"
                        style="padding: 5px 9px; font-size: 11px;"
                        onclick="openStatusModal('${r.id}')">
                        Edit Status
                    </button>
                </td>
            </tr>
        `;
    });
}

async function updateDashboardSummary(data) {
    // Gunakan cara manual yang aman dari perbedaan Timezone UTC/Local
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`; // Format pasti: YYYY-MM-DD

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`; // Format pasti: HH:MM

    let count = 0;
    let revenue = 0;
    let pendingCount = 0;
    let finishedCount = 0;
    let refundCount = 0;
    let creditCount = 0;
    let activeUnitIds = new Set();

    data.forEach(r => {
        if (r.play_date === todayStr) {
            count++;

            if (r.reservation_status === 'paid' || r.reservation_status === 'finished') {
                revenue += Number(r.total_price || 0);
            }

            if (r.reservation_status === 'pending_payment') pendingCount++;
            if (r.reservation_status === 'finished') finishedCount++;
            if (r.reservation_status === 'cancelled_refund') refundCount++;
            if (r.reservation_status === 'converted_to_credit') creditCount++;

            // Cek unit yang aktif saat ini tanpa hit query lagi
            if (r.reservation_status === 'paid') {
                const start = String(r.start_time || '').substring(0, 5);
                const end = String(r.end_time || '').substring(0, 5);
                if (currentTime >= start && currentTime < end) {
                    activeUnitIds.add(r.unit_id);
                }
            }
        }
    });

    const todayCount = document.getElementById('todayCount');
    const todayRevenue = document.getElementById('todayRevenue');
    const todayPendingCount = document.getElementById('todayPendingCount');
    const todayFinishedCount = document.getElementById('todayFinishedCount');
    const todayRefundCount = document.getElementById('todayRefundCount');
    const todayCreditCount = document.getElementById('todayCreditCount');

    if (todayCount) todayCount.innerText = count;
    if (todayRevenue) todayRevenue.innerText = `Rp ${revenue.toLocaleString()}`;
    if (todayPendingCount) todayPendingCount.innerText = pendingCount;
    if (todayFinishedCount) todayFinishedCount.innerText = finishedCount;
    if (todayRefundCount) todayRefundCount.innerText = refundCount;
    if (todayCreditCount) todayCreditCount.innerText = creditCount;

    // Kirim jumlah unit terpakai langsung ke fungsi unit
    await updateUnitDashboardSummary(activeUnitIds.size);
}

async function updateUnitDashboardSummary(activeCount) {
    const totalUnitCount = document.getElementById('totalUnitCount');
    const activeUnitCount = document.getElementById('activeUnitCount');

    try {
        // Ambil total master unit saja
        const { data: units, error: unitError } = await supabase
            .from('playstation_units')
            .select('id');

        if (unitError) throw unitError;

        if (totalUnitCount) totalUnitCount.innerText = (units || []).length;
        if (activeUnitCount) activeUnitCount.innerText = activeCount; // Update dengan data yang sudah difilter

    } catch (err) {
        console.error(err);
    }
}

function updateReservationFilterInfo(filteredCount, totalCount) {
    const info = document.getElementById('reservationFilterInfo');
    if (!info) return;

    const searchValue = document.getElementById('reservationSearchInput')?.value?.trim() || '';
    const statusFilter = document.getElementById('reservationStatusFilter')?.value || 'all';
    const dateFilter = document.getElementById('reservationDateFilter')?.value || '';

    const activeFilters = [];

    if (searchValue) activeFilters.push(`pencarian "${searchValue}"`);
    if (statusFilter !== 'all') activeFilters.push(`status ${getStatusLabel(statusFilter)}`);
    if (dateFilter) activeFilters.push(`tanggal ${dateFilter}`);

    if (activeFilters.length === 0) {
        info.innerText = `Menampilkan semua data reservasi (${totalCount} data).`;
    } else {
        info.innerText = `Menampilkan ${filteredCount} dari ${totalCount} data berdasarkan ${activeFilters.join(', ')}.`;
    }
}

function getStatusLabel(status) {
    const labels = {
        pending_payment: 'Pending',
        paid: 'Paid',
        finished: 'Finished',
        cancelled_refund: 'Refund',
        converted_to_credit: 'Credit'
    };

    return labels[status] || status || '-';
}

function getStatusBadgeClass(status) {
    if (status === 'paid' || status === 'finished') {
        return 'badge-paid';
    }

    if (status === 'pending_payment') {
        return 'badge-pending';
    }

    if (status === 'cancelled_refund' || status === 'converted_to_credit') {
        return 'badge-cancelled';
    }

    return 'badge-pending';
}

function formatTime(timeValue) {
    if (!timeValue) return '-';
    return String(timeValue).substring(0, 5);
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

async function getReservationById(id) {
    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .eq('id', id)
        .single();

    if (error) {
        console.error(error);
        return null;
    }

    return data;
}

function showReservationDetail(id) {
    const reservation = window.adminState.allReservations.find(r => r.id === id);

    if (!reservation) {
        alert("Data reservasi tidak ditemukan.");
        return;
    }

    alert(
        `Detail Reservasi\n\n` +
        `Kode Booking : ${reservation.booking_code}\n` +
        `Nama         : ${reservation.customer_name}\n` +
        `No HP        : ${reservation.phone}\n` +
        `Unit         : ${reservation.playstation_units ? reservation.playstation_units.unit_code : '-'}\n` +
        `Tanggal      : ${reservation.play_date}\n` +
        `Jam          : ${formatTime(reservation.start_time)} - ${formatTime(reservation.end_time)}\n` +
        `Durasi       : ${reservation.duration_hours} Jam\n` +
        `Total        : Rp ${Number(reservation.total_price || 0).toLocaleString()}\n` +
        `Status       : ${getStatusLabel(reservation.reservation_status)}`
    );
}

function ensureStatusModalExists() {
    if (document.getElementById('statusModal')) return;

    const modal = document.createElement('div');
    modal.id = 'statusModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Ubah Status Reservasi</h3>
                <button class="close-btn" onclick="closeStatusModal()">&times;</button>
            </div>

            <div class="modal-body">
                <input type="hidden" id="statusReservationId">

                <div style="background: #f8fafc; border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <p style="margin-bottom: 8px;">
                        <strong>Booking:</strong>
                        <span id="statusModalBooking">-</span>
                    </p>
                    <p style="margin-bottom: 8px;">
                        <strong>Pelanggan:</strong>
                        <span id="statusModalCustomer">-</span>
                    </p>
                    <p style="margin-bottom: 8px;">
                        <strong>Jadwal:</strong>
                        <span id="statusModalSchedule">-</span>
                    </p>
                    <p style="margin-bottom: 0;">
                        <strong>Status Saat Ini:</strong>
                        <span id="statusModalCurrentBadge" class="badge badge-pending">-</span>
                    </p>
                </div>

                <div class="form-group">
                    <label for="editReservationStatus">Pilih Status Baru</label>
                    <select id="editReservationStatus" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                        <option value="pending_payment">Pending Payment</option>
                        <option value="paid">Paid</option>
                        <option value="finished">Finished</option>
                        <option value="cancelled_refund">Cancelled Refund</option>
                        <option value="converted_to_credit">Converted to Credit</option>
                    </select>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button
                        type="button"
                        class="btn btn-outline-gaming"
                        style="flex: 1; padding: 12px; background: transparent; border: 1px solid var(--border); border-radius: 8px;"
                        onclick="closeStatusModal()">
                        Batal
                    </button>

                    <button
                        type="button"
                        id="btnSaveStatus"
                        class="btn btn-primary"
                        style="flex: 1; padding: 12px; border: none; border-radius: 8px;"
                        onclick="submitStatusChange()">
                        Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeStatusModal();
        }
    });
}

async function openStatusModal(id) {
    ensureStatusModalExists();

    let reservation = window.adminState.allReservations.find(r => r.id === id);

    if (!reservation) {
        reservation = await getReservationById(id);
    }

    if (!reservation) {
        alert("Data reservasi tidak ditemukan.");
        return;
    }

    document.getElementById('statusReservationId').value = reservation.id;
    document.getElementById('statusModalBooking').innerText = reservation.booking_code || '-';

    document.getElementById('statusModalCustomer').innerText =
        `${reservation.customer_name || '-'} (${reservation.phone || '-'})`;

    document.getElementById('statusModalSchedule').innerText =
        `${reservation.play_date || '-'} | ${formatTime(reservation.start_time)} - ${formatTime(reservation.end_time)}`;

    const currentBadge = document.getElementById('statusModalCurrentBadge');
    currentBadge.className = `badge ${getStatusBadgeClass(reservation.reservation_status)}`;
    currentBadge.innerText = getStatusLabel(reservation.reservation_status);

    document.getElementById('editReservationStatus').value =
        reservation.reservation_status || 'pending_payment';

    document.getElementById('statusModal').style.display = 'flex';
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) modal.style.display = 'none';
}

async function submitStatusChange() {
    const id = document.getElementById('statusReservationId').value;
    const newStatus = document.getElementById('editReservationStatus').value;
    const btn = document.getElementById('btnSaveStatus');

    if (!id || !newStatus) {
        alert("Data status belum lengkap.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    try {
        const success = await updateStatus(id, newStatus);

        if (success) {
            closeStatusModal();
        }
    } finally {
        btn.disabled = false;
        btn.innerText = "Simpan Perubahan";
    }
}

async function updateStatus(id, status) {
    try {
        const reservation = await getReservationById(id);

        if (!reservation) {
            alert("Data reservasi tidak ditemukan.");
            await loadAdminData();
            return false;
        }

        if (reservation.reservation_status === status) {
            alert("Status tidak berubah.");
            return false;
        }

        if (status === 'converted_to_credit') {
            const confirmCredit = confirm(
                `Yakin ingin mengubah reservasi ini menjadi saldo kredit?\n\n` +
                `Booking : ${reservation.booking_code}\n` +
                `Nama    : ${reservation.customer_name}\n` +
                `No HP   : ${reservation.phone}\n` +
                `Nominal : Rp ${Number(reservation.total_price || 0).toLocaleString()}\n\n` +
                `Setelah disimpan, saldo kredit akan otomatis dibuat.`
            );

            if (!confirmCredit) {
                return false;
            }
        }

        if (status === 'cancelled_refund') {
            const confirmRefund = confirm(
                `Yakin ingin mengubah reservasi ini menjadi Cancelled Refund?\n\n` +
                `Booking : ${reservation.booking_code}\n` +
                `Nama    : ${reservation.customer_name}\n` +
                `Nominal : Rp ${Number(reservation.total_price || 0).toLocaleString()}\n\n` +
                `Status ini menandakan dana perlu dikembalikan secara manual.`
            );

            if (!confirmRefund) {
                return false;
            }
        }

        const { error } = await supabase
            .from('reservations')
            .update({ reservation_status: status })
            .eq('id', id);

        if (error) {
            alert("Gagal update status: " + error.message);
            await loadAdminData();
            return false;
        }

        if (status === 'converted_to_credit') {
            await createCreditFromReservation(reservation);
        }

        await loadAdminData();

        if (typeof loadCreditData === 'function') {
            await loadCreditData();
        }

        if (typeof checkWalkinUnitStatuses === 'function') {
            await checkWalkinUnitStatuses();
        }

        alert("Status reservasi berhasil diperbarui.");
        return true;

    } catch (err) {
        console.error(err);
        alert(err.message || "Terjadi kesalahan saat update status.");
        await loadAdminData();
        return false;
    }
}

async function createCreditFromReservation(reservation) {
    const { data: existingCredit, error: checkError } = await supabase
        .from('credits')
        .select('id')
        .eq('reservation_id', reservation.id)
        .limit(1);

    if (checkError) {
        console.error(checkError);
        throw new Error("Gagal mengecek saldo kredit.");
    }

    if (existingCredit && existingCredit.length > 0) {
        return;
    }

    const { error: insertError } = await supabase
        .from('credits')
        .insert([{
            reservation_id: reservation.id,
            phone: reservation.phone,
            amount: reservation.total_price,
            credit_status: 'unused'
        }]);

    if (insertError) {
        console.error(insertError);
        throw new Error("Status berhasil diubah, tetapi gagal membuat saldo kredit.");
    }
}

window.loadAdminData = loadAdminData;
window.applyReservationFilters = applyReservationFilters;
window.resetReservationFilters = resetReservationFilters;
window.updateStatus = updateStatus;
window.openStatusModal = openStatusModal;
window.closeStatusModal = closeStatusModal;
window.submitStatusChange = submitStatusChange;
window.showReservationDetail = showReservationDetail;