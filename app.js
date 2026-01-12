// Base de dados
const DB = {
    users: [],
    transactions: [],
    budgets: [],
    goals: [],
    currentUser: null
};

let currentFilter = 'month';
let charts = {};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        if (DB.currentUser) {
            showMainApp();
        } else {
            document.getElementById('login-page').classList.remove('hidden');
        }
    }, 1000);
});

// Gerenciamento de dados
async function loadData() {
    try {
        const keys = ['users', 'transactions', 'budgets', 'goals', 'currentUser'];
        for (const key of keys) {
            try {
                const result = await window.storage.get(key, false);
                if (result && result.value) {
                    DB[key] = JSON.parse(result.value);
                }
            } catch (err) {
                console.log(`Chave ${key} não encontrada`);
            }
        }
    } catch (err) {
        console.log('Primeira inicialização');
    }
}

async function saveData() {
    try {
        await window.storage.set('users', JSON.stringify(DB.users), false);
        await window.storage.set('transactions', JSON.stringify(DB.transactions), false);
        await window.storage.set('budgets', JSON.stringify(DB.budgets), false);
        await window.storage.set('goals', JSON.stringify(DB.goals), false);
        if (DB.currentUser) {
            await window.storage.set('currentUser', JSON.stringify(DB.currentUser), false);
        }
    } catch (err) {
        console.error('Erro ao salvar:', err);
    }
}

// Event Listeners
function setupEventListeners() {
    // Auth
    document.getElementById('show-register').addEventListener('click', () => {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('register-page').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
    });

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // Navigation
    document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(item => {
        item.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            navigateTo(page);
        });
    });

    document.querySelectorAll('.link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            navigateTo(page);
        });
    });

    document.querySelector('.logout-btn').addEventListener('click', handleLogout);

    // Forms
    document.getElementById('transaction-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('budget-form').addEventListener('submit', handleAddBudget);
    document.getElementById('goal-form').addEventListener('submit', handleAddGoal);

    // Filters
    document.getElementById('filter-period').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateDashboard();
    });

    document.getElementById('reports-filter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateReports();
    });
}

// Autenticação
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const user = DB.users.find(u => u.email === email && atob(u.password) === password);

    if (!user) {
        showAlert('login-error', 'Email ou senha incorretos');
        return;
    }

    DB.currentUser = user;
    await saveData();
    showMainApp();
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (!name || !email || !password) {
        showAlert('register-error', 'Preencha todos os campos');
        return;
    }

    if (password.length < 6) {
        showAlert('register-error', 'A senha deve ter no mínimo 6 caracteres');
        return;
    }

    if (password !== confirm) {
        showAlert('register-error', 'As senhas não coincidem');
        return;
    }

    if (DB.users.find(u => u.email === email)) {
        showAlert('register-error', 'Email já cadastrado');
        return;
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password: btoa(password),
        createdAt: new Date().toISOString()
    };

    DB.users.push(newUser);
    await saveData();
    
    showAlert('register-success', 'Conta criada com sucesso! Faça login para continuar.');
    
    setTimeout(() => {
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('register-form').reset();
    }, 2000);
}

async function handleLogout() {
    DB.currentUser = null;
    await window.storage.delete('currentUser', false);
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-page').classList.remove('hidden');
}

// Navegação
function showMainApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('register-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    document.getElementById('user-name').textContent = DB.currentUser.name;
    navigateTo('dashboard');
}

function navigateTo(page) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`${page}-page`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    switch(page) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'transactions':
            updateTransactionsList();
            break;
        case 'reports':
            updateReports();
            break;
        case 'budgets':
            updateBudgetsList();
            break;
        case 'goals':
            updateGoalsList();
            break;
    }
}

// Transações
async function handleAddTransaction(e) {
    e.preventDefault();
    
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const category = document.getElementById('transaction-category').value;
    const date = document.getElementById('transaction-date').value;
    const description = document.getElementById('transaction-description').value;

    if (!type || !amount || !category || !date) {
        showAlert('transaction-error', 'Preencha todos os campos obrigatórios');
        return;
    }

    const transaction = {
        id: Date.now(),
        userId: DB.currentUser.id,
        type,
        amount,
        category,
        date,
        description,
        createdAt: new Date().toISOString()
    };

    DB.transactions.push(transaction);
    await saveData();
    
    showAlert('transaction-success', 'Transação adicionada com sucesso!');
    document.getElementById('transaction-form').reset();
    updateTransactionsList();
    
    setTimeout(() => hideAlert('transaction-success'), 3000);
}

