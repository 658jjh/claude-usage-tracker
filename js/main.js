/**
 * main.js
 *
 * Main orchestrator for the Usage Tracker Dashboard.
 * Coordinates data loading and component initialization.
 */

// === Imports ===

// Config
import { sourceColors, defaultColors, modelColorMap } from './config/constants.js';
import { initChartDefaults } from './config/chart-config.js';

// Utils
import { formatNumber } from './utils/formatters.js';
import { getWeekStart, getWeekEnd, formatWeekLabel } from './utils/date-utils.js';
import { sourceClass } from './utils/class-utils.js';
import { getModelInfo } from './utils/model-utils.js';

// Components
import { initCounterAnimations } from './components/animations.js';

import { initCharts, clearDayFilter } from './components/charts.js';
import {
    initFilterDropdowns,
    applyFilters,
    updateFilterCount,
    setupFilterListeners
} from './components/filters.js';
import { initHeatmap } from './components/heatmap.js';
import { renderMonthlyProjection, updateYesterdayDelta } from './components/projections.js';
import {
    renderSessionTable,
    setMostExpensive,
    toggleDay,
    toggleAllDays,
    initKeyboardShortcuts
} from './components/sessions-table.js';
import {
    renderProjectsTable,
    toggleAllProjects
} from './components/projects-table.js';
import {
    exportData,
    importData,
    mergeSessions,
    recalcSummary
} from './components/data-transfer.js';

// === Global State ===

let allSessionsData = [];
let totalSessionCount = 0;
let currentSessionView = 'timeline';

// === Expose Functions to Window (for onclick handlers) ===

// toggleDay and filter removal functions are already exposed by their respective modules
// We just need to expose toggleAllDays and set up the filter callback
window.toggleAllDays = toggleAllDays;
window.toggleAllProjects = toggleAllProjects;
window.clearDayFilter = clearDayFilter;

function getCurrentRenderer() {
    return currentSessionView === 'projects' ? renderProjectsTable : renderSessionTable;
}

function applyCurrentFilters() {
    applyFilters(allSessionsData, totalSessionCount, getCurrentRenderer());
}

function toggleAllForCurrentView() {
    if (currentSessionView === 'projects') {
        toggleAllProjects();
    } else {
        toggleAllDays();
    }
}

function updateTableHeader(view) {
    const thead = document.getElementById('sessions-thead');
    if (!thead) return;
    const cells = thead.querySelectorAll('th');
    if (cells.length < 2) return;
    cells[0].textContent = view === 'projects' ? 'Project' : 'Date';
    cells[1].textContent = view === 'projects' ? 'Sources' : 'Sessions';
}

// === Main Data Loading Function ===

/**
 * Load data from window globals and initialize all dashboard components.
 * This is the main entry point after the page loads.
 */
