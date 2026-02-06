/**
 * Model Utilities Module
 *
 * Model information, pricing lookups, and family classification.
 * Handles all model-specific logic for display and cost calculation.
 */

/**
 * Get pricing information for a specific model.
 * Returns per-million-token pricing for input, output, cache write, and cache read.
 *
 * @param {string} model - The model identifier string
 * @returns {{input: number, output: number, cacheWrite: number, cacheRead: number}}
 *   Pricing object with rates per million tokens
 *
 * @example
 * getPricingForModel('claude-opus-4-6')
 * // { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 }
 *
 * getPricingForModel('claude-sonnet-3-5')
 * // { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 }
 */
export function getPricingForModel(model) {
    if (!model) return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
    const m = model.toLowerCase();

    // ============================================================
    // FUTURE MODELS (Claude 5.x and beyond - speculative pricing)
    // ============================================================
    // Note: These are projected prices based on historical pricing trends.
    // Update with actual pricing when models are released.

    // Claude 5.x Opus (future flagship - estimated higher than current Opus)
    if (m.includes('opus-5'))
        return { input: 20, output: 100, cacheWrite: 25, cacheRead: 2.0 };

    // Claude 5.x Sonnet (future mid-tier - estimated higher than Sonnet 4.5)
    if (m.includes('sonnet-5'))
        return { input: 5, output: 20, cacheWrite: 6.25, cacheRead: 0.50 };

    // Claude 5.x Haiku (future fast model - estimated higher than Haiku 4.5)
    if (m.includes('haiku-5'))
        return { input: 1.5, output: 7.5, cacheWrite: 1.875, cacheRead: 0.15 };

    // Claude 6.x and beyond (very speculative)
    if (m.includes('opus-6') || m.includes('opus-7') || m.includes('opus-8') || m.includes('opus-9'))
        return { input: 30, output: 150, cacheWrite: 37.5, cacheRead: 3.0 };
    if (m.includes('sonnet-6') || m.includes('sonnet-7') || m.includes('sonnet-8') || m.includes('sonnet-9'))
        return { input: 8, output: 40, cacheWrite: 10, cacheRead: 0.80 };
    if (m.includes('haiku-6') || m.includes('haiku-7') || m.includes('haiku-8') || m.includes('haiku-9'))
        return { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.20 };

    // ============================================================
    // CURRENT MODELS (Claude 4.x)
    // ============================================================

    // Opus 4.6 and 4.5 (cheaper than older Opus)
    if (m.includes('opus-4-6') || m.includes('opus-4.6') || m.includes('opus-4-5') || m.includes('opus-4.5'))
        return { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };

    // Opus 4.1, 4.0 and Claude 3 Opus (more expensive)
    if (m.includes('opus-4-1') || m.includes('opus-4.1') || m.includes('opus-4-0') || m.includes('opus-4.0'))
        return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };

    // Generic Opus fallback (assume expensive)
    if (m.includes('opus'))
        return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };

    // Sonnet 4.5 and 4.0 (same pricing)
    if (m.includes('sonnet-4') || m.includes('sonnet-3-7') || m.includes('sonnet-3.7') || m.includes('sonnet-3-5') || m.includes('sonnet-3.5'))
        return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };

    // Generic Sonnet fallback
    if (m.includes('sonnet'))
        return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };

    // Haiku 4.5 and 4.0 (newer, more expensive)
    if (m.includes('haiku-4-5') || m.includes('haiku-4.5') || m.includes('haiku-4-0') || m.includes('haiku-4.0'))
        return { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 };

    // Haiku 3.5 and 3.0 (older, cheaper)
    if (m.includes('haiku-3') || m.includes('haiku'))
        return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 };

    // Default to Sonnet pricing
    return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
}

/**
 * Get model info (display name and CSS class) from a model string.
 *
 * @param {string} model - The model identifier string
 * @returns {{name: string, cls: string}} Object with display name and CSS class
 *
 * @example
 * getModelInfo('claude-opus-4-6') // { name: 'Opus 4.6', cls: 'model-opus' }
 * getModelInfo('claude-sonnet-3-5') // { name: 'Sonnet', cls: 'model-sonnet' }
 * getModelInfo('claude-haiku') // { name: 'Haiku', cls: 'model-haiku' }
 */
