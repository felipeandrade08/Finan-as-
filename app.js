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
    recurring: [],
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
let transactionsLimit = 30;
let budgetMonthOffset = 0; // 0 = mês atual, -1 = mês passado...

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
                try {
                    await syncRecurring();
                } catch (error) {
                    console.error('Erro ao gerar lançamentos fixos:', error);
                }
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

    // Barra de abas do celular
    document.querySelectorAll('.tab-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });
    document.getElementById('tab-add')?.addEventListener('click', openNewTransaction);
    document.getElementById('tab-more')?.addEventListener('click', () => {
        if (typeof openMenu === 'function') openMenu();
    });

    // Botões dentro de listas vazias ("Fazer o primeiro lançamento" etc.)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-goto]');
        if (!target) return;
        if (target.dataset.goto === 'transactions') openNewTransaction();
        else navigateTo(target.dataset.goto);
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
    setupCollapsibleForms();
    document.getElementById('budgets-month-nav')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-month]');
        if (!btn || btn.disabled) return;
        budgetMonthOffset = Math.min(0, budgetMonthOffset + (btn.dataset.month === 'next' ? 1 : -1));
        updateBudgetsList();
    });
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

// No celular, os formulários "Novo..." começam recolhidos para a lista aparecer primeiro.
const mobileQuery = window.matchMedia('(max-width: 900px)');

function setupCollapsibleForms() {
    document.querySelectorAll('.card > form.form-grid').forEach(form => {
        const card = form.parentElement;
        const title = card.querySelector('.card-title');
        if (!title || card.querySelector('.form-toggle')) return;
        card.classList.add('form-card');
        form.id ||= `form-${Math.random().toString(36).slice(2)}`;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'form-toggle';
        toggle.setAttribute('aria-controls', form.id);
        toggle.innerHTML = '<span class="form-toggle-text"></span><i class="fas fa-plus" aria-hidden="true"></i>';
        toggle.querySelector('.form-toggle-text').textContent = title.textContent.trim();
        toggle.addEventListener('click', () => setFormExpanded(card, card.classList.contains('is-collapsed')));
        title.after(toggle);
        setFormExpanded(card, !mobileQuery.matches);
    });
    mobileQuery.addEventListener?.('change', () => {
        document.querySelectorAll('.form-card').forEach(card => setFormExpanded(card, !mobileQuery.matches));
    });
}

function setFormExpanded(card, expanded) {
    if (!card?.classList.contains('form-card')) return;
    card.classList.toggle('is-collapsed', !expanded);
    card.querySelector('.form-toggle')?.setAttribute('aria-expanded', String(expanded));
}

// Abre Lançamentos com o formulário pronto para um novo registro.
function openNewTransaction() {
    navigateTo('transactions');
    const form = document.getElementById('transaction-form');
    setFormExpanded(form?.closest('.card'), true);
    form?.closest('.card')?.scrollIntoView({ block: 'start' });
    document.getElementById('transaction-type')?.focus({ preventScroll: true });
    const date = document.getElementById('transaction-date');
    if (date && !date.value) date.value = todayISO();
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
        
        try {
            const recurringSnap = await window.db.collection('users').doc(userId)
                .collection('recurring').get();
            DB.recurring = recurringSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            DB.recurring = [];
            console.warn('Lançamentos fixos indisponíveis (verifique as regras do Firestore):', error);
        }

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
    // Atalhos do app instalado: ./?action=transaction abre direto em Lançamentos.
    const action = new URLSearchParams(location.search).get('action');
    const shortcutPages = { transaction: 'transactions', dashboard: 'dashboard' };
    fillDefaultDates();
    navigateTo(shortcutPages[action] || 'dashboard');
    if (action) history.replaceState(null, '', location.pathname);
    if (action === 'transaction') {
        document.getElementById('transaction-form')?.closest('.card')?.scrollIntoView({ block: 'start' });
    }

    if (!navigator.onLine) {
        notify.warning('Você está offline. Seus dados serão carregados quando a conexão voltar.', 0);
    }
}

// Ao recuperar a conexão, recarrega os dados que podem não ter vindo offline.
window.addEventListener('online', async () => {
    if (!DB.currentUser || !window.auth?.currentUser) return;
    await loadUserDataFromFirebase(window.auth.currentUser.uid);
    await syncRecurring().catch(error => console.error(error));
    refreshCurrentPage();
    notify.success('Conexão restabelecida. Dados atualizados.');
});

window.addEventListener('offline', () => {
    if (DB.currentUser) notify.warning('Sem conexão. Alterações só poderão ser salvas quando a internet voltar.');
});

