// Use relative API base so the frontend works regardless of port/host.
// Hardcoding localhost:5000 breaks as soon as you change PORT.
const API = "/api";
let token = localStorage.getItem("token");
let weeklyChartInstance = null;

function el(id) { return document.getElementById(id); }

/* ===================== NAVBAR ===================== */
function setNavbarVisible(show) {
    const nav = el("topNav");
    if (!nav) return;
    nav.style.display = show ? "block" : "none";
}

/* ===================== VIEW HELPERS ===================== */
function hideAll() {
    [
        "psychologistPage",
        "introPage",
        "loginPage",
        "signupPage",
        "forgotPage",
        "dashboardPage",
        "screeningPage",
        "profilePage"
    ].forEach(id => el(id)?.classList.add("d-none"));
}

function requireAuth() {
    if (!token) {
        showLogin();
        return false;
    }
    return true;
}

/* ===================== NAVIGATION ===================== */
function showLogin() {
    // force a clean auth state whenever login screen is shown
    localStorage.removeItem("token");
    token = null;

    hideAll();
    setNavbarVisible(false);
    el("loginPage")?.classList.remove("d-none");
}


function showSignup() {
    hideAll();
    setNavbarVisible(false);
    el("signupPage")?.classList.remove("d-none");
}

function showForgot() {
    if (!requireAuth()) return; // if not logged in, stays on login
    hideAll();
    setNavbarVisible(true);
    el("forgotPage")?.classList.remove("d-none");
}

function showDashboard() {
    if (!requireAuth()) return;

    hideAll();
    setNavbarVisible(true);
    el("dashboardPage")?.classList.remove("d-none");
    debugWhoAmI();


    wireDashboardButtons();

    checkToday();
    loadTodayValues();
    loadWeeklyChart();
    loadDashboardAlerts();
}

function showScreening() {
    if (!requireAuth()) return;

    hideAll();
    setNavbarVisible(true);
    el("screeningPage")?.classList.remove("d-none");

    const page = document.getElementById("screeningPage");
    const box = document.getElementById("screeningResult");
    const form = document.getElementById("screeningForm");

    if (page && box) {
        // Place result box at the top, but after the heading if it exists
        const heading = page.querySelector("h1, h2, h3");
        if (heading && heading.nextSibling) {
            page.insertBefore(box, heading.nextSibling);
        } else if (form) {
            // Otherwise place it just before the form
            page.insertBefore(box, form);
        } else {
            // Fallback: first element child (avoids whitespace text nodes)
            const firstEl = page.firstElementChild;
            if (firstEl) page.insertBefore(box, firstEl);
            else page.appendChild(box);
        }
    }

    // Show previous result when opening screening page
    loadLatestScreeningResult();
}



function showProfile() {
    if (!requireAuth()) return;
    hideAll();
    setNavbarVisible(true);
    el("profilePage")?.classList.remove("d-none");
    loadProfile();
}

/* ===================== PASSWORD TOGGLE ===================== */
function togglePassword(inputId, iconSpan) {
    const input = el(inputId);
    if (!input) return;
    const icon = iconSpan?.querySelector("i");
    if (!icon) return;

    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("bi-eye", "bi-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("bi-eye-slash", "bi-eye");
    }
}

/* ===================== AUTH ===================== */
async function login() {
    const email = el("loginEmail")?.value?.trim();
    const password = el("loginPassword")?.value;

    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.token) {
        alert(data.message || "Invalid credentials");
        return;
    }

    localStorage.setItem("token", data.token);
    token = data.token;
    showDashboard();
}

async function signup() {
    const name = el("signupName")?.value?.trim();
    const email = el("signupEmail")?.value?.trim();
    const password = el("signupPassword")?.value;

    const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    alert(data.message || "Account created");
    showLogin();
}

async function changePassword() {
    if (!token) {
        alert("You must be logged in to change password.");
        showLogin();
        return;
    }

    const oldPassword = el("oldPassword")?.value;
    const newPassword = el("newPassword")?.value;

    if (!oldPassword || !newPassword) {
        alert("Enter both current and new password.");
        return;
    }

    const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        alert(data.message || "Failed to update password");
        return;
    }

    alert(data.message || "Password updated successfully");
}



function logout() {
    localStorage.removeItem("token");
    token = null;
    console.log("LOGGED OUT. token:", token);

    hideAll();
    setNavbarVisible(false);
    el("introPage")?.classList.remove("d-none");
}


