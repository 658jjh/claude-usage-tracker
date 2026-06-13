import { sourceColors, defaultColors, modelColorMap } from './config/constants.js';
import { initChartDefaults } from './config/chart-config.js';

import { formatNumber } from './utils/formatters.js';
import { getWeekStart, getWeekEnd, formatWeekLabel } from './utils/date-utils.js';
import { sourceClass } from './utils/class-utils.js';
import { getModelInfo, getPricingForModel } from './utils/model-utils.js';

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
import { initPricingEditor } from './components/pricing-editor.js';

let allSessionsData = [];
let totalSessionCount = 0;
let currentSessionView = 'timeline';

window.toggleAllDays = toggleAllDays;
window.toggleAllProjects = toggleAllProjects;
window.clearDayFilter = clearDayFilter;

function getCurrentRenderer() {
    return currentSessionView === 'projects' ? renderProjectsTable : renderSessionTable;
}

function applyCurrentFilters() {
    applyFilters(allSessionsData, totalSessionCount, getCurrentRenderer());
}

function applyProviderView(provider) {
    const filtered = (!provider || provider === 'all')
        ? allSessionsData
        : allSessionsData.filter(s => (s.provider || 'claude') === provider);
    const summary = recalcSummary(filtered);
    reRenderDashboard(summary, filtered);
}

function toggleAllForCurrentView() {
    if (currentSessionView === 'projects') {
        toggleAllProjects();
    } else {
        toggleAllDays();
    }
}

