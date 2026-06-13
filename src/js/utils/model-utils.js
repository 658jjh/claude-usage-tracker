// Per-million-token pricing in USD. Speculative future-model prices are
// projections based on historical pricing trends — update on release.
export function getPricingForModel(model) {
    if (!model) return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
    const m = model.toLowerCase().replace(/_/g, '-');

    if (m.includes('gpt-5-5') || m.includes('gpt-5.5'))
        return { input: 5.00, output: 30.00, cacheWrite: 0, cacheRead: 0.50 };
    if (m.includes('gpt-5-4-mini') || m.includes('gpt-5.4-mini'))
        return { input: 0.75, output: 4.50, cacheWrite: 0, cacheRead: 0.075 };
    if (m.includes('gpt-5-4') || m.includes('gpt-5.4'))
        return { input: 2.50, output: 15.00, cacheWrite: 0, cacheRead: 0.25 };
    if (m.includes('gpt-5-3-codex') || m.includes('gpt-5.3-codex'))
        return { input: 1.75, output: 14.00, cacheWrite: 0, cacheRead: 0.175 };
    if (m.includes('gpt-5-2') || m.includes('gpt-5.2'))
        return { input: 2.00, output: 10.00, cacheWrite: 0, cacheRead: 0.20 };
    if (m.startsWith('gpt-') || m.includes('codex'))
        return { input: 2.50, output: 15.00, cacheWrite: 0, cacheRead: 0.25 };

    if (m.includes('opus-5'))
        return { input: 20, output: 100, cacheWrite: 25, cacheRead: 2.0 };
    if (m.includes('sonnet-5'))
        return { input: 5, output: 20, cacheWrite: 6.25, cacheRead: 0.50 };
    if (m.includes('haiku-5'))
        return { input: 1.5, output: 7.5, cacheWrite: 1.875, cacheRead: 0.15 };

    if (m.includes('opus-6') || m.includes('opus-7') || m.includes('opus-8') || m.includes('opus-9'))
        return { input: 30, output: 150, cacheWrite: 37.5, cacheRead: 3.0 };
    if (m.includes('sonnet-6') || m.includes('sonnet-7') || m.includes('sonnet-8') || m.includes('sonnet-9'))
        return { input: 8, output: 40, cacheWrite: 10, cacheRead: 0.80 };
    if (m.includes('haiku-6') || m.includes('haiku-7') || m.includes('haiku-8') || m.includes('haiku-9'))
        return { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.20 };

    if (m.includes('opus-4-5') || m.includes('opus-4.5') || m.includes('opus-4-6') || m.includes('opus-4.6') || m.includes('opus-4-7') || m.includes('opus-4.7') || m.includes('opus-4-8') || m.includes('opus-4.8') || m.includes('opus-4-9') || m.includes('opus-4.9'))
        return { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };
    if (m.includes('opus-4-1') || m.includes('opus-4.1') || m.includes('opus-4-0') || m.includes('opus-4.0'))
        return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
    if (m.includes('opus'))
        return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };

    if (m.includes('sonnet-4') || m.includes('sonnet-3-7') || m.includes('sonnet-3.7') || m.includes('sonnet-3-5') || m.includes('sonnet-3.5'))
        return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
    if (m.includes('sonnet'))
        return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };

    if (m.includes('haiku-4-5') || m.includes('haiku-4.5') || m.includes('haiku-4-0') || m.includes('haiku-4.0'))
        return { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 };
    if (m.includes('haiku-3') || m.includes('haiku'))
        return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 };

    // GLM-модели — цены берутся из pricing.json (через window.__PRICING__) или 0
    if (m.includes('glm')) {
        try {
            const customPricing = window.__PRICING__ || {};
            const match = Object.keys(customPricing).find(k => m.includes(k.toLowerCase().replace(/-/g, '.')) || m.includes(k.toLowerCase()));
            if (match) return { input: customPricing[match].input || 0, output: customPricing[match].output || 0, cacheWrite: customPricing[match].cacheWrite || 0, cacheRead: customPricing[match].cacheRead || 0 };
        } catch {}
        return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    }

    return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
}

