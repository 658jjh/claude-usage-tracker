/**
 * sessions-table.js
 *
 * Session table rendering with day/week grouping, expandable details,
 * and keyboard shortcuts for toggling.
 */

import { formatNumber } from '../utils/formatters.js';
import { getWeekStart, getWeekEnd, formatWeekLabel } from '../utils/date-utils.js';
import { getModelInfo } from '../utils/model-utils.js';
import { costClass, sourceClass } from '../utils/class-utils.js';

// Global reference to most expensive session (set by main.js)
let mostExpensiveFile = null;
let mostExpensiveDate = null;

/**
 * Set the most expensive session reference (called from main.js)
 *
 * @param {string} file - File path of most expensive session
 * @param {string} date - Date of most expensive session
 */
export function setMostExpensive(file, date) {
    mostExpensiveFile = file;
    mostExpensiveDate = date;
}

/**
 * Toggle expansion state of a single day row.
 *
 * @param {string} date - The date string (YYYY-MM-DD) to toggle
 */
export function toggleDay(date) {
    const row = document.getElementById('day-' + date);
    const detailWrapper = document.getElementById('detail-wrapper-' + date);

    if (row.classList.contains('expanded')) {
        row.classList.remove('expanded');
        detailWrapper.classList.remove('open');
        detailWrapper.style.maxHeight = '0';
    } else {
        row.classList.add('expanded');
        detailWrapper.classList.add('open');
        const inner = detailWrapper.querySelector('.day-detail');
        detailWrapper.style.maxHeight = inner.scrollHeight + 40 + 'px';

        setTimeout(() => {
            detailWrapper.querySelectorAll('.cost-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.width;
            });
        }, 50);
    }

    // Keep the toggle-all button label in sync
    const anyExpanded = document.querySelectorAll('.day-row.expanded').length > 0;
    updateToggleAllButton(anyExpanded);
}

/**
 * Toggle all day rows between expanded and collapsed states.
 * Includes staggered animation for visual effect.
 */
export function toggleAllDays() {
    const dayRows = document.querySelectorAll('.day-row');
    if (dayRows.length === 0) return;

    const anyExpanded = document.querySelectorAll('.day-row.expanded').length > 0;
    const shouldExpand = !anyExpanded;

    dayRows.forEach((row, index) => {
        const date = row.id.replace('day-', '');
        const detailWrapper = document.getElementById('detail-wrapper-' + date);
        if (!detailWrapper) return;

        setTimeout(() => {
            if (shouldExpand && !row.classList.contains('expanded')) {
                row.classList.add('expanded');
                detailWrapper.classList.add('open');
                const inner = detailWrapper.querySelector('.day-detail');
                detailWrapper.style.maxHeight = inner.scrollHeight + 40 + 'px';

                setTimeout(() => {
                    detailWrapper.querySelectorAll('.cost-bar-fill').forEach(bar => {
                        bar.style.width = bar.dataset.width;
                    });
                }, 50);
            } else if (!shouldExpand && row.classList.contains('expanded')) {
                row.classList.remove('expanded');
                detailWrapper.classList.remove('open');
                detailWrapper.style.maxHeight = '0';
            }
        }, index * 10);
    });

    updateToggleAllButton(shouldExpand);
}

/**
 * Update the "Expand All" / "Collapse All" button label and state.
 *
 * @param {boolean} anyExpanded - Whether any rows are currently expanded
 */
export function updateToggleAllButton(anyExpanded) {
    const btn = document.getElementById('toggle-all-btn');
    if (!btn) return;

    if (anyExpanded) {
        btn.innerHTML = 'Collapse All<span class="arrow">&#9660;</span><span class="kbd-hint">Shift+E</span>';
        btn.classList.add('is-expanded');
    } else {
        btn.innerHTML = 'Expand All<span class="arrow">&#9660;</span><span class="kbd-hint">Shift+E</span>';
        btn.classList.remove('is-expanded');
    }
}

/**
 * Update the totals row in the table footer.
 *
 * @param {Array} sessions - Array of session objects to total
 */
export function updateTotalsRow(sessions) {
    const tfoot = document.getElementById('sessions-tfoot');
    if (!tfoot) return;

    if (!sessions || sessions.length === 0) {
        tfoot.innerHTML = '';
        return;
    }

    const totalSessions = sessions.length;
    const totalInput = sessions.reduce((sum, s) => sum + (s.input_tokens || 0), 0);
    const totalOutput = sessions.reduce((sum, s) => sum + (s.output_tokens || 0), 0);
    const totalCacheRead = sessions.reduce((sum, s) => sum + (s.cache_read || 0), 0);
    const totalCacheWrite = sessions.reduce((sum, s) => sum + (s.cache_write || 0), 0);
    const totalCost = sessions.reduce((sum, s) => sum + s.cost, 0);

    tfoot.innerHTML = `<tr>
        <td>TOTAL</td>
        <td><span class="totals-session-count">${totalSessions}</span></td>
        <td><span class="totals-models-placeholder">--</span></td>
        <td class="token-cell">${formatNumber(totalInput)}</td>
        <td class="token-cell">${formatNumber(totalOutput)}</td>
        <td class="token-cell">${formatNumber(totalCacheRead)}</td>
        <td class="token-cell">${formatNumber(totalCacheWrite)}</td>
        <td style="text-align:right"><span class="cost-badge ${costClass(totalCost)}">$${totalCost.toFixed(2)}</span></td>
    </tr>`;
}