function navigateTo(page) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.add('hidden'));
    const pagEl = document.getElementById(`${page}-page`);
    if (pagEl) {
        pagEl.classList.remove('hidden');
    }
    
    document.querySelectorAll('.nav-item, .tab-item').forEach(item => {
        const isActive = item.dataset.page === page;
        item.classList.toggle('active', isActive);
        if (item.dataset.page) {
            if (isActive) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        }
    });
    if (typeof closeMenu === 'function') closeMenu();
    window.scrollTo({ top: 0 });

    switch(page) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'transactions':
            updateTransactionsList();
            updateRecurringList();
            loadCategories();
            break;
        case 'reports':
            updateReports();
            break;
        case 'budgets':
            budgetMonthOffset = 0;
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

    const repeat = document.getElementById('transaction-recurring');
    if (repeat?.checked && !(editing.collection === 'transactions' && editing.id)) {
        try {
            const count = await createRecurring({ type, amount, category, date, description });
            document.getElementById('transaction-form').reset();
            fillDefaultDates();
            const day = parseLocalDate(date).getDate();
            notify.success(count
                ? `Lançamento fixo criado. Ele se repete todo dia ${day}${count > 1 ? ` (${count} meses lançados desde o início)` : ''}.`
                : `Lançamento fixo criado. O primeiro aparece em ${formatDate(date)}.`);
            EDITABLE.transactions.refresh();
            updateRecurringList();
        } catch (error) {
            console.error('Erro ao criar lançamento fixo:', error);
            notify.error(error?.code === 'permission-denied'
                ? 'O Firestore recusou a coleção "recurring". Libere-a nas regras de segurança (veja o README).'
                : 'Erro ao criar lançamento fixo.');
        }
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
    const ledger = getLedger();
    const transactions = applyTransactionFilters(ledger);
    const filtersActive = ['filter-search', 'filter-type', 'filter-category', 'filter-month']
        .some(id => document.getElementById(id)?.value);
    document.getElementById('filter-clear')?.classList.toggle('hidden', !filtersActive);
    const summary = document.getElementById('transactions-summary');

    if (ledger.length === 0) {
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
            <span class="income">Entrou ${formatCurrency(income)}</span>
            <span class="expense">Saiu ${formatCurrency(expense)}</span>
            <span>Resultado ${formatCurrency(income - expense)}</span>`;
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

    // Mostra 30 por vez; "Mostrar mais" carrega o resto aos poucos.
    const ordered = sortByDate(transactions).reverse();
    const visible = ordered.slice(0, transactionsLimit);

    container.innerHTML = visible.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-icon ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'income' ? 'up' : 'down'}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${escapeHTML(t.description || t.category)}</h4>
                    <p>${escapeHTML(t.category)}${t.seriesId ? ' <span class="tag">Fixo</span>' : ''}</p>
                    <small>${formatDate(t.date)}</small>
                </div>
            </div>
            <div class="item-end">
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
                </div>
                ${t.virtual === 'card'
                    ? `<button type="button" class="tag-btn" data-goto="credit-cards" title="Parcela de compra no cartão ${escapeHTML(t.cardName)}"><i class="fas fa-credit-card" aria-hidden="true"></i> Cartão</button>`
                    : itemActions('transactions', t.id)}
            </div>
        </div>
    `).join('');

    if (ordered.length > visible.length) {
        container.insertAdjacentHTML('beforeend', `
            <div class="list-more">
                <button type="button" class="btn btn-ghost" id="transactions-more">
                    Mostrar mais (${ordered.length - visible.length} restantes)
                </button>
            </div>`);
        document.getElementById('transactions-more').addEventListener('click', () => {
            transactionsLimit += 30;
            updateTransactionsList();
        });
    }
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
    const names = [...new Set([...DB.categories.map(c => c.name), ...getLedger().map(t => t.category)])]
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
        el?.addEventListener(el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change', () => {
            transactionsLimit = 30;
            updateTransactionsList();
        });
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
    const period = getPeriodInfo();
    const negative = totals.balance < 0;

    // Destaque: quanto sobrou (ou faltou) no período escolhido.
    const label = document.getElementById('hero-label');
    if (label) label.textContent = `${negative ? 'Faltou' : 'Sobrou'} ${period.phrase}`;

    const amount = document.getElementById('total-balance');
    // "R$" menor que o número, para o valor ser o que se lê primeiro.
    const [symbol, number] = formatCurrency(Math.abs(totals.balance)).split(/\s/);
    amount.innerHTML = `<span class="hero-currency">${symbol}</span>${number}`;
    amount.classList.toggle('is-negative', negative);

    document.getElementById('total-income').textContent = formatCurrency(totals.income);
    document.getElementById('total-expense').textContent = formatCurrency(totals.expense);

    const spentRatio = totals.income > 0 ? totals.expense / totals.income : (totals.expense > 0 ? 1 : 0);
    document.getElementById('expense-percentage').textContent =
        totals.income > 0 ? `${Math.round(spentRatio * 100)}% do que entrou já saiu`
        : totals.expense > 0 ? 'Nenhuma entrada registrada no período'
        : 'Nenhum lançamento no período';

    // Guardado em metas no período: separado do que sobrou, sem contar como gasto.
    const saved = getSavedInGoals();
    const savedFigure = document.getElementById('saved-figure');
    if (savedFigure) {
        savedFigure.classList.toggle('hidden', DB.goals.length === 0);
        savedFigure.querySelector('dt').textContent = saved < 0 ? 'Retirado de metas' : 'Guardado em metas';
        document.getElementById('total-saved').textContent = formatCurrency(Math.abs(saved));
    }
    const free = document.getElementById('hero-free');
    if (free) {
        free.classList.toggle('hidden', saved <= 0 || negative);
        free.textContent = saved <= totals.balance
            ? `${formatCurrency(totals.balance - saved)} livres depois de guardar ${formatCurrency(saved)} nas metas`
            : `Você guardou ${formatCurrency(saved)} nas metas, mais do que sobrou ${getPeriodInfo().phrase}`;
    }

    const bar = document.getElementById('hero-bar');
    const spent = document.getElementById('hero-bar-spent');
    const savedBar = document.getElementById('hero-bar-saved');
    if (savedBar) {
        const spentPct = Math.min(spentRatio, 1) * 100;
        const savedPct = totals.income > 0 && saved > 0 ? Math.min((saved / totals.income) * 100, 100 - spentPct) : 0;
        savedBar.style.left = `${spentPct}%`;
        savedBar.style.width = `${savedPct}%`;
    }
    if (bar && spent) {
        spent.style.width = `${Math.min(spentRatio, 1) * 100}%`;
        bar.classList.toggle('is-over', spentRatio > 1);
        bar.classList.toggle('is-empty', totals.income === 0 && totals.expense === 0);
        bar.setAttribute('aria-label', totals.income === 0 && totals.expense === 0
            ? 'Sem lançamentos no período'
            : `Saiu ${formatCurrency(totals.expense)} de ${formatCurrency(totals.income)} que entrou`);
    }

    updateCategoryBreakdown();
    updateRecentTransactions();
    updateGoalsPreview();

    if (typeof updateAllCharts === 'function') {
        updateAllCharts();
    }

    if (typeof runAllNotificationChecks === 'function') {
        runAllNotificationChecks();
    }

    checkBillsAlerts();
}

