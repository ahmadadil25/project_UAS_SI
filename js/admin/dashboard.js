// js/admin/dashboard.js
import { supabase } from '../supabase.js';

export async function loadAdminData() {
    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .order('play_date', { ascending: false })
        .order('start_time', { ascending: false });

    if (error) {
        console.error("Gagal load data reservasi:", error);
        return { data: [], count: 0, revenue: 0 };
    }

    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';
    
    const todayStr = new Date().toISOString().split('T')[0];
    let count = 0, revenue = 0;

    data.forEach(r => {
        // Logika statistik harian
        if (r.play_date === todayStr) {
            count++;
            if(r.reservation_status === 'paid' || r.reservation_status === 'finished') {
                revenue += r.total_price;
            }
        }

        // Render baris tabel
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

    // Update kartu statistik
    document.getElementById('todayCount').innerText = count;
    document.getElementById('todayRevenue').innerText = `Rp ${revenue.toLocaleString()}`;
    
    return { data };
}

export async function updateStatus(id, status) {
    const { error } = await supabase.from('reservations').update({ reservation_status: status }).eq('id', id);
    if(error) {
        alert("Gagal update status: " + error.message);
    } else {
        await loadAdminData(); // Refresh data setelah update
    }
}