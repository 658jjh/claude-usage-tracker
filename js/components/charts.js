/**
 * charts.js
 *
 * Chart.js visualization components with compact sizing,
 * gradient fills, smooth animations, and center text plugin.
 */

import { getModelFamily } from '../utils/model-utils.js';

let dailyChart = null;
let sourceChart = null;
let modelChart = null;

const sourceColors = {
    'OpenClaw': '#fbbf24',
    'Clawdbot': '#fbbf24',
    'Claude Code': '#60a5fa',
    'Claude Desktop': '#a78bfa',
    'Cursor': '#22d3ee',
    'Windsurf': '#34d399',
    'Cline': '#fb7185',
    'Roo Code': '#f472b6',
    'Aider': '#2dd4bf',
    'Continue': '#f59e0b',
};

const defaultColors = ['#34d399', '#fb7185', '#a78bfa', '#f472b6', '#2dd4bf'];
let colorIdx = 0;

function getSourceColor(source) {
    if (sourceColors[source]) return sourceColors[source];
    if (!sourceColors[source]) {
        sourceColors[source] = defaultColors[colorIdx % defaultColors.length];
        colorIdx++;
    }
    return sourceColors[source];
}

function createBarGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, color + 'E6');
    gradient.addColorStop(1, color + '66');
    return gradient;
}

/**
 * Center text plugin for doughnut charts.
 */
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        if (chart.config.type !== 'doughnut') return;
        const centerText = chart.config.options?.plugins?.centerText;
        if (!centerText) return;

        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "700 1.1rem 'Outfit', sans-serif";
        ctx.fillStyle = centerText.color || '#e2e8f0';
        ctx.fillText(centerText.text || '', centerX, centerY - 6);

        if (centerText.subText) {
            ctx.font = "500 0.5rem 'JetBrains Mono', monospace";
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(centerText.subText, centerX, centerY + 10);
        }
        ctx.restore();
    }
};

Chart.register(centerTextPlugin);

/**
 * Compact tooltip config.
 */
const tooltipConfig = {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(34, 211, 238, 0.15)',
    borderWidth: 1,
    titleColor: '#e2e8f0',
    bodyColor: '#94a3b8',
    footerColor: '#e2e8f0',
    padding: { top: 8, bottom: 8, left: 10, right: 10 },
    cornerRadius: 8,
    titleFont: { family: "'Outfit', sans-serif", size: 11, weight: '600' },
    bodyFont: { family: "'JetBrains Mono', monospace", size: 10 },
    footerFont: { family: "'JetBrains Mono', monospace", size: 10, weight: '600' },
    boxPadding: 4,
    usePointStyle: true,
    caretSize: 5,
    caretPadding: 6,
};

/**
 * Compact legend config.
 */
const legendConfig = {
    labels: {
        padding: 12,
        usePointStyle: true,
        pointStyleWidth: 6,
        color: '#cbd5e1',
        font: {
            family: "'JetBrains Mono', monospace",
            size: 10,
            weight: '400'
        }
    }
};

export function initCharts(allSessions) {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(30, 41, 59, 0.4)';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size = 10;

    buildDailyChart(allSessions);
    buildSourceChart(allSessions);
    buildModelChart(allSessions);
}

