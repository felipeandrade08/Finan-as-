// =============================================
// FINCONTROL PRO v4.0 - GRÁFICOS AVANÇADOS
// Sistema de Gráficos com Chart.js
// =============================================

let charts = {
    evolution: null,
    categoryPie: null,
    comparison: null,
    cashFlow: null
};

// ========== GRÁFICO DE EVOLUÇÃO TEMPORAL ==========
function updateEvolutionChart() {
    const canvas = document.getElementById('evolution-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (charts.evolution) {
        charts.evolution.destroy();
    }
    
    // Preparar dados dos últimos 6 meses
    const monthsData = getLast6MonthsData();
    
    charts.evolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthsData.labels,
            datasets: [
                {
                    label: 'Receitas',
                    data: monthsData.income,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#22c55e',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Despesas',
                    data: monthsData.expenses,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Saldo',
                    data: monthsData.balance,
                    borderColor: '#1e3a8a',
                    backgroundColor: 'rgba(30, 58, 138, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#1e3a8a',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 16,
                    titleFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14
                    },
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': R$ ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        },
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// ========== GRÁFICO DE PIZZA - CATEGORIAS ==========
function updateCategoryPieChart() {
    const canvas = document.getElementById('category-pie-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.categoryPie) {
        charts.categoryPie.destroy();
    }
    
    const categoryData = getCategoryExpensesData();
    
    charts.categoryPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categoryData.labels,
            datasets: [{
                data: categoryData.values,
                backgroundColor: [
                    '#ef4444', // Vermelho
                    '#f59e0b', // Laranja
                    '#22c55e', // Verde
                    '#3b82f6', // Azul
                    '#8b5cf6', // Roxo
                    '#ec4899', // Rosa
                    '#10b981', // Verde claro
                    '#f97316', // Laranja escuro
                    '#06b6d4', // Cyan
                    '#6366f1'  // Indigo
                ],
                borderWidth: 4,
                borderColor: '#fff',
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 16,
                    titleFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14
                    },
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return context.label + ': R$ ' + context.parsed.toFixed(2) + ' (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

// ========== GRÁFICO DE BARRAS - COMPARAÇÃO MENSAL ==========
function updateComparisonChart() {
    const canvas = document.getElementById('comparison-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.comparison) {
        charts.comparison.destroy();
    }
    
    const monthsData = getLast6MonthsData();
    
    charts.comparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthsData.labels,
            datasets: [
                {
                    label: 'Receitas',
                    data: monthsData.income,
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: '#22c55e',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                },
                {
                    label: 'Despesas',
                    data: monthsData.expenses,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'rect'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 16,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': R$ ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        },
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// ========== GRÁFICO DE ÁREA - FLUXO DE CAIXA ==========
function updateCashFlowChart() {
    const canvas = document.getElementById('cashflow-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.cashFlow) {
        charts.cashFlow.destroy();
    }
    
    const monthsData = getLast6MonthsData();
    
    // Calcular fluxo de caixa acumulado
    let accumulated = 0;
    const cashFlowData = monthsData.balance.map(value => {
        accumulated += value;
        return accumulated;
    });
    
    charts.cashFlow = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthsData.labels,
            datasets: [{
                label: 'Fluxo de Caixa Acumulado',
                data: cashFlowData,
                borderColor: '#1e3a8a',
                backgroundColor: 'rgba(30, 58, 138, 0.2)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 7,
                pointHoverRadius: 9,
                pointBackgroundColor: '#1e3a8a',
                pointBorderColor: '#fff',
                pointBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 16,
                    callbacks: {
                        label: function(context) {
                            return 'Saldo Acumulado: R$ ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toFixed(0);
                        },
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// ========== FUNÇÕES AUXILIARES PARA DADOS ==========
function getLast6MonthsData() {
    const months = [];
    const income = [];
    const expenses = [];
    const balance = [];
    
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
        months.push(monthName.charAt(0).toUpperCase() + monthName.slice(1));
        
        // Filtrar transações do mês
        const monthTransactions = DB.transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getMonth() === date.getMonth() && 
                   tDate.getFullYear() === date.getFullYear();
        });
        
        const monthIncome = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const monthExpenses = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        income.push(monthIncome);
        expenses.push(monthExpenses);
        balance.push(monthIncome - monthExpenses);
    }
    
    return { labels: months, income, expenses, balance };
}

function getCategoryExpensesData() {
    const categoryTotals = {};
    
    DB.transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            if (!categoryTotals[t.category]) {
                categoryTotals[t.category] = 0;
            }
            categoryTotals[t.category] += t.amount;
        });
    
    const labels = Object.keys(categoryTotals);
    const values = Object.values(categoryTotals);
    
    return { labels, values };
}

// ========== ATUALIZAR TODOS OS GRÁFICOS ==========
function updateAllCharts() {
    updateEvolutionChart();
    updateCategoryPieChart();
    updateComparisonChart();
    updateCashFlowChart();
}

// Exportar funções
if (typeof window !== 'undefined') {
    window.updateEvolutionChart = updateEvolutionChart;
    window.updateCategoryPieChart = updateCategoryPieChart;
    window.updateComparisonChart = updateComparisonChart;
    window.updateCashFlowChart = updateCashFlowChart;
    window.updateAllCharts = updateAllCharts;
}