// Texto do período atual ("este mês" vira "em novembro", etc.).
function getPeriodInfo() {
    const now = new Date();
    switch (currentFilter) {
        case 'week': return { phrase: 'nos últimos 7 dias' };
        case 'month': return { phrase: `em ${now.toLocaleDateString('pt-BR', { month: 'long' })}` };
        case 'year': return { phrase: `em ${now.getFullYear()}` };
        default: return { phrase: 'desde o início' };
    }
}

// Lista "Para onde foi o dinheiro": categorias de despesa do período, da maior para a menor.
function updateCategoryBreakdown() {
    const container = document.getElementById('category-breakdown');
    if (!container) return;

    const totals = {};
    getFilteredTransactions()
        .filter(t => t.type === 'expense')
        .forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (rows.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact">
                <p>Nenhuma despesa neste período.</p>
                <button class="btn btn-ghost btn-sm" type="button" data-goto="transactions">Lançar despesa</button>
            </div>`;
        return;
    }

    const total = rows.reduce((sum, [, v]) => sum + v, 0);
    const top = rows.slice(0, 5);
    const rest = rows.slice(5).reduce((sum, [, v]) => sum + v, 0);
    if (rest > 0) top.push(['Outras', rest]);
    const max = top[0][1];

    container.innerHTML = `<ul class="breakdown">${top.map(([name, value]) => `
        <li class="breakdown-row">
            <div class="breakdown-head">
                <span class="breakdown-name">${escapeHTML(name)}</span>
                <span class="breakdown-value">${formatCurrency(value)}</span>
            </div>
            <div class="breakdown-track"><span style="width:${(value / max) * 100}%"></span></div>
            <span class="breakdown-share">${Math.round((value / total) * 100)}% dos gastos</span>
        </li>`).join('')}</ul>`;
}

function updateRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    if (!container) return;

    const transactions = sortByDate(getLedger()).slice(-6).reverse();

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact">
                <p>Nenhum lançamento ainda.</p>
                <button class="btn btn-ghost btn-sm" type="button" data-goto="transactions">Fazer o primeiro lançamento</button>
            </div>`;
        return;
    }

    container.innerHTML = `<ul class="mini-list">${transactions.map(t => `
        <li class="mini-row">
            <span class="mini-dot ${t.type}" aria-hidden="true"></span>
            <div class="mini-text">
                <span class="mini-title">${escapeHTML(t.description || t.category)}</span>
                <span class="mini-sub">${escapeHTML(t.category)}</span>
            </div>
            <div class="mini-end">
                <span class="mini-amount ${t.type}">${t.type === 'income' ? '+' : '−'} ${formatCurrency(t.amount)}</span>
                <span class="mini-sub">${formatShortDate(t.date)}</span>
            </div>
        </li>`).join('')}</ul>`;
}

