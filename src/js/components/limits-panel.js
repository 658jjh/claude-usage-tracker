import { getModelInfo } from '../utils/model-utils.js';

function formatTokens(value) {
    if (!value) return '—';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M tokens`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}K tokens`;
    return `${value.toLocaleString()} tokens`;
}

function formatReset(timestamp) {
    if (!timestamp) return 'Reset time unavailable';
    const delta = Math.max(0, timestamp * 1000 - Date.now());
    const minutes = Math.ceil(delta / 60000);
    if (minutes < 60) return `Resets in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `Resets in ${hours}h${remainder ? ` ${remainder}m` : ''}`;
}

function severity(percent) {
    if (percent >= 90) return 'critical';
    if (percent >= 75) return 'warning';
    return '';
}

function renderCodexBucket(bucket, label) {
    if (!bucket) return '';
    const percent = Math.min(100, Math.max(0, bucket.used_percent || 0));
    const state = severity(percent);
    return `<article class="limit-card">
        <div class="limit-card-head"><div><div class="limit-provider">Codex</div><div class="limit-card-title">${label}</div></div><div class="limit-percent ${state}">${percent.toFixed(0)}%</div></div>
        <div class="limit-track" role="progressbar" aria-label="Codex ${label} usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent.toFixed(0)}"><div class="limit-fill ${state}" style="width:${percent}%"></div></div>
        <div class="limit-card-meta"><span>${percent >= 90 ? 'Near limit' : percent >= 75 ? 'Approaching limit' : 'Available'}</span><span>${formatReset(bucket.resets_at)}</span></div>
    </article>`;
}

export function renderLimitsPanel(limits) {
    const grid = document.getElementById('limits-grid');
    const updated = document.getElementById('limits-updated');
    if (!grid) return;
    const codex = limits?.codex;
    const claude = limits?.claude;
    const cards = [];
    if (codex?.primary) cards.push(renderCodexBucket(codex.primary, 'Primary window'));
    if (codex?.secondary) cards.push(renderCodexBucket(codex.secondary, 'Secondary window'));

    if (claude) {
        const model = getModelInfo(claude.model).name;
        cards.push(`<article class="limit-card limit-card-muted">
            <div class="limit-card-head"><div><div class="limit-provider">Claude</div><div class="limit-card-title">Latest context observed</div></div><div class="limit-percent">—</div></div>
            <div class="limit-card-meta" style="margin-top:14px"><span>${formatTokens(claude.context_tokens)}</span><span>${model}</span></div>
            <p class="limit-note">Claude Code does not expose Pro/Max account quota percentage or reset time locally.</p>
        </article>`);
    } else {
        cards.push(`<article class="limit-card limit-card-muted"><div class="limit-provider">Claude</div><div class="limit-card-title" style="margin-top:6px">Account quota unavailable</div><p class="limit-note">No recent Claude context data was found in local transcripts.</p></article>`);
    }

    if (!cards.length) {
        grid.innerHTML = '<div class="limit-note">No supported limit data found yet. Start a Codex or Claude session, then sync again.</div>';
        if (updated) updated.textContent = 'Waiting for local session data';
        return;
    }
    grid.innerHTML = cards.join('');
    if (updated) updated.textContent = codex?.plan_type ? `${codex.plan_type} plan · local snapshot` : 'Local session snapshot';
}
