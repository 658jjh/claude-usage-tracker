/**
 * heatmap.js
 *
 * Peak activity heatmap with two switchable views:
 *   - Hours: actual dates × 24 hour columns (only dates with data)
 *   - Days:  GitHub-style calendar grid (actual dates, last ~16 weeks)
 *
 * Features: segmented toggle, staggered cell animations, smooth view
 * transitions, polished tooltips, and click-to-scroll on cells.
 */

import { toggleDay } from './sessions-table.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let currentView = 'hours';
let cachedSessions = [];

/**
 * Determine heatmap intensity level based on cost.
 */
function heatmapLevel(cost, maxCost) {
    if (cost === 0 || maxCost === 0) return 0;
    const ratio = cost / maxCost;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.65) return 3;
    return 4;
}

// ─── Hours View ─────────────────────────────────────────────

function renderHoursView(allSessions) {
    // Group sessions by date → hour
    const byDate = {};
    allSessions.forEach(s => {
        if (!s.time || !s.date) return;
        const hour = parseInt(s.time.split(':')[0], 10);
        if (isNaN(hour) || hour < 0 || hour > 23) return;
        if (!byDate[s.date]) byDate[s.date] = Array.from({ length: 24 }, () => ({ cost: 0, count: 0 }));
        byDate[s.date][hour].cost += s.cost;
        byDate[s.date][hour].count += 1;
    });

    // Only dates with data, sorted newest first
    const dates = Object.keys(byDate).sort().reverse();
    const numRows = dates.length;
    if (numRows === 0) return;

    // Find max cost across all cells for scaling
    let maxCost = 0;
    for (const date of dates) {
        for (const cell of byDate[date]) {
            if (cell.cost > maxCost) maxCost = cell.cost;
        }
    }

    // Unified grid: 1 date-label column + 24 hour columns
    // Row 0 = hour labels, rows 1..N = date rows
    const gridEl = document.getElementById('heatmap-hours-grid');
    gridEl.style.gridTemplateRows = `18px repeat(${numRows}, 22px)`;

    let html = '';

    // Row 0: corner cell + 24 hour labels
    html += '<div class="heatmap-corner"></div>';
    for (let i = 0; i < 24; i++) {
        const label = i % 3 === 0 ? i.toString() : '';
        html += `<div class="heatmap-hour-label">${label}</div>`;
    }

    // Date rows
    for (let r = 0; r < numRows; r++) {
        const date = dates[r];
        const dateObj = new Date(date + 'T00:00:00');
        const label = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        html += `<div class="heatmap-day-label" title="${date}">${label}</div>`;

        for (let hour = 0; hour < 24; hour++) {
            const cell = byDate[date][hour];
            const level = heatmapLevel(cell.cost, maxCost);
            const delay = (r * 12 + hour * 3);
            html += `<div class="heatmap-cell level-${level}"
                data-date="${date}" data-hour="${hour}"
                data-cost="${cell.cost.toFixed(2)}" data-count="${cell.count}"
                style="animation-delay:${delay}ms"></div>`;
        }
    }

    gridEl.innerHTML = html;
    setupHoursTooltip(gridEl);
    setupHoursClick(gridEl);
}

// ─── Days View ──────────────────────────────────────────────

