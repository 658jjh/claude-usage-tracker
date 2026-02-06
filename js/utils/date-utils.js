/**
 * Date Utilities Module
 *
 * Date calculation and formatting functions.
 * Handles ISO week calculations (Monday as week start) and date formatting.
 */

/**
 * Get the Monday (week start) for a given date.
 * Uses ISO 8601 week standard (Monday = start of week).
 *
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} ISO week start date in YYYY-MM-DD format
 *
 * @example
 * getWeekStart('2024-01-15') // Returns the Monday of that week
 */
export function getWeekStart(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/**
 * Get the Sunday (week end) for a given week start date.
 *
 * @param {string} weekStartStr - Week start date in YYYY-MM-DD format (Monday)
 * @returns {string} Week end date in YYYY-MM-DD format (Sunday)
 *
 * @example
 * getWeekEnd('2024-01-08') // Returns '2024-01-14' (the following Sunday)
 */
export function getWeekEnd(weekStartStr) {
    const d = new Date(weekStartStr + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/**
 * Format a week range as a human-readable label.
 *
 * @param {string} weekStartStr - Week start date in YYYY-MM-DD format
 * @returns {string} Formatted week label (e.g., "Jan 8 – Jan 14")
 *
 * @example
 * formatWeekLabel('2024-01-08') // "Jan 8 – Jan 14"
 */
export function formatWeekLabel(weekStartStr) {
    const start = new Date(weekStartStr + 'T00:00:00');
    const end = new Date(weekStartStr + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    const opts = { month: 'short', day: 'numeric' };
    return start.toLocaleDateString('en-US', opts) + ' \u2013 ' + end.toLocaleDateString('en-US', opts);
}
