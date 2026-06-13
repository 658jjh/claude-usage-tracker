// Pricing Editor — модалка для редактирования цен моделей
// Позволяет изменять цены за 1M токенов и перерассчитывать стоимость сессий

import { showToast } from './data-transfer.js';
import { getPricingForModel } from '../utils/model-utils.js';

const STORAGE_KEY = 'ai-usage-tracker-pricing';

let allSessions = [];

// Получить текущие цены: мержим window.__PRICING__ с localStorage
function getCurrentPricing() {
    const base = window.__PRICING__ || {};
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Мержим: localStorage перезаписывает базовые значения
            return { ...base, ...parsed };
        }
    } catch { /* игнорируем ошибки парсинга */ }
    return { ...base };
}

// Сохранить цены в localStorage и обновить window.__PRICING__
function savePricing(pricing) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pricing));
    } catch { /* localStorage может быть недоступен */ }
    window.__PRICING__ = pricing;
}

// Перерассчитать стоимость одной сессии на основе новых цен
function recalcSessionCost(session) {
    const model = session.model || '';
    const pricing = getPricingForModel(model);

    const inputTokens = session.input_tokens || 0;
    const outputTokens = session.output_tokens || 0;
    const cacheRead = session.cache_read || 0;
    const cacheWrite = session.cache_write || 0;

    return (
        (inputTokens * pricing.input +
         outputTokens * pricing.output +
         cacheRead * pricing.cacheRead +
         cacheWrite * pricing.cacheWrite) / 1000000
    );
}

// Рендер таблицы с моделями и инпутами
function renderPricingTable(container) {
    const pricing = getCurrentPricing();
    const models = Object.keys(pricing).filter(k => !k.startsWith('_'));

    if (models.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; padding: 20px 0;">No custom pricing configured. Prices are calculated from built-in rates.</p>';
        return;
    }

    // Сортируем модели по имени
    models.sort((a, b) => {
        const nameA = pricing[a].display || a;
        const nameB = pricing[b].display || b;
        return nameA.localeCompare(nameB);
    });

    const table = document.createElement('table');
    table.className = 'pricing-table';

    table.innerHTML = `
        <thead>
            <tr>
                <th>Model</th>
                <th>Input</th>
                <th>Output</th>
                <th>Cache Write</th>
                <th>Cache Read</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    for (const key of models) {
        const p = pricing[key];
        const tr = document.createElement('tr');
        tr.dataset.modelKey = key;

        const isZero = (p.input || 0) === 0 && (p.output || 0) === 0 &&
                       (p.cacheWrite || 0) === 0 && (p.cacheRead || 0) === 0;
        const zeroClass = isZero ? ' pricing-input-zero' : '';

        tr.innerHTML = `
            <td>
                <div class="pricing-model-name">
                    <span class="pricing-model-dot" style="background: ${p.color || '#94a3b8'}"></span>
                    ${p.display || key}
                </div>
            </td>
            <td class="pricing-input-cell">
                <input type="number" step="0.01" min="0"
                       class="pricing-input${zeroClass}"
                       data-field="input"
                       value="${p.input || 0}">
            </td>
            <td class="pricing-input-cell">
                <input type="number" step="0.01" min="0"
                       class="pricing-input${zeroClass}"
                       data-field="output"
                       value="${p.output || 0}">
            </td>
            <td class="pricing-input-cell">
                <input type="number" step="0.01" min="0"
                       class="pricing-input${zeroClass}"
                       data-field="cacheWrite"
                       value="${p.cacheWrite || 0}">
            </td>
            <td class="pricing-input-cell">
                <input type="number" step="0.01" min="0"
                       class="pricing-input${zeroClass}"
                       data-field="cacheRead"
                       value="${p.cacheRead || 0}">
            </td>
        `;

        tbody.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(table);
}

// Собрать данные из инпутов таблицы
function collectPricingFromTable() {
    const pricing = getCurrentPricing();
    const rows = document.querySelectorAll('.pricing-table tbody tr');

    for (const row of rows) {
        const key = row.dataset.modelKey;
        if (!key || !pricing[key]) continue;

        const inputs = row.querySelectorAll('.pricing-input');
        for (const input of inputs) {
            const field = input.dataset.field;
            if (field) {
                pricing[key][field] = parseFloat(input.value) || 0;
            }
        }
    }

    return pricing;
}

// Открыть модалку
function openModal() {
    const overlay = document.getElementById('pricing-overlay');
    if (!overlay) return;

    renderPricingTable(document.getElementById('pricing-table-wrap'));
    overlay.classList.add('pricing-open');
    document.body.style.overflow = 'hidden';
}

// Закрыть модалку
function closeModal() {
    const overlay = document.getElementById('pricing-overlay');
    if (!overlay) return;

    overlay.classList.remove('pricing-open');
    document.body.style.overflow = '';
}

// Сохранить и перерассчитать
function saveAndRecalculate() {
    const pricing = collectPricingFromTable();
    savePricing(pricing);

    // Перерассчитываем стоимость всех сессий
    for (const session of allSessions) {
        session.cost = recalcSessionCost(session);
    }

    closeModal();
    showToast('Pricing updated');

    // Оповещаем main.js о необходимости перерисовки
    window.dispatchEvent(new CustomEvent('pricing-updated', {
        detail: allSessions
    }));
}

// Инициализация — привязка обработчиков
export function initPricingEditor(sessions) {
    allSessions = sessions || [];

    // Кнопка в хедере
    const btn = document.getElementById('pricing-btn');
    if (btn) {
        btn.addEventListener('click', openModal);
    }

    // Кнопка закрытия (X)
    const closeBtn = document.getElementById('pricing-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Кнопка Cancel
    const cancelBtn = document.getElementById('pricing-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    // Кнопка Save
    const saveBtn = document.getElementById('pricing-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAndRecalculate);
    }

    // Закрытие по клику на overlay
    const overlay = document.getElementById('pricing-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Применяем сохранённые цены при загрузке
    const pricing = getCurrentPricing();
    if (Object.keys(pricing).length > 0) {
        window.__PRICING__ = pricing;
    }
}
