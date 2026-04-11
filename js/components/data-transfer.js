/**
 * data-transfer.js
 *
 * Export and import session data as JSON for cross-device viewing.
 * Uses native WKWebView message handlers (NSSavePanel / NSOpenPanel).
 */

const EXPORT_VERSION = 1;

/**
 * Export all session data as a downloadable JSON file.
 * Sends data to native Swift handler which shows NSSavePanel.
 *
 * @param {Object} summary - The __SUMMARY__ object
 * @param {Array} sessions - All session objects
 */
export function exportData(summary, sessions) {
    const payload = {
        _format: 'claude-usage-tracker',
        _version: EXPORT_VERSION,
        exported_at: new Date().toISOString(),
        summary,
        sessions,
    };

    const json = JSON.stringify(payload, null, 2);

    try {
        window.webkit.messageHandlers.exportData.postMessage(json);
    } catch {
        // Fallback for browser testing
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `claude-usage-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Exported ' + sessions.length + ' sessions');
    }
}

/**
 * Prompt user to pick a JSON file and import its session data.
 * Uses native NSOpenPanel via Swift message handler.
 * Returns a promise that resolves to the parsed payload, or null on cancel/error.
 *
 * @returns {Promise<{summary: Object, sessions: Array}|null>}
 */
export function importData() {
    return new Promise((resolve) => {
        // Store the resolver on window so Swift can call back
        window._importDataResolver = (jsonString) => {
            delete window._importDataResolver;
            if (!jsonString) return resolve(null);

            try {
                const data = JSON.parse(jsonString);
                if (data._format !== 'claude-usage-tracker' || !Array.isArray(data.sessions)) {
                    showToast('Invalid file format', true);
                    return resolve(null);
                }
                showToast('Imported ' + data.sessions.length + ' sessions');
                resolve(data);
            } catch {
                showToast('Failed to parse file', true);
                resolve(null);
            }
        };

        try {
            window.webkit.messageHandlers.importData.postMessage('');
        } catch {
            // Fallback for browser testing
            delete window._importDataResolver;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (!file) return resolve(null);
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const data = JSON.parse(reader.result);
                        if (data._format !== 'claude-usage-tracker' || !Array.isArray(data.sessions)) {
                            showToast('Invalid file format', true);
                            return resolve(null);
                        }
                        showToast('Imported ' + data.sessions.length + ' sessions');
                        resolve(data);
                    } catch {
                        showToast('Failed to parse file', true);
                        resolve(null);
                    }
                };
                reader.readAsText(file);
            });
            input.addEventListener('cancel', () => resolve(null));
            input.click();
        }
    });
}

/**
 * Merge imported sessions with existing sessions, deduplicating by source+file+date.
 * Mirrors the collector's dedup key — sessionId alone is not unique because
 * Claude Code sub-agents share one sessionId across multiple .jsonl files.
 *
 * @param {Array} existing - Current session array
 * @param {Array} incoming - Imported session array
 * @returns {Array} Merged and sorted sessions
 */
export function mergeSessions(existing, incoming) {
    const seen = new Set();
    const merged = [];
    const keyOf = (s) => (s.source || '') + '|' + (s.file || '') + '|' + s.date;

    for (const s of existing) {
        seen.add(keyOf(s));
        merged.push(s);
    }

    for (const s of incoming) {
        const key = keyOf(s);
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(s);
        }
    }

    // Sort newest first
    merged.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
    });

    return merged;
}

/**
 * Recalculate summary totals from a session array.
 *
 * @param {Array} sessions - All sessions
 * @returns {Object} Updated summary
 */
export function recalcSummary(sessions) {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);

    const totals = {};
    let grandTotal = 0;
    const sourceCounts = {};
    let todayCost = 0;
    let monthCost = 0;

    for (const s of sessions) {
        const src = s.source || 'Unknown';
        totals[src] = (totals[src] || 0) + s.cost;
        grandTotal += s.cost;
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;

        if (s.date === today) todayCost += s.cost;
        if (s.date && s.date.startsWith(currentMonth)) monthCost += s.cost;
    }

    totals.grand_total = grandTotal;
    sourceCounts.total = sessions.length;

    return {
        generated_at: new Date().toISOString(),
        today,
        current_month: currentMonth,
        totals,
        today_cost: todayCost,
        month_cost: monthCost,
        session_counts: sourceCounts,
    };
}

// ── Toast notification (also called from Swift via window._showExportToast) ──

let toastTimer = null;

export function showToast(message, isError = false) {
    let toast = document.getElementById('data-transfer-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'data-transfer-toast';
        toast.className = 'dt-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.toggle('dt-toast-error', isError);
    toast.classList.remove('dt-toast-visible');

    // force reflow
    void toast.offsetWidth;
    toast.classList.add('dt-toast-visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('dt-toast-visible');
    }, 2500);
}

// Expose toast to Swift callbacks
window._showExportToast = (msg, isErr) => showToast(msg, isErr);
