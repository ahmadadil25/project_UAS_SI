// admin-auth.js
// Berisi fungsi login dan logout admin.
async function handleLogin(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('adminEmail').value,
        password: document.getElementById('adminPass').value
    });
    if (error) alert("Login Gagal: " + error.message);
    else location.reload();
}

function handleLogout() {
    supabase.auth.signOut().then(() => location.reload());
}

window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
