// =============================================
// FINCONTROL PRO v3.5 - COMPLETO COM FIREBASE
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
            // Parar popup periódico
            stopPeriodicDonationPopup();
            
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
    
    // Iniciar sistema de popup periódico
    startPeriodicDonationPopup();
    
    // Mostrar popup de doação após 3 segundos do login
    setTimeout(() => {
        showDonationPopup();
    }, 3000);
}

// ========== POPUP DE DOAÇÃO ==========
function showDonationPopup() {
    // Verificar se o usuário desabilitou permanentemente
    const disabledUntil = localStorage.getItem('donation-popup-disabled-until');
    if (disabledUntil) {
        const disabledDate = new Date(disabledUntil);
        if (new Date() < disabledDate) {
            return; // Não mostrar até a data especificada
        }
    }
    
    // Verificar se já existe um popup aberto
    if (document.getElementById('donation-popup-overlay')) {
        return;
    }
    
    // Criar overlay do popup DIRETAMENTE NO BODY
    const overlay = document.createElement('div');
    overlay.id = 'donation-popup-overlay';
    overlay.className = 'donation-popup-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '999999';
    
    overlay.innerHTML = `
        <div class="donation-popup">
            <button class="donation-close-btn" onclick="closeDonationPopup()">
                <i class="fas fa-times"></i>
            </button>
            
            <div class="donation-popup-header">
                <div class="donation-icon">
                    <i class="fas fa-heart"></i>
                </div>
                <h2>Olá, ${DB.currentUser.name}! 👋</h2>
                <p>Bem-vindo ao FinControl Pro</p>
            </div>
            
            <div class="donation-popup-body">
                <div class="donation-message">
                    <i class="fas fa-coffee" style="font-size: 48px; color: var(--primary); margin-bottom: 16px;"></i>
                    <h3>Gostando do FinControl Pro?</h3>
                    <p>
                        Este projeto é <strong>gratuito e open source</strong>! 
                        Se está te ajudando a organizar suas finanças, 
                        considere fazer uma contribuição. ☕
                    </p>
                    <p style="margin-top: 12px; font-size: 14px; color: var(--text-secondary);">
                        Seu apoio ajuda a manter o desenvolvimento e trazer novas funcionalidades!
                    </p>
                </div>
                
                <div class="donation-pix-quick">
                    <h4><i class="fas fa-qrcode"></i> PIX Rápido</h4>
                    <div class="pix-key-quick">
                        <input type="text" id="popup-pix-key" value="16992189862" readonly>
                        <button onclick="copyPixFromPopup()" class="btn-copy-quick">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <p id="popup-copy-feedback" class="popup-copy-feedback hidden">
                        <i class="fas fa-check-circle"></i> Copiado!
                    </p>
                    
                    <div class="donation-values-quick">
                        <button class="value-btn-quick" onclick="selectValue(5)">R$ 5</button>
                        <button class="value-btn-quick" onclick="selectValue(10)">R$ 10</button>
                        <button class="value-btn-quick" onclick="selectValue(20)">R$ 20</button>
                        <button class="value-btn-quick" onclick="selectValue(50)">R$ 50</button>
                    </div>
                </div>
            </div>
            
            <div class="donation-popup-footer">
                <button class="btn-popup-secondary" onclick="closeDonationPopup()">
                    Agora Não
                </button>
                <button class="btn-popup-primary" onclick="goToDonation()">
                    <i class="fas fa-heart"></i> Quero Contribuir
                </button>
            </div>
            
            <div class="donation-popup-note">
                <label>
                    <input type="checkbox" id="dont-show-again" onchange="handleDontShowAgain()">
                    <span>Não mostrar novamente</span>
                </label>
            </div>
        </div>
    `;
    
    // IMPORTANTE: Adicionar ao BODY, não ao main-app
    document.body.appendChild(overlay);
    
    // Animar entrada
    setTimeout(() => {
        overlay.classList.add('active');
    }, 100);
    
    // Salvar timestamp da última exibição
    localStorage.setItem('donation-popup-last-shown', new Date().toISOString());
}

