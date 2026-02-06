/**
 * animations.js
 *
 * Smooth counter animations for stat cards with easing effects.
 * Uses IntersectionObserver to trigger animations when elements enter viewport.
 */

/**
 * Easing function: decelerate curve (ease-out cubic)
 *
 * @param {number} t - Progress value between 0 and 1
 * @returns {number} Eased progress value
 */
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Format a number with commas (e.g. 1234567.89 -> "1,234,567.89")
 *
 * @param {number} value - The numeric value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string with commas
 */
function formatWithCommas(value, decimals) {
    const parts = value.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

/**
 * Animate a single stat card value from 0 to targetValue.
 *
 * @param {HTMLElement} element - The DOM element whose textContent to update
 * @param {number} target - The final numeric value (e.g. 95.64 or 135)
 * @param {number} duration - Animation duration in ms (default 1500)
 * @param {string} prefix - String prepended to the displayed value (e.g. '$')
 * @param {number} decimals - Number of decimal places (0 for integers, 2 for dollars)
 */
export function animateCounter(element, target, duration = 1500, prefix = '', decimals = 0) {
    // If target is 0, just display it immediately -- nothing to animate
    if (target === 0) {
        element.textContent = prefix + formatWithCommas(0, decimals);
        return;
    }

    const startTime = performance.now();

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const currentValue = easedProgress * target;

        element.textContent = prefix + formatWithCommas(currentValue, decimals);

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            // Ensure the final value is exact (no floating-point drift)
            element.textContent = prefix + formatWithCommas(target, decimals);
        }
    }

    requestAnimationFrame(tick);
}

/**
 * Set up an IntersectionObserver on .stats-grid. When the grid enters the
 * viewport, trigger animateCounter for every stat card value element.
 *
 * Each .value element must have three data attributes set by loadData():
 *   data-target   : the numeric target value (e.g. "95.64")
 *   data-prefix   : the string prefix (e.g. "$" or "")
 *   data-decimals : number of decimal places (e.g. "2" or "0")
 */
export function initCounterAnimations() {
    const grid = document.querySelector('.stats-grid');
    if (!grid) return;

    const DURATION = 1500; // ms
    let hasAnimated = false;

    function runAnimations() {
        if (hasAnimated) return;
        hasAnimated = true;

        grid.querySelectorAll('.value[data-target]').forEach((el, index) => {
            const target = parseFloat(el.dataset.target) || 0;
            const prefix = el.dataset.prefix || '';
            const decimals = parseInt(el.dataset.decimals, 10) || 0;

            // Stagger each card by 80ms so they don't all start at the exact same moment.
            // This complements the existing CSS fadeSlideUp stagger (50ms, 100ms, 150ms, 200ms).
            setTimeout(() => {
                animateCounter(el, target, DURATION, prefix, decimals);
            }, index * 80);
        });
    }

    // Use IntersectionObserver if available (all modern browsers)
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    runAnimations();
                    observer.unobserve(grid);
                }
            });
        }, {
            threshold: 0.2  // trigger when 20% of the grid is visible
        });
        observer.observe(grid);
    } else {
        // Fallback for very old browsers: animate immediately
        runAnimations();
    }
}
