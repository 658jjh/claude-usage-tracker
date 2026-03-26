/**
 * projects-table.js
 *
 * Projects view for the session log. Groups sessions by working directory (cwd),
 * with expandable project detail sub-tables rendered lazily on first expand.
 */

import { formatNumber } from '../utils/formatters.js';
import { getModelInfo } from '../utils/model-utils.js';
import { costClass, sourceClass } from '../utils/class-utils.js';
import { updateTotalsRow, updateToggleAllButton, resetSessionStore, pushToSessionStore } from './sessions-table.js';

const _builtProjects = new Set();
let _projectsData = [];

export function extractProjectName(cwd) {
    if (!cwd) return '(No Project)';
    const cleaned = cwd.replace(/\/+$/, '');
    const parts = cleaned.split('/');
    return parts[parts.length - 1] || cwd;
}

export function groupByProject(sessions) {
    const map = {};
    for (const s of sessions) {
        const key = s.cwd || '';
        if (!map[key]) map[key] = [];
        map[key].push(s);
    }

    const projects = [];
    for (const [cwd, items] of Object.entries(map)) {
        projects.push({
            cwd,
            name: extractProjectName(cwd || null),
            sessions: items,
            totalCost: items.reduce((sum, s) => sum + s.cost, 0),
        });
    }

    projects.sort((a, b) => {
        if (!a.cwd && b.cwd) return 1;
        if (a.cwd && !b.cwd) return -1;
        return b.totalCost - a.totalCost;
    });

    return projects;
}

export function renderProjectsTable(sessions) {
    resetSessionStore();
    _builtProjects.clear();

    const projects = groupByProject(sessions);
    const tbody = document.getElementById('sessions-body');

    if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No sessions match the current filters.</td></tr>';
        updateTotalsRow([]);
        return;
    }

    let html = '';
    projects.forEach((project, idx) => {
        let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0;
        const sourceSet = new Set();
        const modelSet = new Set();
        for (const s of project.sessions) {
            totalInput += s.input_tokens || 0;
            totalOutput += s.output_tokens || 0;
            totalCacheRead += s.cache_read || 0;
            totalCacheWrite += s.cache_write || 0;
            sourceSet.add(s.source);
            if (s.model) modelSet.add(s.model);
        }
        const sources = [...sourceSet];
        const models = [...modelSet];

        const sourceBadges = sources.map(src => {
            const sc = sourceClass(src);
            return `<span class="source-badge source-${sc}">${src}</span>`;
        }).join(' ');

        const modelBadges = models.map(m => {
            const mi = getModelInfo(m);
            return `<span class="model-badge ${mi.cls}">${mi.name}</span>`;
        }).join(' ');

        const displayName = project.name;
        const fullPath = project.cwd || '(no working directory)';

        html += `<tr class="project-row" id="project-${idx}" onclick="toggleProject(${idx})">
            <td>
                <span class="chevron">\u25B6</span>
                <span class="project-icon">\uD83D\uDCC1</span>
                <span class="project-name" title="${fullPath.replace(/"/g, '&quot;')}">${displayName.replace(/</g, '&lt;')}</span>
                <span class="project-meta">${project.sessions.length} session${project.sessions.length !== 1 ? 's' : ''}</span>
            </td>
            <td>${sourceBadges}</td>
            <td>${modelBadges}</td>
            <td class="token-cell">${formatNumber(totalInput)}</td>
            <td class="token-cell">${formatNumber(totalOutput)}</td>
            <td class="token-cell">${formatNumber(totalCacheRead)}</td>
            <td class="token-cell">${formatNumber(totalCacheWrite)}</td>
            <td style="text-align:right"><span class="cost-badge ${costClass(project.totalCost)}">$${project.totalCost.toFixed(2)}</span></td>
        </tr>`;

        html += `<tr class="project-detail-row"><td colspan="8">
            <div class="project-detail-wrapper" id="project-detail-wrapper-${idx}"></div>
        </td></tr>`;
    });

    tbody.innerHTML = html;

    _projectsData = projects;

    updateTotalsRow(sessions);
    updateToggleAllButton(false);
}