async function loadData() {
    try {
        // Load data from window globals
        const summary = window.__SUMMARY__;
        const openclawSessions = window.__OPENCLAW_SESSIONS__ || window.__CLAWDBOT_SESSIONS__ || [];
        const claudeSessions = window.__CLAUDE_SESSIONS__ || [];

        // Check if data is available
        if (!summary) {
            document.getElementById('sessions-body').innerHTML =
                '<tr><td colspan="8" class="no-data">No data found. Run collect-usage.sh then reload.</td></tr>';
            return;
        }

        // === Static Text Values ===
        document.getElementById('today-date').textContent = summary.today;
        document.getElementById('month-name').textContent = new Date(summary.today + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        document.getElementById('last-updated').textContent = new Date(summary.generated_at).toLocaleString();

        // === Monthly Projection ===
        renderMonthlyProjection(summary);

        // === Prepare Animated Counter Elements ===
        // Store target values as data attributes, set initial display to zero
        const todayCostEl = document.getElementById('today-cost');
        todayCostEl.dataset.target = summary.today_cost;
        todayCostEl.dataset.prefix = '$';
        todayCostEl.dataset.decimals = '2';
        todayCostEl.textContent = '$0.00';

        const monthCostEl = document.getElementById('month-cost');
        monthCostEl.dataset.target = summary.month_cost;
        monthCostEl.dataset.prefix = '$';
        monthCostEl.dataset.decimals = '2';
        monthCostEl.textContent = '$0.00';

        const totalCostEl = document.getElementById('total-cost');
        totalCostEl.dataset.target = summary.totals.grand_total;
        totalCostEl.dataset.prefix = '$';
        totalCostEl.dataset.decimals = '2';
        totalCostEl.textContent = '$0.00';

        const sessionCountEl = document.getElementById('session-count');
        sessionCountEl.dataset.target = summary.session_counts.total;
        sessionCountEl.dataset.prefix = '';
        sessionCountEl.dataset.decimals = '0';
        sessionCountEl.textContent = '0';

        // === Combine All Sessions ===
        const allSessions = [...openclawSessions, ...claudeSessions];

        // === Calculate This Week Cost ===
        const thisWeekStart = getWeekStart(summary.today);
        const thisWeekEnd = getWeekEnd(thisWeekStart);
        const weekCost = allSessions
            .filter(s => s.date >= thisWeekStart && s.date <= thisWeekEnd)
            .reduce((sum, s) => sum + s.cost, 0);

        const weekCostEl = document.getElementById('week-cost');
        weekCostEl.dataset.target = weekCost;
        weekCostEl.dataset.prefix = '$';
        weekCostEl.dataset.decimals = '2';
        weekCostEl.textContent = '$0.00';
        document.getElementById('week-range').textContent = formatWeekLabel(thisWeekStart);

        // === Yesterday Delta ===
        updateYesterdayDelta(summary, allSessions);

        // === Find Most Expensive Session ===
        const todaySessions = allSessions.filter(s => s.date === summary.today);
        let mostExpensiveSession = null;
        let mostExpensiveFile = null;
        let mostExpensiveDate = null;

        if (todaySessions.length > 0) {
            mostExpensiveSession = todaySessions.reduce(
                (max, s) => s.cost > max.cost ? s : max,
                todaySessions[0]
            );
            mostExpensiveFile = mostExpensiveSession.file;
            mostExpensiveDate = mostExpensiveSession.date;
        }

        // Populate the expensive session callout banner
        const callout = document.getElementById('expensive-session-callout');
        if (mostExpensiveSession && mostExpensiveSession.cost > 0) {
            const ms = mostExpensiveSession;
            const sc = sourceClass(ms.source);
            const mi = getModelInfo(ms.model);

            document.getElementById('exp-source').innerHTML =
                `<span class="source-badge source-${sc}">${ms.source}</span>`;
            document.getElementById('exp-model').innerHTML =
                `<span class="model-badge ${mi.cls}">${mi.name}</span>`;
            document.getElementById('exp-time').textContent = ms.time || '---';
            document.getElementById('exp-cost').textContent = `$${ms.cost.toFixed(2)}`;
            document.getElementById('exp-tokens').innerHTML =
                `<span><span class="token-label">In:</span> <span class="token-value">${formatNumber(ms.input_tokens || 0)}</span></span>` +
                `<span><span class="token-label">Out:</span> <span class="token-value">${formatNumber(ms.output_tokens || 0)}</span></span>` +
                `<span><span class="token-label">Cache Read:</span> <span class="token-value">${formatNumber(ms.cache_read || 0)}</span></span>` +
                `<span><span class="token-label">Cache Write:</span> <span class="token-value">${formatNumber(ms.cache_write || 0)}</span></span>`;

            callout.style.display = 'flex';
        } else {
            callout.style.display = 'none';
        }

        // Pass most expensive session info to sessions-table module
        setMostExpensive(mostExpensiveFile, mostExpensiveDate);

        // === Store Global State ===
        allSessionsData = allSessions;
        totalSessionCount = allSessions.length;

        // === Initialize Filter Dropdowns ===
        initFilterDropdowns(allSessions);

        // === Render Session Table ===
        renderSessionTable(allSessions);
        updateFilterCount(allSessions.length, totalSessionCount);

        // === Initialize Chart.js Defaults ===
        initChartDefaults();

        // === Initialize Charts ===
        initCharts(allSessions);

        // === Initialize Heatmap ===
        initHeatmap(allSessions);

        // === Initialize Animated Counters ===
        initCounterAnimations();

        // === Setup Filter Listeners ===
        window._applyFiltersCallback = applyCurrentFilters;
        setupFilterListeners(applyCurrentFilters);

        // === Initialize Keyboard Shortcuts ===
        initKeyboardShortcuts(toggleAllForCurrentView);

        // === Setup Session View Toggle ===
        setupSessionViewToggle();

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('sessions-body').innerHTML =
            '<tr><td colspan="8" class="no-data">Error loading data. Run collect-usage.sh first.</td></tr>';
    }
}

// === Reload FAB Handler ===

function initReloadButton() {
    const fab = document.getElementById('reload-fab');
    if (!fab) return;

    fab.addEventListener('click', () => {
        fab.classList.add('is-reloading');
        // Fade out then trigger reload
        document.body.style.transition = 'opacity 0.25s ease-out';
        document.body.style.opacity = '0';
        setTimeout(() => {
            try {
                window.webkit.messageHandlers.reload.postMessage('');
            } catch (_) {
                location.reload();
            }
        }, 250);
    });
}

// === Export / Import Handlers ===

function initDataTransfer() {
    const exportBtn = document.getElementById('dt-export-btn');
    const importBtn = document.getElementById('dt-import-btn');
    if (!exportBtn || !importBtn) return;

    exportBtn.addEventListener('click', () => {
        const summary = window.__SUMMARY__;
        if (!summary || allSessionsData.length === 0) return;
        exportData(summary, allSessionsData);
    });

    importBtn.addEventListener('click', async () => {
        const result = await importData();
        if (!result) return;

        // Merge imported sessions with current data
        const merged = mergeSessions(allSessionsData, result.sessions);
        const newSummary = recalcSummary(merged);

        // Update global state
        allSessionsData = merged;
        totalSessionCount = merged.length;

        // Show import banner
        showImportBanner(result.sessions.length, merged.length);

        // Re-render with merged data
        reRenderDashboard(newSummary, merged);
    });
}

function showImportBanner(importedCount, totalCount) {
    // Remove existing banner
    const old = document.getElementById('dt-import-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'dt-import-banner';
    banner.className = 'dt-import-banner';
    banner.innerHTML = `
        <span class="dt-import-banner-text">
            Viewing merged data — <strong>${totalCount}</strong> total sessions (imported ${importedCount})
        </span>
        <button class="dt-import-dismiss" onclick="location.reload()">Dismiss &amp; Reload</button>
    `;

    const container = document.querySelector('.container');
    const statsGrid = document.querySelector('.stats-grid');
    container.insertBefore(banner, statsGrid);
}

function reRenderDashboard(summary, sessions) {
    // Update stat card targets
    document.getElementById('today-cost').textContent = '$' + summary.today_cost.toFixed(2);
    document.getElementById('month-cost').textContent = '$' + summary.month_cost.toFixed(2);
    document.getElementById('total-cost').textContent = '$' + summary.totals.grand_total.toFixed(2);
    document.getElementById('session-count').textContent = sessions.length.toString();

    // Recalc week cost
    const thisWeekStart = getWeekStart(summary.today);
    const thisWeekEnd = getWeekEnd(thisWeekStart);
    const weekCost = sessions
        .filter(s => s.date >= thisWeekStart && s.date <= thisWeekEnd)
        .reduce((sum, s) => sum + s.cost, 0);
    document.getElementById('week-cost').textContent = '$' + weekCost.toFixed(2);

    // Re-render components
    initFilterDropdowns(sessions);
    getCurrentRenderer()(sessions);
    updateFilterCount(sessions.length, totalSessionCount);
    initCharts(sessions);
    initHeatmap(sessions);

    // Re-bind filter callback
    window._applyFiltersCallback = applyCurrentFilters;
    setupFilterListeners(applyCurrentFilters);
}

// === Session View Toggle ===

function setupSessionViewToggle() {
    const toggle = document.getElementById('sessions-view-toggle');
    if (!toggle) return;

    const buttons = toggle.querySelectorAll('.view-toggle-btn');
    const slider = toggle.querySelector('.view-toggle-slider');
    const toggleAllBtn = document.getElementById('toggle-all-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (view === currentSessionView) return;

            // Update active button
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Slide the slider
            if (view === 'projects') {
                slider.style.transform = 'translateX(100%)';
            } else {
                slider.style.transform = 'translateX(0)';
            }

            // Update state
            currentSessionView = view;

            // Update table header
            updateTableHeader(view);

            // Update Expand All button onclick
            if (toggleAllBtn) {
                toggleAllBtn.onclick = view === 'projects' ? toggleAllProjects : toggleAllDays;
            }

            applyCurrentFilters();
        });
    });
}

// === Initialize on DOM Ready ===

function init() {
    loadData();
    initReloadButton();
    initDataTransfer();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
