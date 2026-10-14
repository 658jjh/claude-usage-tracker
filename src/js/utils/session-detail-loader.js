// Lazy loader for per-session conversation history. JSONL files are read
// on demand via the native Swift `loadSessionDetail` reply handler and
// memoized per filePath so re-opening a row is instant.

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

// Reasoning/tool/encrypted blocks are filtered out — internal model state
// must not reach the UI.
export function parseCodexConversation(raw) {
    if (!raw) return [];
    const out = [];
    const lines = raw.split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        const payload = entry && entry.payload;
        if (!payload || typeof payload !== 'object') continue;

        const pt = payload.type;
        if (pt !== 'message' && pt !== 'user_message' && pt !== 'agent_message') continue;
        const role = payload.role;
        if (role !== 'user' && role !== 'assistant') continue;

        let text = '';
        const content = payload.content;
        if (typeof content === 'string') {
            text = content;
        } else if (Array.isArray(content)) {
            for (const block of content) {
                if (!block) continue;
                if (typeof block === 'string') { text += block; continue; }
                if (block.type === 'reasoning') continue;
                const btext = block.text || block.value || '';
                if (typeof btext === 'string') text += btext;
            }
        }
        if (!text || !text.trim()) continue;
        if (/^<environment_context>/i.test(text.trim())) continue;
        if (/^<permissions instructions>/i.test(text.trim())) continue;

        const cleaned = cleanMessageText(text);
        if (!cleaned) continue;
        const truncated = cleaned.length > MAX_TEXT_LEN
            ? cleaned.substring(0, MAX_TEXT_LEN - 1) + '…'
            : cleaned;
        out.push({ role: role === 'user' ? 'user' : 'ai', text: truncated });
        if (out.length >= MAX_TURNS) break;
    }
    return out;
}

export function parseJsonlConversation(raw) {
    if (!raw) return [];
    const out = [];
    const lines = raw.split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        // Harness-injected content (skill bodies, caveats) is logged as a user turn.
        if (entry.isMeta) continue;
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

export async function loadSessionConversation(filePath, opts) {
    if (!filePath) {
        return { turns: [], truncated: false, error: 'No file reference for this session.' };
    }
    const provider = (opts && opts.provider) || 'claude';
    const cacheKey = provider + '|' + filePath;
    if (_cache.has(cacheKey)) {
        return _cache.get(cacheKey);
    }

    let raw = null;
    let errorMessage = null;

    try {
        const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.loadSessionDetail;
        if (handler && typeof handler.postMessage === 'function') {
            raw = await handler.postMessage(filePath);
        } else {
            const resp = await fetch('file://' + filePath);
            if (resp.ok) raw = await resp.text();
        }
    } catch (e) {
        errorMessage = (e && e.message) ? e.message : String(e);
    }

    if (!raw) {
        // Don't cache transient failures so a retry can succeed.
        return {
            turns: [],
            truncated: false,
            error: errorMessage || 'Conversation is not available for this session.'
        };
    }

    const turns = provider === 'codex'
        ? parseCodexConversation(raw)
        : parseJsonlConversation(raw);
    const result = { turns, truncated: turns.length >= MAX_TURNS };
    _cache.set(cacheKey, result);
    return result;
}

export function clearSessionDetailCache() {
    _cache.clear();
}
