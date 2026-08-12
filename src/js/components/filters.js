import { getModelInfo } from '../utils/model-utils.js';
import { sourceClass } from '../utils/class-utils.js';

// 'all' | 'claude' | 'codex'
const _state = { provider: 'all' };

export function providerForSource(name) {
    return (name && name.startsWith('Codex')) ? 'codex' : 'claude';
}

export function initFilterDropdowns(sessions) {
    const sources = [...new Set(sessions.map(s => s.source))].sort();
    const sourceDropdown = document.getElementById('source-dropdown');
    sourceDropdown.innerHTML = sources.map(source => {
        const sc = sourceClass(source);
        const sp = providerForSource(source);
        return `<label data-provider="${sp}">
            <input type="checkbox" value="${source}" data-filter="source" />
            <span class="source-badge source-${sc}">${source}</span>
        </label>`;
    }).join('');
    applyProviderDimming();

    const modelMap = {};
    sessions.forEach(s => {
        if (s.model) {
            const mi = getModelInfo(s.model);
            if (!modelMap[s.model]) {
                modelMap[s.model] = mi;
            }
        }
    });
    const modelEntries = Object.entries(modelMap).sort((a, b) => {
        const order = {
            'model-fable': 0, 'model-opus': 1, 'model-sonnet': 2, 'model-haiku': 3,
            'model-gpt-frontier': 4, 'model-gpt-mini': 5, 'model-codex': 6,
        };
        const aOrder = order[a[1].cls] ?? 9;
        const bOrder = order[b[1].cls] ?? 9;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a[1].name.localeCompare(b[1].name);
    });

    const modelDropdown = document.getElementById('model-dropdown');
    modelDropdown.innerHTML = modelEntries.map(([rawModel, mi]) => {
        return `<label>
            <input type="checkbox" value="${rawModel}" data-filter="model" />
            <span class="model-badge ${mi.cls}">${mi.name}</span>
        </label>`;
    }).join('');

    if (sessions.length > 0) {
        const dates = sessions.map(s => s.date).sort();
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];
        document.getElementById('filter-date-from').min = minDate;
        document.getElementById('filter-date-from').max = maxDate;
        document.getElementById('filter-date-to').min = minDate;
        document.getElementById('filter-date-to').max = maxDate;
    }
}

export function getActiveFilters() {
    const filters = {
        provider: _state.provider,
        sources: [],
        models: [],
        dateFrom: null,
        dateTo: null,
        minCost: null,
    };

    document.querySelectorAll('#source-dropdown input[type="checkbox"]:checked').forEach(cb => {
        filters.sources.push(cb.value);
    });

    document.querySelectorAll('#model-dropdown input[type="checkbox"]:checked').forEach(cb => {
        filters.models.push(cb.value);
    });

    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const minCostVal = document.getElementById('filter-min-cost').value;
    if (minCostVal !== '' && !isNaN(parseFloat(minCostVal))) {
        filters.minCost = parseFloat(minCostVal);
    }

    return filters;
}

export function filterSessions(sessions, filters) {
    return sessions.filter(s => {
        if (filters.provider && filters.provider !== 'all') {
            const sp = s.provider || providerForSource(s.source);
            if (sp !== filters.provider) return false;
        }
        if (filters.sources.length > 0 && !filters.sources.includes(s.source)) return false;
        if (filters.models.length > 0 && !filters.models.includes(s.model)) return false;
        if (filters.dateFrom && s.date < filters.dateFrom) return false;
        if (filters.dateTo && s.date > filters.dateTo) return false;
        if (filters.minCost !== null && s.cost < filters.minCost) return false;
        return true;
    });
}

export function applyFilters(allSessionsData, totalSessionCount, renderCallback) {
    const filters = getActiveFilters();
    const hasProviderFilter = filters.provider && filters.provider !== 'all';
    const hasAnyFilter = hasProviderFilter
        || filters.sources.length > 0
        || filters.models.length > 0
        || filters.dateFrom !== null
        || filters.dateTo !== null
        || filters.minCost !== null;
    const filtered = hasAnyFilter ? filterSessions(allSessionsData, filters) : allSessionsData;

    renderCallback(filtered);
    updateFilterCount(filtered.length, totalSessionCount);

    document.getElementById('source-filter-btn').classList.toggle('active', filters.sources.length > 0);
    document.getElementById('model-filter-btn').classList.toggle('active', filters.models.length > 0);
    document.getElementById('filter-clear-btn').classList.toggle('visible', hasAnyFilter);

    renderFilterChips(filters);
}

export function updateFilterCount(shown, total) {
    const el = document.getElementById('filter-count');
    if (shown === total) {
        el.innerHTML = `<span class="count-highlight">${total}</span> sessions`;
    } else {
        el.innerHTML = `<span class="count-highlight">${shown}</span> of ${total} sessions`;
    }
}

