#!/usr/bin/env node
/**
 * Claude Usage Collector v4
 * 
 * Tracks usage across ALL local Claude tools:
 *   ✅ OpenClaw / Clawdbot      (~/.openclaw/ , ~/.clawdbot/)
 *   ✅ Claude Code CLI           (~/.claude/projects/)
 *   ✅ Claude Desktop (Agent)    (~/Library/Application Support/Claude/local-agent-mode-sessions/)
 *   ✅ Cursor                    (~/.cursor/ or ~/Library/Application Support/Cursor/)
 *   ✅ Windsurf                  (~/.windsurf/ or ~/Library/Application Support/Windsurf/)
 *   ✅ Cline (VS Code ext)       (~/.cline/ or VS Code extension storage)
 *   ✅ Roo Code (VS Code ext)    (~/.roo-code/ or VS Code extension storage)
 *   ✅ Continue.dev              (~/.continue/)
 *   ✅ Aider                     (~/.aider/)
 * 
 * Auto-detects which tools are installed and parses their JSONL/log files.
 * Attributes costs to actual dates from timestamps (not file mod dates).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const OUTPUT_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const CACHE_FILE = path.join(OUTPUT_DIR, 'sessions-cache.json');
// Fingerprint of every JSONL file we've already parsed: {filePath: {mtime,size}}.
// Lets us skip re-parsing files that haven't changed since the last run.
const SCAN_INDEX_FILE = path.join(OUTPUT_DIR, 'scan-index.json');

const HOME = os.homedir();
const TZ_OFFSET = -new Date().getTimezoneOffset() / 60;

// ─── Helpers ─────────────────────────────────────────────

function toLocalDate(timestampMs) {
  if (!timestampMs) return null;
  const d = new Date(timestampMs + TZ_OFFSET * 3600000);
  return d.toISOString().split('T')[0];
}

function toLocalTime(timestampMs) {
  if (!timestampMs) return null;
  const d = new Date(timestampMs + TZ_OFFSET * 3600000);
  return d.toISOString().split('T')[1].substring(0, 5);
}

function parseTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function getPricing(model) {
  if (!model) return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
  const m = model.toLowerCase();
  if (m.includes('opus-4-6') || m.includes('opus-4.6') || m.includes('opus-4-5') || m.includes('opus-4.5'))
    return { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };
  if (m.includes('opus-4-1') || m.includes('opus-4.1'))
    return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
  if (m.includes('opus'))
    return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
  if (m.includes('sonnet'))
    return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
  if (m.includes('haiku-4-5') || m.includes('haiku-4.5'))
    return { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 };
  if (m.includes('haiku'))
    return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 };
  return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
}

// Recursively find JSONL files
function findJsonl(dir, maxDepth = 10) {
  const results = [];
  if (maxDepth <= 0) return results;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.git')) {
        results.push(...findJsonl(fullPath, maxDepth - 1));
      } else if (entry.name.endsWith('.jsonl') && !entry.name.includes('audit')) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

function makeDayEntry() {
  return { cost: 0, input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0, models: new Set(), times: [] };
}

/**
 * Clean raw message text: strip XML tags, system markers, cron prefixes.
 */
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

/**
 * Extract text content from a JSONL message entry's content field.
 */
function extractText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    // Check if this is a tool_result (skip it)
    if (content.some(b => b.type === 'tool_result')) return '';
    const textBlock = content.find(c => c.type === 'text' && c.text && c.text.trim());
    return textBlock ? textBlock.text : '';
  }
  return '';
}

/**
 * Extract lightweight session metadata from a JSONL file.
 * Full conversation history is NOT stored here — it is read on-demand from
 * the original JSONL file when the user opens the detail modal, so the
 * cache + data.js payload stays small and startup is fast.
 *
 * Returns: { title, sessionId, cwd }
 */
function extractSessionMeta(filePath) {
  const meta = { title: '', sessionId: '', cwd: '' };
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    let foundTitle = false;

    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }

      // Extract sessionId and cwd from any entry that has them
      if (!meta.sessionId && entry.sessionId) meta.sessionId = entry.sessionId;
      if (!meta.cwd && entry.cwd) meta.cwd = entry.cwd;

      // Skip non-conversation entries
      const msg = entry.message;
      if (!msg || typeof msg !== 'object') continue;
      const role = msg.role;
      if (role !== 'user' && role !== 'assistant') continue;

      // We only need title + sessionId + cwd here. Bail as soon as we have
      // everything we came for to avoid walking the full file.
      if (foundTitle && meta.sessionId && meta.cwd) break;

      if (!foundTitle && role === 'user') {
        const rawText = extractText(msg);
        if (!rawText) continue;
        const text = cleanMessageText(rawText);
        if (!text) continue;
        meta.title = text.length > 80 ? text.substring(0, 77) + '...' : text;
        foundTitle = true;
      }
    }
  } catch {}
  // Fallback: derive sessionId from filename
  if (!meta.sessionId) {
    const base = path.basename(filePath, '.jsonl');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(base)) {
      meta.sessionId = base;
    }
  }
  return meta;
}