function renderDaysView(allSessions) {
    // Aggregate sessions by date
    const byDate = {};
    allSessions.forEach(s => {
        if (!s.date) return;
        if (!byDate[s.date]) byDate[s.date] = { cost: 0, count: 0, sources: {} };
        byDate[s.date].cost += s.cost;
        byDate[s.date].count += 1;
        const src = s.source || 'Unknown';
        byDate[s.date].sources[src] = (byDate[s.date].sources[src] || 0) + 1;
    });

    // Calculate date range: go back ~16 weeks from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the Monday of 15 weeks ago
    const startDate = new Date(today);
    const todayDow = startDate.getDay();
    const daysToMonday = todayDow === 0 ? 6 : todayDow - 1;
    startDate.setDate(startDate.getDate() - daysToMonday - (15 * 7));

    // Build list of all dates from startDate to today
    const allDates = [];
    const cursor = new Date(startDate);
    while (cursor <= today) {
        allDates.push(formatDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    // Find max cost for scaling
    let maxCost = 0;
    for (const d of allDates) {
        if (byDate[d] && byDate[d].cost > maxCost) maxCost = byDate[d].cost;
    }

    // Organize into weeks (columns) and days (rows, Mon=0 .. Sun=6)
    const weeks = [];
    let currentWeek = [];
    for (let i = 0; i < allDates.length; i++) {
        const dateStr = allDates[i];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dow = dateObj.getDay();
        const dayIdx = dow === 0 ? 6 : dow - 1; // Mon=0..Sun=6

        // Start a new week on Monday
        if (dayIdx === 0 && currentWeek.length > 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }

        currentWeek.push({
            date: dateStr,
            dayIdx,
            data: byDate[dateStr] || { cost: 0, count: 0, sources: {} }
        });
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const numWeeks = weeks.length;

    // Render day-of-week labels (Sun at top, Mon at bottom)
    const dayLabelsEl = document.getElementById('heatmap-days-day-labels');
    const reversedDays = [...DAY_NAMES].reverse(); // Sun, Sat, Fri, Thu, Wed, Tue, Mon
    dayLabelsEl.innerHTML = reversedDays.map((d, i) => {
        const show = i % 2 === 0; // Show Sun, Fri, Wed, Mon
        return `<div class="heatmap-days-day-label">${show ? d : ''}</div>`;
    }).join('');

    // Render month labels (newest first, track last seen month)
    const monthLabelsEl = document.getElementById('heatmap-days-month-labels');
    let monthLabelsHTML = '';
    let lastMonth = -1;
    for (let w = 0; w < numWeeks; w++) {
        const firstDay = weeks[w][0];
        const dateObj = new Date(firstDay.date + 'T00:00:00');
        const month = dateObj.getMonth();
        if (month !== lastMonth) {
            monthLabelsHTML += `<div class="heatmap-days-month-label" style="grid-column: ${w + 1}">${MONTH_NAMES[month]}</div>`;
            lastMonth = month;
        }
    }
    monthLabelsEl.innerHTML = monthLabelsHTML;
    monthLabelsEl.style.gridTemplateColumns = `repeat(${numWeeks}, 1fr)`;

    // Render grid cells
    const gridEl = document.getElementById('heatmap-days-grid');
    gridEl.style.gridTemplateColumns = `repeat(${numWeeks}, 1fr)`;

    // Build a 7-row × numWeeks-col grid
    // CSS grid-auto-flow: column fills top-to-bottom per column,
    // so we iterate week-by-week (column-by-column), Mon-Sun within each
    let cellsHTML = '';
    for (let w = 0; w < numWeeks; w++) {
        for (let dayRow = 6; dayRow >= 0; dayRow--) {
            const entry = weeks[w].find(e => e.dayIdx === dayRow);
            if (entry) {
                const level = heatmapLevel(entry.data.cost, maxCost);
                const delay = (w * 5 + dayRow * 8);
                const isToday = entry.date === formatDateStr(today);
                cellsHTML += `<div class="heatmap-cell heatmap-days-cell${isToday ? ' is-today' : ''} level-${level}"
                    data-date="${entry.date}"
                    data-cost="${entry.data.cost.toFixed(2)}"
                    data-count="${entry.data.count}"
                    data-sources='${JSON.stringify(entry.data.sources)}'
                    style="animation-delay:${delay}ms"></div>`;
            } else {
                cellsHTML += `<div class="heatmap-cell heatmap-days-cell level-0 is-empty"></div>`;
            }
        }
    }
    gridEl.innerHTML = cellsHTML;

    setupDaysTooltip(gridEl);
    setupDaysClick(gridEl);
}

/**
 * Format a Date object to YYYY-MM-DD string.
 */
function formatDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

// ─── Tooltips ───────────────────────────────────────────────

function setupHoursTooltip(gridEl) {
    const tooltip = document.getElementById('heatmap-tooltip');
    const tipDay = tooltip.querySelector('.tip-day');
    const tipHour = tooltip.querySelector('.tip-hour');
    const tipCount = tooltip.querySelector('.tip-count');
    const tipCost = tooltip.querySelector('.tip-cost');

    gridEl.addEventListener('mouseover', e => {
        const cell = e.target.closest('.heatmap-cell');
        if (!cell || !cell.dataset.date) return;

        const dateStr = cell.dataset.date;
        const hour = parseInt(cell.dataset.hour, 10);
        const cost = cell.dataset.cost;
        const count = cell.dataset.count;

        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayName = DAY_NAMES_FULL[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];
        const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const hourEnd = (hour + 1) % 24;
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        const hourEndStr = hourEnd.toString().padStart(2, '0') + ':00';

        tipDay.textContent = `${dayName}, ${formatted}`;
        tipHour.textContent = `${hourStr} \u2014 ${hourEndStr}`;
        tipCount.textContent = count;
        tipCost.textContent = '$' + cost;
        tooltip.classList.add('visible');
    });

    gridEl.addEventListener('mousemove', e => {
        positionTooltip(tooltip, e);
    });

    gridEl.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });
}

function setupDaysTooltip(gridEl) {
    const tooltip = document.getElementById('heatmap-tooltip');
    const tipDay = tooltip.querySelector('.tip-day');
    const tipHour = tooltip.querySelector('.tip-hour');
    const tipCount = tooltip.querySelector('.tip-count');
    const tipCost = tooltip.querySelector('.tip-cost');

    gridEl.addEventListener('mouseover', e => {
        const cell = e.target.closest('.heatmap-days-cell');
        if (!cell || cell.classList.contains('is-empty')) return;
        const dateStr = cell.dataset.date;
        if (!dateStr) return;

        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayName = DAY_NAMES_FULL[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];
        const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const count = parseInt(cell.dataset.count, 10);
        const cost = cell.dataset.cost;

        // Build sources summary
        let sourcesText = '';
        try {
            const sources = JSON.parse(cell.dataset.sources || '{}');
            const entries = Object.entries(sources).sort((a, b) => b[1] - a[1]);
            if (entries.length > 0) {
                sourcesText = entries.map(([src, cnt]) => `${src}: ${cnt}`).join(', ');
            }
        } catch { /* ignore */ }

        tipDay.textContent = `${dayName}, ${formatted}`;
        tipHour.textContent = count > 0
            ? (sourcesText || `${count} session${count !== 1 ? 's' : ''}`)
            : 'No activity';
        tipCount.textContent = count;
        tipCost.textContent = '$' + cost;
        tooltip.classList.add('visible');
    });

    gridEl.addEventListener('mousemove', e => {
        positionTooltip(tooltip, e);
    });

    gridEl.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });
}

