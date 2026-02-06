/**
 * cache-efficiency.js
 *
 * Calculates and renders cache efficiency metrics including:
 * - Cache hit rate (gauge visualization)
 * - Token breakdown (cache read/write/input)
 * - Cost savings from cache usage
 * - Cache write overhead calculations
 */

import { formatNumber } from '../utils/formatters.js';
import { getPricingForModel } from '../utils/model-utils.js';

/**
 * Update the cache efficiency card with aggregated metrics from all sessions.
 *
 * Calculates:
 * - Cache hit rate (cache reads / total input tokens)
 * - Gross savings from cache reads
 * - Cache write overhead costs
 * - Net savings (gross savings - overhead)
 *
 * Updates:
 * - Gauge SVG animation and color
 * - Rating badge (Excellent/Moderate/Low)
 * - Token breakdown counts
 * - Stacked bar visualization
 * - Savings amount display
 *
 * @param {Array} allSessions - Array of all session objects
 */
export function updateCacheEfficiency(allSessions) {
    // Aggregate totals
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalInput = 0;
    let totalSavings = 0;
    let totalCacheWriteOverhead = 0;

    for (const s of allSessions) {
        const cr = s.cache_read || 0;
        const cw = s.cache_write || 0;
        const inp = s.input_tokens || 0;

        totalCacheRead += cr;
        totalCacheWrite += cw;
        totalInput += inp;

        // Compute per-session savings using model-specific pricing
        const pricing = getPricingForModel(s.model);
        // Savings: what cache_read would have cost at full input price, minus cache price
        totalSavings += cr * (pricing.input - pricing.cacheRead) / 1000000;
        // Cache write overhead: extra cost of writing to cache vs. regular input
        totalCacheWriteOverhead += cw * (pricing.cacheWrite - pricing.input) / 1000000;
    }

    const totalInputTokens = totalCacheRead + totalCacheWrite + totalInput;
    const hitRate = totalInputTokens > 0
        ? (totalCacheRead / totalInputTokens) * 100
        : 0;

    // Net savings = gross savings from reads minus write overhead
    const netSavings = totalSavings - totalCacheWriteOverhead;

    // Determine color and rating
    let gaugeColor, ratingClass, ratingText;
    if (hitRate >= 60) {
        gaugeColor = 'var(--accent-emerald)';
        ratingClass = 'rating-excellent';
        ratingText = 'Excellent';
    } else if (hitRate >= 30) {
        gaugeColor = 'var(--accent-amber)';
        ratingClass = 'rating-moderate';
        ratingText = 'Moderate';
    } else {
        gaugeColor = 'var(--accent-rose)';
        ratingClass = 'rating-low';
        ratingText = 'Low';
    }

    // Update gauge SVG
    const circumference = 2 * Math.PI * 52; // 326.73
    const offset = circumference * (1 - hitRate / 100);
    const gaugeFill = document.getElementById('gauge-fill');
    gaugeFill.style.stroke = gaugeColor;
    // Trigger animation after a brief delay so the transition plays
    setTimeout(() => {
        gaugeFill.style.strokeDashoffset = offset;
    }, 100);

    // Update percentage text
    const gaugePct = document.getElementById('gauge-pct');
    gaugePct.textContent = hitRate.toFixed(1) + '%';
    gaugePct.style.color = gaugeColor;

    // Update rating badge
    const ratingEl = document.getElementById('cache-eff-rating');
    ratingEl.textContent = ratingText;
    ratingEl.className = 'cache-eff-rating ' + ratingClass;

    // Update breakdown values
    document.getElementById('eff-cache-read').textContent = formatNumber(totalCacheRead) + ' tokens';
    document.getElementById('eff-cache-write').textContent = formatNumber(totalCacheWrite) + ' tokens';
    document.getElementById('eff-input').textContent = formatNumber(totalInput) + ' tokens';

    // Update stacked bar
    if (totalInputTokens > 0) {
        const readPct = (totalCacheRead / totalInputTokens * 100).toFixed(2);
        const writePct = (totalCacheWrite / totalInputTokens * 100).toFixed(2);
        const inputPct = (totalInput / totalInputTokens * 100).toFixed(2);
        setTimeout(() => {
            document.getElementById('eff-bar-read').style.width = readPct + '%';
            document.getElementById('eff-bar-write').style.width = writePct + '%';
            document.getElementById('eff-bar-input').style.width = inputPct + '%';
        }, 100);
    }

    // Update savings
    document.getElementById('savings-amount').textContent =
        '$' + (totalSavings > 0 ? totalSavings.toFixed(2) : '0.00');

    // Show net savings detail if cache write overhead is significant
    const detailEl = document.getElementById('savings-detail');
    if (totalCacheWriteOverhead > 0.01) {
        detailEl.innerHTML =
            'Write overhead: $' + totalCacheWriteOverhead.toFixed(2) + '<br>' +
            'Net benefit: <span style="color:' +
            (netSavings >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)') +
            '">$' + netSavings.toFixed(2) + '</span>';
    }
}
