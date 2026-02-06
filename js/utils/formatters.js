/**
 * Formatters Module
 *
 * Number and value formatting utilities.
 * Used throughout the dashboard for consistent data presentation.
 */

/**
 * Format a number with K/M suffixes for large values.
 *
 * @param {number} num - The number to format
 * @returns {string} Formatted string (e.g., "1.5K", "2.3M", "42")
 *
 * @example
 * formatNumber(1234) // "1.2K"
 * formatNumber(1234567) // "1.2M"
 * formatNumber(42) // "42"
 */
export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Format a number with commas for thousands separators.
 *
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places to show
 * @returns {string} Formatted string with commas (e.g., "1,234,567.89")
 *
 * @example
 * formatWithCommas(1234567.89, 2) // "1,234,567.89"
 * formatWithCommas(1234, 0) // "1,234"
 */
export function formatWithCommas(value, decimals) {
    const parts = value.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}
