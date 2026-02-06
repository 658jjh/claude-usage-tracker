/**
 * Class Utilities Module
 *
 * CSS class name generation utilities for badges and styling.
 * Provides consistent class names based on cost levels and sources.
 */

/**
 * Get CSS class for a cost badge based on cost value.
 *
 * @param {number} cost - The cost amount in dollars
 * @returns {string} CSS class name ('cost-low', 'cost-medium', or 'cost-high')
 *
 * @example
 * costClass(0.50) // "cost-low"
 * costClass(10.00) // "cost-medium"
 * costClass(50.00) // "cost-high"
 */
export function costClass(cost) {
    return cost < 1 ? 'cost-low' : cost < 20 ? 'cost-medium' : 'cost-high';
}

/**
 * Get CSS class for cost text color based on cost value.
 *
 * @param {number} cost - The cost amount in dollars
 * @returns {string} CSS class name for text color
 *
 * @example
 * costTextClass(0.50) // "cost-low-text"
 * costTextClass(10.00) // "cost-medium-text"
 * costTextClass(50.00) // "cost-high-text"
 */
export function costTextClass(cost) {
    return cost < 1 ? 'cost-low-text' : cost < 20 ? 'cost-medium-text' : 'cost-high-text';
}

/**
 * Get CSS class for a source badge.
 *
 * @param {string} source - The source name
 * @returns {string} CSS class name for source badge
 *
 * @example
 * sourceClass('Claude Desktop') // "desktop"
 * sourceClass('Cursor') // "cursor"
 * sourceClass('OpenClaw') // "openclaw"
 */
export function sourceClass(source) {
    if (source === 'Clawdbot' || source === 'OpenClaw') return 'openclaw';
    if (source === 'Claude Desktop') return 'desktop';
    if (source === 'Cursor') return 'cursor';
    if (source === 'Windsurf') return 'windsurf';
    if (source === 'Cline' || source === 'Roo Code') return 'cline';
    if (source === 'Aider') return 'aider';
    if (source === 'Continue') return 'continue';
    return 'claude';
}
