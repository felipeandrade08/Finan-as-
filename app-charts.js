// =============================================
// FINCONTROL PRO - GRÁFICOS (Chart.js)
// Cores lidas das variáveis CSS: funcionam no tema claro e no escuro.
// =============================================

const charts = {};

function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartTheme() {
    return {
        text: cssVar('--text-muted'),
        grid: cssVar('--chart-grid'),
        income: cssVar('--income'),
        expense: cssVar('--expense'),
        accent: cssVar('--accent'),
        accentSoft: cssVar('--chart-fill'),
        surface: cssVar('--surface'),
        series: [cssVar('--chart-1'), cssVar('--chart-2'), cssVar('--chart-3'), cssVar('--chart-4'), cssVar('--chart-5'), cssVar('--chart-6')]
    };
}

// Padrões globais aplicados uma vez por renderização (mudam com o tema).
function applyChartDefaults(theme) {
    if (typeof Chart === 'undefined') return false;
    const d = Chart.defaults;
    if (!d || !d.plugins) return true;
    d.font = { ...(d.font || {}), family: getComputedStyle(document.body).fontFamily, size: 12 };
    d.color = theme.text;
    d.borderColor = theme.grid;
    const legend = d.plugins.legend?.labels;
    if (legend) Object.assign(legend, { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3 });
    if (d.plugins.tooltip) Object.assign(d.plugins.tooltip, { padding: 10, cornerRadius: 8, titleFont: { weight: '600' } });
    if (d.animation) d.animation.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400;
    return true;
}

const shortCurrency = (value) => {
    const abs = Math.abs(value);
    if (abs >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return `R$ ${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

function moneyAxis(theme) {
    return {
        beginAtZero: true,
        ticks: { callback: shortCurrency, maxTicksLimit: 5 },
        grid: { color: theme.grid },
        border: { display: false }
    };
}

const categoryAxis = { grid: { display: false }, border: { display: false } };

function renderChart(key, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (charts[key]) charts[key].destroy();
    charts[key] = new Chart(canvas.getContext('2d'), config);
}

function emptyChart(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const box = canvas.parentElement;
    box.classList.toggle('is-empty', Boolean(message));
    let note = box.querySelector('.chart-empty');
    if (message) {
        if (!note) {
            note = document.createElement('p');
            note.className = 'chart-empty';
            box.appendChild(note);
        }
        note.textContent = message;
        canvas.style.display = 'none';
    } else {
        note?.remove();
        canvas.style.display = '';
    }
}

// ========== DADOS ==========
// Totais por mês dos últimos `count` meses, ignorando meses vazios no início.
function getMonthlySeries(count = 6) {
    const now = new Date();
    const months = [];
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ date, income: 0, expense: 0 });
    }
    getLedger().forEach(t => {
        const d = parseLocalDate(t.date);
        const m = months.find(x => x.date.getMonth() === d.getMonth() && x.date.getFullYear() === d.getFullYear());
        if (m) m[t.type === 'income' ? 'income' : 'expense'] += t.amount;
    });
    const firstWithData = months.findIndex(m => m.income || m.expense);
    const used = firstWithData === -1 ? [] : months.slice(Math.min(firstWithData, months.length - 2));
    return used.map(m => {
        const label = m.date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        return { ...m, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
}

function getCategoryTotals(transactions) {
    const totals = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

// ========== INÍCIO: entradas e saídas por mês ==========
function updateEvolutionChart() {
    const theme = chartTheme();
    const months = getMonthlySeries(6);
    if (!months.length) return emptyChart('evolution-chart', 'Os meses aparecem aqui depois do primeiro lançamento.');
    emptyChart('evolution-chart', null);
    renderChart('evolution', 'evolution-chart', {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [
                { label: 'Entrou', data: months.map(m => m.income), backgroundColor: theme.income, borderRadius: 4, maxBarThickness: 22 },
                { label: 'Saiu', data: months.map(m => m.expense), backgroundColor: theme.expense, borderRadius: 4, maxBarThickness: 22 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', align: 'end' },
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } }
            },
            scales: { x: categoryAxis, y: moneyAxis(theme) }
        }
    });
}

// ========== RELATÓRIOS: saldo acumulado ==========
function updateCashFlowChart() {
    const theme = chartTheme();
    const months = getMonthlySeries(12);
    if (!months.length) return emptyChart('reports-evolution-chart', 'Sem lançamentos nos últimos 12 meses.');
    emptyChart('reports-evolution-chart', null);
    let running = 0;
    const values = months.map(m => (running += m.income - m.expense));
    renderChart('cashFlow', 'reports-evolution-chart', {
        type: 'line',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Saldo acumulado',
                data: values,
                borderColor: theme.accent,
                backgroundColor: theme.accentSoft,
                fill: true,
                tension: 0.3,
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: theme.accent
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => formatCurrency(c.parsed.y) } }
            },
            scales: { x: categoryAxis, y: moneyAxis(theme) }
        }
    });
}

// ========== RELATÓRIOS: gastos por categoria (barras horizontais) ==========
function updateCategoryChart() {
    const theme = chartTheme();
    const rows = getCategoryTotals(getFilteredTransactions()).slice(0, 8);
    if (!rows.length) return emptyChart('reports-category-chart', 'Nenhuma despesa no período escolhido.');
    emptyChart('reports-category-chart', null);
    renderChart('category', 'reports-category-chart', {
        type: 'bar',
        data: {
            labels: rows.map(r => r[0]),
            datasets: [{ label: 'Gastos', data: rows.map(r => r[1]), backgroundColor: theme.series[0], borderRadius: 4, maxBarThickness: 18 }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => formatCurrency(c.parsed.x) } }
            },
            scales: { x: moneyAxis(theme), y: categoryAxis }
        }
    });
}

// ========== RELATÓRIOS: resultado de cada mês ==========
function updateComparisonChart() {
    const theme = chartTheme();
    const months = getMonthlySeries(12);
    if (!months.length) return emptyChart('reports-comparison-chart', 'Sem lançamentos nos últimos 12 meses.');
    emptyChart('reports-comparison-chart', null);
    const values = months.map(m => m.income - m.expense);
    renderChart('comparison', 'reports-comparison-chart', {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Resultado',
                data: values,
                backgroundColor: values.map(v => (v >= 0 ? theme.income : theme.expense)),
                borderRadius: 4,
                maxBarThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.parsed.y >= 0 ? 'Sobrou' : 'Faltou'} ${formatCurrency(Math.abs(c.parsed.y))}` } }
            },
            scales: { x: categoryAxis, y: moneyAxis(theme) }
        }
    });
}