// Most-specific matches first — order matters.
export function getModelInfo(model) {
    if (!model) return { name: 'Unknown', cls: 'model-sonnet' };
    const m = model.toLowerCase().replace(/_/g, '-');

    if (m.includes('gpt-5-5') || m.includes('gpt-5.5')) return { name: 'GPT-5.5', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-4-mini') || m.includes('gpt-5.4-mini')) return { name: 'GPT-5.4 Mini', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-4') || m.includes('gpt-5.4')) return { name: 'GPT-5.4', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-3-codex') || m.includes('gpt-5.3-codex')) return { name: 'GPT-5.3 Codex', cls: 'model-codex' };
    if (m.includes('gpt-5-2') || m.includes('gpt-5.2')) return { name: 'GPT-5.2', cls: 'model-gpt-frontier' };
    if (m.startsWith('gpt-')) return { name: model, cls: 'model-gpt-frontier' };
    if (m.includes('codex')) return { name: model, cls: 'model-codex' };

    if (m.includes('opus-5-1') || m.includes('opus-5.1')) return { name: 'Opus 5.1', cls: 'model-opus' };
    if (m.includes('opus-5-0') || m.includes('opus-5.0') || m.includes('opus-5')) return { name: 'Opus 5', cls: 'model-opus' };

    if (m.includes('sonnet-5-1') || m.includes('sonnet-5.1')) return { name: 'Sonnet 5.1', cls: 'model-sonnet' };
    if (m.includes('sonnet-5-0') || m.includes('sonnet-5.0') || m.includes('sonnet-5')) return { name: 'Sonnet 5', cls: 'model-sonnet' };

    if (m.includes('haiku-5-1') || m.includes('haiku-5.1')) return { name: 'Haiku 5.1', cls: 'model-haiku' };
    if (m.includes('haiku-5-0') || m.includes('haiku-5.0') || m.includes('haiku-5')) return { name: 'Haiku 5', cls: 'model-haiku' };

    if (m.includes('opus-6-1') || m.includes('opus-6.1')) return { name: 'Opus 6.1', cls: 'model-opus' };
    if (m.includes('opus-6-0') || m.includes('opus-6.0') || m.includes('opus-6')) return { name: 'Opus 6', cls: 'model-opus' };

    if (m.includes('sonnet-6-1') || m.includes('sonnet-6.1')) return { name: 'Sonnet 6.1', cls: 'model-sonnet' };
    if (m.includes('sonnet-6-0') || m.includes('sonnet-6.0') || m.includes('sonnet-6')) return { name: 'Sonnet 6', cls: 'model-sonnet' };

    if (m.includes('haiku-6-1') || m.includes('haiku-6.1')) return { name: 'Haiku 6.1', cls: 'model-haiku' };
    if (m.includes('haiku-6-0') || m.includes('haiku-6.0') || m.includes('haiku-6')) return { name: 'Haiku 6', cls: 'model-haiku' };

    if (m.includes('opus-7') || m.includes('opus-8') || m.includes('opus-9')) return { name: m.match(/opus-(\d+)/)?.[0]?.toUpperCase() || 'Opus', cls: 'model-opus' };
    if (m.includes('sonnet-7') || m.includes('sonnet-8') || m.includes('sonnet-9')) return { name: m.match(/sonnet-(\d+)/)?.[0]?.toUpperCase() || 'Sonnet', cls: 'model-sonnet' };
    if (m.includes('haiku-7') || m.includes('haiku-8') || m.includes('haiku-9')) return { name: m.match(/haiku-(\d+)/)?.[0]?.toUpperCase() || 'Haiku', cls: 'model-haiku' };

    if (m.includes('opus-4-9') || m.includes('opus-4.9')) return { name: 'Opus 4.9', cls: 'model-opus' };
    if (m.includes('opus-4-8') || m.includes('opus-4.8')) return { name: 'Opus 4.8', cls: 'model-opus' };
    if (m.includes('opus-4-7') || m.includes('opus-4.7')) return { name: 'Opus 4.7', cls: 'model-opus' };
    if (m.includes('opus-4-6') || m.includes('opus-4.6')) return { name: 'Opus 4.6', cls: 'model-opus' };
    if (m.includes('opus-4-5') || m.includes('opus-4.5')) return { name: 'Opus 4.5', cls: 'model-opus' };
    if (m.includes('opus-4-1') || m.includes('opus-4.1')) return { name: 'Opus 4.1', cls: 'model-opus' };
    if (m.includes('opus-4-0') || m.includes('opus-4.0')) return { name: 'Opus 4.0', cls: 'model-opus' };

    if (m.includes('sonnet-4-6') || m.includes('sonnet-4.6')) return { name: 'Sonnet 4.6', cls: 'model-sonnet' };
    if (m.includes('sonnet-4-5') || m.includes('sonnet-4.5')) return { name: 'Sonnet 4.5', cls: 'model-sonnet' };
    if (m.includes('sonnet-4-0') || m.includes('sonnet-4.0') || m.includes('sonnet-4-20')) return { name: 'Sonnet 4', cls: 'model-sonnet' };

    if (m.includes('haiku-4-5') || m.includes('haiku-4.5')) return { name: 'Haiku 4.5', cls: 'model-haiku' };
    if (m.includes('haiku-4-0') || m.includes('haiku-4.0')) return { name: 'Haiku 4', cls: 'model-haiku' };

    if (m.includes('3-opus') || m.includes('3.5-opus') || m.includes('3.0-opus')) return { name: 'Opus 3', cls: 'model-opus' };
    if (m.includes('3-7-sonnet') || m.includes('3.7-sonnet')) return { name: 'Sonnet 3.7', cls: 'model-sonnet' };
    if (m.includes('3-5-sonnet') || m.includes('3.5-sonnet')) return { name: 'Sonnet 3.5', cls: 'model-sonnet' };
    if (m.includes('3-sonnet') || m.includes('3.0-sonnet')) return { name: 'Sonnet 3', cls: 'model-sonnet' };
    if (m.includes('3-5-haiku') || m.includes('3.5-haiku')) return { name: 'Haiku 3.5', cls: 'model-haiku' };
    if (m.includes('3-haiku') || m.includes('3.0-haiku')) return { name: 'Haiku 3', cls: 'model-haiku' };

    if (m.includes('opus')) return { name: 'Opus', cls: 'model-opus' };
    if (m.includes('sonnet')) return { name: 'Sonnet', cls: 'model-sonnet' };
    if (m.includes('haiku')) return { name: 'Haiku', cls: 'model-haiku' };

    if (m.includes('claude-2.1')) return { name: 'Claude 2.1', cls: 'model-sonnet' };
    if (m.includes('claude-2.0') || m.includes('claude-2')) return { name: 'Claude 2', cls: 'model-sonnet' };
    if (m.includes('claude-1')) return { name: 'Claude 1', cls: 'model-sonnet' };
    if (m.includes('instant')) return { name: 'Instant', cls: 'model-haiku' };

    // GLM-модели
    if (m.includes('glm-5-1') || m.includes('glm-5.1')) return { name: 'GLM 5.1', cls: 'model-glm' };
    if (m.includes('glm')) return { name: model.toUpperCase(), cls: 'model-glm' };

    return { name: model, cls: 'model-sonnet' };
}

export function getModelFamily(model) {
    if (!model) return 'Unknown';
    const m = model.toLowerCase();
    if (m.includes('opus')) return 'Opus';
    if (m.includes('sonnet')) return 'Sonnet';
    if (m.includes('haiku')) return 'Haiku';
    if (m.includes('codex')) return 'Codex';
    if (m.startsWith('gpt-')) return 'GPT';
    if (m.includes('glm')) return 'GLM';
    return 'Unknown';
}
