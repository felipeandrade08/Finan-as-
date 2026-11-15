// =============================================
// FINCONTROL PRO v4.0 - COMPLETO COM FIREBASE
// Desenvolvido por: FELIPE ANDRADE DEV
// =============================================

// Base de dados local (cache)
const DB = {
    transactions: [],
    budgets: [],
    goals: [],
    categories: [],
    investments: [],
    creditCards: [],
    monthlyBills: [],
    currentUser: null
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

const INVESTMENT_TYPES = {
    'acoes': 'Ações', 'fundos': 'Fundos', 'renda-fixa': 'Renda Fixa', 'tesouro': 'Tesouro Direto',
    'cripto': 'Criptomoedas', 'imoveis': 'Imóveis', 'outros': 'Outros'
};

// ========== UTILITÁRIOS ==========
// Escapa texto digitado pelo usuário antes de inseri-lo via innerHTML.
function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Converte "AAAA-MM-DD" em data LOCAL. new Date("AAAA-MM-DD") é interpretado
// como meia-noite UTC, o que no Brasil (UTC-3) mostra o dia anterior.
function parseLocalDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'string') {
        const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    return new Date(value);
}

// Data de hoje no formato AAAA-MM-DD, no fuso local (toISOString usa UTC).
function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ordena por data (mais antiga primeiro); empata pela ordem de cadastro.
function sortByDate(list) {
    return list
        .map((item, index) => ({ item, index }))
        .sort((a, b) => (parseLocalDate(a.item.date) - parseLocalDate(b.item.date)) || (a.index - b.index))
        .map(x => x.item);
}

// Executa operações em lotes de até 500 (limite do Firestore por batch).
async function commitInChunks(refs, operation) {
    for (let i = 0; i < refs.length; i += 500) {
        const batch = window.db.batch();
        refs.slice(i, i + 500).forEach(item => operation(batch, item));
        await batch.commit();
    }
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== FINCONTROL PRO v4.0 INICIANDO ===');
    
    loadTheme();
    setupEventListeners();
    
    // Firebase Auth State Observer
    if (window.auth) {
        window.auth.onAuthStateChanged(async (user) => {
            document.getElementById('loading-screen').style.display = 'none';
            
            if (user) {
                console.log('✅ Usuário autenticado:', user.email);
                DB.currentUser = {
                    id: user.uid,
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email
                };
                
                await loadUserDataFromFirebase(user.uid);
                showMainApp();
            } else {
                console.log('❌ Nenhum usuário autenticado');
                document.getElementById('login-page').classList.remove('hidden');
            }
        });
    } else {
        console.error('Firebase não está configurado!');
        document.getElementById('loading-screen').style.display = 'none';
        alert('Firebase não configurado. Por favor, adicione suas credenciais no HTML.');
        document.getElementById('login-page').classList.remove('hidden');
    }
    
    console.log('=== INICIALIZAÇÃO COMPLETA ===');
});

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Auth
    document.getElementById('show-register')?.addEventListener('click', () => {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('register-page').classList.remove('hidden');
    });

    document.getElementById('show-login')?.addEventListener('click', () => {
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
    });

    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);

    // Navigation
    document.querySelectorAll('.nav-item:not(.logout-btn)').forEach(item => {
        item.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            if (page) navigateTo(page);
        });
    });

    document.querySelectorAll('.link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            if (page) navigateTo(page);
        });
    });

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Forms
    document.getElementById('transaction-form')?.addEventListener('submit', handleAddTransaction);
    document.getElementById('budget-form')?.addEventListener('submit', handleAddBudget);
    document.getElementById('goal-form')?.addEventListener('submit', handleAddGoal);
    document.getElementById('investment-form')?.addEventListener('submit', handleAddInvestment);
    document.getElementById('credit-card-form')?.addEventListener('submit', handleAddCreditCard);
    document.getElementById('bill-form')?.addEventListener('submit', handleAddBill);

    // Categories
    document.getElementById('add-category-btn')?.addEventListener('click', handleAddCategory);

    // Export buttons
    document.getElementById('export-pdf-btn')?.addEventListener('click', exportToPDF);
    document.getElementById('export-excel-btn')?.addEventListener('click', exportToExcel);

    // Backup buttons
    document.getElementById('backup-btn')?.addEventListener('click', handleBackup);
    document.getElementById('restore-btn')?.addEventListener('change', handleRestore);
    setupTransactionFilters();
    document.getElementById('clear-data-btn')?.addEventListener('click', handleClearData);

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

    // Filters
    document.getElementById('filter-period')?.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateDashboard();
    });

    document.getElementById('reports-filter')?.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        updateReports();
    });

    // Password strength indicator
    const registerPassword = document.getElementById('register-password');
    if (registerPassword) {
        registerPassword.addEventListener('input', (e) => {
            const password = e.target.value;
            const strengthDiv = document.getElementById('password-strength');
            const strengthFill = document.getElementById('strength-bar-fill');
            const strengthText = document.getElementById('strength-text');
            
            if (!strengthDiv || !strengthFill || !strengthText) return;
            
            if (password.length === 0) {
                strengthDiv.classList.add('hidden');
                return;
            }
            
            strengthDiv.classList.remove('hidden');
            const strength = checkPasswordStrength(password);
            
            strengthFill.className = `strength-bar-fill ${strength.class}`;
            strengthText.className = `strength-text ${strength.class}`;
            strengthText.textContent = strength.text;
        });
    }
}

