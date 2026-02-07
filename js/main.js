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

import { initCharts } from './components/charts.js';
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

// === Global State ===

let allSessionsData = [];
let totalSessionCount = 0;

// === Expose Functions to Window (for onclick handlers) ===

// toggleDay and filter removal functions are already exposed by their respective modules
// We just need to expose toggleAllDays and set up the filter callback
window.toggleAllDays = toggleAllDays;

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
        // Create callback that has access to global state
        const applyFiltersCallback = () => {
            applyFilters(allSessionsData, totalSessionCount, renderSessionTable);
        };

        // Store callback globally so filter removal functions can use it
        window._applyFiltersCallback = applyFiltersCallback;

        // Setup listeners with the callback
        setupFilterListeners(applyFiltersCallback);

        // === Initialize Keyboard Shortcuts ===
        initKeyboardShortcuts();

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('sessions-body').innerHTML =
            '<tr><td colspan="8" class="no-data">Error loading data. Run collect-usage.sh first.</td></tr>';
    }
}

// === Initialize on DOM Ready ===

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
} else {
    loadData();
}
