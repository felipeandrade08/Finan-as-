// =============================================
// FINCONTROL PRO v3.5 - COM FIREBASE
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
let charts = {};

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== FINCONTROL PRO INICIANDO ===');
    
    // Carregar tema
    loadTheme();
    
    // Setup de listeners (exceto Firebase auth que vai ser configurado depois)
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
    document.getElementById('invite-family-btn')?.addEventListener('click', handleInviteFamily);

    // Recurring checkbox
    document.getElementById('transaction-recurring')?.addEventListener('change', (e) => {
        const recurringOptions = document.getElementById('recurring-options');
        if (recurringOptions) {
            if (e.target.checked) {
                recurringOptions.classList.remove('hidden');
            } else {
                recurringOptions.classList.add('hidden');
            }
        }
    });

    // Categories
    document.getElementById('manage-categories-btn')?.addEventListener('click', () => {
        navigateTo('settings');
    });
    document.getElementById('add-category-btn')?.addEventListener('click', handleAddCategory);

    // Export buttons
    document.getElementById('export-pdf-btn')?.addEventListener('click', exportToPDF);
    document.getElementById('export-excel-btn')?.addEventListener('click', exportToExcel);

    // Backup buttons
    document.getElementById('backup-btn')?.addEventListener('click', handleBackup);
    document.getElementById('restore-btn')?.addEventListener('change', handleRestore);
    document.getElementById('clear-data-btn')?.addEventListener('click', handleClearData);

    // PWA Install
    document.getElementById('install-pwa-btn')?.addEventListener('click', handleInstallPWA);

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

    // Validações
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
        // Criar usuário no Firebase Auth
        const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Atualizar perfil
        await user.updateProfile({ displayName: name });
        
        // Salvar dados adicionais no Firestore
        await window.db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Inicializar categorias padrão
        const batch = window.db.batch();
        DEFAULT_CATEGORIES.forEach((cat, index) => {
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
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
        'auth/network-request-failed': 'Erro de conexão. Verifique sua internet'
    };
    
    return errors[errorCode] || 'Erro desconhecido. Tente novamente';
}

// ========== CARREGAR DADOS DO FIREBASE ==========
async function loadUserDataFromFirebase(userId) {
    try {
        console.log('📊 Carregando dados do Firebase...');
        
        // Carregar categorias
        const categoriesSnap = await window.db.collection('users').doc(userId)
            .collection('categories').get();
        
        if (!categoriesSnap.empty) {
            DB.categories = categoriesSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            DB.categories = DEFAULT_CATEGORIES;
        }
        
        // Carregar transações
        const transactionsSnap = await window.db.collection('users').doc(userId)
            .collection('transactions').get();
        
        DB.transactions = transactionsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        // Carregar orçamentos
        const budgetsSnap = await window.db.collection('users').doc(userId)
            .collection('budgets').get();
        
        DB.budgets = budgetsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        // Carregar metas
        const goalsSnap = await window.db.collection('users').doc(userId)
            .collection('goals').get();
        
        DB.goals = goalsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        // Carregar investimentos
        const investmentsSnap = await window.db.collection('users').doc(userId)
            .collection('investments').get();
        
        DB.investments = investmentsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        // Carregar cartões
        const cardsSnap = await window.db.collection('users').doc(userId)
            .collection('creditCards').get();
        
        DB.creditCards = cardsSnap.docs.map(doc => ({
            id: doc.id,
            userId: userId,
            ...doc.data()
        }));
        
        // Carregar contas mensais
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
        case 'family':
            updateFamilyMembersList();
            break;
        case 'settings':
            updateCategoriesList();
            loadCategories();
            break;
    }
}

// Continuação no próximo bloco...
// =============================================
// FINCONTROL PRO v3.5 - PARTE 2
// COLE ESTE CÓDIGO NO FINAL DO app.js
// =============================================

// ========== TRANSAÇÕES ==========
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

    try {
        const userId = window.auth.currentUser.uid;
        
        // Adicionar ao Firestore
        const docRef = await window.db.collection('users').doc(userId)
            .collection('transactions').add({
                type,
                amount,
                category,
                date,
                description,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Adicionar ao DB local
        DB.transactions.push({
            id: docRef.id,
            userId,
            type,
            amount,
            category,
            date,
            description
        });
        
        showAlert('transaction-success', 'Transação adicionada com sucesso!');
        document.getElementById('transaction-form').reset();
        updateTransactionsList();
        updateDashboard();
        
        setTimeout(() => hideAlert('transaction-success'), 3000);
        
    } catch (error) {
        console.error('Erro ao adicionar transação:', error);
        showAlert('transaction-error', 'Erro ao salvar transação');
    }
}

function updateTransactionsList() {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    
    const transactions = DB.transactions;

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-invoice"></i>
                <p>Nenhuma transação registrada</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.slice().reverse().map(t => `
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

// ========== DASHBOARD ==========
function updateDashboard() {
    const totals = calculateTotals();
    
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
    if (balanceCard) {
        if (totals.balance < 0) {
            balanceCard.classList.add('negative');
        } else {
            balanceCard.classList.remove('negative');
        }
    }
    
    updateRecentTransactions();
    updateGoalsPreview();
    updateEvolutionChart();
}

function updateRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    if (!container) return;
    
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
    
    return transactions.filter(t => new Date(t.date) >= startDate);
}

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
    const date = new Date(dateString);
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
                <p>felipe.andrade.dev@email.com</p>
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
    const themeIcon = document.querySelector('#theme-toggle i');
    
    body.classList.remove('light-theme', 'dark-theme');
    
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

// ========== CATEGORIAS ==========
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

// ========== STUBS DAS OUTRAS FUNÇÕES ==========
// Adicione aqui as funções restantes conforme necessário

function handleAddBudget(e) { e.preventDefault(); console.log('Budget - implementar'); }
function handleAddGoal(e) { e.preventDefault(); console.log('Goal - implementar'); }
function handleAddInvestment(e) { e.preventDefault(); console.log('Investment - implementar'); }
function handleAddCreditCard(e) { e.preventDefault(); console.log('Card - implementar'); }
function handleAddBill(e) { e.preventDefault(); console.log('Bill - implementar'); }
function handleInviteFamily() { console.log('Family - implementar'); }
function handleAddCategory() { console.log('Category - implementar'); }
function exportToPDF() { console.log('PDF - implementar'); }
function exportToExcel() { console.log('Excel - implementar'); }
function handleBackup() { console.log('Backup - implementar'); }
function handleRestore() { console.log('Restore - implementar'); }
function handleClearData() { console.log('Clear - implementar'); }
function handleInstallPWA() { console.log('PWA - implementar'); }
function updateBudgetsList() { console.log('Budgets list'); }
function updateGoalsList() { console.log('Goals list'); }
function updateGoalsPreview() { console.log('Goals preview'); }
function updateInvestmentsList() { console.log('Investments list'); }
function updateCreditCardsList() { console.log('Cards list'); }
function updateBillsList() { console.log('Bills list'); }
function updateFamilyMembersList() { console.log('Family list'); }
function updateCategoriesList() { console.log('Categories list'); }
function updateReports() { console.log('Reports'); }
function updateEvolutionChart() { console.log('Chart'); }

console.log('✅ FinControl Pro carregado!');