/* ===================== DASHBOARD BUTTON WIRING ===================== */
function wireDashboardButtons() {
    const btn = el("takeTestBtn");
    if (!btn) return;

    // Always route dashboard button through eligibility check.
    btn.onclick = startScreeningFromDashboard;
}

/* ===================== DASHBOARD ALERTS (SCREENING) ===================== */
async function loadDashboardAlerts() {
    const alertBox = el("screeningAlertBox");
    const summaryBox = el("screeningSummary");

    // These elements may not exist if you haven't updated the HTML.
    if (!alertBox && !summaryBox) return;

    const res = await fetch(`${API}/stats/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
        logout();
        return;
    }

    if (!res.ok) return;
    const data = await res.json();

    // Latest screening summary
    if (summaryBox) {
        if (data.screening) {
            const dt = new Date(data.screening.created_at);
            summaryBox.innerText = `Latest screening: ${data.screening.level} (score ${data.screening.score}) on ${dt.toLocaleDateString('en-IN')}`;
        } else {
            summaryBox.innerText = "No screening results yet.";
        }
    }

    // Persistence alert
    if (alertBox) {
        if (data.screeningAlert && data.screeningAlert.shouldConsult) {
            alertBox.classList.remove("d-none");
            alertBox.innerText = "Your screening indicates persistent high distress. Consider consulting a qualified healthcare professional.";
        } else {
            alertBox.classList.add("d-none");
            alertBox.innerText = "";
        }
    }
}


async function loadLatestScreeningResult() {
    const resultBox = el("screeningResult");
    if (!resultBox) return;

    const res = await fetch(`${API}/screening/latest`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
        logout();
        return;
    }

    if (!res.ok) return;

    const latest = await res.json();
    if (!latest) {
        // Hide or show default message
        resultBox.classList.add("d-none");
        resultBox.innerText = "";
        return;
    }

    const dt = new Date(latest.created_at);
    resultBox.innerText =
        `Previous result: ${latest.level} (score ${latest.score}) on ${dt.toLocaleString('en-IN')}.`;
    resultBox.classList.remove("d-none");
}


/* ===================== SCREENING START (FROM DASHBOARD) ===================== */
async function startScreeningFromDashboard() {
    if (!requireAuth()) return;

    const summaryBox = el("screeningSummary");
    const alertBox = el("screeningAlertBox");

    const res = await fetch(`${API}/screening/eligibility`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
        logout();
        return;
    }

    const data = await res.json().catch(() => ({}));

    // If allowed -> go to screening page
    if (res.ok && data.canTake) {
        showScreening();
        return;
    }

    // Not allowed -> show message on dashboard (NO POPUP)
    let msg = "You can take the screening test only once every 7 days.";
    if (data.nextEligibleAt) {
        const dt = new Date(data.nextEligibleAt);
        msg += ` Next eligible: ${dt.toLocaleString('en-IN')}.`;
    }

    // Prefer summary box text (subtle), else use alert box
    if (summaryBox) {
        summaryBox.innerText = msg;
        summaryBox.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (alertBox) {
        alertBox.classList.remove("d-none");
        alertBox.innerText = msg;
        alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
        // Fallback if HTML doesn't have those elements
        alert(msg);
    }
}

/* ===================== DAILY CHECK-IN ===================== */
async function checkToday() {
    const todayStatus = el("todayStatus");
    if (!todayStatus) return;

    const res = await fetch(`${API}/checkin/today`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
        logout();
        return;
    }

    const data = await res.json();

    if (!data.exists) {
        todayStatus.innerText = "Please complete today's check-in";
        new bootstrap.Modal(el("dailyCheckinModal")).show();
    } else {
        todayStatus.innerText = "Check-in completed for today";
    }
}

async function submitCheckin() {
    const body = {
        mood: el("mood")?.value,
        stress: el("stress")?.value,
        energy: el("energy")?.value,
        sleep: el("sleep")?.value
    };

    const res = await fetch(`${API}/checkin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Check-in failed");
        return;
    }

    bootstrap.Modal.getInstance(el("dailyCheckinModal")).hide();
    el("todayStatus").innerText = "Check-in completed for today";

    await loadTodayValues();
    await loadWeeklyChart();
}

