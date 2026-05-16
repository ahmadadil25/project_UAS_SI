// admin-auth.js
// Berisi fungsi login dan logout admin.
async function handleLogin(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('adminEmail').value,
        password: document.getElementById('adminPass').value
    });
    if (error) {
        await adminAlert("Login gagal: " + error.message, "Login Gagal");
    } else {
        location.reload();
    }
}

function handleLogout() {
    localStorage.removeItem(window.ADMIN_ACTIVE_TAB_KEY || 'pshubAdminActiveTab');
    supabase.auth.signOut().then(() => location.reload());
}

window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