function updateTransactionsList() {
    const container = document.getElementById('transactions-list');
    const transactions = getUserTransactions();

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-invoice"></i>
                <p>Nenhuma transação registrada</p>
                <p style="font-size: 14px;">Adicione sua primeira transação acima</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.reverse().map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-icon ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'income' ? 'up' : 'down'}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${t.category}</h4>
                    <p>${t.description}</p>
                    <small>${formatDate(t.date)}</small>
                </div>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'} R$ ${t.amount.toFixed(2)}
            </div>
        </div>
    `).join('');
}

// Orçamentos
async function handleAddBudget(e) {
    e.preventDefault();
    
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);

    if (!category || !amount) {
        showAlert('budget-error', 'Preencha todos os campos');
        return;
    }

    const budget = {
        id: Date.now(),
        userId: DB.currentUser.id,
        category,
        amount,
        createdAt: new Date().toISOString()
    };

    DB.budgets.push(budget);
    await saveData();
    
    showAlert('budget-success', 'Orçamento definido com sucesso!');
    document.getElementById('budget-form').reset();
    updateBudgetsList();
    
    setTimeout(() => hideAlert('budget-success'), 3000);
}

function updateBudgetsList() {
    const container = document.getElementById('budgets-list');
    const budgets = getUserBudgets();

    if (budgets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-credit-card"></i>
                <p>Nenhum orçamento definido</p>
            </div>
        `;
        return;
    }

    container.innerHTML = budgets.map(budget => {
        const spent = calculateBudgetSpent(budget.category);
        const percentage = (spent / budget.amount) * 100;
        const status = percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'success';

        return `
            <div class="budget-item">
                <div class="budget-header">
                    <h4 class="budget-name">${budget.category}</h4>
                    <span class="budget-percentage ${status}">${percentage.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="budget-info">
                    <span>Gasto: R$ ${spent.toFixed(2)}</span>
                    <span>Limite: R$ ${budget.amount.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Metas
async function handleAddGoal(e) {
    e.preventDefault();
    
    const name = document.getElementById('goal-name').value;
    const targetAmount = parseFloat(document.getElementById('goal-amount').value);
    const deadline = document.getElementById('goal-deadline').value;

    if (!name || !targetAmount || !deadline) {
        showAlert('goal-error', 'Preencha todos os campos');
        return;
    }

    const goal = {
        id: Date.now(),
        userId: DB.currentUser.id,
        name,
        targetAmount,
        currentAmount: 0,
        deadline,
        createdAt: new Date().toISOString()
    };

    DB.goals.push(goal);
    await saveData();
    
    showAlert('goal-success', 'Meta criada com sucesso!');
    document.getElementById('goal-form').reset();
    updateGoalsList();
    
    setTimeout(() => hideAlert('goal-success'), 3000);
}

function updateGoalsList() {
    const container = document.getElementById('goals-list');
    const goals = getUserGoals();

    if (goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullseye"></i>
                <p>Nenhuma meta definida</p>
            </div>
        `;
        return;
    }

    container.innerHTML = goals.map(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));

        return `
            <div class="goal-item">
                <div class="goal-header">
                    <h4 class="goal-name">${goal.name}</h4>
                    <div class="goal-icon">
                        <i class="fas fa-award"></i>
                    </div>
                </div>
                <div class="goal-progress">
                    <span>Progresso</span>
                    <span class="goal-percentage">${progress.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill success" style="width: ${Math.min(progress, 100)}%"></div>
                </div>
                <div class="goal-stats">
                    <div class="goal-stat">
                        <span>Economizado:</span>
                        <span>R$ ${goal.currentAmount.toFixed(2)}</span>
                    </div>
                    <div class="goal-stat">
                        <span>Meta:</span>
                        <span>R$ ${goal.targetAmount.toFixed(2)}</span>
                    </div>
                    <div class="goal-stat ${daysLeft < 30 ? 'deadline' : ''}">
                        <span>Prazo:</span>
                        <span>${daysLeft > 0 ? daysLeft + ' dias' : 'Expirado'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Dashboard
function updateDashboard() {
    const totals = calculateTotals();
    
    // Atualizar cards
    document.getElementById('total-income').textContent = `R$ ${totals.income.toFixed(2)}`;
    document.getElementById('total-expense').textContent = `R$ ${totals.expense.toFixed(2)}`;
    document.getElementById('total-balance').textContent = `R$ ${totals.balance.toFixed(2)}`;
    
    const total = totals.income + totals.expense;
    document.getElementById('income-percentage').textContent = 
        `${((totals.income / total) * 100 || 0).toFixed(1)}% do total`;
    document.getElementById('expense-percentage').textContent = 
        `${((totals.expense / total) * 100 || 0).toFixed(1)}% do total`;
    document.getElementById('balance-status').textContent = 
        totals.balance >= 0 ? 'Situação positiva' : 'Atenção necessária';
    
    const balanceCard = document.querySelector('.balance-card');
    if (totals.balance < 0) {
        balanceCard.classList.add('negative');
    } else {
        balanceCard.classList.remove('negative');
    }
    
    // Atualizar alertas
    updateAlerts();
    
    // Atualizar transações recentes
    updateRecentTransactions();
    
    // Atualizar preview de metas
    updateGoalsPreview();
    
    // Atualizar gráfico
    updateEvolutionChart();
}

function updateAlerts() {
    const container = document.getElementById('alerts-container');
    const alerts = [];
    
    // Verificar orçamentos
    const budgets = getUserBudgets();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    budgets.forEach(budget => {
        const spent = calculateBudgetSpent(budget.category);
        const percentage = (spent / budget.amount) * 100;
        
        if (percentage >= 100) {
            alerts.push({
                type: 'danger',
                message: `Orçamento de ${budget.category} excedido! (${percentage.toFixed(0)}%)`
            });
        } else if (percentage >= 80) {
            alerts.push({
                type: 'warning',
                message: `Orçamento de ${budget.category} em ${percentage.toFixed(0)}% do limite`
            });
        }
    });
    
    if (alerts.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert alert-${alert.type}">
            <i class="fas fa-exclamation-triangle"></i>
            ${alert.message}
        </div>
    `).join('');
}

function updateRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    const transactions = getFilteredTransactions().slice(-6).reverse();
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 32px 0;">
                <i class="fas fa-file-invoice" style="font-size: 48px;"></i>
                <p style="font-size: 14px;">Nenhuma transação registrada</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(t => `
        <div class="transaction-item" style="margin-bottom: 8px;">
            <div class="transaction-info">
                <div class="transaction-icon ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'income' ? 'up' : 'down'}"></i>
                </div>
                <div class="transaction-details">
                    <h4 style="font-size: 14px;">${t.category}</h4>
                    <small>${formatDate(t.date)}</small>
                </div>
            </div>
            <div class="transaction-amount ${t.type}" style="font-size: 16px;">
                ${t.type === 'income' ? '+' : '-'} R$ ${t.amount.toFixed(2)}
            </div>
        </div>
    `).join('');
}

function updateGoalsPreview() {
    const container = document.getElementById('goals-preview');
    const goals = getUserGoals().slice(0, 3);
    
    if (goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 32px 0;">
                <i class="fas fa-bullseye" style="font-size: 48px;"></i>
                <p style="font-size: 14px; margin-bottom: 12px;">Nenhuma meta definida</p>
                <button class="btn btn-primary" data-page="goals" style="padding: 8px 16px; font-size: 14px;">
                    Criar Meta
                </button>
            </div>
        `;
        
        container.querySelector('button').addEventListener('click', () => navigateTo('goals'));
        return;
    }
    
    container.innerHTML = goals.map(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        
        return `
            <div style="padding: 16px; background: var(--gray-50); border-radius: 12px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 14px;">${goal.name}</span>
                    <span style="font-weight: 700; color: var(--primary); font-size: 14px;">${progress.toFixed(0)}%</span>
                </div>
                <div class="progress-bar" style="height: 8px; margin-bottom: 8px;">
                    <div class="progress-fill success" style="width: ${Math.min(progress, 100)}%"></div>
                </div>
                <div style="font-size: 12px; color: var(--gray-600);">
                    R$ ${goal.currentAmount.toFixed(2)} de R$ ${goal.targetAmount.toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
}

function updateEvolutionChart() {
    const ctx = document.getElementById('evolution-chart');
    const data = getChartData();
    
    if (charts.evolution) {
        charts.evolution.destroy();
    }
    
    if (data.length === 0) {
        ctx.parentElement.innerHTML = '<p class="empty-state">Sem dados para exibir</p>';
        return;
    }
    
    charts.evolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.month),
            datasets: [
                {
                    label: 'Receitas',
                    data: data.map(d => d.income),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Despesas',
                    data: data.map(d => d.expense),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Relatórios
function updateReports() {
    updateTemporalChart();
    updateComparisonChart();
    updateDistributionChart();
}

function updateTemporalChart() {
    const ctx = document.getElementById('temporal-chart');
    const data = getChartData();
    
    if (charts.temporal) {
        charts.temporal.destroy();
    }
    
    if (data.length === 0) {
        ctx.parentElement.innerHTML = '<p class="empty-state">Sem dados para exibir</p>';
        return;
    }
    
    charts.temporal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.month),
            datasets: [
                {
                    label: 'Receitas',
                    data: data.map(d => d.income),
                    borderColor: '#10b981',
                    borderWidth: 3,
                    tension: 0.4
                },
                {
                    label: 'Despesas',
                    data: data.map(d => d.expense),
                    borderColor: '#ef4444',
                    borderWidth: 3,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

function updateComparisonChart() {
    const ctx = document.getElementById('comparison-chart');
    const data = getChartData();
    
    if (charts.comparison) {
        charts.comparison.destroy();
    }
    
    if (data.length === 0) {
        ctx.parentElement.innerHTML = '<p class="empty-state">Sem dados para exibir</p>';
        return;
    }
    
    charts.comparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.month),
            datasets: [
                {
                    label: 'Receitas',
                    data: data.map(d => d.income),
                    backgroundColor: '#10b981'
                },
                {
                    label: 'Despesas',
                    data: data.map(d => d.expense),
                    backgroundColor: '#ef4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

function updateDistributionChart() {
    const ctx = document.getElementById('distribution-chart');
    const data = getCategoryData();
    
    if (charts.distribution) {
        charts.distribution.destroy();
    }
    
    if (data.length === 0) {
        ctx.parentElement.innerHTML = '<p class="empty-state">Sem dados para exibir</p>';
        return;
    }
    
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    
    charts.distribution = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => d.value),
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Funções auxiliares
function getUserTransactions() {
    return DB.transactions.filter(t => t.userId === DB.currentUser.id);
}

function getUserBudgets() {
    return DB.budgets.filter(b => b.userId === DB.currentUser.id);
}

function getUserGoals() {
    return DB.goals.filter(g => g.userId === DB.currentUser.id);
}

function getFilteredTransactions() {
    const transactions = getUserTransactions();
    const now = new Date();
    let startDate;
    
    switch(currentFilter) {
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            return transactions;
    }
    
    return transactions.filter(t => new Date(t.date) >= startDate);
}

function calculateTotals() {
    const filtered = getFilteredTransactions();
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
}

function calculateBudgetSpent(category) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return getUserTransactions()
        .filter(t => t.type === 'expense' && t.category === category && new Date(t.date) >= monthStart)
        .reduce((sum, t) => sum + t.amount, 0);
}

function getChartData() {
    const filtered = getFilteredTransactions();
    const grouped = {};
    
    filtered.forEach(t => {
        const date = new Date(t.date);
        const month = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        if (!grouped[month]) {
            grouped[month] = { month, income: 0, expense: 0 };
        }
        grouped[month][t.type] += t.amount;
    });
    
    return Object.values(grouped).sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA - dateB;
    });
}

function getCategoryData() {
    const filtered = getFilteredTransactions().filter(t => t.type === 'expense');
    const grouped = {};
    
    filtered.forEach(t => {
        if (!grouped[t.category]) {
            grouped[t.category] = { name: t.category, value: 0 };
        }
        grouped[t.category].value += t.amount;
    });
    
    return Object.values(grouped);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    });
}

function showAlert(id, message) {
    const alert = document.getElementById(id);
    alert.textContent = message;
    alert.classList.remove('hidden');
}

function hideAlert(id) {
    document.getElementById(id).classList.add('hidden');
}