function formatSinceLabel(sessions) {
    if (!sessions || sessions.length === 0) return 'Since tracking began';
    let earliest = sessions[0].date;
    for (let i = 1; i < sessions.length; i++) {
        if (sessions[i].date < earliest) earliest = sessions[i].date;
    }
    if (!earliest) return 'Since tracking began';
    const formatted = new Date(earliest + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
    return 'Since ' + formatted;
}

function updateTableHeader(view) {
    const thead = document.getElementById('sessions-thead');
    if (!thead) return;
    const cells = thead.querySelectorAll('th');
    if (cells.length < 2) return;
    cells[0].textContent = view === 'projects' ? 'Project' : 'Date';
    cells[1].textContent = view === 'projects' ? 'Sources' : 'Sessions';
}

async function loadData() {
    try {
        const summary = window.__SUMMARY__;
        const openclawSessions = window.__OPENCLAW_SESSIONS__ || window.__CLAWDBOT_SESSIONS__ || [];
        const claudeSessions = window.__CLAUDE_SESSIONS__ || [];
        const codexSessions = window.__CODEX_SESSIONS__ || [];

        if (!summary) {
            document.getElementById('sessions-body').innerHTML =
                '<tr><td colspan="8" class="no-data">No data found. Run collect-usage.sh then reload.</td></tr>';
            return;
        }

        document.getElementById('today-date').textContent = summary.today;
        document.getElementById('month-name').textContent = new Date(summary.today + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        document.getElementById('last-updated').textContent = new Date(summary.generated_at).toLocaleString();

        renderMonthlyProjection(summary);

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

        const claudeAll = [...openclawSessions, ...claudeSessions]
            .map(s => s.provider ? s : { ...s, provider: 'claude' });
        const codexAll = codexSessions
            .map(s => s.provider ? s : { ...s, provider: 'codex' });
        const allSessions = [...claudeAll, ...codexAll];

        // Пересчёт стоимости если есть сохранённые пользовательские цены
        try {
            const savedPricing = localStorage.getItem('ai-usage-tracker-pricing');
            if (savedPricing) {
                const customPricing = JSON.parse(savedPricing);
                window.__PRICING__ = { ...(window.__PRICING__ || {}), ...customPricing };
                for (const s of allSessions) {
                    const p = getPricingForModel(s.model);
                    s.cost = ((s.input_tokens || 0) * p.input +
                              (s.output_tokens || 0) * p.output +
                              (s.cache_read || 0) * p.cacheRead +
                              (s.cache_write || 0) * p.cacheWrite) / 1000000;
                }
            }
        } catch { /* игнорируем */ }

        document.getElementById('total-since').textContent = formatSinceLabel(allSessions);

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

        updateYesterdayDelta(summary, allSessions);

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

        setMostExpensive(mostExpensiveFile, mostExpensiveDate);

        allSessionsData = allSessions;
        totalSessionCount = allSessions.length;

        initFilterDropdowns(allSessions);
        renderSessionTable(allSessions);
        updateFilterCount(allSessions.length, totalSessionCount);

        initChartDefaults();
        initCharts(allSessions);
        initHeatmap(allSessions);
        initCounterAnimations();

        window._applyFiltersCallback = applyCurrentFilters;
        setupFilterListeners(applyCurrentFilters, applyProviderView);

        initKeyboardShortcuts(toggleAllForCurrentView);
        setupSessionViewToggle();
        initPricingEditor(allSessions);

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('sessions-body').innerHTML =
            '<tr><td colspan="8" class="no-data">Error loading data. Run collect-usage.sh first.</td></tr>';
    }
}

function initReloadButton() {
    const fab = document.getElementById('reload-fab');
    if (!fab) return;

    fab.addEventListener('click', () => {
        fab.classList.add('is-reloading');
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

        const merged = mergeSessions(allSessionsData, result.sessions);
        const newSummary = recalcSummary(merged);

        allSessionsData = merged;
        totalSessionCount = merged.length;

        try {
            window.webkit.messageHandlers.saveImportedData.postMessage(JSON.stringify(merged));
        } catch {
            // Browser fallback — no persistence.
        }

        showImportBanner(result.sessions.length, merged.length);
        reRenderDashboard(newSummary, merged);
    });
}

function showImportBanner(importedCount, totalCount) {
    const old = document.getElementById('dt-import-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'dt-import-banner';
    banner.className = 'dt-import-banner';
    banner.innerHTML = `
        <span class="dt-import-banner-text">
            Viewing merged data — <strong>${totalCount}</strong> total sessions (imported ${importedCount})
        </span>
    `;

    const container = document.querySelector('.container');
    const statsGrid = document.querySelector('.stats-grid');
    container.insertBefore(banner, statsGrid);
}

function reRenderDashboard(summary, sessions) {
    document.getElementById('today-cost').textContent = '$' + summary.today_cost.toFixed(2);
    document.getElementById('month-cost').textContent = '$' + summary.month_cost.toFixed(2);
    document.getElementById('total-cost').textContent = '$' + summary.totals.grand_total.toFixed(2);
    document.getElementById('total-since').textContent = formatSinceLabel(sessions);
    document.getElementById('session-count').textContent = sessions.length.toString();

    const thisWeekStart = getWeekStart(summary.today);
    const thisWeekEnd = getWeekEnd(thisWeekStart);
    const weekCost = sessions
        .filter(s => s.date >= thisWeekStart && s.date <= thisWeekEnd)
        .reduce((sum, s) => sum + s.cost, 0);
    document.getElementById('week-cost').textContent = '$' + weekCost.toFixed(2);

    renderMonthlyProjection(summary);
    updateYesterdayDelta(summary, sessions);

    initFilterDropdowns(sessions);
    getCurrentRenderer()(sessions);
    updateFilterCount(sessions.length, totalSessionCount);
    initCharts(sessions);
    initHeatmap(sessions);

    window._applyFiltersCallback = applyCurrentFilters;
    setupFilterListeners(applyCurrentFilters, applyProviderView);
}

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

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (view === 'projects') {
                slider.style.transform = 'translateX(100%)';
            } else {
                slider.style.transform = 'translateX(0)';
            }

            currentSessionView = view;
            updateTableHeader(view);

            if (toggleAllBtn) {
                toggleAllBtn.onclick = view === 'projects' ? toggleAllProjects : toggleAllDays;
            }

            applyCurrentFilters();
        });
    });
}

function init() {
    loadData();
    initReloadButton();
    initDataTransfer();

    // Перерисовка дашборда при изменении цен через pricing editor
    window.addEventListener('pricing-updated', () => {
        location.reload();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
