// Base de dados
const DB = {
    users: [],
    transactions: [],
    budgets: [],
    goals: [],
    categories: [],
    recurringTransactions: [],
    investments: [],
    familyMembers: [],
    currentUser: null
};

// Supabase client instance
let supabaseClient = null;

// Configuração padrão do Supabase (CONFIGURE COM SUAS CREDENCIAIS)
const SUPABASE_CONFIG = {
    // Coloque sua URL do Supabase aqui
    url: 'https://nnhrpvwyawjzzgnwbxpy.supabase.co', // Ex: https://xxxxx.supabase.co
    // Coloque sua chave anon/public aqui
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaHJwdnd5YXdqenpnbndieHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNjM0MjksImV4cCI6MjA4MzgzOTQyOX0.6ITiSW88PFl5sE9Aoslxw2wqVr8teO4ue3AqaeweNXw', // Ex: eyJhbGciOiJIUzI1NI...
    enabled: true // Mude para true após configurar
};

let supabaseConfig = {
    url: SUPABASE_CONFIG.url,
    key: SUPABASE_CONFIG.key,
    autoSync: true
};

// Categorias padrão
const DEFAULT_CATEGORIES = [
    { name: 'Salário', type: 'income' },
    { name: 'Freelance', type: 'income' },
    { name: 'Investimentos', type: 'income' },
    { name: 'Alimentação', type: 'expense' },
    { name: 'Transporte', type: 'expense' },
    { name: 'Moradia', type: 'expense' },
    { name: 'Saúde', type: 'expense' },
    { name: 'Educação', type: 'expense' },
    { name: 'Lazer', type: 'expense' },
    { name: 'Compras', type: 'expense' },
    { name: 'Contas', type: 'expense' }
];

let currentFilter = 'month';
let charts = {};
let deferredPrompt;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Carregar tema ANTES de tudo
    loadTheme();
    
    // Inicializar Supabase se configurado
    await initializeSupabaseOnLoad();
    
    await loadData();
    setupEventListeners();
    
    // Esconder loading e mostrar página apropriada
    document.getElementById('loading-screen').style.display = 'none';
    
    if (DB.currentUser) {
        showMainApp();
    } else {
        document.getElementById('login-page').classList.remove('hidden');
    }
});

// Gerenciamento de dados
async function loadData() {
    try {
        // Se Supabase estiver configurado, carregar de lá
        if (supabaseClient && DB.currentUser) {
            await loadFromSupabase();
            return;
        }
        
        // Senão, carregar do storage local
        const keys = ['users', 'transactions', 'budgets', 'goals', 'categories', 'recurringTransactions', 'investments', 'familyMembers', 'currentUser'];
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
        
        // Inicializar categorias padrão se não existirem
        if (DB.categories.length === 0) {
            DB.categories = DEFAULT_CATEGORIES.map((cat, index) => ({
                id: index + 1,
                ...cat
            }));
            await saveData();
        }
    } catch (err) {
        console.log('Primeira inicialização');
    }
}

async function loadFromSupabase() {
    try {
        console.log('Carregando dados do Supabase...');
        
        // Carregar transações
        const { data: transactions } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', DB.currentUser.email);
        
        if (transactions) {
            DB.transactions = transactions.map(t => ({
                id: t.id,
                userId: t.user_id,
                type: t.type,
                amount: parseFloat(t.amount),
                category: t.category,
                date: t.date,
                description: t.description,
                createdAt: t.created_at
            }));
        }
        
        // Carregar orçamentos
        const { data: budgets } = await supabaseClient
            .from('budgets')
            .select('*')
            .eq('user_id', DB.currentUser.email);
        
        if (budgets) {
            DB.budgets = budgets.map(b => ({
                id: b.id,
                userId: b.user_id,
                category: b.category,
                amount: parseFloat(b.amount),
                createdAt: b.created_at
            }));
        }
        
        // Carregar metas
        const { data: goals } = await supabaseClient
            .from('goals')
            .select('*')
            .eq('user_id', DB.currentUser.email);
        
        if (goals) {
            DB.goals = goals.map(g => ({
                id: g.id,
                userId: g.user_id,
                name: g.name,
                targetAmount: parseFloat(g.target_amount),
                currentAmount: parseFloat(g.current_amount || 0),
                deadline: g.deadline,
                createdAt: g.created_at
            }));
        }
        
        // Carregar investimentos
        const { data: investments } = await supabaseClient
            .from('investments')
            .select('*')
            .eq('user_id', DB.currentUser.email);
        
        if (investments) {
            DB.investments = investments.map(i => ({
                id: i.id,
                userId: i.user_id,
                name: i.name,
                type: i.type,
                amount: parseFloat(i.amount),
                currentValue: parseFloat(i.current_value),
                date: i.date,
                yieldRate: parseFloat(i.yield_rate || 0),
                createdAt: i.created_at
            }));
        }
        
        console.log('Dados carregados do Supabase com sucesso!');
        
    } catch (err) {
        console.error('Erro ao carregar do Supabase:', err);
    }
}