// ========== FIREBASE AUTH ==========
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const acceptTerms = document.getElementById('accept-terms').checked;

    if (!name || !email || !password) {
        showAlert('register-error', 'Preencha todos os campos');
        return;
    }

    if (!acceptTerms) {
        showAlert('register-error', 'Você precisa aceitar os termos de uso');
        return;
    }

    if (password.length < 8) {
        showAlert('register-error', 'A senha deve ter no mínimo 8 caracteres');
        return;
    }

    if (password !== confirm) {
        showAlert('register-error', 'As senhas não coincidem');
        return;
    }

    const strength = checkPasswordStrength(password);
    if (strength.score < 3) {
        showAlert('register-error', 'Senha muito fraca. Use letras maiúsculas, minúsculas, números e caracteres especiais');
        return;
    }

    try {
        const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await user.updateProfile({ displayName: name });
        
        await window.db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const batch = window.db.batch();
        DEFAULT_CATEGORIES.forEach((cat) => {
            const ref = window.db.collection('users').doc(user.uid).collection('categories').doc();
            batch.set(ref, {
                name: cat.name,
                type: cat.type,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        
        console.log('✅ Usuário registrado:', email);
        
        showAlert('register-success', 'Conta criada com sucesso! Redirecionando...');
        
        setTimeout(() => {
            hideAlert('register-success');
            document.getElementById('register-page').classList.add('hidden');
            document.getElementById('login-page').classList.remove('hidden');
            document.getElementById('register-form').reset();
        }, 2000);
        
    } catch (error) {
        console.error('Erro ao registrar:', error);
        showAlert('register-error', getFirebaseErrorMessage(error.code));
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    console.log('Tentando login...');

    try {
        await window.auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Login bem-sucedido!');
        hideAlert('login-error');
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        showAlert('login-error', getFirebaseErrorMessage(error.code));
    }
}

async function handleLogout() {
    if (confirm('Deseja realmente sair?')) {
        try {
            await window.auth.signOut();
            Object.keys(EDITABLE).forEach(cancelEdit);
            DB.currentUser = null;
            DB.transactions = [];
            DB.budgets = [];
            DB.goals = [];
            DB.investments = [];
            DB.creditCards = [];
            DB.monthlyBills = [];
            
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('login-page').classList.remove('hidden');
            
            console.log('✅ Logout realizado');
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    }
}

function getFirebaseErrorMessage(errorCode) {
    const errors = {
        'auth/email-already-in-use': 'Este email já está cadastrado',
        'auth/invalid-email': 'Email inválido',
        'auth/weak-password': 'Senha muito fraca (mínimo 8 caracteres)',
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        // Firebase Auth can return invalid-credential for either an unknown email or a wrong password.
        'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
        'auth/invalid-login-credentials': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
        'auth/user-disabled': 'Esta conta está desativada. Entre em contato com o suporte.',
        'auth/operation-not-allowed': 'O login por e-mail e senha não está habilitado no Firebase.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
        'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.'
    };
    
    return errors[errorCode] || 'Erro desconhecido. Tente novamente';
}

// ========== CARREGAR DADOS DO FIREBASE ==========
async function loadUserDataFromFirebase(userId) {
    try {
        console.log('📊 Carregando dados do Firebase...');
        
        const categoriesSnap = await window.db.collection('users').doc(userId)
            .collection('categories').get();
        
        if (!categoriesSnap.empty) {
            DB.categories = categoriesSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            DB.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
        }
        
        const transactionsSnap = await window.db.collection('users').doc(userId)
            .collection('transactions').get();
        
        DB.transactions = transactionsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        const budgetsSnap = await window.db.collection('users').doc(userId)
            .collection('budgets').get();
        
        DB.budgets = budgetsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        const goalsSnap = await window.db.collection('users').doc(userId)
            .collection('goals').get();
        
        DB.goals = goalsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        const investmentsSnap = await window.db.collection('users').doc(userId)
            .collection('investments').get();
        
        DB.investments = investmentsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        const cardsSnap = await window.db.collection('users').doc(userId)
            .collection('creditCards').get();
        
        DB.creditCards = cardsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        const billsSnap = await window.db.collection('users').doc(userId)
            .collection('monthlyBills').get();
        
        DB.monthlyBills = billsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        console.log('✅ Dados carregados do Firebase:', {
            transactions: DB.transactions.length,
            budgets: DB.budgets.length,
            goals: DB.goals.length,
            investments: DB.investments.length,
            creditCards: DB.creditCards.length,
            monthlyBills: DB.monthlyBills.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    }
}

// ========== NAVEGAÇÃO ==========
function showMainApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('register-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    if (DB.currentUser) {
        document.getElementById('user-name').textContent = DB.currentUser.name;
    }
    navigateTo('dashboard');
}

function navigateTo(page) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.add('hidden'));
    const pagEl = document.getElementById(`${page}-page`);
    if (pagEl) {
        pagEl.classList.remove('hidden');
    }
    
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
        case 'credit-cards':
            updateCreditCardsList();
            break;
        case 'bills':
            updateBillsList();
            break;
        case 'settings':
            updateCategoriesList();
            loadCategories();
            break;
    }
}

// ========== TRANSAÇÕES ==========
async function handleAddTransaction(e) {
    e.preventDefault();

    const type = document.getElementById('transaction-type').value;
    const amount = parseAmount(document.getElementById('transaction-amount').value);
    const category = document.getElementById('transaction-category').value;
    const date = document.getElementById('transaction-date').value;
    const description = document.getElementById('transaction-description').value.trim();

    if (!type || !(amount > 0) || !category || !date) {
        notify.error('Preencha todos os campos obrigatórios');
        return;
    }

    try {
        const { created } = await saveRecord('transactions', { type, amount, category, date, description });
        notify.success(created ? 'Transação adicionada com sucesso!' : 'Transação atualizada!');
        EDITABLE.transactions.refresh();
    } catch (error) {
        console.error('Erro ao salvar transação:', error);
        notify.error('Erro ao salvar transação');
    }
}

function updateTransactionsList() {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    
    updateFilterCategoryOptions();
    const transactions = applyTransactionFilters(DB.transactions);
    const summary = document.getElementById('transactions-summary');

    if (DB.transactions.length === 0) {
        if (summary) summary.textContent = '';
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-invoice"></i>
                <p>Nenhuma transação registrada</p>
            </div>
        `;
        return;
    }

    if (summary) {
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        summary.innerHTML = `
            <span>${transactions.length} lançamento(s)</span>
            <span class="income">Receitas: ${formatCurrency(income)}</span>
            <span class="expense">Despesas: ${formatCurrency(expense)}</span>
            <span>Saldo: ${formatCurrency(income - expense)}</span>`;
    }

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-filter"></i>
                <p>Nenhum lançamento encontrado com esses filtros</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sortByDate(transactions).reverse().map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-icon ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'income' ? 'up' : 'down'}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${escapeHTML(t.category)}</h4>
                    <p>${escapeHTML(t.description || 'Sem descrição')}</p>
                    <small>${formatDate(t.date)}</small>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
                </div>
                ${itemActions('transactions', t.id)}
            </div>
        </div>
    `).join('');
}

// ---------- Filtros do histórico ----------
// Remove acentos e caixa para a busca ("alimentacao" encontra "Alimentação").
function normalizeText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function applyTransactionFilters(list) {
    const search = normalizeText(document.getElementById('filter-search')?.value.trim());
    const type = document.getElementById('filter-type')?.value || '';
    const category = document.getElementById('filter-category')?.value || '';
    const month = document.getElementById('filter-month')?.value || ''; // "AAAA-MM"

    return list.filter(t =>
        (!type || t.type === type) &&
        (!category || t.category === category) &&
        (!month || String(t.date).startsWith(month)) &&
        (!search || normalizeText(`${t.description} ${t.category}`).includes(search))
    );
}

function updateFilterCategoryOptions() {
    const select = document.getElementById('filter-category');
    if (!select) return;
    const current = select.value;
    const names = [...new Set([...DB.categories.map(c => c.name), ...DB.transactions.map(t => t.category)])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    select.innerHTML = '<option value="">Todas</option>';
    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
    select.value = names.includes(current) ? current : '';
}

function setupTransactionFilters() {
    ['filter-search', 'filter-type', 'filter-category', 'filter-month'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener(el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change', updateTransactionsList);
    });
    document.getElementById('filter-clear')?.addEventListener('click', () => {
        ['filter-search', 'filter-type', 'filter-category', 'filter-month'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        updateTransactionsList();
    });
}

// ========== DASHBOARD ==========
function updateDashboard() {
    const totals = calculateTotals();
    
    document.getElementById('total-income').textContent = `${formatCurrency(totals.income)}`;
    document.getElementById('total-expense').textContent = `${formatCurrency(totals.expense)}`;
    document.getElementById('total-balance').textContent = `${formatCurrency(totals.balance)}`;
    
    const total = totals.income + totals.expense;
    document.getElementById('income-percentage').textContent = 
        `${((totals.income / total) * 100 || 0).toFixed(1)}% do total`;
    document.getElementById('expense-percentage').textContent = 
        `${((totals.expense / total) * 100 || 0).toFixed(1)}% do total`;
    document.getElementById('balance-status').textContent = 
        totals.balance >= 0 ? 'Situação positiva' : 'Atenção necessária';
    
    const balanceCard = document.querySelector('.balance-card');
    if (balanceCard) {
        if (totals.balance < 0) {
            balanceCard.classList.add('negative');
        } else {
            balanceCard.classList.remove('negative');
        }
    }
    
    updateRecentTransactions();
    updateGoalsPreview();
    
    // NOVO: Atualizar gráficos
    if (typeof updateAllCharts === 'function') {
        updateAllCharts();
    }
    
    // NOVO: Verificar notificações
    if (typeof runAllNotificationChecks === 'function') {
        runAllNotificationChecks();
    }
    
    checkBillsAlerts();
}

function updateRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    
    const transactions = sortByDate(getFilteredTransactions()).slice(-6).reverse();
    
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
        <div class="transaction-item" style="margin-bottom: 12px;">
            <div class="transaction-info">
                <div class="transaction-icon ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'income' ? 'up' : 'down'}"></i>
                </div>
                <div class="transaction-details">
                    <h4 style="font-size: 14px; font-weight: 700;">${escapeHTML(t.category)}</h4>
                    <small>${formatDate(t.date)}</small>
                </div>
            </div>
            <div class="transaction-amount ${t.type}" style="font-size: 16px;">
                ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
        </div>
    `).join('');
}

function calculateTotals() {
    const filtered = getFilteredTransactions();
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
}

function getFilteredTransactions() {
    const transactions = DB.transactions;
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
    
    return transactions.filter(t => parseLocalDate(t.date) >= startDate);
}

// ========== ORÇAMENTOS ==========
async function handleAddBudget(e) {
    e.preventDefault();

    const category = document.getElementById('budget-category').value.trim();
    const amount = parseAmount(document.getElementById('budget-amount').value);

    if (!category || !(amount > 0)) {
        notify.error('Preencha todos os campos');
        return;
    }

    try {
        const { created } = await saveRecord('budgets', { category, amount });
        notify.success(created ? 'Orçamento adicionado com sucesso!' : 'Orçamento atualizado!');
        EDITABLE.budgets.refresh();
    } catch (error) {
        console.error('Erro ao salvar orçamento:', error);
        notify.error('Erro ao salvar orçamento');
    }
}

function updateBudgetsList() {
    const container = document.getElementById('budgets-list');
    if (!container) return;
    
    if (DB.budgets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-credit-card"></i>
                <p>Nenhum orçamento definido</p>
            </div>
        `;
        return;
    }

    container.innerHTML = DB.budgets.map(b => {
        const spent = DB.transactions
            .filter(t => t.type === 'expense' && t.category === b.category)
            .reduce((sum, t) => sum + t.amount, 0);
        
        const percentage = (spent / b.amount) * 100;
        const status = percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'success';
        
        return `
            <div class="budget-item">
                <div class="budget-header">
                    <h4 class="budget-name">${escapeHTML(b.category)}</h4>
                    <div class="item-header-right">
                        <span class="budget-percentage ${status}">${percentage.toFixed(0)}%</span>
                        ${itemActions('budgets', b.id)}
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="budget-info">
                    <span>Gasto: ${formatCurrency(spent)}</span>
                    <span>Limite: ${formatCurrency(b.amount)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Continua no próximo bloco...

// ========== METAS ==========
async function handleAddGoal(e) {
    e.preventDefault();

    const name = document.getElementById('goal-name').value.trim();
    const targetAmount = parseAmount(document.getElementById('goal-amount').value);
    const currentRaw = document.getElementById('goal-current')?.value ?? '';
    const currentAmount = currentRaw === '' ? 0 : parseAmount(currentRaw);
    const deadline = document.getElementById('goal-deadline').value;

    if (!name || !(targetAmount > 0) || !deadline || !(currentAmount >= 0)) {
        notify.error('Preencha todos os campos');
        return;
    }

    try {
        const { created } = await saveRecord('goals', { name, targetAmount, currentAmount, deadline });
        notify.success(created ? 'Meta criada com sucesso!' : 'Meta atualizada!');
        EDITABLE.goals.refresh();
    } catch (error) {
        console.error('Erro ao salvar meta:', error);
        notify.error('Erro ao salvar meta');
    }
}

function updateGoalsList() {
    const container = document.getElementById('goals-list');
    if (!container) return;
    
    if (DB.goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullseye"></i>
                <p>Nenhuma meta definida</p>
            </div>
        `;
        return;
    }

    container.innerHTML = DB.goals.map(g => {
        const percentage = (g.currentAmount / g.targetAmount) * 100;
        const remaining = g.targetAmount - g.currentAmount;
        
        return `
            <div class="goal-item">
                <div class="goal-header">
                    <h4 class="goal-name">${escapeHTML(g.name)}</h4>
                    ${itemActions('goals', g.id, `
                        <button type="button" class="icon-btn success" data-action="goal-add" data-id="${escapeHTML(g.id)}" title="Adicionar valor guardado" aria-label="Adicionar valor guardado">
                            <i class="fas fa-plus"></i>
                        </button>`)}
                </div>
                <div class="goal-progress">
                    <span>${formatCurrency(g.currentAmount)} de ${formatCurrency(g.targetAmount)}</span>
                    <span class="goal-percentage">${percentage.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill success" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="goal-stats">
                    <div class="goal-stat">
                        <span>Falta</span>
                        <span>${formatCurrency(remaining)}</span>
                    </div>
                    <div class="goal-stat deadline">
                        <span>Prazo</span>
                        <span>${formatDate(g.deadline)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateGoalsPreview() {
    const container = document.getElementById('goals-preview');
    if (!container) return;
    
    const goals = DB.goals.slice(0, 3);
    
    if (goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 32px 0;">
                <i class="fas fa-bullseye" style="font-size: 48px;"></i>
                <p style="font-size: 14px;">Nenhuma meta definida</p>
            </div>
        `;
        return;
    }

    container.innerHTML = goals.map(g => {
        const percentage = (g.currentAmount / g.targetAmount) * 100;
        
        return `
            <div class="goal-item" style="margin-bottom: 12px;">
                <div class="goal-header">
                    <h4 class="goal-name" style="font-size: 16px;">${escapeHTML(g.name)}</h4>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill success" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="goal-progress" style="margin-top: 8px;">
                    <span style="font-size: 12px;">${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)}</span>
                    <span class="goal-percentage" style="font-size: 14px;">${percentage.toFixed(0)}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// ========== INVESTIMENTOS ==========
async function handleAddInvestment(e) {
    e.preventDefault();

    const name = document.getElementById('investment-name').value.trim();
    const type = document.getElementById('investment-type').value;
    const amount = parseAmount(document.getElementById('investment-amount').value);
    const currentRaw = document.getElementById('investment-current').value;
    const currentValue = currentRaw === '' ? amount : parseAmount(currentRaw);
    const date = document.getElementById('investment-date').value;
    const yieldRate = parseAmount(document.getElementById('investment-yield').value) || 0;

    if (!name || !type || !(amount > 0) || !date || !(currentValue >= 0)) {
        notify.error('Preencha todos os campos obrigatórios');
        return;
    }

    try {
        const { created } = await saveRecord('investments', { name, type, amount, currentValue, date, yieldRate });
        notify.success(created ? 'Investimento adicionado com sucesso!' : 'Investimento atualizado!');
        EDITABLE.investments.refresh();
    } catch (error) {
        console.error('Erro ao salvar investimento:', error);
        notify.error('Erro ao salvar investimento');
    }
}

function updateInvestmentsList() {
    const container = document.getElementById('investments-list');
    if (!container) return;
    
    if (DB.investments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>Nenhum investimento registrado</p>
            </div>
        `;
        return;
    }

    const totalInvested = DB.investments.reduce((sum, i) => sum + i.amount, 0);
    const totalCurrent = DB.investments.reduce((sum, i) => sum + i.currentValue, 0);
    const totalProfit = totalCurrent - totalInvested;
    const totalReturn = ((totalProfit / totalInvested) * 100) || 0;

    document.getElementById('total-invested').textContent = `${formatCurrency(totalInvested)}`;
    document.getElementById('total-current').textContent = `${formatCurrency(totalCurrent)}`;
    document.getElementById('total-profit').textContent = `${formatCurrency(totalProfit)}`;
    document.getElementById('total-return').textContent = formatPercent(totalReturn);

    container.innerHTML = DB.investments.map(inv => {
        const profit = inv.currentValue - inv.amount;
        const returnRate = ((profit / inv.amount) * 100) || 0;
        
        return `
            <div class="investment-item">
                <div class="investment-header">
                    <h4 class="investment-name">${escapeHTML(inv.name)}</h4>
                    <div class="item-header-right">
                        <span class="investment-type">${escapeHTML(INVESTMENT_TYPES[inv.type] || inv.type)}</span>
                        ${itemActions('investments', inv.id)}
                    </div>
                </div>
                <div class="investment-details">
                    <div class="investment-detail">
                        <span class="investment-detail-label">Investido</span>
                        <span class="investment-detail-value">${formatCurrency(inv.amount)}</span>
                    </div>
                    <div class="investment-detail">
                        <span class="investment-detail-label">Valor Atual</span>
                        <span class="investment-detail-value">${formatCurrency(inv.currentValue)}</span>
                    </div>
                    <div class="investment-detail">
                        <span class="investment-detail-label">Rendimento</span>
                        <span class="investment-detail-value" style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                            ${formatCurrency(profit)} (${formatPercent(returnRate)})
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
}

// ========== CARTÕES DE CRÉDITO ==========
async function handleAddCreditCard(e) {
    e.preventDefault();

    const cardName = document.getElementById('card-name').value.trim();
    const description = document.getElementById('card-description').value.trim();
    const totalAmount = parseAmount(document.getElementById('card-amount').value);
    const date = document.getElementById('card-date').value;
    const installments = parseInt(document.getElementById('card-installments').value, 10);
    const category = document.getElementById('card-category').value;

    if (!cardName || !description || !(totalAmount > 0) || !date || !(installments >= 1)) {
        notify.error('Preencha todos os campos obrigatórios');
        return;
    }

    try {
        const { created } = await saveRecord('creditCards', {
            cardName, description, totalAmount,
            installmentAmount: totalAmount / installments,
            date, installments, category
        });
        notify.success(created ? 'Compra adicionada com sucesso!' : 'Compra atualizada!');
        EDITABLE.creditCards.refresh();
    } catch (error) {
        console.error('Erro ao salvar compra:', error);
        notify.error('Erro ao salvar compra');
    }
}

function updateCreditCardsList() {
    const container = document.getElementById('credit-cards-list');
    if (!container) return;
    
    if (DB.creditCards.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-credit-card"></i>
                <p>Nenhuma compra registrada</p>
            </div>
        `;
        return;
    }

    container.innerHTML = DB.creditCards.map(card => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-icon expense">
                    <i class="fas fa-credit-card"></i>
                </div>
                <div class="transaction-details">
                    <h4>${escapeHTML(card.cardName)} - ${escapeHTML(card.description)}</h4>
                    <p>${escapeHTML(card.category)}</p>
                    <small>${formatDate(card.date)} - ${card.installments}x de ${formatCurrency(card.installmentAmount)}</small>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <div class="transaction-amount expense">
                    ${formatCurrency(card.totalAmount)}
                </div>
                ${itemActions('creditCards', card.id)}
            </div>
        </div>
    `).join('');
}

// ========== CONTAS MENSAIS ==========
async function handleAddBill(e) {
    e.preventDefault();

    const type = document.getElementById('bill-type').value;
    const amount = parseAmount(document.getElementById('bill-amount').value);
    const dueDay = parseInt(document.getElementById('bill-due-day').value, 10);
    const notes = document.getElementById('bill-notes').value.trim();

    if (!type || !(amount > 0) || !(dueDay >= 1 && dueDay <= 31)) {
        notify.error('Preencha todos os campos obrigatórios');
        return;
    }

    try {
        // Ao editar, status e histórico de pagamentos são preservados.
        const { created } = await saveRecord('monthlyBills', { type, amount, dueDay, notes },
            { status: 'pending', payments: [] });
        notify.success(created ? 'Conta adicionada com sucesso!' : 'Conta atualizada!');
        EDITABLE.monthlyBills.refresh();
    } catch (error) {
        console.error('Erro ao salvar conta:', error);
        notify.error('Erro ao salvar conta');
    }
}

async function markBillAsPaid(billId, month, year) {
    try {
        const userId = window.auth.currentUser.uid;
        const bill = DB.monthlyBills.find(b => b.id === billId);
        
        if (!bill) return;
        
        const payment = {
            month,
            year,
            paidAt: new Date().toISOString(),
            amount: bill.amount
        };
        
        if (!bill.payments) bill.payments = [];
        bill.payments.push(payment);
        
        await window.db.collection('users').doc(userId)
            .collection('monthlyBills').doc(billId)
            .update({
                payments: firebase.firestore.FieldValue.arrayUnion(payment)
            });
        
        updateBillsList();
        notify.success('Conta marcada como paga!');
        
    } catch (error) {
        console.error('Erro ao marcar conta como paga:', error);
    }
}

function getBillStatus(bill) {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const isPaid = bill.payments?.some(p => 
        p.month === currentMonth && p.year === currentYear
    );
    
    if (isPaid) {
        return { status: 'paid', text: 'Pago', class: 'success' };
    }
    
    if (currentDay > bill.dueDay) {
        return { status: 'overdue', text: 'Atrasado', class: 'danger' };
    }
    
    const daysUntilDue = bill.dueDay - currentDay;
    if (daysUntilDue <= 3) {
        return { status: 'warning', text: 'Vence em breve', class: 'warning' };
    }
    
    return { status: 'pending', text: 'Pendente', class: 'info' };
}

function checkBillsAlerts() {
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) return;
    
    const now = new Date();
    const currentDay = now.getDate();
    
    const overdueBills = DB.monthlyBills.filter(bill => {
        const status = getBillStatus(bill);
        return status.status === 'overdue';
    });
    
    const upcomingBills = DB.monthlyBills.filter(bill => {
        const status = getBillStatus(bill);
        return status.status === 'warning';
    });
    
    let alerts = '';
    
    if (overdueBills.length > 0) {
        alerts += `
            <div class="alert alert-error" style="margin-bottom: 16px;">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Atenção!</strong> Você tem ${overdueBills.length} conta(s) em atraso.
                    <button class="link-btn" data-page="bills" style="margin-left: 8px; color: inherit; text-decoration: underline;">
                        Ver contas
                    </button>
                </div>
            </div>
        `;
    }
    
    if (upcomingBills.length > 0) {
        alerts += `
            <div class="alert alert-warning" style="margin-bottom: 16px;">
                <i class="fas fa-clock"></i>
                <div>
                    <strong>Lembrete:</strong> ${upcomingBills.length} conta(s) vencem nos próximos 3 dias.
                    <button class="link-btn" data-page="bills" style="margin-left: 8px; color: inherit; text-decoration: underline;">
                        Ver contas
                    </button>
                </div>
            </div>
        `;
    }
    
    alertsContainer.innerHTML = alerts;
    
    // Re-attach event listeners
    document.querySelectorAll('#alerts-container .link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            if (page) navigateTo(page);
        });
    });
}

function updateBillsList() {
    const container = document.getElementById('bills-list');
    if (!container) return;
    
    if (DB.monthlyBills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-invoice-dollar"></i>
                <p>Nenhuma conta cadastrada</p>
            </div>
        `;
        return;
    }

    const totalBills = DB.monthlyBills.reduce((sum, b) => sum + b.amount, 0);
    document.getElementById('total-bills').textContent = `${formatCurrency(totalBills)}`;
    document.getElementById('bills-count').textContent = DB.monthlyBills.length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    container.innerHTML = DB.monthlyBills.map(bill => {
        const status = getBillStatus(bill);
        const isPaid = status.status === 'paid';
        
        return `
            <div class="bill-item">
                <div class="transaction-info">
                    <div class="transaction-icon expense">
                        <i class="fas fa-file-invoice-dollar"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${escapeHTML(bill.type)}</h4>
                        <p>${escapeHTML(bill.notes || 'Sem observações')}</p>
                        <small>Vencimento: dia ${bill.dueDay}</small>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <div class="transaction-amount expense">
                        ${formatCurrency(bill.amount)}
                    </div>
                    <span class="bill-status ${status.class}">
                        <i class="fas fa-${status.status === 'paid' ? 'check-circle' : status.status === 'overdue' ? 'exclamation-circle' : 'clock'}"></i>
                        ${status.text}
                    </span>
                    ${!isPaid ? `
                        <button class="btn-mark-paid" onclick="markBillAsPaid('${escapeHTML(bill.id)}', ${currentMonth}, ${currentYear})">
                            <i class="fas fa-check"></i> Marcar como Pago
                        </button>
                    ` : ''}
                    ${itemActions('monthlyBills', bill.id)}
                </div>
            </div>
        `;
    }).join('');
    
    updateBillsCalendar();
}

function updateBillsCalendar() {
    const container = document.getElementById('bills-calendar');
    if (!container) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    const billsByDay = {};
    
    DB.monthlyBills.forEach(bill => {
        if (!billsByDay[bill.dueDay]) {
            billsByDay[bill.dueDay] = [];
        }
        billsByDay[bill.dueDay].push(bill);
    });
    
    const days = Object.keys(billsByDay).sort((a, b) => a - b);
    
    if (days.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary);">Nenhum vencimento neste mês</p>`;
        return;
    }
    
    container.innerHTML = `
        <h4 style="margin-bottom: 16px; color: var(--text-primary);">${monthName}</h4>
        ${days.map(day => {
            const bills = billsByDay[day];
            const total = bills.reduce((sum, b) => sum + b.amount, 0);
            
            return `
                <div class="calendar-day-item">
                    <div class="calendar-day-header">
                        <span class="calendar-day-number">Dia ${day}</span>
                        <span class="calendar-day-total">${formatCurrency(total)}</span>
                    </div>
                    <div class="calendar-day-bills">
                        ${bills.map(bill => {
                            const status = getBillStatus(bill);
                            return `<span class="calendar-bill-tag ${status.class}">${escapeHTML(bill.type)}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

// ========== CATEGORIAS ==========
async function handleAddCategory() {
    const name = document.getElementById('new-category-name').value;
    const type = document.getElementById('new-category-type').value;

    if (!name || !type) {
        notify.error('Preencha todos os campos');
        return;
    }

    try {
        const userId = window.auth.currentUser.uid;
        
        const docRef = await window.db.collection('users').doc(userId)
            .collection('categories').add({
                name,
                type,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        DB.categories.push({
            id: docRef.id,
            name,
            type
        });
        
        notify.success('Categoria adicionada com sucesso!');
        document.getElementById('new-category-name').value = '';
        updateCategoriesList();
        loadCategories();
        
    } catch (error) {
        console.error('Erro ao adicionar categoria:', error);
    }
}

function updateCategoriesList() {
    const container = document.getElementById('categories-list');
    if (!container) return;
    
    if (DB.categories.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary);">Nenhuma categoria cadastrada</p>`;
        return;
    }

    container.innerHTML = DB.categories.map(cat => `
        <div class="category-item">
            <div class="category-info">
                <span>${escapeHTML(cat.name)}</span>
                <span class="category-badge ${cat.type}">${cat.type === 'income' ? 'Receita' : 'Despesa'}</span>
            </div>
            ${cat.id ? `<button type="button" class="icon-btn danger" data-action="delete-category" data-id="${escapeHTML(cat.id)}" title="Excluir categoria" aria-label="Excluir categoria"><i class="fas fa-trash"></i></button>` : ''}
        </div>
    `).join('');
}

function loadCategories() {
    const select = document.getElementById('transaction-category');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    
    DB.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

// ========== RELATÓRIOS ==========
function updateReports() {
    const totals = calculateTotals();
    
    document.getElementById('report-income').textContent = `${formatCurrency(totals.income)}`;
    document.getElementById('report-expense').textContent = `${formatCurrency(totals.expense)}`;
    document.getElementById('report-balance').textContent = `${formatCurrency(totals.balance)}`;
    
    // Atualizar gráficos da página de relatórios
    if (typeof updateAllCharts === 'function') {
        updateAllCharts();
    }
}

// ========== BACKUP ==========
function handleBackup() {
    const data = {
        transactions: DB.transactions,
        budgets: DB.budgets,
        goals: DB.goals,
        investments: DB.investments,
        creditCards: DB.creditCards,
        monthlyBills: DB.monthlyBills,
        categories: DB.categories
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fincontrol-backup-${todayISO()}.json`;
    link.click();
    
    notify.success('Backup realizado com sucesso!');
}

const USER_COLLECTIONS = ['transactions', 'budgets', 'goals', 'investments', 'creditCards', 'monthlyBills', 'categories'];

// Apaga todos os documentos das coleções do usuário no Firestore.
async function deleteAllUserDocs(userId) {
    const refs = [];
    for (const collection of USER_COLLECTIONS) {
        const snapshot = await window.db.collection('users').doc(userId).collection(collection).get();
        snapshot.docs.forEach(doc => refs.push(doc.ref));
    }
    await commitInChunks(refs, (batch, ref) => batch.delete(ref));
}

// Grava as categorias padrão no Firestore e devolve a lista com ids.
async function seedDefaultCategories(userId) {
    const colRef = window.db.collection('users').doc(userId).collection('categories');
    const items = DEFAULT_CATEGORIES.map(cat => ({ ref: colRef.doc(), ...cat }));
    await commitInChunks(items, (batch, it) => batch.set(it.ref, {
        name: it.name,
        type: it.type,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }));
    return items.map(it => ({ id: it.ref.id, name: it.name, type: it.type }));
}

// Re-renderiza a página que está aberta.
function refreshCurrentPage() {
    const active = document.querySelector('.nav-item.active[data-page]');
    navigateTo(active ? active.dataset.page : 'dashboard');
}

function handleRestore(e) {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        let data;
        try {
            data = JSON.parse(event.target.result);
            const valid = data && typeof data === 'object' && !Array.isArray(data) &&
                USER_COLLECTIONS.some(c => Array.isArray(data[c])) &&
                USER_COLLECTIONS.every(c => data[c] === undefined || Array.isArray(data[c]));
            if (!valid) throw new Error('Formato inválido');
        } catch (error) {
            notify.error('Erro ao restaurar backup. Arquivo inválido.');
            input.value = '';
            return;
        }

        if (!confirm('Tem certeza que deseja restaurar este backup? Os dados atuais serão substituídos.')) {
            input.value = '';
            return;
        }

        try {
            const userId = window.auth.currentUser.uid;
            notify.info('Restaurando backup, aguarde…');

            await deleteAllUserDocs(userId);

            // Grava cada item no Firestore, mantendo o id original quando existir.
            const writes = [];
            const restored = {};
            for (const collection of USER_COLLECTIONS) {
                restored[collection] = [];
                const items = Array.isArray(data[collection]) ? data[collection] : [];
                const colRef = window.db.collection('users').doc(userId).collection(collection);
                items.forEach(item => {
                    if (!item || typeof item !== 'object') return;
                    const { id, userId: _ignored, createdAt: _created, ...fields } = item;
                    const ref = (typeof id === 'string' && id && !id.includes('/')) ? colRef.doc(id) : colRef.doc();
                    writes.push({ ref, fields });
                    restored[collection].push(collection === 'categories'
                        ? { id: ref.id, ...fields }
                        : { id: ref.id, userId, ...fields });
                });
            }
            await commitInChunks(writes, (batch, w) => batch.set(w.ref, {
                ...w.fields,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }));

            DB.transactions = restored.transactions;
            DB.budgets = restored.budgets;
            DB.goals = restored.goals;
            DB.investments = restored.investments;
            DB.creditCards = restored.creditCards;
            DB.monthlyBills = restored.monthlyBills;
            DB.categories = restored.categories.length ? restored.categories : await seedDefaultCategories(userId);

            notify.success('Backup restaurado com sucesso!');
            refreshCurrentPage();
        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            notify.error('Erro ao salvar o backup na nuvem. Recarregue a página e tente novamente.');
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
}

async function handleClearData() {
    if (!confirm('⚠️ ATENÇÃO! Esta ação irá apagar TODOS os seus dados permanentemente. Deseja continuar?')) {
        return;
    }

    if (!confirm('Tem CERTEZA ABSOLUTA? Esta ação NÃO pode ser desfeita!')) {
        return;
    }

    try {
        const userId = window.auth.currentUser.uid;

        await deleteAllUserDocs(userId);

        // Limpar dados locais
        DB.transactions = [];
        DB.budgets = [];
        DB.goals = [];
        DB.investments = [];
        DB.creditCards = [];
        DB.monthlyBills = [];
        DB.categories = await seedDefaultCategories(userId);

        notify.success('Todos os dados foram apagados com sucesso!');
        refreshCurrentPage();

    } catch (error) {
        console.error('Erro ao limpar dados:', error);
        notify.error('Erro ao limpar dados');
    }
}

// ========== EDIÇÃO E EXCLUSÃO ==========
// Cada coleção editável: formulário, campos (propriedade -> id do input),
// rótulo para mensagens e função que re-renderiza as telas afetadas.
const EDITABLE = {
    transactions: {
        form: 'transaction-form', label: 'Lançamento',
        fields: { type: 'transaction-type', amount: 'transaction-amount', category: 'transaction-category', date: 'transaction-date', description: 'transaction-description' },
        name: t => `${t.category} — ${formatCurrency(t.amount)}`,
        refresh: () => { updateTransactionsList(); updateDashboard(); }
    },
    budgets: {
        form: 'budget-form', label: 'Orçamento',
        fields: { category: 'budget-category', amount: 'budget-amount' },
        name: b => b.category,
        refresh: () => updateBudgetsList()
    },
    goals: {
        form: 'goal-form', label: 'Meta',
        fields: { name: 'goal-name', targetAmount: 'goal-amount', currentAmount: 'goal-current', deadline: 'goal-deadline' },
        name: g => g.name,
        refresh: () => { updateGoalsList(); updateGoalsPreview(); }
    },
    investments: {
        form: 'investment-form', label: 'Investimento',
        fields: { name: 'investment-name', type: 'investment-type', amount: 'investment-amount', currentValue: 'investment-current', date: 'investment-date', yieldRate: 'investment-yield' },
        name: i => i.name,
        refresh: () => updateInvestmentsList()
    },
    creditCards: {
        form: 'credit-card-form', label: 'Compra',
        fields: { cardName: 'card-name', description: 'card-description', totalAmount: 'card-amount', date: 'card-date', installments: 'card-installments', category: 'card-category' },
        name: c => `${c.cardName} — ${c.description}`,
        refresh: () => updateCreditCardsList()
    },
    monthlyBills: {
        form: 'bill-form', label: 'Conta',
        fields: { type: 'bill-type', amount: 'bill-amount', dueDay: 'bill-due-day', notes: 'bill-notes' },
        name: b => b.type,
        refresh: () => { updateBillsList(); checkBillsAlerts(); }
    }
};

// Coleção/id em edição (null quando o formulário está em modo "adicionar").
const editing = { collection: null, id: null };

function formatCurrency(value) {
    return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value) {
    return `${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

// Lê valores digitados aceitando vírgula como separador decimal ("12,50").
function parseAmount(value) {
    if (typeof value === 'number') return value;
    const s = String(value ?? '').trim().replace(/\s|R\$/g, '');
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    return parseFloat(normalized);
}

// Botões de editar/excluir exibidos em cada item das listas.
function itemActions(collection, id, extra = '') {
    const safeId = escapeHTML(id);
    return `
        <div class="item-actions">
            ${extra}
            <button type="button" class="icon-btn" data-action="edit" data-collection="${collection}" data-id="${safeId}" title="Editar" aria-label="Editar">
                <i class="fas fa-pen"></i>
            </button>
            <button type="button" class="icon-btn danger" data-action="delete" data-collection="${collection}" data-id="${safeId}" title="Excluir" aria-label="Excluir">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
}

// Grava um registro: atualiza se o formulário estiver em edição, senão cria.
async function saveRecord(collection, data, defaultsOnCreate = {}) {
    const userId = window.auth.currentUser.uid;
    const colRef = window.db.collection('users').doc(userId).collection(collection);
    const list = DB[collection];

    if (editing.collection === collection && editing.id) {
        const id = editing.id;
        await colRef.doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const index = list.findIndex(item => item.id === id);
        if (index >= 0) list[index] = { ...list[index], ...data };
        cancelEdit(collection);
        return { id, created: false };
    }

    const record = { ...defaultsOnCreate, ...data };
    const docRef = await colRef.add({
        ...record,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    list.push({ id: docRef.id, userId, ...record });
    document.getElementById(EDITABLE[collection].form)?.reset();
    return { id: docRef.id, created: true };
}

function setFieldValue(inputId, value) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const v = value ?? '';
    // Garante que o valor salvo exista no <select> (ex.: categoria removida).
    if (el.tagName === 'SELECT' && v !== '' && ![...el.options].some(o => o.value === String(v))) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        el.appendChild(opt);
    }
    el.value = v;
}

function startEdit(collection, id) {
    const config = EDITABLE[collection];
    const item = DB[collection].find(x => x.id === id);
    if (!config || !item) return;

    if (editing.collection && editing.collection !== collection) cancelEdit(editing.collection);
    if (collection === 'transactions') loadCategories();

    Object.entries(config.fields).forEach(([prop, inputId]) => setFieldValue(inputId, item[prop]));

    editing.collection = collection;
    editing.id = id;

    const form = document.getElementById(config.form);
    const card = form.closest('.card');
    const title = card?.querySelector('.card-title');
    const submit = form.querySelector('button[type="submit"]');

    if (title && !title.dataset.original) title.dataset.original = title.innerHTML;
    if (title) title.innerHTML = `<i class="fas fa-pen"></i> Editar ${config.label.toLowerCase()}`;
    if (submit && !submit.dataset.original) submit.dataset.original = submit.innerHTML;
    if (submit) submit.innerHTML = '<i class="fas fa-save"></i> Salvar alterações';

    if (!form.querySelector('.btn-cancel-edit')) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-ghost form-full btn-cancel-edit';
        cancel.innerHTML = '<i class="fas fa-times"></i> Cancelar edição';
        cancel.addEventListener('click', () => cancelEdit(collection));
        form.appendChild(cancel);
    }
    card?.classList.add('is-editing');
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.querySelector('input, select, textarea')?.focus({ preventScroll: true });
}

function cancelEdit(collection) {
    const config = EDITABLE[collection];
    if (!config) return;
    const form = document.getElementById(config.form);
    if (form) {
        form.reset();
        const card = form.closest('.card');
        const title = card?.querySelector('.card-title');
        const submit = form.querySelector('button[type="submit"]');
        if (title?.dataset.original) title.innerHTML = title.dataset.original;
        if (submit?.dataset.original) submit.innerHTML = submit.dataset.original;
        form.querySelector('.btn-cancel-edit')?.remove();
        card?.classList.remove('is-editing');
    }
    if (editing.collection === collection) {
        editing.collection = null;
        editing.id = null;
    }
}

async function deleteRecord(collection, id) {
    const config = EDITABLE[collection];
    const item = DB[collection]?.find(x => x.id === id);
    if (!config || !item) return;

    if (!confirm(`Excluir ${config.label.toLowerCase()} "${config.name(item)}"? Esta ação não pode ser desfeita.`)) return;

    try {
        const userId = window.auth.currentUser.uid;
        await window.db.collection('users').doc(userId).collection(collection).doc(id).delete();
        DB[collection] = DB[collection].filter(x => x.id !== id);
        if (editing.collection === collection && editing.id === id) cancelEdit(collection);
        config.refresh();
        notify.success(`${config.label} excluído(a).`);
    } catch (error) {
        console.error('Erro ao excluir:', error);
        notify.error('Erro ao excluir. Tente novamente.');
    }
}

// Adiciona um valor ao que já foi guardado em uma meta.
async function addToGoal(id) {
    const goal = DB.goals.find(g => g.id === id);
    if (!goal) return;
    const input = prompt(`Quanto você quer adicionar à meta "${goal.name}"? (use valor negativo para retirar)`, '');
    if (input === null) return;
    const value = parseAmount(input);
    if (!Number.isFinite(value) || value === 0) {
        notify.error('Informe um valor válido.');
        return;
    }
    const currentAmount = Math.max(0, Math.round(((goal.currentAmount || 0) + value) * 100) / 100);
    try {
        const userId = window.auth.currentUser.uid;
        await window.db.collection('users').doc(userId).collection('goals').doc(id).update({
            currentAmount,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        goal.currentAmount = currentAmount;
        EDITABLE.goals.refresh();
        notify.success(currentAmount >= goal.targetAmount
            ? `🎉 Meta "${goal.name}" atingida!`
            : `Meta atualizada: ${formatCurrency(currentAmount)} de ${formatCurrency(goal.targetAmount)}.`);
    } catch (error) {
        console.error('Erro ao atualizar meta:', error);
        notify.error('Erro ao atualizar a meta.');
    }
}

// Exclui uma categoria criada pelo usuário (lançamentos antigos mantêm o nome).
async function deleteCategory(id) {
    const cat = DB.categories.find(c => c.id === id);
    if (!cat) return;
    if (!confirm(`Excluir a categoria "${cat.name}"? Os lançamentos já registrados continuam com esse nome.`)) return;
    try {
        const userId = window.auth.currentUser.uid;
        await window.db.collection('users').doc(userId).collection('categories').doc(id).delete();
        DB.categories = DB.categories.filter(c => c.id !== id);
        updateCategoriesList();
        loadCategories();
        notify.success('Categoria excluída.');
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        notify.error('Erro ao excluir categoria.');
    }
}

// Um único listener para todos os botões de ação das listas.
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, collection, id } = btn.dataset;
    if (action === 'edit') startEdit(collection, id);
    else if (action === 'delete') deleteRecord(collection, id);
    else if (action === 'goal-add') addToGoal(id);
    else if (action === 'delete-category') deleteCategory(id);
});

// ========== FUNÇÕES AUXILIARES ==========
function showAlert(id, message) {
    const alert = document.getElementById(id);
    if (alert) {
        alert.textContent = message;
        alert.classList.remove('hidden');
    }
}

function hideAlert(id) {
    const alert = document.getElementById(id);
    if (alert) {
        alert.classList.add('hidden');
    }
}

function formatDate(dateString) {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    });
}

// ========== SENHA ==========
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function checkPasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    let strength = {
        text: '',
        class: '',
        score: score
    };
    
    if (score <= 2) {
        strength.text = '⚠️ Senha fraca';
        strength.class = 'weak';
    } else if (score <= 4) {
        strength.text = '⚡ Senha média';
        strength.class = 'medium';
    } else {
        strength.text = '✅ Senha forte';
        strength.class = 'strong';
    }
    
    return strength;
}

// ========== TERMOS E PRIVACIDADE ==========
function showTerms() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>📜 Termos de Uso</h2>
            </div>
            <div class="modal-body">
                <h3>1. Aceitação dos Termos</h3>
                <p>Ao usar o FinControl Pro, você concorda com estes termos.</p>
                
                <h3>2. Uso do Serviço</h3>
                <p>O FinControl Pro é uma ferramenta de gestão financeira pessoal.</p>
                
                <h3>3. Privacidade</h3>
                <p>Seus dados são privados e criptografados.</p>
                
                <h3>4. Contato</h3>
                <p>felipe.pessoall2026@gmail.com</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
}

function showPrivacy() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔒 Política de Privacidade</h2>
            </div>
            <div class="modal-body">
                <h3>1. Coleta de Dados</h3>
                <p>Coletamos: nome, email e dados financeiros.</p>
                
                <h3>2. Uso dos Dados</h3>
                <p>Para fornecer funcionalidades do app.</p>
                
                <h3>3. Segurança</h3>
                <p>Dados criptografados e protegidos.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
}

// ========== TEMA ==========
function loadTheme() {
    const savedTheme = localStorage.getItem('fincontrol-theme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const body = document.body;
    const html = document.documentElement;
    const themeIcon = document.querySelector('#theme-toggle i');
    
    body.classList.remove('light-theme', 'dark-theme');
    html.classList.remove('light-theme', 'dark-theme');
    
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
    
    if (theme === 'auto') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.classList.add(isDark ? 'dark-theme' : 'light-theme');
        html.classList.add(isDark ? 'dark-theme' : 'light-theme');
        if (themeIcon) {
            themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    } else {
        body.classList.add(`${theme}-theme`);
        html.classList.add(`${theme}-theme`);
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

// Keep the automatic theme synchronized when the operating system preference changes.
(function syncSystemThemePreference() {
    if (!window.matchMedia) return;

    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
        if (localStorage.getItem('fincontrol-theme') === 'auto') {
            applyTheme('auto');
        }
    };

    if (typeof colorSchemeQuery.addEventListener === 'function') {
        colorSchemeQuery.addEventListener('change', syncTheme);
    } else if (typeof colorSchemeQuery.addListener === 'function') {
        // Compatibility with older browsers.
        colorSchemeQuery.addListener(syncTheme);
    }
})();

console.log('✅ FinControl Pro v4.0 carregado!');