function pushSessions(sessions, dayData, source, fileName, meta, filePath) {
  meta = meta || {};
  for (const [date, data] of Object.entries(dayData)) {
    if (data.cost < 0.0001) continue;
    const models = [...data.models];
    const time = data.times.length > 0 ? data.times.sort()[0] : '00:00';
    const entry = {
      date,
      time,
      source,
      file: fileName,
      cost: parseFloat(data.cost.toFixed(4)),
      input_tokens: data.input_tokens,
      output_tokens: data.output_tokens,
      cache_read: data.cache_read,
      cache_write: data.cache_write,
      model: models[models.length - 1] || ''
    };
    if (filePath) entry.filePath = filePath;
    if (meta.title) entry.title = meta.title;
    if (meta.sessionId) entry.sessionId = meta.sessionId;
    if (meta.cwd) entry.cwd = meta.cwd;
    sessions.push(entry);
  }
}

// ─── Cache helpers ───────────────────────────────────────

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return [];
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.warn('⚠️  Cache file has unexpected format, ignoring.');
      return [];
    }
    // Per-entry validation: keep only entries with required fields
    const valid = data.filter(s =>
      s && typeof s.source === 'string' && typeof s.file === 'string' &&
      typeof s.date === 'string' && typeof s.cost === 'number'
    );
    if (valid.length < data.length) {
      console.warn(`⚠️  Filtered out ${data.length - valid.length} malformed cache entries`);
    }
    // Drop legacy embedded `history` field from older caches — detail is now
    // loaded on-demand from the original JSONL, so keeping it just bloats
    // memory and startup parse time.
    let strippedHistory = 0;
    for (const s of valid) {
      if (s.history) { delete s.history; strippedHistory++; }
    }
    if (strippedHistory > 0) {
      console.log(`🗜️  Stripped legacy history from ${strippedHistory} cache entries`);
    }
    return valid;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(`⚠️  Could not load cache: ${e.message}`);
    }
    return [];
  }
}

function saveCache(sessions) {
  try {
    const tmpFile = CACHE_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(sessions));
    fs.renameSync(tmpFile, CACHE_FILE);
  } catch (e) {
    console.warn(`⚠️  Could not save cache: ${e.message}`);
  }
}

function mergeSessions(freshSessions, cachedSessions) {
  const freshKeys = new Set();
  for (const s of freshSessions) {
    freshKeys.add(`${s.source}|${s.file}|${s.date}`);
  }
  const merged = [...freshSessions];
  for (const s of cachedSessions) {
    const key = `${s.source}|${s.file}|${s.date}`;
    if (!freshKeys.has(key)) {
      merged.push(s);
    }
  }
  return merged;
}

// ─── Scan index (mtime fingerprint) ──────────────────────
//
// This is the big startup win: we remember every JSONL file's mtime+size
// from the previous run and skip re-parsing files that haven't changed.
// A typical launch touches ~10k files but only a handful have actually been
// written to since last launch, so we can drop collector cost from ~20s to
// well under a second on steady state.

function loadScanIndex() {
  try {
    if (!fs.existsSync(SCAN_INDEX_FILE)) return {};
    const raw = fs.readFileSync(SCAN_INDEX_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  } catch {
    return {};
  }
}

function saveScanIndex(index) {
  try {
    const tmp = SCAN_INDEX_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(index));
    fs.renameSync(tmp, SCAN_INDEX_FILE);
  } catch (e) {
    console.warn(`⚠️  Could not save scan index: ${e.message}`);
  }
}

// Module-level scan state — populated in main().
let _scanIndex = {};
let _newScanIndex = {};
let _cachedByFilePath = new Map();
const _seenFilePaths = new Set();
let _skipCount = 0;
let _parseCount = 0;

/**
 * Scan one JSONL file: stat it, skip parsing if fingerprint is unchanged,
 * otherwise parse it with the supplied parser and append freshly-collected
 * session-day entries onto `sessions`.
 */