async function saveData() {
    try {
        // Salvar localmente sempre
        await window.storage.set('users', JSON.stringify(DB.users), false);
        await window.storage.set('transactions', JSON.stringify(DB.transactions), false);
        await window.storage.set('budgets', JSON.stringify(DB.budgets), false);
        await window.storage.set('goals', JSON.stringify(DB.goals), false);
        await window.storage.set('categories', JSON.stringify(DB.categories), false);
        await window.storage.set('recurringTransactions', JSON.stringify(DB.recurringTransactions), false);
        await window.storage.set('investments', JSON.stringify(DB.investments), false);
        await window.storage.set('familyMembers', JSON.stringify(DB.familyMembers), false);
        if (DB.currentUser) {
            await window.storage.set('currentUser', JSON.stringify(DB.currentUser), false);
        }
        
        // Se Supabase estiver configurado e autoSync ativo, sincronizar
        if (supabaseClient && supabaseConfig.autoSync && DB.currentUser) {
            await syncWithSupabase();
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

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Forms
    document.getElementById('transaction-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('budget-form').addEventListener('submit', handleAddBudget);
    document.getElementById('goal-form').addEventListener('submit', handleAddGoal);

    // Recurring checkbox
    document.getElementById('transaction-recurring').addEventListener('change', (e) => {
        const recurringOptions = document.getElementById('recurring-options');
        if (e.target.checked) {
            recurringOptions.classList.remove('hidden');
        } else {
            recurringOptions.classList.add('hidden');
        }
    });

    // Categories
    document.getElementById('manage-categories-btn').addEventListener('click', () => {
        navigateTo('settings');
    });
    document.getElementById('add-category-btn').addEventListener('click', handleAddCategory);

    // Export buttons
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
    document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);

    // Backup buttons
    document.getElementById('backup-btn').addEventListener('click', handleBackup);
    document.getElementById('restore-btn').addEventListener('change', handleRestore);
    document.getElementById('clear-data-btn').addEventListener('click', handleClearData);

    // PWA Install
    document.getElementById('install-pwa-btn').addEventListener('click', handleInstallPWA);

    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const theme = e.currentTarget.dataset.theme;
            setTheme(theme);
        });
    });

    // Supabase
    document.getElementById('save-supabase-btn').addEventListener('click', handleSaveSupabase);
    document.getElementById('manual-sync-btn').addEventListener('click', handleManualSync);
    document.getElementById('auto-sync-toggle').addEventListener('change', handleAutoSyncToggle);

    // Investments
    document.getElementById('investment-form').addEventListener('submit', handleAddInvestment);

    // Family
    document.getElementById('invite-family-btn').addEventListener('click', handleInviteFamily);

    // PWA prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('install-pwa-btn').style.display = 'block';
    });

    // Filters
    document.getElementById('filter-period').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateDashboard();
    });

    document.getElementById('reports-filter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateReports();
    });

    // Processar transações recorrentes ao carregar
    processRecurringTransactions();
    
    // Carregar tema salvo (chamada redundante removida, já carrega no início)
    
    // Carregar config do Supabase
    loadSupabaseConfig();
}