export function getModelInfo(model) {
    if (!model) return { name: 'Unknown', cls: 'model-sonnet' };
    const m = model.toLowerCase();

    // ============================================================
    // FUTURE MODELS (Claude 5.x and beyond)
    // ============================================================
    // Note: These are speculative and will need adjustment when released.
    // Check order carefully - most specific versions first.

    // Claude 5.x family (next generation)
    if (m.includes('opus-5-1') || m.includes('opus-5.1')) return { name: 'Opus 5.1', cls: 'model-opus' };
    if (m.includes('opus-5-0') || m.includes('opus-5.0') || m.includes('opus-5')) return { name: 'Opus 5', cls: 'model-opus' };

    if (m.includes('sonnet-5-1') || m.includes('sonnet-5.1')) return { name: 'Sonnet 5.1', cls: 'model-sonnet' };
    if (m.includes('sonnet-5-0') || m.includes('sonnet-5.0') || m.includes('sonnet-5')) return { name: 'Sonnet 5', cls: 'model-sonnet' };

    if (m.includes('haiku-5-1') || m.includes('haiku-5.1')) return { name: 'Haiku 5.1', cls: 'model-haiku' };
    if (m.includes('haiku-5-0') || m.includes('haiku-5.0') || m.includes('haiku-5')) return { name: 'Haiku 5', cls: 'model-haiku' };

    // Claude 6.x family (future)
    if (m.includes('opus-6-1') || m.includes('opus-6.1')) return { name: 'Opus 6.1', cls: 'model-opus' };
    if (m.includes('opus-6-0') || m.includes('opus-6.0') || m.includes('opus-6')) return { name: 'Opus 6', cls: 'model-opus' };

    if (m.includes('sonnet-6-1') || m.includes('sonnet-6.1')) return { name: 'Sonnet 6.1', cls: 'model-sonnet' };
    if (m.includes('sonnet-6-0') || m.includes('sonnet-6.0') || m.includes('sonnet-6')) return { name: 'Sonnet 6', cls: 'model-sonnet' };

    if (m.includes('haiku-6-1') || m.includes('haiku-6.1')) return { name: 'Haiku 6.1', cls: 'model-haiku' };
    if (m.includes('haiku-6-0') || m.includes('haiku-6.0') || m.includes('haiku-6')) return { name: 'Haiku 6', cls: 'model-haiku' };

    // Claude 7.x, 8.x, 9.x (far future - generic)
    if (m.includes('opus-7') || m.includes('opus-8') || m.includes('opus-9')) return { name: m.match(/opus-(\d+)/)?.[0]?.toUpperCase() || 'Opus', cls: 'model-opus' };
    if (m.includes('sonnet-7') || m.includes('sonnet-8') || m.includes('sonnet-9')) return { name: m.match(/sonnet-(\d+)/)?.[0]?.toUpperCase() || 'Sonnet', cls: 'model-sonnet' };
    if (m.includes('haiku-7') || m.includes('haiku-8') || m.includes('haiku-9')) return { name: m.match(/haiku-(\d+)/)?.[0]?.toUpperCase() || 'Haiku', cls: 'model-haiku' };

    // ============================================================
    // CURRENT MODELS (Claude 4.x)
    // ============================================================

    // Opus 4.x versions (most recent first)
    if (m.includes('opus-4-6') || m.includes('opus-4.6')) return { name: 'Opus 4.6', cls: 'model-opus' };
    if (m.includes('opus-4-5') || m.includes('opus-4.5')) return { name: 'Opus 4.5', cls: 'model-opus' };
    if (m.includes('opus-4-1') || m.includes('opus-4.1')) return { name: 'Opus 4.1', cls: 'model-opus' };
    if (m.includes('opus-4-0') || m.includes('opus-4.0')) return { name: 'Opus 4.0', cls: 'model-opus' };

    // Sonnet 4.x versions
    if (m.includes('sonnet-4-5') || m.includes('sonnet-4.5')) return { name: 'Sonnet 4.5', cls: 'model-sonnet' };
    if (m.includes('sonnet-4-0') || m.includes('sonnet-4.0') || m.includes('sonnet-4-20')) return { name: 'Sonnet 4', cls: 'model-sonnet' };

    // Haiku 4.x versions
    if (m.includes('haiku-4-5') || m.includes('haiku-4.5')) return { name: 'Haiku 4.5', cls: 'model-haiku' };
    if (m.includes('haiku-4-0') || m.includes('haiku-4.0')) return { name: 'Haiku 4', cls: 'model-haiku' };

    // ============================================================
    // LEGACY MODELS (Claude 3.x and older)
    // ============================================================

    // Claude 3.x versions
    if (m.includes('3-opus') || m.includes('3.5-opus') || m.includes('3.0-opus')) return { name: 'Opus 3', cls: 'model-opus' };
    if (m.includes('3-7-sonnet') || m.includes('3.7-sonnet')) return { name: 'Sonnet 3.7', cls: 'model-sonnet' };
    if (m.includes('3-5-sonnet') || m.includes('3.5-sonnet')) return { name: 'Sonnet 3.5', cls: 'model-sonnet' };
    if (m.includes('3-sonnet') || m.includes('3.0-sonnet')) return { name: 'Sonnet 3', cls: 'model-sonnet' };
    if (m.includes('3-5-haiku') || m.includes('3.5-haiku')) return { name: 'Haiku 3.5', cls: 'model-haiku' };
    if (m.includes('3-haiku') || m.includes('3.0-haiku')) return { name: 'Haiku 3', cls: 'model-haiku' };

    // Generic family fallbacks
    if (m.includes('opus')) return { name: 'Opus', cls: 'model-opus' };
    if (m.includes('sonnet')) return { name: 'Sonnet', cls: 'model-sonnet' };
    if (m.includes('haiku')) return { name: 'Haiku', cls: 'model-haiku' };

    // Claude 2.x and 1.x (very old, rarely used)
    if (m.includes('claude-2.1')) return { name: 'Claude 2.1', cls: 'model-sonnet' };
    if (m.includes('claude-2.0') || m.includes('claude-2')) return { name: 'Claude 2', cls: 'model-sonnet' };
    if (m.includes('claude-1')) return { name: 'Claude 1', cls: 'model-sonnet' };
    if (m.includes('instant')) return { name: 'Instant', cls: 'model-haiku' };

    return { name: model, cls: 'model-sonnet' };
}

/**
 * Get model family from a model string.
 *
 * @param {string} model - The model identifier string
 * @returns {string} Model family name ('Opus', 'Sonnet', 'Haiku', or 'Unknown')
 *
 * @example
 * getModelFamily('claude-opus-4-6') // "Opus"
 * getModelFamily('claude-sonnet-3-5') // "Sonnet"
 * getModelFamily('claude-haiku') // "Haiku"
 */
export function getModelFamily(model) {
    if (!model) return 'Unknown';
    if (model.includes('opus')) return 'Opus';
    if (model.includes('sonnet')) return 'Sonnet';
    if (model.includes('haiku')) return 'Haiku';
    return 'Unknown';
}