/**
 * Build the expandable detail panel HTML for a single day.
 *
 * Includes:
 * - Source breakdown cards with cost bars
 * - Detailed session sub-table
 *
 * @param {string} date - The date string (YYYY-MM-DD)
 * @param {Array} sessions - Array of session objects for this day
 * @returns {string} HTML string for the detail panel
 */
export function buildDayDetail(date, sessions) {
    const bySource = {};
    sessions.forEach(s => {
        if (!bySource[s.source]) bySource[s.source] = [];
        bySource[s.source].push(s);
    });

    const totalCost = sessions.reduce((sum, s) => sum + s.cost, 0);
    const maxSourceCost = Math.max(...Object.values(bySource).map(arr => arr.reduce((s, x) => s + x.cost, 0)));

    let sourceCardsHTML = '';
    for (const [source, items] of Object.entries(bySource)) {
        const sCost = items.reduce((s, x) => s + x.cost, 0);
        const sInput = items.reduce((s, x) => s + (x.input_tokens || 0), 0);
        const sOutput = items.reduce((s, x) => s + (x.output_tokens || 0), 0);
        const sCacheRead = items.reduce((s, x) => s + (x.cache_read || 0), 0);
        const sCacheWrite = items.reduce((s, x) => s + (x.cache_write || 0), 0);
        const models = [...new Set(items.map(x => x.model).filter(Boolean))];
        const sc = sourceClass(source);
        const barPct = maxSourceCost > 0 ? (sCost / maxSourceCost * 100).toFixed(1) : 0;

        sourceCardsHTML += `
            <div class="source-card border-${sc}">
                <div class="source-card-header">
                    <span class="source-name">
                        <span class="source-badge source-${sc}">${source}</span>
                        <span style="margin-left:6px;font-size:0.7rem;color:var(--text-muted);">${items.length} session${items.length > 1 ? 's' : ''}</span>
                    </span>
                    <span class="source-cost ${costClass(sCost) + '-text'}">${'$' + sCost.toFixed(2)}</span>
                </div>
                <div class="source-stats">
                    <div class="source-stat"><span class="stat-label">Input</span><span class="stat-value">${formatNumber(sInput)}</span></div>
                    <div class="source-stat"><span class="stat-label">Output</span><span class="stat-value">${formatNumber(sOutput)}</span></div>
                    <div class="source-stat"><span class="stat-label">Cache Read</span><span class="stat-value">${formatNumber(sCacheRead)}</span></div>
                    <div class="source-stat"><span class="stat-label">Cache Write</span><span class="stat-value">${formatNumber(sCacheWrite)}</span></div>
                    <div class="source-stat"><span class="stat-label">Models</span><span class="stat-value">${models.map(m => getModelInfo(m).name).join(', ') || '—'}</span></div>
                    <div class="source-stat"><span class="stat-label">% of Day</span><span class="stat-value">${totalCost > 0 ? (sCost / totalCost * 100).toFixed(1) : 0}%</span></div>
                </div>
                <div class="cost-bar-container">
                    <div class="cost-bar-bg">
                        <div class="cost-bar-fill fill-${sc}" data-width="${barPct}%"></div>
                    </div>
                </div>
            </div>`;
    }

    let subTableHTML = `
        <table class="session-subtable">
            <thead><tr>
                <th>Time</th><th>Source</th><th>Model</th>
                <th>Input</th><th>Output</th><th>Cache R</th><th>Cache W</th><th style="text-align:right">Cost</th>
            </tr></thead><tbody>`;
    sessions.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    for (const s of sessions) {
        const mi = getModelInfo(s.model);
        const sc = sourceClass(s.source);
        const isExpensive = (s.file === mostExpensiveFile && date === mostExpensiveDate);
        subTableHTML += `<tr${isExpensive ? ' class="expensive-session-row"' : ''}>
            <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${s.time || '—'}</td>
            <td><span class="source-badge source-${sc}">${s.source}</span></td>
            <td><span class="model-badge ${mi.cls}">${mi.name}</span></td>
            <td class="token-cell">${formatNumber(s.input_tokens || 0)}</td>
            <td class="token-cell">${formatNumber(s.output_tokens || 0)}</td>
            <td class="token-cell">${formatNumber(s.cache_read || 0)}</td>
            <td class="token-cell">${formatNumber(s.cache_write || 0)}</td>
            <td style="text-align:right"><span class="cost-badge ${costClass(s.cost)}">$${s.cost.toFixed(2)}</span></td>
        </tr>`;
    }
    subTableHTML += '</tbody></table>';

    return `
        <div class="day-detail">
            <div class="source-breakdown">${sourceCardsHTML}</div>
            ${subTableHTML}
        </div>`;
}