// Autenticação
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Verificar no storage local primeiro
    const user = DB.users.find(u => u.email === email && atob(u.password) === password);

    if (!user) {
        showAlert('login-error', 'Email ou senha incorretos');
        return;
    }

    DB.currentUser = user;
    await saveData();
    
    // Carregar dados do Supabase se configurado
    if (supabaseClient) {
        await loadFromSupabase();
    }
    
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
    
    // Salvar no Supabase se configurado
    if (supabaseClient) {
        try {
            await supabaseClient.from('users').insert([{
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                created_at: newUser.createdAt
            }]);
        } catch (err) {
            console.log('Erro ao salvar usuário no Supabase:', err);
        }
    }
    
    await saveData();
    
    showAlert('register-success', 'Conta criada com sucesso! Faça login para continuar.');
    
    setTimeout(() => {
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('register-form').reset();
    }, 2000);
}

async function handleLogout() {
    if (confirm('Deseja realmente sair?')) {
        DB.currentUser = null;
        await window.storage.delete('currentUser', false);
        
        // Resetar interface
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('register-page').classList.add('hidden');
        
        // Limpar formulários
        document.getElementById('login-form').reset();
        
        console.log('Logout realizado com sucesso');
    }
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
            loadCategories();
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
        case 'settings':
            updateCategoriesList();
            loadCategories();
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
    const isRecurring = document.getElementById('transaction-recurring').checked;

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
    
    // Se for recorrente, criar registro de recorrência
    if (isRecurring) {
        const frequency = document.getElementById('recurring-frequency').value;
        const endDate = document.getElementById('recurring-end-date').value;
        
        const recurringTransaction = {
            id: Date.now() + 1,
            userId: DB.currentUser.id,
            type,
            amount,
            category,
            description,
            frequency,
            startDate: date,
            endDate,
            lastProcessed: date,
            createdAt: new Date().toISOString()
        };
        
        DB.recurringTransactions.push(recurringTransaction);
    }
    
    await saveData();
    
    showAlert('transaction-success', 'Transação adicionada com sucesso!');
    document.getElementById('transaction-form').reset();
    document.getElementById('recurring-options').classList.add('hidden');
    updateTransactionsList();
    loadCategories();
    
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

// Categorias
function loadCategories() {
    const select = document.getElementById('transaction-category');
    const categories = DB.categories;
    
    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

async function handleAddCategory() {
    const name = document.getElementById('new-category-name').value.trim();
    const type = document.getElementById('new-category-type').value;
    
    if (!name) return;
    
    const newCategory = {
        id: Date.now(),
        name,
        type
    };
    
    DB.categories.push(newCategory);
    await saveData();
    
    document.getElementById('new-category-name').value = '';
    showAlert('categories-success', 'Categoria adicionada com sucesso!');
    setTimeout(() => hideAlert('categories-success'), 3000);
    
    updateCategoriesList();
    loadCategories();
}

function updateCategoriesList() {
    const container = document.getElementById('categories-list');
    
    container.innerHTML = DB.categories.map(cat => `
        <div class="category-item">
            <div class="category-info">
                <span style="font-weight: 600;">${cat.name}</span>
                <span class="category-badge ${cat.type}">${cat.type === 'income' ? 'Receita' : cat.type === 'expense' ? 'Despesa' : 'Ambos'}</span>
            </div>
            <button class="category-delete" onclick="deleteCategory(${cat.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

async function deleteCategory(id) {
    if (!confirm('Deseja realmente excluir esta categoria?')) return;
    
    DB.categories = DB.categories.filter(c => c.id !== id);
    await saveData();
    updateCategoriesList();
    loadCategories();
}

// Transações Recorrentes
async function processRecurringTransactions() {
    const now = new Date();
    
    for (const recurring of DB.recurringTransactions) {
        const lastDate = new Date(recurring.lastProcessed || recurring.startDate);
        const endDate = recurring.endDate ? new Date(recurring.endDate) : null;
        
        if (endDate && now > endDate) continue;
        
        let nextDate = new Date(lastDate);
        
        switch (recurring.frequency) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
        }
        
        if (nextDate <= now) {
            const transaction = {
                id: Date.now() + Math.random(),
                userId: recurring.userId,
                type: recurring.type,
                amount: recurring.amount,
                category: recurring.category,
                date: nextDate.toISOString().split('T')[0],
                description: recurring.description + ' (Recorrente)',
                createdAt: new Date().toISOString()
            };
            
            DB.transactions.push(transaction);
            recurring.lastProcessed = nextDate.toISOString();
            await saveData();
        }
    }
}

// Exportação PDF
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const transactions = getFilteredTransactions();
    const totals = calculateTotals();
    
    // Título
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text('FinControl Pro - Relatório Financeiro', 20, 20);
    
    // Informações do usuário
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Usuário: ${DB.currentUser.name}`, 20, 35);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 42);
    doc.text(`Período: ${currentFilter}`, 20, 49);
    
    // Resumo
    doc.setFontSize(14);
    doc.text('Resumo Financeiro', 20, 65);
    doc.setFontSize(11);
    doc.text(`Receitas: R$ ${totals.income.toFixed(2)}`, 20, 75);
    doc.text(`Despesas: R$ ${totals.expense.toFixed(2)}`, 20, 82);
    doc.text(`Saldo: R$ ${totals.balance.toFixed(2)}`, 20, 89);
    
    // Transações
    doc.setFontSize(14);
    doc.text('Transações', 20, 105);
    
    let y = 115;
    doc.setFontSize(9);
    
    transactions.slice(-20).reverse().forEach(t => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        
        const typeIcon = t.type === 'income' ? '+' : '-';
        const text = `${formatDate(t.date)} | ${t.category} | ${typeIcon} R$ ${t.amount.toFixed(2)}`;
        doc.text(text, 20, y);
        y += 7;
    });
    
    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('Desenvolvido por FELIPE ANDRADE DEV', 20, 285);
        doc.text(`Página ${i} de ${pageCount}`, 170, 285);
    }
    
    doc.save(`FinControl_Relatorio_${new Date().getTime()}.pdf`);
}