function formatShortDate(value) {
    return parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function calculateTotals() {
    const filtered = getFilteredTransactions();
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
}

// Intervalo de datas do período escolhido no Início (null = tudo).
function getPeriodRange() {
    const now = new Date();
    switch (currentFilter) {
        case 'week':
            return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
        case 'month':
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
        case 'year':
            return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
        default:
            return null;
    }
}

function inPeriod(dateValue, range = getPeriodRange()) {
    if (!range) return true;
    const d = parseLocalDate(dateValue);
    return d >= range.start && d <= range.end;
}

function getFilteredTransactions() {
    const range = getPeriodRange();
    return getLedger().filter(t => inPeriod(t.date, range));
}

// Total guardado em metas no período (depósitos menos retiradas).
// Guardar não é gasto: esse valor não entra em "Saiu", só mostra quanto do que sobrou foi separado.
function getSavedInGoals(range = getPeriodRange()) {
    return round2(DB.goals.reduce((sum, g) =>
        sum + (g.deposits || []).filter(d => inPeriod(d.date, range)).reduce((s2, d) => s2 + (Number(d.amount) || 0), 0), 0));
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
                <i class="fas fa-wallet"></i>
                <p>Nenhum orçamento definido. Escolha uma categoria e um limite por mês.</p>
            </div>
        `;
        return;
    }

    const now = new Date();
    const ref = new Date(now.getFullYear(), now.getMonth() + budgetMonthOffset, 1);
    const monthLabel = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const isCurrent = budgetMonthOffset === 0;

    // Navegação entre meses (só até o mês atual).
    const nav = document.getElementById('budgets-month-nav');
    if (nav) {
        nav.querySelector('.month-label').textContent = monthLabel;
        nav.querySelector('[data-month="next"]').disabled = isCurrent;
    }
    const note = document.getElementById('budgets-month-note');
    if (note) note.textContent = isCurrent
        ? 'Gastos deste mês, incluindo as parcelas do cartão que vencem nele.'
        : `Gastos de ${monthLabel}. Os limites são os de hoje.`;

    // Média dos 3 meses anteriores ao mês exibido, para comparar.
    // Considera só meses a partir do primeiro lançamento, para não puxar a média para baixo.
    const ledgerDates = getLedger().map(t => parseLocalDate(t.date)).filter(d => !isNaN(d));
    const firstMonth = ledgerDates.length
        ? new Date(Math.min(...ledgerDates.map(d => new Date(d.getFullYear(), d.getMonth(), 1).getTime())))
        : null;
    const previousAverage = (category) => {
        let sum = 0, months = 0;
        for (let i = 1; i <= 3; i++) {
            const month = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
            if (!firstMonth || month < firstMonth) break;
            sum += getMonthSpending(category, month);
            months++;
        }
        return months ? sum / months : 0;
    };

    container.innerHTML = DB.budgets.map(b => {
        const spent = getMonthSpending(b.category, ref);
        const percentage = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        const status = percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'success';
        const left = b.amount - spent;
        const average = previousAverage(b.category);
        const diff = average > 0 ? Math.round(((spent - average) / average) * 100) : null;

        return `
            <div class="budget-item">
                <div class="budget-header">
                    <h4 class="budget-name">${escapeHTML(b.category)}</h4>
                    <div class="item-header-right">
                        <span class="budget-percentage ${status}">${Math.round(percentage)}%</span>
                        ${itemActions('budgets', b.id)}
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="budget-info">
                    <span>${formatCurrency(spent)} de ${formatCurrency(b.amount)}</span>
                    <span class="${left < 0 ? 'expense' : ''}">${left >= 0 ? `${isCurrent ? 'Restam' : 'Sobraram'} ${formatCurrency(left)}` : `Passou ${formatCurrency(-left)}`}</span>
                </div>
                ${average > 0 ? `<p class="budget-compare">Média dos meses anteriores: ${formatCurrency(average)}${diff !== null && diff !== 0 ? ` <span class="${diff > 0 ? 'expense' : 'income'}">(${diff > 0 ? '+' : ''}${diff}%)</span>` : ''}</p>` : ''}
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

    const monthRange = { start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0) };
    const note = document.getElementById('goals-month-note');
    if (note) {
        const savedMonth = getSavedInGoals(monthRange);
        note.textContent = savedMonth > 0
            ? `Guardado em ${currentMonthName()}: ${formatCurrency(savedMonth)}. Esse valor não conta como gasto.`
            : `Nada guardado em ${currentMonthName()} ainda. Use o + de uma meta para registrar um depósito.`;
    }

    container.innerHTML = DB.goals.map(g => {
        const percentage = (g.currentAmount / g.targetAmount) * 100;
        const remaining = Math.max(g.targetAmount - g.currentAmount, 0);
        const last = (g.deposits || []).slice(-1)[0];
        
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
                ${last ? `<p class="goal-last">${last.amount > 0 ? 'Último depósito' : 'Última retirada'}: ${formatCurrency(Math.abs(last.amount))} em ${formatShortDate(last.date)}</p>` : ''}
            </div>
        `;
    }).join('');
}

function updateGoalsPreview() {
    const container = document.getElementById('goals-preview');
    if (!container) return;

    // Metas em andamento primeiro, ordenadas pelo prazo.
    const goals = DB.goals.slice()
        .sort((a, b) => ((a.currentAmount >= a.targetAmount) - (b.currentAmount >= b.targetAmount)) ||
            (parseLocalDate(a.deadline) - parseLocalDate(b.deadline)))
        .slice(0, 3);

    if (goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact">
                <p>Nenhuma meta criada.</p>
                <button class="btn btn-ghost btn-sm" type="button" data-goto="goals">Criar uma meta</button>
            </div>`;
        return;
    }

    container.innerHTML = `<ul class="goal-mini-list">${goals.map(g => {
        const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100) || 0;
        const done = g.currentAmount >= g.targetAmount;
        return `
        <li class="goal-mini">
            <div class="breakdown-head">
                <span class="breakdown-name">${escapeHTML(g.name)}</span>
                <span class="breakdown-value">${done ? 'Concluída' : `${Math.round(pct)}%`}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill ${done ? 'done' : ''}" style="width:${pct}%"></div></div>
            <div class="breakdown-foot">
                <span>${formatCurrency(g.currentAmount)} de ${formatCurrency(g.targetAmount)}</span>
                <span>até ${formatShortDate(g.deadline)}</span>
            </div>
        </li>`;
    }).join('')}</ul>`;
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

    if (typeof updateAllCharts === 'function') updateAllCharts();

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
                        <span class="investment-detail-value ${profit >= 0 ? 'income' : 'expense'}">
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

    const now = new Date();
    const monthKey = now.getFullYear() * 12 + now.getMonth();
    const keyOf = (iso) => { const d = parseLocalDate(iso); return d.getFullYear() * 12 + d.getMonth(); };

    // Compras em andamento primeiro; quitadas por último.
    const rows = DB.creditCards.map(card => {
        const installments = getInstallments(card);
        const current = installments.find(i => keyOf(i.date) === monthKey);
        const paid = installments.filter(i => keyOf(i.date) <= monthKey);
        const remaining = installments.filter(i => keyOf(i.date) > monthKey).reduce((sum, i) => sum + i.amount, 0);
        const done = paid.length === installments.length && !current;
        let status;
        if (current) status = `Parcela ${current.number} de ${current.count} em ${currentMonthName()}: ${formatCurrency(current.amount)}`;
        else if (done) status = 'Quitada';
        else status = `Começa em ${parseLocalDate(installments[0].date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
        return { card, installments, current, paid, remaining, done, status };
    }).sort((a, b) => (a.done - b.done) || (parseLocalDate(b.card.date) - parseLocalDate(a.card.date)));

    container.innerHTML = rows.map(({ card, installments, paid, remaining, done, status }) => `
        <div class="transaction-item ${done ? 'is-done' : ''}">
            <div class="transaction-info">
                <div class="transaction-icon expense">
                    <i class="fas fa-credit-card"></i>
                </div>
                <div class="transaction-details">
                    <h4>${escapeHTML(card.description)}</h4>
                    <p>${escapeHTML(card.cardName)}, ${escapeHTML(card.category || 'Compras')}</p>
                    <small>${escapeHTML(status)}</small>
                    ${installments.length > 1 ? `
                    <div class="installment-track" aria-label="${paid.length} de ${installments.length} parcelas">
                        ${installments.map(i => `<span class="${keyOf(i.date) <= monthKey ? 'paid' : ''}"></span>`).join('')}
                    </div>` : ''}
                </div>
            </div>
            <div class="item-end">
                <div class="transaction-amount expense">${formatCurrency(card.totalAmount)}</div>
                <span class="mini-sub">${done ? 'Tudo pago' : `${installments.length}x de ${formatCurrency(installments[0].amount)}`}</span>
                ${remaining > 0 ? `<span class="mini-sub">Faltam ${formatCurrency(remaining)}</span>` : ''}
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

// Categoria do lançamento gerado ao pagar uma conta.
const BILL_CATEGORY = {
    'Aluguel': 'Moradia', 'Condomínio': 'Moradia', 'Plano de Saúde': 'Saúde',
    'Academia': 'Saúde', 'Escola': 'Educação', 'TV/Streaming': 'Lazer'
};

function billCategory(bill) {
    const exists = (name) => DB.categories.some(c => c.name === name && c.type === 'expense');
    const preferred = BILL_CATEGORY[bill.type];
    if (preferred && exists(preferred)) return preferred;
    if (exists(bill.type)) return bill.type;
    return 'Contas';
}

// Marca a conta do mês como paga e registra a despesa em Lançamentos.
async function markBillAsPaid(billId, month, year) {
    const bill = DB.monthlyBills.find(b => b.id === billId);
    if (!bill) return;

    // O valor cadastrado é uma média: pergunta quanto foi pago de fato.
    const input = prompt(`Quanto você pagou de ${bill.type}?`, String(bill.amount).replace('.', ','));
    if (input === null) return;
    const amount = parseAmount(input);
    if (!(amount > 0)) {
        notify.error('Informe o valor pago, por exemplo 180,50.');
        return;
    }

    try {
        const userId = window.auth.currentUser.uid;
        const userRef = window.db.collection('users').doc(userId);
        const transaction = {
            type: 'expense',
            amount,
            category: billCategory(bill),
            date: todayISO(),
            description: bill.notes ? `${bill.type} (${bill.notes})` : bill.type,
            billId
        };
        const txRef = await userRef.collection('transactions').add({
            ...transaction,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        DB.transactions.push({ id: txRef.id, userId, ...transaction });

        const payment = { month, year, paidAt: new Date().toISOString(), amount, transactionId: txRef.id };
        const payments = [...(bill.payments || []), payment];
        await userRef.collection('monthlyBills').doc(billId).update({ payments });
        bill.payments = payments;

        updateBillsList();
        checkBillsAlerts();
        notify.success(`${bill.type} paga. A despesa de ${formatCurrency(amount)} entrou em Lançamentos.`);
    } catch (error) {
        console.error('Erro ao marcar conta como paga:', error);
        notify.error('Não foi possível registrar o pagamento. Tente de novo.');
    }
}

// Desfaz o pagamento do mês e remove a despesa que ele gerou.
async function undoBillPayment(billId, month, year) {
    const bill = DB.monthlyBills.find(b => b.id === billId);
    if (!bill) return;
    const payment = (bill.payments || []).find(p => p.month === month && p.year === year);
    if (!payment) return;
    if (!confirm(`Desfazer o pagamento de ${bill.type} deste mês? A despesa registrada também será excluída.`)) return;

    try {
        const userRef = window.db.collection('users').doc(window.auth.currentUser.uid);
        const payments = bill.payments.filter(p => p !== payment);
        await userRef.collection('monthlyBills').doc(billId).update({ payments });
        bill.payments = payments;

        if (payment.transactionId) {
            await userRef.collection('transactions').doc(payment.transactionId).delete();
            DB.transactions = DB.transactions.filter(t => t.id !== payment.transactionId);
        }

        updateBillsList();
        checkBillsAlerts();
        notify.success(`Pagamento de ${bill.type} desfeito.`);
    } catch (error) {
        console.error('Erro ao desfazer pagamento:', error);
        notify.error('Não foi possível desfazer o pagamento. Tente de novo.');
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
            <div class="alert alert-error">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Atenção!</strong> Você tem ${overdueBills.length} conta(s) em atraso.
                    <button class="link-btn alert-link" data-page="bills">
                        Ver contas
                    </button>
                </div>
            </div>
        `;
    }
    
    if (upcomingBills.length > 0) {
        alerts += `
            <div class="alert alert-warning">
                <i class="fas fa-clock"></i>
                <div>
                    <strong>Lembrete:</strong> ${upcomingBills.length} conta(s) vencem nos próximos 3 dias.
                    <button class="link-btn alert-link" data-page="bills">
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
                        ${bill.notes ? `<p>${escapeHTML(bill.notes)}</p>` : ''}
                        <small>Vencimento: dia ${bill.dueDay}</small>
                    </div>
                </div>
                <div class="item-end">
                    <div class="transaction-amount expense">
                        ${formatCurrency(bill.amount)}
                    </div>
                    <span class="bill-status ${status.class}">
                        <i class="fas fa-${status.status === 'paid' ? 'check-circle' : status.status === 'overdue' ? 'exclamation-circle' : 'clock'}"></i>
                        ${status.text}
                    </span>
                    ${!isPaid ? `
                        <button class="btn-mark-paid" onclick="markBillAsPaid('${escapeHTML(bill.id)}', ${currentMonth}, ${currentYear})">
                            <i class="fas fa-check"></i> Marcar como pago
                        </button>
                    ` : `
                        <button type="button" class="link-btn" onclick="undoBillPayment('${escapeHTML(bill.id)}', ${currentMonth}, ${currentYear})">Desfazer pagamento</button>
                    `}
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
        container.innerHTML = `<p class="muted-text">Nenhum vencimento cadastrado.</p>`;
        return;
    }
    
    container.innerHTML = `
        <h4 class="calendar-month">${monthName}</h4>
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
        container.innerHTML = `<p class="muted-text">Nenhuma categoria cadastrada.</p>`;
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
        categories: DB.categories,
        recurring: DB.recurring
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

const USER_COLLECTIONS = ['transactions', 'budgets', 'goals', 'investments', 'creditCards', 'monthlyBills', 'categories', 'recurring'];

// Apaga todos os documentos das coleções do usuário no Firestore.
async function deleteAllUserDocs(userId) {
    const refs = [];
    for (const collection of USER_COLLECTIONS) {
        try {
            const snapshot = await window.db.collection('users').doc(userId).collection(collection).get();
            snapshot.docs.forEach(doc => refs.push(doc.ref));
        } catch (error) {
            // Coleção nova ainda não liberada nas regras do Firestore: segue com as demais.
            if (collection === 'recurring' && error?.code === 'permission-denied') continue;
            throw error;
        }
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
            DB.recurring = restored.recurring;
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
        DB.recurring = [];
        DB.categories = await seedDefaultCategories(userId);

        notify.success('Todos os dados foram apagados com sucesso!');
        refreshCurrentPage();

    } catch (error) {
        console.error('Erro ao limpar dados:', error);
        notify.error('Erro ao limpar dados');
    }
}

// ========== LIVRO-CAIXA: lançamentos + parcelas do cartão ==========
const round2 = (value) => Math.round(value * 100) / 100;

function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function toISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Parcelas de uma compra no cartão: a 1ª cai no mês da compra, as demais
// nos meses seguintes, no mesmo dia (ou no último dia, em meses mais curtos).
function getInstallments(card) {
    const total = Number(card.totalAmount) || 0;
    const count = Math.max(1, parseInt(card.installments, 10) || 1);
    const base = round2(total / count);
    const start = parseLocalDate(card.date);
    if (isNaN(start)) return [];

    return Array.from({ length: count }, (_, i) => {
        const year = start.getFullYear();
        const month = start.getMonth() + i;
        const day = Math.min(start.getDate(), daysInMonth(year, month));
        return {
            number: i + 1,
            count,
            date: toISODate(new Date(year, month, day)),
            amount: i === count - 1 ? round2(total - base * (count - 1)) : base
        };
    });
}

// Lançamentos reais + parcelas do cartão que já venceram até o fim do mês atual.
// As parcelas são somente leitura: são editadas pela compra, em Cartões.
function getLedger() {
    const now = new Date();
    const limit = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const installments = [];
    DB.creditCards.forEach(card => {
        getInstallments(card).forEach(inst => {
            if (parseLocalDate(inst.date) > limit) return;
            installments.push({
                id: `card:${card.id}:${inst.number}`,
                virtual: 'card',
                cardId: card.id,
                type: 'expense',
                amount: inst.amount,
                category: card.category || 'Compras',
                date: inst.date,
                description: `${card.description} (${inst.number}/${inst.count})`,
                cardName: card.cardName
            });
        });
    });
    return DB.transactions.concat(installments);
}

// Quanto foi gasto numa categoria no mês da data informada (padrão: mês atual).
function getMonthSpending(category, reference = new Date()) {
    const y = reference.getFullYear();
    const m = reference.getMonth();
    return round2(getLedger()
        .filter(t => t.type === 'expense' && t.category === category)
        .filter(t => {
            const d = parseLocalDate(t.date);
            return d.getFullYear() === y && d.getMonth() === m;
        })
        .reduce((sum, t) => sum + t.amount, 0));
}

function currentMonthName() {
    return new Date().toLocaleDateString('pt-BR', { month: 'long' });
}

// Datas dos formulários começam preenchidas com hoje.
function fillDefaultDates() {
    ['transaction-date', 'card-date', 'investment-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = todayISO();
    });
}

// ========== LANÇAMENTOS FIXOS (repetem todo mês) ==========
const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// Data da ocorrência de uma série num mês (dia 31 vira o último dia em meses curtos).
function occurrenceDate(series, year, month) {
    return new Date(year, month, Math.min(series.day, daysInMonth(year, month)));
}

// Cria os lançamentos que faltam de cada série, do mês inicial até hoje.
// O id do documento é fixo por série e mês, então rodar de novo nunca duplica.
async function syncRecurring() {
    if (!DB.recurring.length || !window.auth?.currentUser) return 0;
    const userRef = window.db.collection('users').doc(window.auth.currentUser.uid);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const created = [];

    for (const series of DB.recurring) {
        const start = parseLocalDate(series.startDate);
        if (isNaN(start)) continue;
        const skipped = new Set(series.skipped || []);
        const existing = new Set(DB.transactions
            .filter(t => t.seriesId === series.id)
            .map(t => monthKeyOf(parseLocalDate(t.date))));

        for (let y = start.getFullYear(), m = start.getMonth(); ; m++) {
            const date = occurrenceDate(series, y, m);
            if (date > today) break;
            const key = monthKeyOf(date);
            if (existing.has(key) || skipped.has(key)) continue;

            const transaction = {
                type: series.type,
                amount: series.amount,
                category: series.category,
                description: series.description,
                date: toISODate(date),
                seriesId: series.id
            };
            const ref = userRef.collection('transactions').doc(`${series.id}_${key}`);
            await ref.set({ ...transaction, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            created.push({ id: ref.id, ...transaction });
            existing.add(key);
        }
    }

    DB.transactions.push(...created);
    return created.length;
}

async function createRecurring({ type, amount, category, description, date }) {
    const userRef = window.db.collection('users').doc(window.auth.currentUser.uid);
    const series = {
        type, amount, category, description,
        day: parseLocalDate(date).getDate(),
        startDate: date,
        skipped: []
    };
    const ref = await userRef.collection('recurring').add({
        ...series,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    DB.recurring.push({ id: ref.id, ...series });
    return syncRecurring();
}

// Muda o valor das próximas ocorrências (as já criadas não mudam).
async function editRecurringAmount(id) {
    const series = DB.recurring.find(s => s.id === id);
    if (!series) return;
    const input = prompt(`Novo valor de "${series.description || series.category}" a partir do próximo mês:`, String(series.amount).replace('.', ','));
    if (input === null) return;
    const amount = parseAmount(input);
    if (!(amount > 0)) {
        notify.error('Informe um valor válido, por exemplo 7.800,00.');
        return;
    }
    try {
        await window.db.collection('users').doc(window.auth.currentUser.uid)
            .collection('recurring').doc(id).update({ amount });
        series.amount = amount;
        updateRecurringList();
        notify.success(`Valor atualizado para ${formatCurrency(amount)} nos próximos meses.`);
    } catch (error) {
        console.error('Erro ao atualizar lançamento fixo:', error);
        notify.error('Não foi possível atualizar. Tente de novo.');
    }
}

async function stopRecurring(id) {
    const series = DB.recurring.find(s => s.id === id);
    if (!series) return;
    if (!confirm(`Parar de repetir "${series.description || series.category}"? Os lançamentos já criados continuam no histórico.`)) return;
    try {
        await window.db.collection('users').doc(window.auth.currentUser.uid)
            .collection('recurring').doc(id).delete();
        DB.recurring = DB.recurring.filter(s => s.id !== id);
        updateRecurringList();
        notify.success('Lançamento fixo encerrado.');
    } catch (error) {
        console.error('Erro ao encerrar lançamento fixo:', error);
        notify.error('Não foi possível encerrar. Tente de novo.');
    }
}

// Ao excluir um lançamento de uma série, o mês fica marcado para não ser recriado.
async function skipRecurringMonth(transaction) {
    const series = DB.recurring.find(s => s.id === transaction.seriesId);
    if (!series) return;
    const key = monthKeyOf(parseLocalDate(transaction.date));
    series.skipped = [...new Set([...(series.skipped || []), key])];
    await window.db.collection('users').doc(window.auth.currentUser.uid)
        .collection('recurring').doc(series.id).update({ skipped: series.skipped });
}

function updateRecurringList() {
    const card = document.getElementById('recurring-card');
    const container = document.getElementById('recurring-list');
    if (!card || !container) return;
    card.classList.toggle('hidden', DB.recurring.length === 0);
    if (!DB.recurring.length) return;

    const sorted = DB.recurring.slice().sort((a, b) => (a.type === b.type ? a.day - b.day : a.type === 'income' ? -1 : 1));
    container.innerHTML = `<ul class="mini-list">${sorted.map(s => `
        <li class="mini-row">
            <span class="mini-dot ${s.type}" aria-hidden="true"></span>
            <div class="mini-text">
                <span class="mini-title">${escapeHTML(s.description || s.category)}</span>
                <span class="mini-sub">${escapeHTML(s.category)}, todo dia ${s.day}</span>
            </div>
            <div class="mini-end">
                <span class="mini-amount ${s.type}">${s.type === 'income' ? '+' : '−'} ${formatCurrency(s.amount)}</span>
            </div>
            <div class="item-actions">
                <button type="button" class="icon-btn" data-action="recurring-edit" data-id="${escapeHTML(s.id)}" title="Mudar valor" aria-label="Mudar valor">
                    <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="icon-btn danger" data-action="recurring-stop" data-id="${escapeHTML(s.id)}" title="Parar de repetir" aria-label="Parar de repetir">
                    <i class="fas fa-stop"></i>
                </button>
            </div>
        </li>`).join('')}</ul>`;
}

// ========== EDIÇÃO E EXCLUSÃO ==========
// Cada coleção editável: formulário, campos (propriedade -> id do input),
// rótulo para mensagens e função que re-renderiza as telas afetadas.
const EDITABLE = {
    transactions: {
        form: 'transaction-form', label: 'Lançamento',
        fields: { type: 'transaction-type', amount: 'transaction-amount', category: 'transaction-category', date: 'transaction-date', description: 'transaction-description' },
        name: t => `${t.category} — ${formatCurrency(t.amount)}`,
        refresh: () => { updateTransactionsList(); updateRecurringList(); updateDashboard(); }
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
    fillDefaultDates();
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
    setFormExpanded(card, true);
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
        fillDefaultDates();
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

        // Lançamento de uma série fixa: este mês não é recriado.
        if (collection === 'transactions' && item.seriesId) {
            await skipRecurringMonth(item).catch(error => console.error(error));
        }

        // Despesa gerada pelo pagamento de uma conta: a conta volta a ficar pendente.
        if (collection === 'transactions' && item.billId) {
            const bill = DB.monthlyBills.find(b => b.id === item.billId);
            if (bill?.payments?.some(p => p.transactionId === id)) {
                bill.payments = bill.payments.filter(p => p.transactionId !== id);
                await window.db.collection('users').doc(userId).collection('monthlyBills').doc(bill.id).update({ payments: bill.payments });
                updateBillsList();
                checkBillsAlerts();
            }
        }
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
    const input = prompt(`Quanto você guardou para "${goal.name}"? Para retirar, use um valor negativo (ex.: -100).`, '');
    if (input === null) return;
    const value = parseAmount(input);
    if (!Number.isFinite(value) || value === 0) {
        notify.error('Informe um valor válido.');
        return;
    }
    const currentAmount = Math.max(0, round2((goal.currentAmount || 0) + value));
    // Registra o movimento real (uma retirada não passa do que estava guardado).
    const delta = round2(currentAmount - (goal.currentAmount || 0));
    if (delta === 0) {
        notify.error('A meta não tem saldo para retirar.');
        return;
    }
    const deposits = [...(goal.deposits || []), { date: todayISO(), amount: delta }];
    try {
        const userId = window.auth.currentUser.uid;
        await window.db.collection('users').doc(userId).collection('goals').doc(id).update({
            currentAmount,
            deposits,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        goal.currentAmount = currentAmount;
        goal.deposits = deposits;
        EDITABLE.goals.refresh();
        updateDashboard();
        notify.success(currentAmount >= goal.targetAmount
            ? `Meta "${goal.name}" atingida. Parabéns!`
            : delta > 0
                ? `${formatCurrency(delta)} guardados em "${goal.name}". Agora são ${formatCurrency(currentAmount)} de ${formatCurrency(goal.targetAmount)}.`
                : `${formatCurrency(-delta)} retirados de "${goal.name}".`);
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
    else if (action === 'recurring-edit') editRecurringAmount(id);
    else if (action === 'recurring-stop') stopRecurring(id);
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
        strength.text = 'Senha fraca';
        strength.class = 'weak';
    } else if (score <= 4) {
        strength.text = 'Senha média';
        strength.class = 'medium';
    } else {
        strength.text = 'Senha forte';
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
                <h2>Termos de uso</h2>
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
                <h2>Política de privacidade</h2>
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

    // Gráficos leem as cores do tema: redesenha ao trocar.
    if (typeof updateAllCharts === 'function' && DB.currentUser) updateAllCharts();
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
