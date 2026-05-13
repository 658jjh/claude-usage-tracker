/**
 * Chart Configuration Module
 *
 * Contains Chart.js default settings and shared configuration.
 * Sets global defaults for all charts in the dashboard.
 */

/**
 * Initialize Chart.js global defaults.
 * Must be called before creating any Chart instances.
 */
export function initChartDefaults() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(30, 41, 59, 0.4)';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size = 11;
}

/**
 * Shared tooltip configuration for all charts.
 * Uses frosted glass aesthetic for a polished look.
 */
export const commonTooltipConfig = {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(34, 211, 238, 0.15)',
    borderWidth: 1,
    titleColor: '#e2e8f0',
    bodyColor: '#94a3b8',
    footerColor: '#e2e8f0',
    padding: { top: 12, bottom: 12, left: 14, right: 14 },
    cornerRadius: 10,
    titleFont: { family: "'Outfit', sans-serif", size: 13, weight: '600' },
    bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
    footerFont: { family: "'JetBrains Mono', monospace", size: 11, weight: '600' },
    boxPadding: 6,
    usePointStyle: true,
    caretSize: 6,
    caretPadding: 8,
};

/**
 * Shared legend configuration for chart legends.
 */
export const commonLegendConfig = {
    labels: {
        padding: 20,
        usePointStyle: true,
        pointStyleWidth: 8,
        color: '#cbd5e1',
        font: {
            family: "'JetBrains Mono', monospace",
            size: 11,
            weight: '400'
        }
    }
};
