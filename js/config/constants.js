/**
 * Constants Module
 *
 * Contains all constant values used throughout the application:
 * - Source color palette for charts
 * - Default fallback colors
 * - Model pricing tiers
 * - Day name arrays for heatmap
 */

/**
 * Source color palette mapping source names to hex colors.
 * Used by charts to ensure consistent color coding across visualizations.
 */
export const sourceColors = {
    'OpenClaw': '#fbbf24',
    'Clawdbot': '#fbbf24',
    'Claude Code': '#60a5fa',
    'Claude Desktop': '#a78bfa',
    'Cursor': '#22d3ee',
    'Windsurf': '#34d399',
    'Cline': '#fb7185',
    'Roo Code': '#f472b6',
    'Aider': '#2dd4bf',
    'Continue': '#f59e0b',
};

/**
 * Default color palette for sources not explicitly mapped.
 * Colors are assigned cyclically when a new unknown source is encountered.
 */
export const defaultColors = ['#34d399', '#fb7185', '#a78bfa', '#f472b6', '#2dd4bf'];

/**
 * Model family color mapping for model breakdown charts.
 */
export const modelColorMap = {
    'Opus': '#fb7185',
    'Sonnet': '#60a5fa',
    'Haiku': '#34d399',
    'Unknown': '#a78bfa',
};

/**
 * Abbreviated day names for heatmap column headers.
 * Order: Monday through Sunday (ISO week standard).
 */
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Full day names for heatmap tooltips.
 * Order: Monday through Sunday (ISO week standard).
 */
export const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