function buildProjectDetail(project) {
    const sorted = [...project.sessions].sort((a, b) => {
        const dateCmp = (b.date || '').localeCompare(a.date || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.time || '').localeCompare(a.time || '');
    });

    let subTableHTML = `
        <table class="session-subtable">
            <thead><tr>
                <th>Date</th><th>Time</th><th>Title</th><th>Source</th><th>Model</th>
                <th>Input</th><th>Output</th><th>Cache R</th><th>Cache W</th><th style="text-align:right">Cost</th>
            </tr></thead><tbody>`;

    for (const s of sorted) {
        const mi = getModelInfo(s.model);
        const sc = sourceClass(s.source);
        const titleText = s.title ? s.title.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '\u2014';
        const sessionIdx = pushToSessionStore(s);
        const dateLabel = s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014';

        subTableHTML += `<tr class="session-clickable" onclick="showSessionDetail(${sessionIdx})">
            <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${dateLabel}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${s.time || '\u2014'}</td>
            <td class="session-title-cell" title="${titleText}">${titleText}</td>
            <td><span class="source-badge source-${sc}">${s.source}</span></td>
            <td><span class="model-badge ${mi.cls}">${mi.name}</span></td>
            <td class="token-cell">${formatNumber(s.input_tokens || 0)}</td>
            <td class="token-cell">${formatNumber(s.output_tokens || 0)}</td>
            <td class="token-cell">${formatNumber(s.cache_read || 0)}</td>
            <td class="token-cell">${formatNumber(s.cache_write || 0)}</td>
            <td style="text-align:right"><span class="cost-badge ${costClass(s.cost)}">$${s.cost.toFixed(2)}</span></td>
        </tr>`;
    }

    subTableHTML += '</tbody></table>';
    return `<div class="project-detail">${subTableHTML}</div>`;
}

export function toggleProject(idx) {
    const row = document.getElementById('project-' + idx);
    const wrapper = document.getElementById('project-detail-wrapper-' + idx);
    if (!row || !wrapper) return;

    if (row.classList.contains('expanded')) {
        row.classList.remove('expanded');
        wrapper.classList.remove('open');
    } else {
        if (!_builtProjects.has(idx) && _projectsData[idx]) {
            wrapper.innerHTML = buildProjectDetail(_projectsData[idx]);
            _builtProjects.add(idx);
        }
        row.classList.add('expanded');
        wrapper.classList.add('open');
    }

    const anyExpanded = document.querySelectorAll('.project-row.expanded').length > 0;
    updateToggleAllButton(anyExpanded);
}

export function toggleAllProjects() {
    const projectRows = document.querySelectorAll('.project-row');
    if (projectRows.length === 0) return;

    const anyExpanded = document.querySelectorAll('.project-row.expanded').length > 0;
    const shouldExpand = !anyExpanded;

    projectRows.forEach((row, index) => {
        const idx = parseInt(row.id.replace('project-', ''), 10);
        const wrapper = document.getElementById('project-detail-wrapper-' + idx);
        if (!wrapper) return;

        setTimeout(() => {
            if (shouldExpand && !row.classList.contains('expanded')) {
                if (!_builtProjects.has(idx) && _projectsData[idx]) {
                    wrapper.innerHTML = buildProjectDetail(_projectsData[idx]);
                    _builtProjects.add(idx);
                }
                row.classList.add('expanded');
                wrapper.classList.add('open');
            } else if (!shouldExpand && row.classList.contains('expanded')) {
                row.classList.remove('expanded');
                wrapper.classList.remove('open');
            }
        }, index * 10);
    });

    updateToggleAllButton(shouldExpand);
}

// Expose to window for onclick handlers
window.toggleProject = toggleProject;