function closeDonationPopup() {
    const overlay = document.getElementById('donation-popup-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

function copyPixFromPopup() {
    const pixKey = document.getElementById('popup-pix-key');
    const feedback = document.getElementById('popup-copy-feedback');
    
    if (!pixKey || !feedback) return;
    
    pixKey.select();
    pixKey.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(pixKey.value).then(() => {
        feedback.classList.remove('hidden');
        setTimeout(() => {
            feedback.classList.add('hidden');
        }, 3000);
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Chave PIX copiada: ' + pixKey.value);
    });
}

function selectValue(value) {
    const pixKey = document.getElementById('popup-pix-key');
    if (!pixKey) return;
    
    alert(`💰 Valor sugerido: R$ ${value.toFixed(2)}\n\n📋 Chave PIX copiada!\nCole no seu app de pagamentos.`);
    copyPixFromPopup();
}

function goToDonation() {
    closeDonationPopup();
    navigateTo('settings');
    
    // Scroll para a seção de contribuição
    setTimeout(() => {
        const contributionSection = document.querySelector('.contribution-section');
        if (contributionSection) {
            contributionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            contributionSection.style.animation = 'pulse 2s ease';
        }
    }, 500);
}

function handleDontShowAgain() {
    const checkbox = document.getElementById('dont-show-again');
    if (!checkbox) return;
    
    if (checkbox.checked) {
        // Salvar preferência por 30 dias
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        localStorage.setItem('donation-popup-disabled-until', futureDate.toISOString());
        console.log('✅ Popup de doação desabilitado por 30 dias');
    } else {
        localStorage.removeItem('donation-popup-disabled-until');
        console.log('✅ Popup de doação reativado');
    }
}

// ========== SISTEMA DE POPUP PERIÓDICO ==========
let donationPopupInterval = null;

function startPeriodicDonationPopup() {
    // Limpar intervalo anterior se existir
    if (donationPopupInterval) {
        clearInterval(donationPopupInterval);
    }
    
    // Verificar a cada 10 minutos se deve mostrar o popup
    donationPopupInterval = setInterval(() => {
        const disabledUntil = localStorage.getItem('donation-popup-disabled-until');
        
        // Se desabilitado, não mostrar
        if (disabledUntil) {
            const disabledDate = new Date(disabledUntil);
            if (new Date() < disabledDate) {
                return;
            }
        }
        
        // Verificar última vez que foi mostrado
        const lastShown = localStorage.getItem('donation-popup-last-shown');
        if (lastShown) {
            const lastShownDate = new Date(lastShown);
            const now = new Date();
            const hoursSinceLastShown = (now - lastShownDate) / (1000 * 60 * 60);
            
            // Mostrar apenas se passou mais de 24 horas (1 dia)
            if (hoursSinceLastShown < 24) {
                return;
            }
        }
        
        // Mostrar popup
        console.log('⏰ Mostrando popup periódico de doação');
        showDonationPopup();
        
    }, 10 * 60 * 1000); // Verificar a cada 10 minutos
}

function stopPeriodicDonationPopup() {
    if (donationPopupInterval) {
        clearInterval(donationPopupInterval);
        donationPopupInterval = null;
    }
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
        
        const docRef = await window.db.collection('users').doc(userId)
            .collection('transactions').add({
                type,
                amount,
                category,
                date,
                description,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
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
                    <p>${t.description || 'Sem descrição'}</p>
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
    checkBillsAlerts();
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

// ========== ORÇAMENTOS ==========
async function handleAddBudget(e) {
    e.preventDefault();
    
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);

    if (!category || !amount) {
        showAlert('budget-error', 'Preencha todos os campos');
        return;
    }

    try {
        const userId = window.auth.currentUser.uid;
        
        const docRef = await window.db.collection('users').doc(userId)
            .collection('budgets').add({
                category,
                amount,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        DB.budgets.push({
            id: docRef.id,
            userId,
            category,
            amount
        });
        
        showAlert('budget-success', 'Orçamento adicionado com sucesso!');
        document.getElementById('budget-form').reset();
        updateBudgetsList();
        
        setTimeout(() => hideAlert('budget-success'), 3000);
        
    } catch (error) {
        console.error('Erro ao adicionar orçamento:', error);
        showAlert('budget-error', 'Erro ao salvar orçamento');
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
                    <h4 class="budget-name">${b.category}</h4>
                    <span class="budget-percentage ${status}">${percentage.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="budget-info">
                    <span>Gasto: R$ ${spent.toFixed(2)}</span>
                    <span>Limite: R$ ${b.amount.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ========== METAS ==========
async function handleAddGoal(e) {
    e.preventDefault();
    
    const name = document.getElementById('goal-name').value;
    const amount = parseFloat(document.getElementById('goal-amount').value);
    const deadline = document.getElementById('goal-deadline').value;

    if (!name || !amount || !deadline) {
        showAlert('goal-error', 'Preencha todos os campos');
        return;
    }

    try {
        const userId = window.auth.currentUser.uid;
        
        const docRef = await window.db.collection('users').doc(userId)
            .collection('goals').add({
                name,
                targetAmount: amount,
                currentAmount: 0,
                deadline,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        DB.goals.push({
            id: docRef.id,
            userId,
            name,
            targetAmount: amount,
            currentAmount: 0,
            deadline
        });
        
        showAlert('goal-success', 'Meta criada com sucesso!');
        document.getElementById('goal-form').reset();
        updateGoalsList();
        
        setTimeout(() => hideAlert('goal-success'), 3000);
        
    } catch (error) {
        console.error('Erro ao adicionar meta:', error);
        showAlert('goal-error', 'Erro ao salvar meta');
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
                    <h4 class="goal-name">${g.name}</h4>
                    <div class="goal-icon">
                        <i class="fas fa-bullseye"></i>
                    </div>
                </div>
                <div class="goal-progress">
                    <span>R$ ${g.currentAmount.toFixed(2)} de R$ ${g.targetAmount.toFixed(2)}</span>
                    <span class="goal-percentage">${percentage.toFixed(0)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill success" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="goal-stats">
                    <div class="goal-stat">
                        <span>Falta</span>
                        <span>R$ ${remaining.toFixed(2)}</span>
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
                    <h4 class="goal-name" style="font-size: 16px;">${g.name}</h4>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill success" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="goal-progress" style="margin-top: 8px;">
                    <span style="font-size: 12px;">R$ ${g.currentAmount.toFixed(2)} / R$ ${g.targetAmount.toFixed(2)}</span>
                    <span class="goal-percentage" style="font-size: 14px;">${percentage.toFixed(0)}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// ========== INVESTIMENTOS ==========
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

    try {
        const userId = window.auth.currentUser.uid;
        
        const docRef = await window.db.collection('users').doc(userId)
            .collection('investments').add({
                name,
                type,
                amount,
                currentValue: current,
                date,
                yieldRate,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        DB.investments.push({
            id: docRef.id,
            userId,
            name,
            type,
            amount,
            currentValue: current,
            date,
            yieldRate
        });
        
        showAlert('investment-success', 'Investimento adicionado com sucesso!');
        document.getElementById('investment-form').reset();
        updateInvestmentsList();
        
        setTimeout(() => hideAlert('investment-success'), 3000);
        
    } catch (error) {
        console.error('Erro ao adicionar investimento:', error);
        showAlert('investment-error', 'Erro ao salvar investimento');
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

    document.getElementById('total-invested').textContent = `R$ ${totalInvested.toFixed(2)}`;
    document.getElementById('total-current').textContent = `R$ ${totalCurrent.toFixed(2)}`;
    document.getElementById('total-profit').textContent = `R$ ${totalProfit.toFixed(2)}`;
    document.getElementById('total-return').textContent = `${totalReturn.toFixed(2)}%`;

    container.innerHTML = DB.investments.map(inv => {
        const profit = inv.currentValue - inv.amount;
        const returnRate = ((profit / inv.amount) * 100) || 0;
        
        return `
            <div class="investment-item">
                <div class="investment-header">
                    <h4 class="investment-name">${inv.name}</h4>
                    <span class="investment-type">${inv.type}</span>
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
                        <span class="investment-detail-value" style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
                            R$ ${profit.toFixed(2)} (${returnRate.toFixed(2)}%)
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
    
    const cardName = document.getElementById('card-name').value;
    const description = document.getElementById('card-description').value;
    const amount = parseFloat(document.getElementById('card-amount').value);
    const date = document.getElementById('card-date').value;
    const installments = parseInt(document.getElementById('card-installments').value);
    const category = document.getElementById('card-category').value;

    if (!cardName || !description || !amount || !date || !installments) {
        showAlert('card-error', 'Preencha todos os campos obrigatórios');
        return;
    }

    try {
        const userId = window.auth.currentUser.uid;
        
        const docRef = await window.db.collection('users').doc(userId)
            .collection('creditCards').add({
                cardName,
                description,
                totalAmount: amount,
                installmentAmount: amount / installments,
                date,
                installments,
                category,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        DB.creditCards.push({
            id: docRef.id,
            userId,
            cardName,
            description,
            totalAmount: amount,
            installmentAmount: amount / installments,
            date,
            installments,
            category
        });
        
        showAlert('card-success', 'Compra adicionada com sucesso!');
        document.getElementById('credit-card-form').reset();
        updateCreditCardsList();
        
        setTimeout(() => hideAlert('card-success'), 3000);
        
    } catch (error) {
        console.error('Erro ao adicionar compra:', error);
        showAlert('card-error', 'Erro ao salvar compra');
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
                    <h4>${card.cardName} - ${card.description}</h4>
                    <p>${card.category}</p>
                    <small>${formatDate(card.date)} - ${card.installments}x de R$ ${card.installmentAmount.toFixed(2)}</small>
                </div>
            </div>
            <div class="transaction-amount expense">
                R$ ${card.totalAmount.toFixed(2)}
            </div>
        </div>
    `).join('');
}

// ========== CONTAS MENSAIS ==========
async function handleAddBill(e) {
    e.preventDefault();
    
    const type = document.getElementById('bill-type').value;
    const amount = parseFloat(document.getElementById('bill-amount').value);
    const dueDay = parseInt(document.getElementById('bill-due-day').value);
    const notes = document.getElementById('bill-notes').value;

    if (!type || !amount || !dueDay) {
        showAlert('bill-error', 'Preencha todos os campos obrigatórios');
        return;
    }

    try {
        const userId = window.auth.currentUser.uid;
        
        const docRef = await window.db.collection('users').doc(userId)
            .collection('monthlyBills').add({
                type,
                amount,
                dueDay,
                notes,
                status: 'pending',
                payments: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        DB.monthlyBills.push({
            id: docRef.id,
            userId,
            type,
            amount,
            dueDay,
            notes,
            status: 'pending',
            payments: []
        });
        
        showAlert('bill-success', 'Conta adicionada com sucesso!');
        document.getElementById('bill-form').reset();
        updateBillsList();
        checkBillsAlerts();
        
        setTimeout(() => hideAlert('bill-success'), 3000);
        
    } catch (error) {
        console.error('Erro ao adicionar conta:', error);
        showAlert('bill-error', 'Erro ao salvar conta');
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
        showAlert('bill-success', 'Conta marcada como paga!');
        setTimeout(() => hideAlert('bill-success'), 3000);
        
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
    document.getElementById('total-bills').textContent = `R$ ${totalBills.toFixed(2)}`;
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
                        <h4>${bill.type}</h4>
                        <p>${bill.notes || 'Sem observações'}</p>
                        <small>Vencimento: dia ${bill.dueDay}</small>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <div class="transaction-amount expense">
                        R$ ${bill.amount.toFixed(2)}
                    </div>
                    <span class="bill-status ${status.class}">
                        <i class="fas fa-${status.status === 'paid' ? 'check-circle' : status.status === 'overdue' ? 'exclamation-circle' : 'clock'}"></i>
                        ${status.text}
                    </span>
                    ${!isPaid ? `
                        <button class="btn-mark-paid" onclick="markBillAsPaid('${bill.id}', ${currentMonth}, ${currentYear})">
                            <i class="fas fa-check"></i> Marcar como Pago
                        </button>
                    ` : ''}
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
                        <span class="calendar-day-total">R$ ${total.toFixed(2)}</span>
                    </div>
                    <div class="calendar-day-bills">
                        ${bills.map(bill => {
                            const status = getBillStatus(bill);
                            return `<span class="calendar-bill-tag ${status.class}">${bill.type}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

// ========== FAMÍLIA ==========
function handleInviteFamily() {
    const email = document.getElementById('family-email').value;
    const permission = document.getElementById('family-permission').value;

    if (!email || !permission) {
        showAlert('family-error', 'Preencha todos os campos');
        return;
    }

    showAlert('family-success', `Convite enviado para ${email} com permissão de ${permission}`);
    
    document.getElementById('family-email').value = '';
    
    setTimeout(() => hideAlert('family-success'), 3000);
}

function updateFamilyMembersList() {
    const container = document.getElementById('family-members-list');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-users"></i>
            <p>Nenhum membro adicionado ainda</p>
            <p style="font-size: 14px; margin-top: 8px;">Convide membros da família para compartilhar finanças</p>
        </div>
    `;
}

// ========== CATEGORIAS ==========
async function handleAddCategory() {
    const name = document.getElementById('new-category-name').value;
    const type = document.getElementById('new-category-type').value;

    if (!name || !type) {
        showAlert('categories-error', 'Preencha todos os campos');
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
        
        showAlert('categories-success', 'Categoria adicionada com sucesso!');
        document.getElementById('new-category-name').value = '';
        updateCategoriesList();
        loadCategories();
        
        setTimeout(() => hideAlert('categories-success'), 3000);
        
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
                <span>${cat.name}</span>
                <span class="category-badge ${cat.type}">${cat.type === 'income' ? 'Receita' : 'Despesa'}</span>
            </div>
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
    console.log('Atualizando relatórios...');
    // Implementar gráficos e relatórios detalhados
}

function updateEvolutionChart() {
    const canvas = document.getElementById('evolution-chart');
    if (!canvas) return;
    
    console.log('Atualizando gráfico de evolução...');
    // Implementar Chart.js aqui
}

// ========== EXPORTAÇÃO ==========
function exportToPDF() {
    alert('Funcionalidade de exportação PDF será implementada em breve!');
}

function exportToExcel() {
    alert('Funcionalidade de exportação Excel será implementada em breve!');
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
    link.download = `fincontrol-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showAlert('backup-success', 'Backup realizado com sucesso!');
    setTimeout(() => hideAlert('backup-success'), 3000);
}

function handleRestore(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            if (confirm('Tem certeza que deseja restaurar este backup? Os dados atuais serão substituídos.')) {
                DB.transactions = data.transactions || [];
                DB.budgets = data.budgets || [];
                DB.goals = data.goals || [];
                DB.investments = data.investments || [];
                DB.creditCards = data.creditCards || [];
                DB.monthlyBills = data.monthlyBills || [];
                DB.categories = data.categories || DEFAULT_CATEGORIES;
                
                showAlert('backup-success', 'Backup restaurado com sucesso!');
                updateDashboard();
                
                setTimeout(() => hideAlert('backup-success'), 3000);
            }
        } catch (error) {
            showAlert('backup-error', 'Erro ao restaurar backup. Arquivo inválido.');
            setTimeout(() => hideAlert('backup-error'), 3000);
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
        
        // Limpar dados do Firebase
        const batch = window.db.batch();
        
        const collections = ['transactions', 'budgets', 'goals', 'investments', 'creditCards', 'monthlyBills'];
        
        for (const collection of collections) {
            const snapshot = await window.db.collection('users').doc(userId).collection(collection).get();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        
        await batch.commit();
        
        // Limpar dados locais
        DB.transactions = [];
        DB.budgets = [];
        DB.goals = [];
        DB.investments = [];
        DB.creditCards = [];
        DB.monthlyBills = [];
        
        showAlert('backup-success', 'Todos os dados foram apagados com sucesso!');
        updateDashboard();
        
        setTimeout(() => hideAlert('backup-success'), 3000);
        
    } catch (error) {
        console.error('Erro ao limpar dados:', error);
        showAlert('backup-error', 'Erro ao limpar dados');
    }
}

// ========== PWA ==========
function handleInstallPWA() {
    alert('Para instalar o app:\n\n• No Chrome: Menu > Instalar App\n• No Safari: Compartilhar > Adicionar à Tela Inicial\n• No Edge: Menu > Aplicativos > Instalar este site');
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

console.log('✅ FinControl Pro carregado!');
