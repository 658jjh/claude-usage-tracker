/**
 * session-detail-loader.js
 *
 * Lazy loader for per-session conversation history. The dashboard no longer
 * ships embedded `history[]` arrays in data.js — instead the original JSONL
 * file is read on demand (via the native Swift `loadSessionDetail` reply
 * handler) the first time the user opens a session detail modal.
 *
 * Results are memoized in-memory per filePath so re-opening a row is instant.
 */

const _cache = new Map();

const MAX_TURNS = 100;
const MAX_TEXT_LEN = 2000;

function cleanMessageText(text) {
    text = text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim();
    text = text.replace(/<[^>]+>/g, '').trim();
    text = text.replace(/^\[SUGGESTION MODE:[^\]]*\]\s*/i, '').trim();
    const cronMatch = text.match(/^\[cron:[a-f0-9-]+\s+([^\]]*)\]\s*(.*)/i);
    if (cronMatch) {
        text = cronMatch[1].trim() + (cronMatch[2] ? ' — ' + cronMatch[2].trim() : '');
    }
    return text;
}

function extractText(msg) {
    if (!msg || typeof msg !== 'object') return '';
    const content = msg.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        if (content.some(b => b && b.type === 'tool_result')) return '';
        const textBlock = content.find(c => c && c.type === 'text' && c.text && c.text.trim());
        return textBlock ? textBlock.text : '';
    }
    return '';
}

/**
 * Parse a raw JSONL string into a chronological conversation array.
 * @param {string} raw — contents of the .jsonl file
 * @returns {Array<{role: 'user'|'ai', text: string}>}
 */
export function parseJsonlConversation(raw) {
    if (!raw) return [];
    const out = [];
    const lines = raw.split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        const msg = entry.message;
        if (!msg || typeof msg !== 'object') continue;
        const role = msg.role;
        if (role !== 'user' && role !== 'assistant') continue;
        const rawText = extractText(msg);
        if (!rawText) continue;
        const cleaned = cleanMessageText(rawText);
        if (!cleaned) continue;
        const text = cleaned.length > MAX_TEXT_LEN
            ? cleaned.substring(0, MAX_TEXT_LEN - 1) + '…'
            : cleaned;
        out.push({ role: role === 'user' ? 'user' : 'ai', text });
        if (out.length >= MAX_TURNS) break;
    }
    return out;
}

/**
 * Load + parse a session's conversation history. Uses the native
 * `loadSessionDetail` reply handler when available and falls back to a
 * browser-mode fetch for local development.
 *
 * @param {string} filePath absolute path of the JSONL file
 * @returns {Promise<{turns: Array, truncated: boolean, error?: string}>}
 */
export async function loadSessionConversation(filePath) {
    if (!filePath) {
        return { turns: [], truncated: false, error: 'No file reference for this session.' };
    }
    if (_cache.has(filePath)) {
        return _cache.get(filePath);
    }

    let raw = null;
    let errorMessage = null;

    try {
        const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.loadSessionDetail;
        if (handler && typeof handler.postMessage === 'function') {
            // WKScriptMessageHandlerWithReply → postMessage returns a Promise
            raw = await handler.postMessage(filePath);
        } else {
            // Browser fallback — only works when dashboard is served with
            // read access to the file (rare, but useful for local dev).
            const resp = await fetch('file://' + filePath);
            if (resp.ok) raw = await resp.text();
        }
    } catch (e) {
        errorMessage = (e && e.message) ? e.message : String(e);
    }

    if (!raw) {
        const result = {
            turns: [],
            truncated: false,
            error: errorMessage || 'Conversation is not available for this session.'
        };
        // Do not cache transient failures so a retry can succeed.
        return result;
    }

    const turns = parseJsonlConversation(raw);
    const result = { turns, truncated: turns.length >= MAX_TURNS };
    _cache.set(filePath, result);
    return result;
}

/** Clear the in-memory cache (used on reload / import). */
export function clearSessionDetailCache() {
    _cache.clear();
}
