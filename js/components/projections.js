/**
 * projections.js
 *
 * Monthly cost projection calculations and rendering.
 * Includes yesterday delta comparison for daily spend analysis.
 */

/**
 * Determine color class for monthly projection based on projected amount.
 *
 * @param {number} monthlyAmount - Projected monthly cost in dollars
 * @returns {string} CSS class name ('proj-low', 'proj-mid', or 'proj-high')
 */
export function projectionColorClass(monthlyAmount) {
    if (monthlyAmount < 50) return 'proj-low';
    if (monthlyAmount <= 200) return 'proj-mid';
    return 'proj-high';
}

/**
 * Render the monthly projection based on current month-to-date spending.
 *
 * Calculates daily average and projects to end of month.
 * Shows confidence note for early-month projections (first 3 days).
 *
 * @param {Object} summary - Summary object containing today, month_cost, etc.
 */
export function renderMonthlyProjection(summary) {
    const el = document.getElementById('month-projection');
    if (!el) return;

    const today = new Date(summary.today + 'T00:00:00');
    const year = today.getFullYear();
    const month = today.getMonth();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // No data yet
    if (summary.month_cost === 0) {
        el.style.display = 'none';
        return;
    }

    const dailyAvg = summary.month_cost / dayOfMonth;
    const projection = dailyAvg * daysInMonth;
    const colorCls = projectionColorClass(projection);

    // Format projection: use ~$ for estimates, round to nearest dollar if >= $10
    let projStr;
    if (projection >= 10) {
        projStr = '~$' + Math.round(projection);
    } else {
        projStr = '~$' + projection.toFixed(2);
    }

    // Format daily average
    let dailyStr = '$' + dailyAvg.toFixed(2) + '/day';

    // Build the HTML
    let html = '';
    html += '<span class="proj-arrow">\u2192</span>';
    html += '<span class="proj-value ' + colorCls + '">' + projStr + '/mo</span>';
    html += '<span class="proj-sep">|</span>';
    html += '<span class="proj-daily">' + dailyStr + '</span>';

    // Confidence note for early-month projections
    if (dayOfMonth <= 3) {
        html += '<span class="proj-note">based on ' + dayOfMonth + ' day' + (dayOfMonth > 1 ? 's' : '') + ' of ' + daysInMonth + '</span>';
    }

    el.innerHTML = html;
    el.style.display = 'flex';
}

/**
 * IIFE: Update yesterday delta comparison for today's cost card.
 *
 * Compares today's cost to yesterday's cost and displays:
 * - Up arrow (↑) with red/rose color if spending more
 * - Down arrow (↓) with green/emerald color if spending less
 * - Neutral indicator if same or no data
 *
 * Shows percentage change if >= 1%.
 *
 * This is an IIFE that should be called within loadData() context.
 *
 * @param {Object} summary - Summary object with today and today_cost
 * @param {Array} allSessions - Array of all session objects
 */
export function updateYesterdayDelta(summary, allSessions) {
    const deltaEl = document.getElementById('yesterday-delta');
    if (!deltaEl) return;

    const todayCost = summary.today_cost;

    // Calculate yesterday's date string
    const todayDate = new Date(summary.today + 'T00:00:00');
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yy = yesterdayDate.getFullYear();
    const ym = String(yesterdayDate.getMonth() + 1).padStart(2, '0');
    const yd = String(yesterdayDate.getDate()).padStart(2, '0');
    const yesterdayStr = `${yy}-${ym}-${yd}`;

    // Find yesterday's sessions and cost
    const yesterdaySessions = allSessions.filter(s => s.date === yesterdayStr);
    const hasYesterdayData = yesterdaySessions.length > 0;
    const yesterdayCost = yesterdaySessions.reduce((sum, s) => sum + s.cost, 0);

    // No data for yesterday at all
    if (!hasYesterdayData) {
        // Check if there is ANY prior data
        const hasPriorData = allSessions.some(s => s.date < summary.today);
        if (!hasPriorData) {
            deltaEl.textContent = '';
            deltaEl.className = 'yesterday-delta';
            return;
        }
        deltaEl.innerHTML = '<span class="delta-arrow">--</span> no data yesterday';
        deltaEl.className = 'yesterday-delta delta-neutral';
        return;
    }

    // Both days have data -- compute delta
    const diff = todayCost - yesterdayCost;
    const absDiff = Math.abs(diff);

    // Same cost (within 1 cent tolerance)
    if (absDiff < 0.01) {
        deltaEl.innerHTML = '<span class="delta-arrow">--</span> same as yesterday';
        deltaEl.className = 'yesterday-delta delta-neutral';
        return;
    }

    // Percentage change
    let pctStr = '';
    if (yesterdayCost > 0) {
        const pct = (absDiff / yesterdayCost) * 100;
        if (pct >= 1) {
            pctStr = ` (${pct.toFixed(0)}%)`;
        }
    }

    if (diff > 0) {
        // Spending MORE than yesterday -- rose/red, up arrow
        deltaEl.innerHTML =
            `<span class="delta-arrow">\u2191</span> $${absDiff.toFixed(2)}${pctStr} vs yesterday`;
        deltaEl.className = 'yesterday-delta delta-up';
    } else {
        // Spending LESS than yesterday -- emerald/green, down arrow
        deltaEl.innerHTML =
            `<span class="delta-arrow">\u2193</span> $${absDiff.toFixed(2)}${pctStr} vs yesterday`;
        deltaEl.className = 'yesterday-delta delta-down';
    }
}
