// admin-nav.js
// Berisi fungsi navigasi tab pada dashboard admin.
function switchTab(tabId, btnId) {
    document.querySelectorAll('.admin-tab').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
    const targetBtn = document.getElementById(btnId);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

window.switchTab = switchTab;
