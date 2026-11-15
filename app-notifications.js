// =============================================
// FINCONTROL PRO v4.0 - SISTEMA DE NOTIFICAÇÕES
// =============================================

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }
    
    init() {
        // Criar container de notificações se não existir
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
            this.container = container;
        } else {
            this.container = document.getElementById('notification-container');
        }
    }
    
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getIcon(type);
        
        notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
        notification.innerHTML = `
            <i class="fas fa-${icon} notification-icon" aria-hidden="true"></i>
            <div class="notification-body">
                <p class="notification-title">${this.getTitle(type)}</p>
                <p class="notification-message"></p>
            </div>
            <button type="button" class="notification-close" aria-label="Fechar aviso">
                <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
        `;
        notification.querySelector('.notification-close').addEventListener('click', () => notification.remove());
        
        // Texto puro: mensagens podem conter nomes digitados pelo usuário.
        notification.querySelector('.notification-message').textContent = message;

        this.container.appendChild(notification);

        // No máximo 3 avisos visíveis: os mais antigos saem primeiro.
        const visible = this.container.querySelectorAll('.notification');
        for (let i = 0; i < visible.length - 3; i++) visible[i].remove();
        
        // Auto remover após duração
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.add('is-leaving');
                setTimeout(() => notification.remove(), 250);
            }, duration);
        }
        
        return notification;
    }
    
    getIcon(type) {
        const icons = {
            success: 'circle-check',
            error: 'circle-exclamation',
            warning: 'triangle-exclamation',
            info: 'circle-info'
        };
        return icons[type] || 'bell';
    }
    
    // Mostra um aviso só uma vez por sessão (evita repetir a cada atualização da tela).
    once(key, type, message, duration = 9000) {
        this.shown = this.shown || new Set();
        if (this.shown.has(key)) return null;
        this.shown.add(key);
        return this.show(message, type, duration);
    }

    getTitle(type) {
        const titles = {
            success: 'Pronto',
            error: 'Não foi possível concluir',
            warning: 'Atenção',
            info: 'Aviso'
        };
        return titles[type] || 'Notificação';
    }
    
    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }
    
    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
}

// Instância global
const notify = new NotificationSystem();

// ========== VERIFICAR CONTAS VENCIDAS E AVISAR ==========
function checkBillsNotifications() {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    DB.monthlyBills.forEach(bill => {
        const isPaid = bill.payments?.some(p => 
            p.month === currentMonth && p.year === currentYear
        );
        
        if (!isPaid) {
            const daysUntilDue = bill.dueDay - currentDay;
            
            // Notificar contas vencidas
            if (daysUntilDue < 0) {
                notify.once(`Conta "${bill.type}" está vencida! Venceu no dia ${bill.dueDay}.`, 'error', `Conta "${bill.type}" está vencida! Venceu no dia ${bill.dueDay}.`);
            }
            // Notificar contas próximas do vencimento (3 dias)
            else if (daysUntilDue <= 3 && daysUntilDue > 0) {
                notify.once(`Conta "${bill.type}" vence em ${daysUntilDue} dia(s)!`, 'warning', `Conta "${bill.type}" vence em ${daysUntilDue} dia(s)!`);
            }
        }
    });
}

// ========== VERIFICAR ORÇAMENTOS EXCEDIDOS ==========
function checkBudgetNotifications() {
    DB.budgets.forEach(budget => {
        const spent = DB.transactions
            .filter(t => t.type === 'expense' && t.category === budget.category)
            .reduce((sum, t) => sum + t.amount, 0);
        
        const percentage = (spent / budget.amount) * 100;
        
        if (percentage >= 100) {
            notify.once(`Orçamento de "${budget.category}" excedido! Gasto: ${formatCurrency(spent)} / ${formatCurrency(budget.amount)}`, 'error', `Orçamento de "${budget.category}" excedido! Gasto: ${formatCurrency(spent)} / ${formatCurrency(budget.amount)}`);
        } else if (percentage >= 80) {
            notify.once(`Orçamento de "${budget.category}" em 80%! Gasto: ${formatCurrency(spent)} / ${formatCurrency(budget.amount)}`, 'warning', `Orçamento de "${budget.category}" em 80%! Gasto: ${formatCurrency(spent)} / ${formatCurrency(budget.amount)}`);
        }
    });
}

// ========== VERIFICAR METAS ATINGIDAS ==========
function checkGoalsNotifications() {
    DB.goals.forEach(goal => {
        const percentage = (goal.currentAmount / goal.targetAmount) * 100;
        
        if (percentage >= 100) {
            notify.once(`Meta "${goal.name}" atingida. Parabéns!`, 'success', `Meta "${goal.name}" atingida. Parabéns!`);
        } else if (percentage >= 75 && percentage < 100) {
            notify.once(`Meta "${goal.name}" está em ${percentage.toFixed(0)}%.`, 'info', `Meta "${goal.name}" está em ${percentage.toFixed(0)}%.`);
        }
    });
}

// Executar verificações ao carregar
function runAllNotificationChecks() {
    setTimeout(() => {
        checkBillsNotifications();
        checkBudgetNotifications();
        checkGoalsNotifications();
    }, 2000);
}

// Exportar
if (typeof window !== 'undefined') {
    window.notify = notify;
    window.checkBillsNotifications = checkBillsNotifications;
    window.checkBudgetNotifications = checkBudgetNotifications;
    window.checkGoalsNotifications = checkGoalsNotifications;
    window.runAllNotificationChecks = runAllNotificationChecks;
}
