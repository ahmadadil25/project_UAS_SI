// js/admin/finance.js
import { supabase } from '../supabase.js';

export async function loadLaporanByDate() {
    const targetDate = document.getElementById('filterDate').value || new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
        .from('reservations')
        .select('*, playstation_units(unit_code)')
        .eq('play_date', targetDate)
        .in('reservation_status', ['paid', 'finished']);

    if (error) return console.error(error);

    let total = 0;
    const container = document.getElementById('laporanContainer');
    
    let html = `<table style="width:100%; border-collapse:collapse;">
        <thead><tr><th>Booking</th><th>Unit</th><th>Nama</th><th>Total</th></tr></thead>
        <tbody>`;
    
    data.forEach(r => {
        total += r.total_price;
        html += `<tr><td>${r.booking_code}</td><td>${r.playstation_units.unit_code}</td><td>${r.customer_name}</td><td>Rp ${r.total_price.toLocaleString()}</td></tr>`;
    });
    
    html += `</tbody><tfoot><tr><th colspan="3">TOTAL</th><th>Rp ${total.toLocaleString()}</th></tr></tfoot></table>`;
    container.innerHTML = html;
    window.currentReportData = data; // Simpan data untuk dicetak
}

export function printLaporan() {
    const data = window.currentReportData;
    if (!data) return alert("Pilih tanggal dulu!");
    
    // Gunakan printArea untuk mencetak
    const printArea = document.getElementById('printArea');
    printArea.innerHTML = document.getElementById('laporanContainer').innerHTML;
    window.print();
}