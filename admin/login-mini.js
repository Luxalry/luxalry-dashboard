const API_URL = 'https://luxalry-api.vercel.app/api/admin';
const ACCESS_API_URL = 'https://luxalry-api.vercel.app/api/access';

// Check if already logged in
if (localStorage.getItem('admin_token') || sessionStorage.getItem('escalation_token')) {
    window.location.href = 'dashboard';
} else {
    document.getElementById('app-layout').style.display = 'flex';
}

let isEmergencyMode = false;
const toggleBtn = document.getElementById('toggle-mode');
const submitBtn = document.querySelector('button[type="submit"]');
const submitBtnText = submitBtn.querySelector('span');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        isEmergencyMode = !isEmergencyMode;
        if (isEmergencyMode) {
            toggleBtn.innerText = '[ Switch to Standard Login ]';
            toggleBtn.classList.add('text-red-400');
            submitBtn.classList.remove('bg-brand-gold', 'text-brand-dark');
            submitBtn.classList.add('bg-red-600', 'text-white');
            submitBtnText.innerText = 'REQUEST EMERGENCY ACCESS';
        } else {
            toggleBtn.innerText = '[ Switch to Emergency Access ]';
            toggleBtn.classList.remove('text-red-400');
            submitBtn.classList.add('bg-brand-gold', 'text-brand-dark');
            submitBtn.classList.remove('bg-red-600', 'text-white');
            submitBtnText.innerText = 'INITIATE SESSION';
        }
    });
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const btnSpan = btn.querySelector('span');
    const errorMsg = document.getElementById('login-error');
    const originalText = btnSpan.innerText;

    // Loading State
    btn.disabled = true;
    btnSpan.innerText = isEmergencyMode ? 'REQUESTING...' : 'AUTHENTICATING...';
    btn.classList.add('opacity-80', 'cursor-wait');
    errorMsg.style.display = 'none';

    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    try {
        if (isEmergencyMode) {
            // --- Emergency Flow ---
            const response = await fetch(`${ACCESS_API_URL}?action=request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Request Failed');

            const requestId = result.requestId;
            btnSpan.innerText = 'WAITING FOR APPROVAL...';

            // Start Polling
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${ACCESS_API_URL}?action=status&id=${requestId}`);
                    const statusData = await statusRes.json();

                    if (statusData.status === 'approved') {
                        clearInterval(pollInterval);
                        localStorage.clear();

                        sessionStorage.setItem('backdoor_token', statusData.token);
                        sessionStorage.setItem('user_role', 'super_admin');
                        sessionStorage.setItem('auth_type', 'backdoor');
                        sessionStorage.setItem('escalation_token', statusData.token);
                        sessionStorage.setItem('user_role', 'super_admin');
                        sessionStorage.setItem('auth_type', 'escalation');

                        btnSpan.innerText = 'ACCESS GRANTED';
                        btn.classList.remove('bg-red-600');
                        btn.classList.add('bg-emerald-600');

                        setTimeout(() => window.location.href = 'dashboard', 500);
                    } else if (statusData.status === 'denied') {
                        clearInterval(pollInterval);
                        throw new Error('Request Denied by Admin');
                    }
                } catch (pollErr) {
                    clearInterval(pollInterval);
                    errorMsg.innerText = 'APPROVAL FAILED: ' + pollErr.message;
                    errorMsg.style.display = 'block';
                    resetBtn();
                }
            }, 5000);

        } else {
            // --- Standard Flow ---
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                sessionStorage.clear();

                localStorage.setItem('admin_token', result.token || '');
                localStorage.setItem('user_role', result.role || 'editor');
                localStorage.setItem('auth_type', result.type || 'unknown');
                localStorage.setItem('user_permissions', JSON.stringify(result.permissions || { can_edit: false, can_view_stats: false }));

                // Note: We no longer store basic_cred for backdoor!
                // The old backdoor path is effectively deprecated/removed from frontend usage here.

                btn.classList.remove('bg-brand-gold', 'hover:bg-amber-500', 'text-brand-dark');
                btn.classList.add('bg-emerald-600', 'text-white');
                btnSpan.innerText = 'ACCESS GRANTED';

                setTimeout(() => {
                    window.location.href = 'dashboard';
                }, 600);

            } else {
                throw new Error(result.error || 'فشل الدخول');
            }
        }
    } catch (err) {
        // if (!isEmergencyMode) { // Emergency mode handles its own errors during polling
        errorMsg.innerText = 'ACCESS DENIED: ' + (err.message || 'UNKNOWN ERROR');
        errorMsg.style.display = 'block';
        resetBtn();
    }


    function resetBtn() {
        btn.disabled = false;
        btnSpan.innerText = originalText;
        btn.classList.remove('opacity-80', 'cursor-wait');
    }
});