// ========== INVESTIMENTOS: distribuição por tipo ==========
function updateInvestmentChart() {
    const theme = chartTheme();
    const totals = {};
    DB.investments.forEach(inv => {
        const label = (typeof INVESTMENT_TYPES !== 'undefined' && INVESTMENT_TYPES[inv.type]) || inv.type;
        totals[label] = (totals[label] || 0) + (Number(inv.currentValue) || 0);
    });
    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return emptyChart('investment-distribution-chart', 'Adicione um investimento para ver a distribuição.');
    emptyChart('investment-distribution-chart', null);
    const total = rows.reduce((sum, r) => sum + r[1], 0);
    renderChart('investments', 'investment-distribution-chart', {
        type: 'doughnut',
        data: {
            labels: rows.map(r => r[0]),
            datasets: [{
                data: rows.map(r => r[1]),
                backgroundColor: rows.map((_, i) => theme.series[i % theme.series.length]),
                borderColor: theme.surface,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { position: 'right' },
                tooltip: { callbacks: { label: c => `${c.label}: ${formatCurrency(c.parsed)} (${Math.round((c.parsed / total) * 100)}%)` } }
            }
        }
    });
}

// ========== ATUALIZAÇÃO ==========
// Desenha só os gráficos da página visível.
function updateAllCharts() {
    try {
        drawVisibleCharts();
    } catch (error) {
        // Um problema nos gráficos nunca deve impedir listas e totais de aparecerem.
        console.error('Erro ao desenhar gráficos:', error);
    }
}

function drawVisibleCharts() {
    if (!applyChartDefaults(chartTheme())) return;
    const visible = id => {
        const el = document.getElementById(id);
        return el && !el.closest('.content-page')?.classList.contains('hidden');
    };
    if (visible('evolution-chart')) updateEvolutionChart();
    if (visible('reports-evolution-chart')) {
        updateCashFlowChart();
        updateCategoryChart();
        updateComparisonChart();
    }
    if (visible('investment-distribution-chart')) updateInvestmentChart();
}

if (typeof window !== 'undefined') {
    window.updateAllCharts = updateAllCharts;
    window.updateEvolutionChart = updateEvolutionChart;
    window.updateInvestmentChart = updateInvestmentChart;
}
