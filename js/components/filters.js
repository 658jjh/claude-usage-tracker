/**
 * filters.js
 *
 * Session filtering system with multi-criteria support:
 * - Source filtering (checkboxes)
 * - Model filtering (checkboxes)
 * - Date range filtering
 * - Minimum cost filtering
 * - Filter chips for active filters
 */

import { getModelInfo } from '../utils/model-utils.js';
import { sourceClass } from '../utils/class-utils.js';

/**
 * Initialize filter dropdowns with data from sessions.
 * Populates source and model checkboxes, sets date input ranges.
 *
 * @param {Array} sessions - Array of all session objects
 */
export function initFilterDropdowns(sessions) {
    // Collect unique sources
    const sources = [...new Set(sessions.map(s => s.source))].sort();
    const sourceDropdown = document.getElementById('source-dropdown');
    sourceDropdown.innerHTML = sources.map(source => {
        const sc = sourceClass(source);
        return `<label>
            <input type="checkbox" value="${source}" data-filter="source" />
            <span class="source-badge source-${sc}">${source}</span>
        </label>`;
    }).join('');

    // Collect unique models (use display name, store raw value)
    const modelMap = {};
    sessions.forEach(s => {
        if (s.model) {
            const mi = getModelInfo(s.model);
            if (!modelMap[s.model]) {
                modelMap[s.model] = mi;
            }
        }
    });
    // Sort by family then name
    const modelEntries = Object.entries(modelMap).sort((a, b) => {
        const order = { 'model-opus': 0, 'model-sonnet': 1, 'model-haiku': 2 };
        const aOrder = order[a[1].cls] ?? 3;
        const bOrder = order[b[1].cls] ?? 3;
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

    // Set date input min/max from data
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

/**
 * Get currently active filter values from the UI.
 *
 * @returns {Object} Filter object with sources, models, dateFrom, dateTo, minCost
 */
export function getActiveFilters() {
    const filters = {
        sources: [],
        models: [],
        dateFrom: null,
        dateTo: null,
        minCost: null,
    };

    // Collect checked sources
    document.querySelectorAll('#source-dropdown input[type="checkbox"]:checked').forEach(cb => {
        filters.sources.push(cb.value);
    });

    // Collect checked models
    document.querySelectorAll('#model-dropdown input[type="checkbox"]:checked').forEach(cb => {
        filters.models.push(cb.value);
    });

    // Date range
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    // Min cost
    const minCostVal = document.getElementById('filter-min-cost').value;
    if (minCostVal !== '' && !isNaN(parseFloat(minCostVal))) {
        filters.minCost = parseFloat(minCostVal);
    }

    return filters;
}

/**
 * Filter sessions based on active filter criteria.
 *
 * @param {Array} sessions - Array of all session objects
 * @param {Object} filters - Filter object from getActiveFilters()
 * @returns {Array} Filtered array of session objects
 */
export function filterSessions(sessions, filters) {
    return sessions.filter(s => {
        // Source filter (OR within)
        if (filters.sources.length > 0 && !filters.sources.includes(s.source)) {
            return false;
        }

        // Model filter (OR within)
        if (filters.models.length > 0 && !filters.models.includes(s.model)) {
            return false;
        }

        // Date from (inclusive)
        if (filters.dateFrom && s.date < filters.dateFrom) {
            return false;
        }

        // Date to (inclusive)
        if (filters.dateTo && s.date > filters.dateTo) {
            return false;
        }

        // Min cost
        if (filters.minCost !== null && s.cost < filters.minCost) {
            return false;
        }

        return true;
    });
}

/**
 * Apply filters and re-render the table.
 * Updates filter button states, clear button visibility, and filter chips.
 *
 * @param {Array} allSessionsData - Global array of all sessions
 * @param {number} totalSessionCount - Total number of sessions
 * @param {Function} renderCallback - Callback to re-render table with filtered data
 */
export function applyFilters(allSessionsData, totalSessionCount, renderCallback) {
    const filters = getActiveFilters();
    const filtered = filterSessions(allSessionsData, filters);

    // Re-render the table with filtered sessions
    renderCallback(filtered);

    // Update session count
    updateFilterCount(filtered.length, totalSessionCount);

    // Update filter button active states
    const sourceBtn = document.getElementById('source-filter-btn');
    sourceBtn.classList.toggle('active', filters.sources.length > 0);

    const modelBtn = document.getElementById('model-filter-btn');
    modelBtn.classList.toggle('active', filters.models.length > 0);

    // Show/hide clear button
    const hasAnyFilter = filters.sources.length > 0
        || filters.models.length > 0
        || filters.dateFrom !== null
        || filters.dateTo !== null
        || filters.minCost !== null;
    document.getElementById('filter-clear-btn').classList.toggle('visible', hasAnyFilter);

    // Render chips
    renderFilterChips(filters);
}

/**
 * Update the filter count display showing filtered vs total sessions.
 *
 * @param {number} shown - Number of sessions after filtering
 * @param {number} total - Total number of sessions
 */
export function updateFilterCount(shown, total) {
    const el = document.getElementById('filter-count');
    if (shown === total) {
        el.innerHTML = `<span class="count-highlight">${total}</span> sessions`;
    } else {
        el.innerHTML = `<span class="count-highlight">${shown}</span> of ${total} sessions`;
    }
}

/**
 * Render filter chips showing active filters with remove buttons.
 *
 * @param {Object} filters - Filter object from getActiveFilters()
 */
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

/**
 * Remove a specific source filter.
 *
 * @param {string} source - Source name to remove from filter
 */
export function removeSourceFilter(source) {
    const cb = document.querySelector(`#source-dropdown input[value="${source}"]`);
    if (cb) cb.checked = false;
    // applyFilters will be called by the caller
}

/**
 * Remove a specific model filter.
 *
 * @param {string} model - Model identifier to remove from filter
 */
export function removeModelFilter(model) {
    const cb = document.querySelector(`#model-dropdown input[value="${model}"]`);
    if (cb) cb.checked = false;
    // applyFilters will be called by the caller
}

/**
 * Remove the date-from filter.
 */
export function removeDateFromFilter() {
    document.getElementById('filter-date-from').value = '';
    // applyFilters will be called by the caller
}

/**
 * Remove the date-to filter.
 */
export function removeDateToFilter() {
    document.getElementById('filter-date-to').value = '';
    // applyFilters will be called by the caller
}

/**
 * Remove the minimum cost filter.
 */
export function removeMinCostFilter() {
    document.getElementById('filter-min-cost').value = '';
    // applyFilters will be called by the caller
}

/**
 * Clear all active filters and reset UI.
 */
export function clearAllFilters() {
    // Uncheck all source checkboxes
    document.querySelectorAll('#source-dropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Uncheck all model checkboxes
    document.querySelectorAll('#model-dropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Clear date inputs
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';

    // Clear min cost
    document.getElementById('filter-min-cost').value = '';

    // Close any open dropdowns
    closeAllDropdowns();

    // applyFilters will be called by the caller
}

/**
 * Setup event listeners for all filter controls.
 *
 * @param {Function} applyFiltersCallback - Callback to apply filters when changed
 */
export function setupFilterListeners(applyFiltersCallback) {
    // Dropdown toggle for Source
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

    // Dropdown toggle for Model
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

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-group')) {
            closeAllDropdowns();
        }
    });

    // Prevent dropdown close when clicking inside dropdown
    sourceDropdown.addEventListener('click', (e) => e.stopPropagation());
    modelDropdown.addEventListener('click', (e) => e.stopPropagation());

    // Checkbox change listeners (delegated)
    sourceDropdown.addEventListener('change', () => applyFiltersCallback());
    modelDropdown.addEventListener('change', () => applyFiltersCallback());

    // Date input listeners
    document.getElementById('filter-date-from').addEventListener('change', () => applyFiltersCallback());
    document.getElementById('filter-date-to').addEventListener('change', () => applyFiltersCallback());

    // Min cost listener (debounced for typing)
    let costTimeout;
    document.getElementById('filter-min-cost').addEventListener('input', () => {
        clearTimeout(costTimeout);
        costTimeout = setTimeout(() => applyFiltersCallback(), 300);
    });

    // Clear all button
    document.getElementById('filter-clear-btn').addEventListener('click', () => {
        clearAllFilters();
        applyFiltersCallback();
    });
}

/**
 * Close all open filter dropdowns.
 */
export function closeAllDropdowns() {
    document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('open'));
}

// Make filter removal functions available globally for onclick handlers
window.removeSourceFilter = function(source) {
    removeSourceFilter(source);
    // Trigger applyFilters from global context
    if (window._applyFiltersCallback) {
        window._applyFiltersCallback();
    }
};

window.removeModelFilter = function(model) {
    removeModelFilter(model);
    if (window._applyFiltersCallback) {
        window._applyFiltersCallback();
    }
};

window.removeDateFromFilter = function() {
    removeDateFromFilter();
    if (window._applyFiltersCallback) {
        window._applyFiltersCallback();
    }
};

window.removeDateToFilter = function() {
    removeDateToFilter();
    if (window._applyFiltersCallback) {
        window._applyFiltersCallback();
    }
};

window.removeMinCostFilter = function() {
    removeMinCostFilter();
    if (window._applyFiltersCallback) {
        window._applyFiltersCallback();
    }
};