function positionTooltip(tooltip, e) {
    const x = e.clientX + 14;
    const y = e.clientY - 12;
    const maxX = window.innerWidth - tooltip.offsetWidth - 12;
    const maxY = window.innerHeight - tooltip.offsetHeight - 12;
    tooltip.style.left = Math.min(x, maxX) + 'px';
    tooltip.style.top = Math.min(y, maxY) + 'px';
}

// ─── Click to Scroll ────────────────────────────────────────

function scrollToSessionDay(cell) {
    const dateStr = cell.dataset.date;
    if (!dateStr) return;

    const count = parseInt(cell.dataset.count, 10);
    if (count === 0) return;

    // Add a brief pulse animation to the clicked cell
    cell.classList.add('clicked');
    setTimeout(() => cell.classList.remove('clicked'), 400);

    // Find the day row in the session log
    const dayRow = document.getElementById('day-' + dateStr);
    if (!dayRow) return;

    // Scroll to the row with smooth animation
    dayRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Expand the day after scroll settles
    setTimeout(() => {
        if (!dayRow.classList.contains('expanded')) {
            toggleDay(dateStr);
        }
        // Briefly highlight the row
        dayRow.classList.add('heatmap-scroll-highlight');
        setTimeout(() => dayRow.classList.remove('heatmap-scroll-highlight'), 1500);
    }, 400);
}

function setupHoursClick(gridEl) {
    gridEl.addEventListener('click', e => {
        const cell = e.target.closest('.heatmap-cell');
        if (!cell || !cell.dataset.date) return;
        scrollToSessionDay(cell);
    });
}

function setupDaysClick(gridEl) {
    gridEl.addEventListener('click', e => {
        const cell = e.target.closest('.heatmap-days-cell');
        if (!cell || cell.classList.contains('is-empty')) return;
        scrollToSessionDay(cell);
    });
}

// ─── Toggle Logic ───────────────────────────────────────────

function setupToggle() {
    const toggle = document.getElementById('heatmap-toggle');
    const hoursBtn = document.getElementById('toggle-hours-btn');
    const daysBtn = document.getElementById('toggle-days-btn');
    const slider = document.getElementById('heatmap-toggle-slider');
    const hoursView = document.getElementById('heatmap-hours-view');
    const daysView = document.getElementById('heatmap-days-view');
    const title = document.getElementById('heatmap-title');

    function switchView(view) {
        if (view === currentView) return;
        currentView = view;

        // Update button states
        hoursBtn.classList.toggle('active', view === 'hours');
        daysBtn.classList.toggle('active', view === 'days');

        // Animate slider
        if (view === 'days') {
            slider.style.transform = 'translateX(100%)';
        } else {
            slider.style.transform = 'translateX(0)';
        }

        // Update title
        title.textContent = view === 'hours' ? 'Peak Hours' : 'Peak Days';

        // Animate view transition
        const outgoing = view === 'hours' ? daysView : hoursView;
        const incoming = view === 'hours' ? hoursView : daysView;

        outgoing.classList.add('heatmap-view-exiting');
        outgoing.classList.remove('heatmap-view-active');

        setTimeout(() => {
            outgoing.classList.remove('heatmap-view-exiting');
            incoming.classList.add('heatmap-view-active');

            // Re-trigger cell animations on incoming view
            const cells = incoming.querySelectorAll('.heatmap-cell');
            cells.forEach(cell => {
                cell.style.animation = 'none';
                cell.offsetHeight; // trigger reflow
                cell.style.animation = '';
            });
        }, 200);
    }

    hoursBtn.addEventListener('click', () => switchView('hours'));
    daysBtn.addEventListener('click', () => switchView('days'));
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Initialize and render both heatmap views with session data.
 */
export function initHeatmap(allSessions) {
    cachedSessions = allSessions;
    renderHoursView(allSessions);
    renderDaysView(allSessions);
    setupToggle();
}
