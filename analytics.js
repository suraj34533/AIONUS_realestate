/**
 * ========================================
 * AIONUS ANALYTICS DASHBOARD
 * Dark Fintech/Trading Style
 * ========================================
 */

// ========================================
// GLOBAL STATE
// ========================================
let leadsData = [];
let visitsData = [];
let leadsChart = null;
let visitsChart = null;
let sourceChart = null;
let stagesChart = null;

// Chart.js Configuration
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.display = false;

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 AIONUS Analytics Loading...');

    // Load theme
    if (localStorage.getItem('adminDarkMode') === 'false') {
        document.body.classList.add('light-mode');
    }
    updateThemeButton();

    // Update timestamp
    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();

    // Load data
    await loadAllData();

    console.log('✅ Analytics Ready');
});

// ========================================
// DATA LOADING
// ========================================
async function loadAllData() {
    try {
        const [leadsRes, visitsRes] = await Promise.all([
            fetch('/api/crm/get-leads'),
            fetch('/api/schedule-visit')
        ]);

        const leadsJson = await leadsRes.json();
        const visitsJson = await visitsRes.json();

        leadsData = leadsJson.success ? (leadsJson.leads || []) : [];
        visitsData = visitsJson.success ? (visitsJson.data || []) : [];

        console.log(`📊 Loaded: ${leadsData.length} leads, ${visitsData.length} visits`);

        // Update all components
        updateHeroStats();
        updateStatCards();
        updateSourceStats();
        renderLeadsChart();
        renderVisitsChart();
        renderSourceChart();
        renderStagesChart();
        renderRecentLeadsTable();
        renderUpcomingVisitsTable();
        animateBars();

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// ========================================
// HERO STATS
// ========================================
function updateHeroStats() {
    // Calculate estimated total value (mock calculation based on leads)
    const totalValue = leadsData.length * 250000; // Average property value
    const hotValue = leadsData.filter(l => l.stage === 'hot').length * 350000;

    animateCounter('heroValue', 0, totalValue, 2000, true);
    animateCounter('sideValue', 0, hotValue, 2000, true);

    // Today's leads
    const today = new Date().toISOString().split('T')[0];
    const todayLeads = leadsData.filter(l => l.created_at?.split('T')[0] === today).length;
    document.getElementById('todayLeadsCount').textContent = todayLeads;

    // Conversion rate
    const closedLeads = leadsData.filter(l => l.stage === 'closed').length;
    const rate = leadsData.length > 0 ? Math.round((closedLeads / leadsData.length) * 100) : 0;
    document.getElementById('conversionRateValue').textContent = rate + '%';
}

// ========================================
// STAT CARDS
// ========================================
function updateStatCards() {
    animateCounter('totalLeads', 0, leadsData.length, 1500);
    animateCounter('totalVisits', 0, visitsData.length, 1500);
    animateCounter('hotLeads', 0, leadsData.filter(l => l.stage === 'hot').length, 1500);
    animateCounter('closedLeads', 0, leadsData.filter(l => l.stage === 'closed').length, 1500);
}

// ========================================
// SOURCE STATS
// ========================================
function updateSourceStats() {
    const sources = {};
    leadsData.forEach(lead => {
        const src = (lead.lead_source || 'chatbot').toLowerCase();
        sources[src] = (sources[src] || 0) + 1;
    });

    document.getElementById('chatbotCount').textContent = sources['chatbot'] || 0;
    document.getElementById('websiteCount').textContent = sources['website'] || 0;
    document.getElementById('referralCount').textContent = sources['referral'] || 0;
}

// ========================================
// ANIMATE COUNTER
// ========================================
function animateCounter(elementId, start, end, duration, isCurrency = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startTime = performance.now();
    const range = end - start;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (range * easeOut));

        if (isCurrency) {
            element.textContent = '$' + current.toLocaleString();
        } else {
            element.textContent = current.toLocaleString();
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ========================================
// ANIMATE BARS
// ========================================
function animateBars() {
    const bars = document.querySelectorAll('.hero-bar-chart .bar');
    const heights = [30, 45, 55, 40, 70, 85, 95, 100, 90, 75, 60, 50];

    bars.forEach((bar, index) => {
        setTimeout(() => {
            bar.style.height = heights[index] + '%';
        }, index * 50);
    });
}

// ========================================
// CHARTS
// ========================================
function renderLeadsChart() {
    const ctx = document.getElementById('leadsChart')?.getContext('2d');
    if (!ctx) return;

    const last7Days = getLast7Days();
    const counts = countByDay(leadsData, 'created_at', last7Days);

    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
    const textColor = isLight ? '#64748b' : '#8b95a7';

    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(0, 217, 132, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 217, 132, 0.02)');

    if (leadsChart) leadsChart.destroy();

    leadsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(d => formatShortDate(d)),
            datasets: [{
                label: 'Leads',
                data: counts,
                borderColor: '#00d984',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: '#00d984',
                pointBorderColor: isLight ? '#fff' : '#151b2e',
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 2000, easing: 'easeOutQuart' },
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: textColor },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderVisitsChart() {
    const ctx = document.getElementById('visitsChart')?.getContext('2d');
    if (!ctx) return;

    const last7Days = getLast7Days();
    const counts = countByDay(visitsData, 'visit_date', last7Days);

    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
    const textColor = isLight ? '#64748b' : '#8b95a7';

    if (visitsChart) visitsChart.destroy();

    visitsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last7Days.map(d => formatShortDate(d)),
            datasets: [{
                label: 'Visits',
                data: counts,
                backgroundColor: 'rgba(79, 125, 243, 0.8)',
                borderColor: '#4f7df3',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 2000, easing: 'easeOutQuart' },
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: textColor },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderSourceChart() {
    const ctx = document.getElementById('sourceChart')?.getContext('2d');
    if (!ctx) return;

    const sources = {};
    leadsData.forEach(lead => {
        const src = lead.lead_source || 'chatbot';
        sources[src] = (sources[src] || 0) + 1;
    });

    if (Object.keys(sources).length === 0) {
        sources['No Data'] = 1;
    }

    if (sourceChart) sourceChart.destroy();

    sourceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(sources),
            datasets: [{
                data: Object.values(sources),
                backgroundColor: ['#9945ff', '#00d984', '#4f7df3', '#ff9f43', '#f93a8b'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            animation: { animateRotate: true, duration: 2000 },
            plugins: { legend: { display: false } }
        }
    });
}

function renderStagesChart() {
    const ctx = document.getElementById('stagesChart')?.getContext('2d');
    if (!ctx) return;

    const stages = { new: 0, contacted: 0, interested: 0, hot: 0, closed: 0 };
    leadsData.forEach(lead => {
        if (stages.hasOwnProperty(lead.stage)) {
            stages[lead.stage]++;
        }
    });

    const isLight = document.body.classList.contains('light-mode');
    const textColor = isLight ? '#64748b' : '#8b95a7';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';

    if (stagesChart) stagesChart.destroy();

    stagesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['New', 'Contacted', 'Interested', 'Hot', 'Closed'],
            datasets: [{
                label: 'Leads',
                data: Object.values(stages),
                backgroundColor: [
                    'rgba(139, 149, 167, 0.8)',
                    'rgba(79, 125, 243, 0.8)',
                    'rgba(153, 69, 255, 0.8)',
                    'rgba(249, 58, 139, 0.8)',
                    'rgba(0, 217, 132, 0.8)'
                ],
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 2000 },
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            }
        }
    });
}

// ========================================
// TABLES
// ========================================
function renderRecentLeadsTable() {
    const tbody = document.getElementById('recentLeadsBody');
    if (!tbody) return;

    const recent = leadsData.slice(0, 6);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No leads yet</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(lead => `
        <tr>
            <td class="td-name">${escapeHtml(lead.name)}</td>
            <td class="td-phone">${escapeHtml(lead.phone)}</td>
            <td><span class="stage-badge stage-${lead.stage}">${lead.stage}</span></td>
            <td class="td-date">${formatDate(lead.created_at)}</td>
        </tr>
    `).join('');
}

function renderUpcomingVisitsTable() {
    const tbody = document.getElementById('upcomingVisitsBody');
    if (!tbody) return;

    const today = new Date().toISOString().split('T')[0];
    const upcoming = visitsData
        .filter(v => v.visit_date >= today)
        .sort((a, b) => a.visit_date.localeCompare(b.visit_date))
        .slice(0, 6);

    if (upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No upcoming visits</td></tr>';
        return;
    }

    tbody.innerHTML = upcoming.map(visit => `
        <tr>
            <td class="td-name">${escapeHtml(visit.name)}</td>
            <td class="td-phone">${escapeHtml(visit.phone)}</td>
            <td class="td-date">${formatDate(visit.visit_date)}</td>
            <td>${escapeHtml(visit.visit_time)}</td>
        </tr>
    `).join('');
}

// ========================================
// THEME TOGGLE
// ========================================
function toggleDarkMode() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('adminDarkMode', !isLight);
    updateThemeButton();

    // Re-render charts
    setTimeout(() => {
        renderLeadsChart();
        renderVisitsChart();
        renderSourceChart();
        renderStagesChart();
    }, 100);
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    const isLight = document.body.classList.contains('light-mode');
    btn.innerHTML = isLight
        ? '<span class="icon">🌙</span> Dark Mode'
        : '<span class="icon">☀️</span> Light Mode';
}

// ========================================
// UTILITIES
// ========================================
function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
}

function countByDay(data, dateField, days) {
    return days.map(day =>
        data.filter(item => {
            const itemDate = item[dateField]?.split('T')[0];
            return itemDate === day;
        }).length
    );
}

function formatShortDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