function processJsonlFile(sessions, source, fullPath, parser) {
  let stat;
  try { stat = fs.statSync(fullPath); } catch { return; }
  _seenFilePaths.add(fullPath);

  const prev = _scanIndex[fullPath];
  const cached = _cachedByFilePath.get(fullPath);
  if (prev && cached && prev.mtime === stat.mtimeMs && prev.size === stat.size) {
    // Unchanged — reuse cached entries verbatim, skip the file read entirely.
    for (const entry of cached) sessions.push(entry);
    _newScanIndex[fullPath] = prev;
    _skipCount++;
    return;
  }

  try {
    const dayData = parser(fullPath);
    const meta = extractSessionMeta(fullPath);
    pushSessions(sessions, dayData, source, path.basename(fullPath), meta, fullPath);
    _newScanIndex[fullPath] = { mtime: stat.mtimeMs, size: stat.size };
    _parseCount++;
  } catch (e) {
    console.error(`  Error: ${fullPath}: ${e.message}`);
  }
}

// ─── Parser: OpenClaw / Clawdbot format ──────────────────
// usage fields: usage.input, usage.output, usage.cacheRead, usage.cacheWrite
// OR pre-computed usage.cost.total
function parseOpenClawFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry.message;
    const usage = (msg && msg.usage) || entry.usage;
    if (!usage) continue;
    if (!usage.cost && !usage.input && !usage.output) continue;

    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(msg && msg.timestamp);
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;

    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);

    const model = (msg && msg.model) || entry.model || '';
    if (model && model.startsWith('claude')) dd.models.add(model);

    if (usage.cost && usage.cost.total) {
      dd.cost += usage.cost.total;
    } else {
      const pricing = getPricing(model);
      const inp = usage.input || 0;
      const out = usage.output || 0;
      const cr = usage.cacheRead || 0;
      const cw = usage.cacheWrite || 0;
      dd.cost += (inp * pricing.input + out * pricing.output + cw * pricing.cacheWrite + cr * pricing.cacheRead) / 1000000;
    }
    dd.input_tokens += (usage.input || 0);
    dd.output_tokens += (usage.output || 0);
    dd.cache_read += (usage.cacheRead || 0);
    dd.cache_write += (usage.cacheWrite || 0);
  }
  return dayData;
}

// ─── Parser: Claude Code / Desktop / Cursor / Windsurf format ────
// usage fields: usage.input_tokens, usage.output_tokens,
//               usage.cache_creation_input_tokens, usage.cache_read_input_tokens
function parseClaudeCodeFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry.message;
    const usage = (msg && msg.usage) || entry.usage;
    if (!usage) continue;

    const inputTok = usage.input_tokens || 0;
    const outputTok = usage.output_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    if (inputTok === 0 && outputTok === 0 && cacheRead === 0 && cacheWrite === 0) continue;

    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(msg && msg.timestamp);
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;

    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);

    const model = (msg && msg.model) || entry.model || '';
    if (model && model.startsWith('claude')) dd.models.add(model);

    dd.input_tokens += inputTok;
    dd.output_tokens += outputTok;
    dd.cache_read += cacheRead;
    dd.cache_write += cacheWrite;

    const pricing = getPricing(model);
    dd.cost += (inputTok * pricing.input + outputTok * pricing.output + cacheWrite * pricing.cacheWrite + cacheRead * pricing.cacheRead) / 1000000;
  }
  return dayData;
}

// ─── Parser: Aider format ────────────────────────────────
// Aider uses a different log format — .aider.input.history and .aider.chat.history
// It also can write JSONL with litellm format
function parseAiderFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    // Aider litellm JSONL: { model, usage: { prompt_tokens, completion_tokens, total_tokens }, ... }
    const usage = entry.usage || entry.response?.usage;
    if (!usage) continue;

    const inputTok = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTok = usage.completion_tokens || usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    if (inputTok === 0 && outputTok === 0) continue;

    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(entry.created);
    // Aider sometimes uses Unix epoch seconds
    if (entry.created && typeof entry.created === 'number' && entry.created < 2000000000) {
      tsMs = entry.created * 1000;
    }
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;

    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);

    const model = entry.model || '';
    if (model && model.includes('claude')) dd.models.add(model);

    dd.input_tokens += inputTok;
    dd.output_tokens += outputTok;
    dd.cache_read += cacheRead;
    dd.cache_write += cacheWrite;

    const pricing = getPricing(model);
    dd.cost += (inputTok * pricing.input + outputTok * pricing.output + cacheWrite * pricing.cacheWrite + cacheRead * pricing.cacheRead) / 1000000;
  }
  return dayData;
}