export function renderFilterChips(filters) {
    const container = document.getElementById('filter-chips');
    let html = '';

    filters.sources.forEach(source => {
        html += `<span class="filter-chip chip-source">
            Source: ${source}
            <span class="chip-remove" onclick="removeSourceFilter('${source.replace(/'/g, "\\'")}')">&times;</span>
        </span>`;
    });

    filters.models.forEach(model => {
        const mi = getModelInfo(model);
        html += `<span class="filter-chip chip-model">
            Model: ${mi.name}
            <span class="chip-remove" onclick="removeModelFilter('${model.replace(/'/g, "\\'")}')">&times;</span>
        </span>`;
    });

    if (filters.dateFrom) {
        html += `<span class="filter-chip chip-date">
            From: ${filters.dateFrom}
            <span class="chip-remove" onclick="removeDateFromFilter()">&times;</span>
        </span>`;
    }

    if (filters.dateTo) {
        html += `<span class="filter-chip chip-date">
            To: ${filters.dateTo}
            <span class="chip-remove" onclick="removeDateToFilter()">&times;</span>
        </span>`;
    }

    if (filters.minCost !== null) {
        html += `<span class="filter-chip chip-cost">
            Min: $${filters.minCost.toFixed(2)}
            <span class="chip-remove" onclick="removeMinCostFilter()">&times;</span>
        </span>`;
    }

    container.innerHTML = html;
}

export function removeSourceFilter(source) {
    const cb = document.querySelector(`#source-dropdown input[value="${source}"]`);
    if (cb) cb.checked = false;
}

export function removeModelFilter(model) {
    const cb = document.querySelector(`#model-dropdown input[value="${model}"]`);
    if (cb) cb.checked = false;
}

export function removeDateFromFilter() {
    document.getElementById('filter-date-from').value = '';
}

export function removeDateToFilter() {
    document.getElementById('filter-date-to').value = '';
}

export function removeMinCostFilter() {
    document.getElementById('filter-min-cost').value = '';
}

export function clearAllFilters() {
    document.querySelectorAll('#source-dropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('#model-dropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-min-cost').value = '';
    closeAllDropdowns();
}

function applyProviderDimming() {
    const dropdown = document.getElementById('source-dropdown');
    if (!dropdown) return;
    const p = _state.provider;
    dropdown.querySelectorAll('label[data-provider]').forEach(label => {
        const lp = label.getAttribute('data-provider');
        if (p === 'all' || lp === p) {
            label.style.opacity = '';
            label.style.display = '';
        } else {
            label.style.opacity = '0.35';
        }
    });
}

function setupProviderPills(applyFiltersCallback, onProviderChange) {
    const container = document.getElementById('provider-pills');
    if (!container) return;
    container.querySelectorAll('button[data-provider]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-provider') === _state.provider);
    });
    if (container._pillHandler) {
        container.removeEventListener('click', container._pillHandler);
    }
    const handler = (e) => {
        const btn = e.target.closest('button[data-provider]');
        if (!btn) return;
        const next = btn.getAttribute('data-provider');
        if (!next || next === _state.provider) return;
        _state.provider = next;
        container.querySelectorAll('button[data-provider]').forEach(b => {
            b.classList.toggle('active', b === btn);
        });
        applyProviderDimming();
        if (typeof onProviderChange === 'function') {
            onProviderChange(next);
        } else {
            applyFiltersCallback();
        }
    };
    container.addEventListener('click', handler);
    container._pillHandler = handler;
}

export function setupFilterListeners(applyFiltersCallback, onProviderChange) {
    setupProviderPills(applyFiltersCallback, onProviderChange);

    const sourceBtn = document.getElementById('source-filter-btn');
    const sourceDropdown = document.getElementById('source-dropdown');
    sourceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sourceDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
            sourceDropdown.classList.add('open');
            sourceBtn.classList.add('open');
        }
    });

    const modelBtn = document.getElementById('model-filter-btn');
    const modelDropdown = document.getElementById('model-dropdown');
    modelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = modelDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
            modelDropdown.classList.add('open');
            modelBtn.classList.add('open');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-group')) {
            closeAllDropdowns();
        }
    });

    sourceDropdown.addEventListener('click', (e) => e.stopPropagation());
    modelDropdown.addEventListener('click', (e) => e.stopPropagation());

    sourceDropdown.addEventListener('change', () => applyFiltersCallback());
    modelDropdown.addEventListener('change', () => applyFiltersCallback());

    document.getElementById('filter-date-from').addEventListener('change', () => applyFiltersCallback());
    document.getElementById('filter-date-to').addEventListener('change', () => applyFiltersCallback());

    let costTimeout;
    document.getElementById('filter-min-cost').addEventListener('input', () => {
        clearTimeout(costTimeout);
        costTimeout = setTimeout(() => applyFiltersCallback(), 300);
    });

    document.getElementById('filter-clear-btn').addEventListener('click', () => {
        clearAllFilters();
        applyFiltersCallback();
    });
}

export function closeAllDropdowns() {
    document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('open'));
}

window.removeSourceFilter = function(source) {
    removeSourceFilter(source);
    if (window._applyFiltersCallback) window._applyFiltersCallback();
};

window.removeModelFilter = function(model) {
    removeModelFilter(model);
    if (window._applyFiltersCallback) window._applyFiltersCallback();
};

window.removeDateFromFilter = function() {
    removeDateFromFilter();
    if (window._applyFiltersCallback) window._applyFiltersCallback();
};

window.removeDateToFilter = function() {
    removeDateToFilter();
    if (window._applyFiltersCallback) window._applyFiltersCallback();
};

window.removeMinCostFilter = function() {
    removeMinCostFilter();
    if (window._applyFiltersCallback) window._applyFiltersCallback();
};