// Exportação Excel
function exportToExcel() {
    const transactions = getFilteredTransactions();
    const totals = calculateTotals();
    
    // Preparar dados
    const data = transactions.map(t => ({
        'Data': formatDate(t.date),
        'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
        'Categoria': t.category,
        'Valor': t.amount,
        'Descrição': t.description
    }));
    
    // Adicionar resumo
    data.unshift({});
    data.unshift({
        'Data': 'RESUMO',
        'Tipo': '',
        'Categoria': 'Saldo',
        'Valor': totals.balance,
        'Descrição': ''
    });
    data.unshift({
        'Data': '',
        'Tipo': '',
        'Categoria': 'Despesas',
        'Valor': totals.expense,
        'Descrição': ''
    });
    data.unshift({
        'Data': '',
        'Tipo': '',
        'Categoria': 'Receitas',
        'Valor': totals.income,
        'Descrição': ''
    });
    data.unshift({
        'Data': `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}`,
        'Tipo': '',
        'Categoria': '',
        'Valor': '',
        'Descrição': ''
    });
    
    // Criar workbook
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    
    // Download
    XLSX.writeFile(wb, `FinControl_Relatorio_${new Date().getTime()}.xlsx`);
}

// Backup e Restauração
function handleBackup() {
    const backup = {
        version: '2.0',
        date: new Date().toISOString(),
        user: DB.currentUser,
        data: {
            transactions: getUserTransactions(),
            budgets: getUserBudgets(),
            goals: getUserGoals(),
            categories: DB.categories,
            recurringTransactions: DB.recurringTransactions.filter(r => r.userId === DB.currentUser.id)
        }
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FinControl_Backup_${new Date().getTime()}.json`;
    link.click();
    
    showAlert('backup-success', 'Backup criado com sucesso!');
    setTimeout(() => hideAlert('backup-success'), 3000);
}

async function handleRestore(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const backup = JSON.parse(event.target.result);
            
            if (!backup.version || !backup.data) {
                showAlert('backup-error', 'Arquivo de backup inválido!');
                return;
            }
            
            if (!confirm('Deseja restaurar este backup? Os dados atuais serão substituídos.')) {
                return;
            }
            
            // Restaurar dados
            const userId = DB.currentUser.id;
            
            // Remover dados antigos do usuário
            DB.transactions = DB.transactions.filter(t => t.userId !== userId);
            DB.budgets = DB.budgets.filter(b => b.userId !== userId);
            DB.goals = DB.goals.filter(g => g.userId !== userId);
            DB.recurringTransactions = DB.recurringTransactions.filter(r => r.userId !== userId);
            
            // Adicionar dados do backup
            DB.transactions.push(...backup.data.transactions);
            DB.budgets.push(...backup.data.budgets);
            DB.goals.push(...backup.data.goals);
            if (backup.data.categories) {
                DB.categories = backup.data.categories;
            }
            if (backup.data.recurringTransactions) {
                DB.recurringTransactions.push(...backup.data.recurringTransactions);
            }
            
            await saveData();
            
            showAlert('backup-success', 'Backup restaurado com sucesso!');
            setTimeout(() => {
                hideAlert('backup-success');
                navigateTo('dashboard');
            }, 2000);
            
        } catch (err) {
            showAlert('backup-error', 'Erro ao restaurar backup: ' + err.message);
        }
    };
    reader.readAsText(file);
}

async function handleClearData() {
    if (!confirm('ATENÇÃO: Esta ação irá apagar TODOS os seus dados permanentemente. Deseja continuar?')) {
        return;
    }
    
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita!')) {
        return;
    }
    
    const userId = DB.currentUser.id;
    
    DB.transactions = DB.transactions.filter(t => t.userId !== userId);
    DB.budgets = DB.budgets.filter(b => b.userId !== userId);
    DB.goals = DB.goals.filter(g => g.userId !== userId);
    DB.recurringTransactions = DB.recurringTransactions.filter(r => r.userId !== userId);
    
    await saveData();
    
    alert('Todos os dados foram apagados com sucesso!');
    navigateTo('dashboard');
}

// PWA Install
async function handleInstallPWA() {
    if (!deferredPrompt) {
        alert('Este app já está instalado ou seu navegador não suporta instalação.');
        return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        alert('App instalado com sucesso!');
    }
    
    deferredPrompt = null;
    document.getElementById('install-pwa-btn').style.display = 'none';
}

// Modo Escuro
function loadTheme() {
    const savedTheme = localStorage.getItem('fincontrol-theme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const body = document.body;
    const themeIcon = document.querySelector('#theme-toggle i');
    
    // Remover classes anteriores
    body.classList.remove('light-theme', 'dark-theme');
    
    // Atualizar botões de seleção de tema (se estiverem na página)
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
    
    if (theme === 'auto') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.classList.add(isDark ? 'dark-theme' : 'light-theme');
        if (themeIcon) {
            themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    } else {
        body.classList.add(`${theme}-theme`);
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
    
    localStorage.setItem('fincontrol-theme', theme);
}

function setTheme(theme) {
    applyTheme(theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('fincontrol-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// Supabase Integration
async function initializeSupabaseOnLoad() {
    // Tentar carregar config salva
    try {
        const config = await window.storage.get('supabase-config', false);
        if (config && config.value) {
            const savedConfig = JSON.parse(config.value);
            if (savedConfig.url && savedConfig.key) {
                supabaseConfig = savedConfig;
            }
        }
    } catch (err) {
        console.log('Config do Supabase não encontrada');
    }
    
    // Se há configuração padrão no código, usar ela
    if (SUPABASE_CONFIG.enabled && SUPABASE_CONFIG.url && SUPABASE_CONFIG.key) {
        supabaseConfig.url = SUPABASE_CONFIG.url;
        supabaseConfig.key = SUPABASE_CONFIG.key;
    }
    
    // Inicializar se houver URL e Key
    if (supabaseConfig.url && supabaseConfig.key && 
        supabaseConfig.url !== 'SUA_URL_SUPABASE_AQUI' && 
        supabaseConfig.key !== 'SUA_CHAVE_SUPABASE_AQUI') {
        initializeSupabase();
    }
}

async function loadSupabaseConfig() {
    try {
        const config = await window.storage.get('supabase-config', false);
        if (config && config.value) {
            supabaseConfig = JSON.parse(config.value);
            document.getElementById('supabase-url').value = supabaseConfig.url || '';
            document.getElementById('supabase-key').value = supabaseConfig.key || '';
            document.getElementById('auto-sync-toggle').checked = supabaseConfig.autoSync || false;
            
            if (supabaseConfig.url && supabaseConfig.key) {
                initializeSupabase();
            }
        }
    } catch (err) {
        console.log('Config do Supabase não encontrada');
    }
}

async function handleSaveSupabase() {
    const url = document.getElementById('supabase-url').value.trim();
    const key = document.getElementById('supabase-key').value.trim();
    
    if (!url || !key) {
        showAlert('supabase-error', 'Preencha todos os campos');
        return;
    }
    
    supabaseConfig.url = url;
    supabaseConfig.key = key;
    
    await window.storage.set('supabase-config', JSON.stringify(supabaseConfig), false);
    
    initializeSupabase();
    showAlert('supabase-success', 'Configuração salva com sucesso!');
    setTimeout(() => hideAlert('supabase-success'), 3000);
}

function initializeSupabase() {
    try {
        const { createClient } = window.supabase;
        supabaseClient = createClient(supabaseConfig.url, supabaseConfig.key);
        
        document.getElementById('manual-sync-btn').disabled = false;
        document.getElementById('sync-status-text').textContent = 'Conectado';
        document.getElementById('sync-status-text').style.color = 'var(--success)';
    } catch (err) {
        console.error('Erro ao inicializar Supabase:', err);
        showAlert('supabase-error', 'Erro ao conectar com Supabase');
    }
}

async function syncWithSupabase() {
    if (!supabaseClient) {
        console.log('Supabase não configurado, pulando sincronização');
        return;
    }
    
    try {
        console.log('Sincronizando com Supabase...');
        
        const userId = DB.currentUser.email;
        
        // Sincronizar transações
        const userTransactions = getUserTransactions();
        for (const transaction of userTransactions) {
            await supabaseClient.from('transactions').upsert({
                id: transaction.id,
                user_id: userId,
                type: transaction.type,
                amount: transaction.amount,
                category: transaction.category,
                date: transaction.date,
                description: transaction.description,
                created_at: transaction.createdAt,
                synced_at: new Date().toISOString()
            }, { onConflict: 'id' });
        }
        
        // Sincronizar orçamentos
        const userBudgets = getUserBudgets();
        for (const budget of userBudgets) {
            await supabaseClient.from('budgets').upsert({
                id: budget.id,
                user_id: userId,
                category: budget.category,
                amount: budget.amount,
                created_at: budget.createdAt,
                synced_at: new Date().toISOString()
            }, { onConflict: 'id' });
        }
        
        // Sincronizar metas
        const userGoals = getUserGoals();
        for (const goal of userGoals) {
            await supabaseClient.from('goals').upsert({
                id: goal.id,
                user_id: userId,
                name: goal.name,
                target_amount: goal.targetAmount,
                current_amount: goal.currentAmount,
                deadline: goal.deadline,
                created_at: goal.createdAt,
                synced_at: new Date().toISOString()
            }, { onConflict: 'id' });
        }
        
        // Sincronizar investimentos
        const userInvestments = getUserInvestments();
        for (const investment of userInvestments) {
            await supabaseClient.from('investments').upsert({
                id: investment.id,
                user_id: userId,
                name: investment.name,
                type: investment.type,
                amount: investment.amount,
                current_value: investment.currentValue,
                date: investment.date,
                yield_rate: investment.yieldRate,
                created_at: investment.createdAt,
                synced_at: new Date().toISOString()
            }, { onConflict: 'id' });
        }
        
        const now = new Date().toLocaleString('pt-BR');
        const lastSyncEl = document.getElementById('last-sync');
        if (lastSyncEl) {
            lastSyncEl.textContent = `Última sincronização: ${now}`;
        }
        localStorage.setItem('last-sync', now);
        
        console.log('Sincronização concluída com sucesso!');
        
    } catch (err) {
        console.error('Erro na sincronização:', err);
        throw err;
    }
}

async function handleManualSync() {
    if (!supabaseClient) {
        showAlert('supabase-error', 'Configure o Supabase primeiro');
        return;
    }
    
    const btn = document.getElementById('manual-sync-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    
    try {
        await syncWithSupabase();
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Agora';
        
        showAlert('supabase-success', 'Dados sincronizados com sucesso!');
        setTimeout(() => hideAlert('supabase-success'), 3000);
        
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Agora';
        showAlert('supabase-error', 'Erro ao sincronizar: ' + err.message);
    }
}

async function handleAutoSyncToggle(e) {
    supabaseConfig.autoSync = e.target.checked;
    await window.storage.set('supabase-config', JSON.stringify(supabaseConfig), false);
    
    if (supabaseConfig.autoSync && supabaseClient) {
        showAlert('supabase-success', 'Sincronização automática ativada!');
        setTimeout(() => hideAlert('supabase-success'), 2000);
    }
}

// Investimentos
async function handleAddInvestment(e) {
    e.preventDefault();
    
    const name = document.getElementById('investment-name').value;
    const type = document.getElementById('investment-type').value;
    const amount = parseFloat(document.getElementById('investment-amount').value);
    const current = parseFloat(document.getElementById('investment-current').value) || amount;
    const date = document.getElementById('investment-date').value;
    const yieldRate = parseFloat(document.getElementById('investment-yield').value) || 0;
    
    if (!name || !type || !amount || !date) {
        showAlert('investment-error', 'Preencha todos os campos obrigatórios');
        return;
    }
    
    const investment = {
        id: Date.now(),
        userId: DB.currentUser.id,
        name,
        type,
        amount,
        currentValue: current,
        date,
        yieldRate,
        createdAt: new Date().toISOString()
    };
    
    DB.investments.push(investment);
    await saveData();
    
    if (supabaseConfig.autoSync && supabaseClient) {
        await syncWithSupabase();
    }
    
    showAlert('investment-success', 'Investimento adicionado com sucesso!');
    document.getElementById('investment-form').reset();
    updateInvestmentsList();
    
    setTimeout(() => hideAlert('investment-success'), 3000);
}

function updateInvestmentsList() {
    const container = document.getElementById('investments-list');
    const investments = getUserInvestments();
    
    if (investments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>Nenhum investimento registrado</p>
            </div>
        `;
        updateInvestmentSummary();
        return;
    }
    
    container.innerHTML = investments.map(inv => {
        const profit = inv.currentValue - inv.amount;
        const profitPercent = ((profit / inv.amount) * 100).toFixed(2);
        
        return `
            <div class="investment-item">
                <div class="investment-header">
                    <div>
                        <h4 class="investment-name">${inv.name}</h4>
                        <span class="investment-type">${getInvestmentTypeLabel(inv.type)}</span>
                    </div>
                    <button class="category-delete" onclick="deleteInvestment(${inv.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="investment-details">
                    <div class="investment-detail">
                        <span class="investment-detail-label">Investido</span>
                        <span class="investment-detail-value">R$ ${inv.amount.toFixed(2)}</span>
                    </div>
                    <div class="investment-detail">
                        <span class="investment-detail-label">Valor Atual</span>
                        <span class="investment-detail-value">R$ ${inv.currentValue.toFixed(2)}</span>
                    </div>
                    <div class="investment-detail">
                        <span class="investment-detail-label">Rendimento</span>
                        <span class="investment-detail-value ${profit >= 0 ? 'success' : 'danger'}">
                            ${profit >= 0 ? '+' : ''}R$ ${profit.toFixed(2)} (${profitPercent}%)
                        </span>
                    </div>
                    <div class="investment-detail">
                        <span class="investment-detail-label">Data</span>
                        <span class="investment-detail-value">${formatDate(inv.date)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    updateInvestmentSummary();
    updateInvestmentDistributionChart();
}

function updateInvestmentSummary() {
    const investments = getUserInvestments();
    
    const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
    const totalCurrent = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
    const totalProfit = totalCurrent - totalInvested;
    const totalReturn = totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(2) : 0;
    
    document.getElementById('total-invested').textContent = `R$ ${totalInvested.toFixed(2)}`;
    document.getElementById('total-current').textContent = `R$ ${totalCurrent.toFixed(2)}`;
    document.getElementById('total-profit').textContent = `R$ ${totalProfit.toFixed(2)}`;
    document.getElementById('total-profit').className = `summary-value ${totalProfit >= 0 ? 'success' : 'danger'}`;
    document.getElementById('total-return').textContent = `${totalReturn}%`;
    document.getElementById('total-return').className = `summary-value ${totalProfit >= 0 ? 'success' : 'danger'}`;
}

function updateInvestmentDistributionChart() {
    const ctx = document.getElementById('investment-distribution-chart');
    const investments = getUserInvestments();
    
    if (charts.investmentDistribution) {
        charts.investmentDistribution.destroy();
    }
    
    if (investments.length === 0) {
        ctx.parentElement.innerHTML = '<p class="empty-state">Sem dados</p>';
        return;
    }
    
    const grouped = {};
    investments.forEach(inv => {
        if (!grouped[inv.type]) grouped[inv.type] = 0;
        grouped[inv.type] += inv.currentValue;
    });
    
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    charts.investmentDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(grouped).map(getInvestmentTypeLabel),
            datasets: [{
                data: Object.values(grouped),
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function getInvestmentTypeLabel(type) {
    const labels = {
        'acoes': 'Ações',
        'fundos': 'Fundos',
        'renda-fixa': 'Renda Fixa',
        'tesouro': 'Tesouro',
        'cripto': 'Cripto',
        'imoveis': 'Imóveis',
        'outros': 'Outros'
    };
    return labels[type] || type;
}

async function deleteInvestment(id) {
    if (!confirm('Deseja excluir este investimento?')) return;
    
    DB.investments = DB.investments.filter(i => i.id !== id);
    await saveData();
    updateInvestmentsList();
}

function getUserInvestments() {
    return DB.investments.filter(i => i.userId === DB.currentUser.id);
}

// Compartilhamento Familiar
async function handleInviteFamily() {
    const email = document.getElementById('family-email').value.trim();
    const permission = document.getElementById('family-permission').value;
    
    if (!email) {
        showAlert('family-error', 'Digite um email');
        return;
    }
    
    const member = {
        id: Date.now(),
        userId: DB.currentUser.id,
        email,
        permission,
        status: 'pending',
        invitedAt: new Date().toISOString()
    };
    
    DB.familyMembers.push(member);
    await saveData();
    
    showAlert('family-success', 'Convite enviado com sucesso!');
    document.getElementById('family-email').value = '';
    updateFamilyMembersList();
    
    setTimeout(() => hideAlert('family-success'), 3000);
}

function updateFamilyMembersList() {
    const container = document.getElementById('family-members-list');
    const members = DB.familyMembers.filter(m => m.userId === DB.currentUser.id);
    
    if (members.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Nenhum membro adicionado ainda</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = members.map(member => {
        const initial = member.email.charAt(0).toUpperCase();
        return `
            <div class="family-member-item">
                <div class="family-member-info">
                    <div class="family-avatar">${initial}</div>
                    <div class="family-member-details">
                        <h4>${member.email}</h4>
                        <p>Status: ${member.status === 'pending' ? 'Pendente' : 'Ativo'}</p>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="family-permission-badge ${member.permission}">
                        ${member.permission === 'admin' ? 'Admin' : member.permission === 'edit' ? 'Editar' : 'Visualizar'}
                    </span>
                    <button class="category-delete" onclick="removeFamilyMember(${member.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function removeFamilyMember(id) {
    if (!confirm('Remover este membro?')) return;
    
    DB.familyMembers = DB.familyMembers.filter(m => m.id !== id);
    await saveData();
    updateFamilyMembersList();
}

// Atualizar navegação
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
            loadCategories();
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
        case 'investments':
            updateInvestmentsList();
            break;
        case 'family':
            updateFamilyMembersList();
            break;
        case 'settings':
            updateCategoriesList();
            loadCategories();
            const lastSync = localStorage.getItem('last-sync');
            if (lastSync) {
                document.getElementById('last-sync').textContent = `Última sincronização: ${lastSync}`;
            }
            break;
    }
}