/* ===================== DASHBOARD VALUES ===================== */
async function loadTodayValues() {
    const res = await fetch(`${API}/checkin/latest`, {
        headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) return;

    const latest = await res.json();
    if (!latest) return;

    el("moodValue").innerText = latest.mood ?? "–";
    el("energyValue").innerText = latest.energy ?? "–";
    el("sleepValue").innerText = latest.sleep ?? "–";
    handleMoodSuggestion(latest.mood, latest.energy, latest.sleep, latest.stress);
}

/* ===================== CHART ===================== */
async function loadWeeklyChart() {
    const res = await fetch(`${API}/checkin`, {
        headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) return;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const last7 = data.slice(-7);

    const labels = last7.map(d => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString("en-IN", { weekday: "short" });
    });

    const moods = last7.map(d => d.mood);
    const stresses = last7.map(d => d.stress);
    const energies = last7.map(d => d.energy);
    const sleeps = last7.map(d => d.sleep);

    const canvas = el("weeklyChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (weeklyChartInstance) weeklyChartInstance.destroy();

    weeklyChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: "Mood", data: moods, borderColor: "#2f7f7b", tension: 0.3 },
                { label: "Stress", data: stresses, borderColor: "#e76f51", tension: 0.3 },
                { label: "Energy", data: energies, borderColor: "#264653", tension: 0.3 },
                { label: "Sleep", data: sleeps, borderColor: "#457b9d", tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { y: { min: 0, max: 10, ticks: { stepSize: 1 } } }
        }
    });
}

/* ===================== PROFILE (PLACEHOLDER) ===================== */
function loadProfile() {
    (async () => {
        const res = await fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401) {
            logout();
            return;
        }

        if (!res.ok) return;
        const me = await res.json();
        if (!me) return;

        el("profileName").innerText = me.name || "—";
        el("profileEmail").innerText = me.email || "—";
    })();
}

/* ===================== INIT ===================== */
function initApp() {
    hideAll();
    setNavbarVisible(false);

    if (!token) {
        el("psychologistPage")?.classList.remove("d-none");
    } else {
        showDashboard();
    }
}

initApp();

/* Ensure inline onclick works */
window.showLogin = showLogin;
window.showSignup = showSignup;
window.showForgot = showForgot;
window.showDashboard = showDashboard;
window.showScreening = showScreening;
window.showProfile = showProfile;
window.login = login;
window.signup = signup;

window.logout = logout;
window.togglePassword = togglePassword;
window.submitCheckin = submitCheckin;
window.submitScreening = submitScreening;
window.startScreeningFromDashboard = startScreeningFromDashboard;
window.changePassword = changePassword;


/* ===================== SCREENING ===================== */
function handleMoodSuggestion(mood, energy, sleep, stress) {
    const btn = document.getElementById("takeTestBtn");
    if (!btn) return;

    const needsTest =
        (mood !== null && mood <= 4) ||
        (energy !== null && energy <= 4) ||
        (sleep !== null && sleep <= 4) ||
        (stress !== null && stress >= 7);

    // Always keep the screening entry point visible.
    // If today's signals look concerning, change the copy to nudge the user.
    if (needsTest) {
        btn.innerText = "Not feeling your best? Take a quick test";
    } else {
        btn.innerText = "Take a Test";
    }
}

function submitScreening() {
    const form = document.getElementById("screeningForm");
    const resultBox = document.getElementById("screeningResult");

    const answers = [];

    for (let i = 1; i <= 7; i++) {
        const q = form.querySelector(`input[name="q${i}"]:checked`);
        if (!q) {
            alert("Please answer all questions.");
            return;
        }
        answers.push(parseInt(q.value));
    }

    fetch(`${API}/screening/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
    })
        .then(async (res) => {
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                // Keep defensive handling, but dashboard click should prevent most cases.
                if (res.status === 429) {
                    // No popup requirement was only for dashboard button;
                    // Here, user is already on screening page trying to submit.
                    // You can change this to inline text too if you want.
                    let msg = data.message || "You can take the screening test only once every 7 days.";
                    if (data.nextEligibleAt) {
                        const dt = new Date(data.nextEligibleAt);
                        msg += ` Next eligible: ${dt.toLocaleString('en-IN')}.`;
                    }
                    alert(msg);
                    return;
                }

                alert(data.message || "Failed to submit screening");
                return;
            }

            let message = `Result saved: ${data.level} (score ${data.score}).`;
            if (String(data.level).toLowerCase() === "high") {
                message += " Consider reaching out for professional support if you feel unsafe or overwhelmed.";
            }

            resultBox.innerText = message;
            resultBox.classList.remove("d-none");

            loadDashboardAlerts();
        });
}

async function debugWhoAmI() {
    const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const me = await res.json().catch(() => null);
    console.log("AUTH ME:", me);
}
function goToIntro() {
    hideAll();
    el("introPage")?.classList.remove("d-none");
}
window.goToIntro = goToIntro;