// ─── Parser: Continue.dev format ─────────────────────────
// Continue stores in ~/.continue/sessions/ as JSON with completions
function parseContinueFormat(filePath) {
  const dayData = {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const steps = data.steps || data.history || [];
    for (const step of steps) {
      const usage = step.usage || step.promptTokens ? { input_tokens: step.promptTokens || 0, output_tokens: step.completionTokens || 0 } : null;
      if (!usage && !step.tokens) continue;

      const inputTok = usage?.input_tokens || step.promptTokens || 0;
      const outputTok = usage?.output_tokens || step.completionTokens || 0;
      if (inputTok === 0 && outputTok === 0) continue;

      let tsMs = parseTimestamp(step.timestamp) || parseTimestamp(data.dateCreated);
      let date = tsMs ? toLocalDate(tsMs) : null;
      let time = tsMs ? toLocalTime(tsMs) : '00:00';
      if (!date) {
        try { date = toLocalDate(fs.statSync(filePath).mtimeMs); } catch { continue; }
      }

      if (!dayData[date]) dayData[date] = makeDayEntry();
      const dd = dayData[date];
      if (time) dd.times.push(time);

      const model = step.model || data.model || '';
      if (model && model.includes('claude')) dd.models.add(model);

      dd.input_tokens += inputTok;
      dd.output_tokens += outputTok;

      const pricing = getPricing(model);
      dd.cost += (inputTok * pricing.input + outputTok * pricing.output) / 1000000;
    }
  } catch {}
  return dayData;
}

// ─── Source Collectors ───────────────────────────────────

function collectOpenClaw() {
  const sessions = [];
  const seenFiles = new Set();
  for (const dirName of ['openclaw', 'clawdbot']) {
    const sessDir = path.join(HOME, `.${dirName}/agents/main/sessions`);
    if (!fs.existsSync(sessDir)) continue;
    const source = dirName === 'openclaw' ? 'OpenClaw' : 'Clawdbot';
    const files = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      if (seenFiles.has(file)) continue;
      seenFiles.add(file);
      processJsonlFile(sessions, source, path.join(sessDir, file), parseOpenClawFormat);
    }
  }
  return sessions;
}

function collectClaudeCode() {
  const sessions = [];
  const claudeDir = path.join(HOME, '.claude/projects');
  if (!fs.existsSync(claudeDir)) return sessions;
  for (const filePath of findJsonl(claudeDir)) {
    processJsonlFile(sessions, 'Claude Code', filePath, parseClaudeCodeFormat);
  }
  return sessions;
}

function collectClaudeDesktop() {
  const sessions = [];
  const baseDir = path.join(HOME, 'Library/Application Support/Claude/local-agent-mode-sessions');
  if (!fs.existsSync(baseDir)) return sessions;
  for (const filePath of findJsonl(baseDir)) {
    processJsonlFile(sessions, 'Claude Desktop', filePath, parseClaudeCodeFormat);
  }
  return sessions;
}

function collectCursor() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.cursor/projects'),
    path.join(HOME, 'Library/Application Support/Cursor/User/workspaceStorage'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Cursor', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectWindsurf() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.windsurf/projects'),
    path.join(HOME, '.windsurf'),
    path.join(HOME, 'Library/Application Support/Windsurf/User/workspaceStorage'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Windsurf', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectCline() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.cline'),
    path.join(HOME, 'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev'),
    path.join(HOME, 'Library/Application Support/Code/User/globalStorage/cline.cline'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Cline', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectRooCode() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.roo-code'),
    path.join(HOME, 'Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Roo Code', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectAider() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.aider'),
    path.join(HOME, '.aider/logs'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const f of entries) {
      if (!f.endsWith('.jsonl') && !f.endsWith('.json')) continue;
      processJsonlFile(sessions, 'Aider', path.join(dir, f), parseAiderFormat);
    }
  }
  return sessions;
}

function collectContinue() {
  const sessions = [];
  const sessDir = path.join(HOME, '.continue/sessions');
  if (!fs.existsSync(sessDir)) return sessions;
  let entries;
  try { entries = fs.readdirSync(sessDir); } catch { return sessions; }
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    processJsonlFile(sessions, 'Continue', path.join(sessDir, f), parseContinueFormat);
  }
  return sessions;
}

// ─── Main ────────────────────────────────────────────────

console.log('Claude Usage Collector v4');
console.log('========================\n');