/**
 * Render the sessions table with day and week groupings.
 *
 * Groups sessions by date, then by ISO week (Monday-Sunday).
 * Each week shows individual day rows followed by a week summary row.
 *
 * @param {Array} sessions - Array of session objects to render
 */
export function renderSessionTable(sessions) {
    const byDate = {};
    sessions.forEach(s => {
        if (!byDate[s.date]) byDate[s.date] = [];
        byDate[s.date].push(s);
    });
    const sortedDates = Object.keys(byDate).sort().reverse();

    const tbody = document.getElementById('sessions-body');
    if (sortedDates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No sessions match the current filters.</td></tr>';
        updateTotalsRow([]);
        return;
    }

    // Group dates into ISO weeks
    const weekGroups = {}; // weekStart -> [dates]
    for (const date of sortedDates) {
        const ws = getWeekStart(date);
        if (!weekGroups[ws]) weekGroups[ws] = [];
        weekGroups[ws].push(date);
    }

    // Sort week start dates in reverse order (newest first)
    const sortedWeeks = Object.keys(weekGroups).sort().reverse();

    let html = '';
    for (const weekStart of sortedWeeks) {
        const weekDates = weekGroups[weekStart];

        // Accumulators for weekly totals
        let weekTotalCost = 0;
        let weekTotalInput = 0;
        let weekTotalOutput = 0;
        let weekTotalCacheRead = 0;
        let weekTotalCacheWrite = 0;
        let weekTotalSessions = 0;
        const weekModels = new Set();

        // Emit day rows for this week
        for (const date of weekDates) {
            const daySessions = byDate[date];
            const dayCost = daySessions.reduce((s, x) => s + x.cost, 0);
            const dayInput = daySessions.reduce((s, x) => s + (x.input_tokens || 0), 0);
            const dayOutput = daySessions.reduce((s, x) => s + (x.output_tokens || 0), 0);
            const dayCacheRead = daySessions.reduce((s, x) => s + (x.cache_read || 0), 0);
            const dayCacheWrite = daySessions.reduce((s, x) => s + (x.cache_write || 0), 0);
            const models = [...new Set(daySessions.map(x => x.model).filter(Boolean))];
            const modelBadges = models.map(m => {
                const mi = getModelInfo(m);
                return `<span class="model-badge ${mi.cls}">${mi.name}</span>`;
            }).join(' ');

            // Accumulate into weekly totals
            weekTotalCost += dayCost;
            weekTotalInput += dayInput;
            weekTotalOutput += dayOutput;
            weekTotalCacheRead += dayCacheRead;
            weekTotalCacheWrite += dayCacheWrite;
            weekTotalSessions += daySessions.length;
            models.forEach(m => weekModels.add(m));

            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            html += `<tr class="day-row" id="day-${date}" onclick="toggleDay('${date}')">
                <td><span class="chevron">\u25B6</span>${dateLabel}</td>
                <td>${daySessions.length}</td>
                <td>${modelBadges}</td>
                <td class="token-cell">${formatNumber(dayInput)}</td>
                <td class="token-cell">${formatNumber(dayOutput)}</td>
                <td class="token-cell">${formatNumber(dayCacheRead)}</td>
                <td class="token-cell">${formatNumber(dayCacheWrite)}</td>
                <td style="text-align:right"><span class="cost-badge ${costClass(dayCost)}">$${dayCost.toFixed(2)}</span></td>
            </tr>`;

            html += `<tr class="day-detail-row"><td colspan="8">
                <div class="day-detail-wrapper" id="detail-wrapper-${date}">
                    ${buildDayDetail(date, daySessions)}
                </div>
            </td></tr>`;
        }

        // Emit weekly summary row after all days in this week
        const weekLabel = formatWeekLabel(weekStart);
        html += `<tr class="week-row">
            <td colspan="8">
                <div class="week-strip">
                    <div class="week-strip-left">
                        <span class="week-strip-icon">\u03A3</span>
                        <span class="week-strip-label">${weekLabel}</span>
                    </div>
                    <div class="week-strip-stats">
                        <span class="week-stat"><span class="week-stat-label">Sessions</span><span class="week-stat-value">${weekTotalSessions}</span></span>
                        <span class="week-stat-divider"></span>
                        <span class="week-stat"><span class="week-stat-label">In</span><span class="week-stat-value">${formatNumber(weekTotalInput)}</span></span>
                        <span class="week-stat"><span class="week-stat-label">Out</span><span class="week-stat-value">${formatNumber(weekTotalOutput)}</span></span>
                        <span class="week-stat-divider"></span>
                        <span class="week-strip-cost">$${weekTotalCost.toFixed(2)}</span>
                    </div>
                </div>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
    updateTotalsRow(sessions);
    updateToggleAllButton(false);
}

/**
 * Initialize keyboard shortcuts for table interactions.
 * Shift+E toggles all day rows.
 */
export function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.shiftKey && e.key === 'E') {
            // Don't trigger if user is typing in an input/textarea
            const tag = document.activeElement.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
            e.preventDefault();
            toggleAllDays();
        }
    });
}

// Make toggleDay available globally for onclick handlers
window.toggleDay = toggleDay;