function buildDailyChart(allSessions) {
    const dailyBySource = {};
    const allSourcesSet = new Set();
    allSessions.forEach(s => {
        if (!dailyBySource[s.date]) dailyBySource[s.date] = {};
        dailyBySource[s.date][s.source] = (dailyBySource[s.date][s.source] || 0) + s.cost;
        allSourcesSet.add(s.source);
    });
    const chartDays = Object.keys(dailyBySource).sort().slice(-15);
    const allSources = Array.from(allSourcesSet);

    const canvas = document.getElementById('dailyChart');
    const ctx = canvas.getContext('2d');

    const dailyDatasets = allSources.map(source => {
        const color = getSourceColor(source);
        return {
            label: source,
            data: chartDays.map(d => dailyBySource[d][source] || 0),
            backgroundColor: createBarGradient(ctx, color),
            hoverBackgroundColor: color,
            borderRadius: 3,
            borderSkipped: false,
            borderWidth: 0,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
        };
    });

    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: chartDays.map(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: dailyDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 900,
                easing: 'easeOutQuart',
                delay: (ctx) => ctx.dataIndex * 20 + ctx.datasetIndex * 40,
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    ...legendConfig,
                },
                tooltip: {
                    ...tooltipConfig,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: (items) => items.length ? items[0].label : '',
                        label: (ctx) => {
                            if (ctx.raw === 0) return null;
                            return ` ${ctx.dataset.label}: $${ctx.raw.toFixed(2)}`;
                        },
                        footer: (items) => {
                            const total = items.reduce((sum, item) => sum + item.raw, 0);
                            return `  Total: $${total.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 9 },
                        maxRotation: 0,
                    },
                    border: { display: false },
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(30, 41, 59, 0.3)',
                        drawBorder: false,
                    },
                    ticks: {
                        callback: v => '$' + v.toFixed(0),
                        color: '#94a3b8',
                        font: { size: 9 },
                        padding: 6,
                    },
                    border: { display: false },
                }
            }
        }
    });
}

function buildSourceChart(allSessions) {
    const sourceTotals = {};
    allSessions.forEach(s => {
        sourceTotals[s.source] = (sourceTotals[s.source] || 0) + s.cost;
    });

    const sourceEntries = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]);
    const sourceLabels = sourceEntries.map(([name]) => name);
    const sourceData = sourceEntries.map(([, cost]) => cost);
    const sourceBgColors = sourceLabels.map(s => getSourceColor(s));
    const totalCost = sourceData.reduce((a, b) => a + b, 0);

    if (sourceChart) sourceChart.destroy();
    sourceChart = new Chart(document.getElementById('sourceChart'), {
        type: 'doughnut',
        data: {
            labels: sourceLabels,
            datasets: [{
                data: sourceData,
                backgroundColor: sourceBgColors.map(c => c + 'CC'),
                hoverBackgroundColor: sourceBgColors,
                borderColor: 'rgba(10, 14, 23, 0.8)',
                borderWidth: 2,
                hoverOffset: 6,
                hoverBorderColor: 'rgba(255,255,255,0.1)',
                spacing: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeOutQuart',
            },
            layout: {
                padding: { top: 0, bottom: 0, left: 0, right: 0 },
            },
            plugins: {
                centerText: {
                    text: '$' + totalCost.toFixed(2),
                    subText: 'TOTAL',
                    color: '#e2e8f0',
                },
                legend: {
                    position: 'right',
                    align: 'center',
                    ...legendConfig,
                    labels: {
                        ...legendConfig.labels,
                        padding: 8,
                        color: '#cbd5e1',
                        font: { family: "'JetBrains Mono', monospace", size: 9 },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const pct = total > 0 ? (value / total * 100).toFixed(0) : '0';
                                return {
                                    text: `${label} ${pct}%`,
                                    fontColor: '#cbd5e1',
                                    fillStyle: data.datasets[0].hoverBackgroundColor[i],
                                    strokeStyle: 'transparent',
                                    lineWidth: 0,
                                    hidden: false,
                                    index: i,
                                    pointStyle: 'rectRounded',
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    ...tooltipConfig,
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : '0.0';
                            return ` $${ctx.raw.toFixed(2)}  (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function buildModelChart(allSessions) {
    const modelTotals = {};
    allSessions.forEach(s => {
        const family = getModelFamily(s.model);
        modelTotals[family] = (modelTotals[family] || 0) + s.cost;
    });

    const modelColorMap = {
        'Opus': '#fb7185',
        'Sonnet': '#60a5fa',
        'Haiku': '#34d399',
        'Unknown': '#a78bfa',
    };

    const modelEntries = Object.entries(modelTotals).sort((a, b) => b[1] - a[1]);
    const modelLabels = modelEntries.map(([name]) => name);
    const modelData = modelEntries.map(([, cost]) => cost);
    const modelColors = modelLabels.map(name => modelColorMap[name] || '#a78bfa');
    const totalCost = modelData.reduce((a, b) => a + b, 0);

    if (modelChart) modelChart.destroy();
    modelChart = new Chart(document.getElementById('modelChart'), {
        type: 'doughnut',
        data: {
            labels: modelLabels,
            datasets: [{
                data: modelData,
                backgroundColor: modelColors.map(c => c + 'CC'),
                hoverBackgroundColor: modelColors,
                borderColor: 'rgba(10, 14, 23, 0.8)',
                borderWidth: 2,
                hoverOffset: 6,
                hoverBorderColor: 'rgba(255,255,255,0.1)',
                spacing: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeOutQuart',
                delay: 150,
            },
            layout: {
                padding: { top: 0, bottom: 0, left: 0, right: 0 },
            },
            plugins: {
                centerText: {
                    text: '$' + totalCost.toFixed(2),
                    subText: 'BY MODEL',
                    color: '#e2e8f0',
                },
                legend: {
                    position: 'right',
                    align: 'center',
                    ...legendConfig,
                    labels: {
                        ...legendConfig.labels,
                        padding: 8,
                        color: '#cbd5e1',
                        font: { family: "'JetBrains Mono', monospace", size: 9 },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const pct = total > 0 ? (value / total * 100).toFixed(1) : '0.0';
                                return {
                                    text: `${label}  $${value.toFixed(2)}  (${pct}%)`,
                                    fontColor: '#cbd5e1',
                                    fillStyle: data.datasets[0].hoverBackgroundColor[i],
                                    strokeStyle: 'transparent',
                                    lineWidth: 0,
                                    hidden: false,
                                    index: i,
                                    pointStyle: 'rectRounded',
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    ...tooltipConfig,
                    callbacks: {
                        label: function(ctx) {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : '0.0';
                            return ` $${ctx.raw.toFixed(2)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}