const sources = [
  { name: 'OpenClaw / Clawdbot', fn: collectOpenClaw },
  { name: 'Claude Code CLI',     fn: collectClaudeCode },
  { name: 'Claude Desktop',      fn: collectClaudeDesktop },
  { name: 'Cursor',              fn: collectCursor },
  { name: 'Windsurf',            fn: collectWindsurf },
  { name: 'Cline',               fn: collectCline },
  { name: 'Roo Code',            fn: collectRooCode },
  { name: 'Aider',               fn: collectAider },
  { name: 'Continue.dev',        fn: collectContinue },
];

let allSessions = [];
const sourceResults = {};

// Pre-load cache + scan index so processJsonlFile can skip unchanged files.
// These populate module-level state used by processJsonlFile().
const cachedSessions = loadCache();
_scanIndex = loadScanIndex();
_newScanIndex = {};
_cachedByFilePath = new Map();
for (const s of cachedSessions) {
  if (!s.filePath) continue;
  const arr = _cachedByFilePath.get(s.filePath);
  if (arr) { arr.push(s); } else { _cachedByFilePath.set(s.filePath, [s]); }
}

const scanStartedAt = Date.now();
for (const { name, fn } of sources) {
  process.stdout.write(`Scanning ${name}... `);
  const sessions = fn();
  if (sessions.length > 0) {
    console.log(`✅ ${sessions.length} session-day entries`);
    sourceResults[name] = sessions.length;
  } else {
    console.log(`— not found or empty`);
  }
  allSessions.push(...sessions);
}

const scanMs = Date.now() - scanStartedAt;
console.log(`\n⚡ Scan: ${_parseCount} parsed, ${_skipCount} skipped (unchanged) in ${scanMs}ms`);

// Preserve historical/imported cache entries whose file wasn't visited this
// run — either the original file is gone, or they were imported from another
// machine and have no local filePath.
let preservedHistorical = 0;
for (const s of cachedSessions) {
  if (!s.filePath || !_seenFilePaths.has(s.filePath)) {
    allSessions.push(s);
    preservedHistorical++;
  }
}
if (preservedHistorical > 0) {
  console.log(`📦 Preserved ${preservedHistorical} historical/imported entries`);
}

// Dedupe just in case: source|file|date must be unique.
const dedupedMap = new Map();
for (const s of allSessions) {
  dedupedMap.set(`${s.source}|${s.file}|${s.date}`, s);
}
allSessions = [...dedupedMap.values()];
console.log(`📊 Total after merge: ${allSessions.length} session-day entries\n`);

saveScanIndex(_newScanIndex);

// Generate summary
const today = toLocalDate(Date.now());
const currentMonth = today.substring(0, 7);

const sourceTotals = {};
const sourceCounts = {};
allSessions.forEach(s => {
  sourceTotals[s.source] = (sourceTotals[s.source] || 0) + s.cost;
  sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
});
const grandTotal = allSessions.reduce((s, x) => s + x.cost, 0);

for (const key of Object.keys(sourceTotals)) {
  sourceTotals[key] = parseFloat(sourceTotals[key].toFixed(2));
}

const todayCost = allSessions.filter(s => s.date === today).reduce((s, x) => s + x.cost, 0);
const monthCost = allSessions.filter(s => s.date.startsWith(currentMonth)).reduce((s, x) => s + x.cost, 0);

const summary = {
  generated_at: new Date().toISOString(),
  today,
  current_month: currentMonth,
  totals: {
    ...sourceTotals,
    grand_total: parseFloat(grandTotal.toFixed(2))
  },
  today_cost: parseFloat(todayCost.toFixed(2)),
  month_cost: parseFloat(monthCost.toFixed(2)),
  session_counts: {
    ...sourceCounts,
    total: allSessions.length
  }
};

// Separate sessions by type for backward-compatible data.js
const openclawSessions = allSessions.filter(s => s.source === 'OpenClaw' || s.source === 'Clawdbot');
const otherSessions = allSessions.filter(s => s.source !== 'OpenClaw' && s.source !== 'Clawdbot');

// Save cache (atomic write) before generating data.js
saveCache(allSessions);

const dataJs = `// Auto-generated by collect-usage.js v4 — ${new Date().toISOString()}
window.__SUMMARY__ = ${JSON.stringify(summary, null, 2)};
window.__OPENCLAW_SESSIONS__ = ${JSON.stringify(openclawSessions)};
window.__CLAUDE_SESSIONS__ = ${JSON.stringify(otherSessions)};
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'data.js'), dataJs);
console.log(`📄 Data written to: ${path.join(OUTPUT_DIR, 'data.js')}`);

console.log('\n✅ Done!');
console.log('================================');
console.log(JSON.stringify(summary, null, 2));
