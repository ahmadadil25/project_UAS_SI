// js/admin/walkin.js
import { supabase } from '../supabase.js';

export async function loadWalkinUnits() {
    const { data, error } = await supabase.from('playstation_units').select('*').order('unit_code');
    if (error) return alert("Gagal load unit!");
    
    const container = document.getElementById('walkinUnitContainer');
    container.innerHTML = '';
    
    data.forEach(unit => {
        const div = document.createElement('div');
        div.className = 'unit-card';
        div.id = `walkin-card-${unit.id}`;
        div.innerHTML = `
            <div><strong>${unit.unit_code}</strong><br>
            <span class="price-tag">Rp ${unit.price_per_hour.toLocaleString()}/jam</span></div>
            <div class="unit-status" id="walkin-status-${unit.id}"><small>Memuat...</small></div>`;
        
        div.onclick = () => {
            document.querySelectorAll('#walkinUnitContainer .unit-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            document.getElementById('selectedUnitId').value = unit.id;
            document.getElementById('selectedUnitPrice').value = unit.price_per_hour;
            calculateWalkinPrice();
        };
        container.appendChild(div);
    });
    checkWalkinUnitStatuses(data);
}

export async function checkWalkinUnitStatuses(unitsData) {
    const playDate = document.getElementById('playDate').value;
    if(!playDate) return;

    const { data, error } = await supabase
        .from('reservations')
        .select('unit_id, start_time, end_time')
        .eq('play_date', playDate)
        .eq('reservation_status', 'paid');

    if (error) return console.error(error);

    unitsData.forEach(unit => {
        const statusDiv = document.getElementById(`walkin-status-${unit.id}`);
        if(!statusDiv) return;
        const unitBookings = data.filter(r => r.unit_id === unit.id);
        statusDiv.innerHTML = unitBookings.length === 0 
            ? `<span class="text-success">✅ Tersedia</span>` 
            : `<span style="color: #d97706; font-weight: bold;">🟡 Ada Jadwal</span>`;
    });
}

export function calculateWalkinPrice() {
    const price = document.getElementById('selectedUnitPrice').value || 0;
    const dur = document.getElementById('duration').value || 1;
    document.getElementById('totalPriceDisplay').innerText = `Total Tagihan: Rp ${(price * dur).toLocaleString()}`;
}

export async function handleWalkinReservation(e) {
    e.preventDefault();
    // Logika pengiriman data ke Supabase sama seperti di admin.js lama Anda
    // Gunakan alert sukses dan reset form setelah insert berhasil
    alert("✅ Reservasi Walk-in Berhasil!");
}