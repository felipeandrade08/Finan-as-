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
        
        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="font-size: 24px; color: ${this.getColor(type)};">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px; color: var(--text-primary);">
                        ${this.getTitle(type)}
                    </div>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        ${message}
                    </div>
                </div>
                <button onclick="this.closest('.notification').remove()" 
                        style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 18px; padding: 0;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        this.container.appendChild(notification);
        
        // Auto remover após duração
        if (duration > 0) {
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        return notification;
    }
    
    getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'bell';
    }
    
    getColor(type) {
        const colors = {
            success: '#22c55e',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || '#3b82f6';
    }
    
    getTitle(type) {
        const titles = {
            success: 'Sucesso!',
            error: 'Erro!',
            warning: 'Atenção!',
            info: 'Informação'
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
                notify.error(`Conta "${bill.type}" está vencida! Venceu no dia ${bill.dueDay}.`, 0);
            }
            // Notificar contas próximas do vencimento (3 dias)
            else if (daysUntilDue <= 3 && daysUntilDue > 0) {
                notify.warning(`Conta "${bill.type}" vence em ${daysUntilDue} dia(s)!`, 0);
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
            notify.error(`Orçamento de "${budget.category}" excedido! Gasto: R$ ${spent.toFixed(2)} / R$ ${budget.amount.toFixed(2)}`, 0);
        } else if (percentage >= 80) {
            notify.warning(`Orçamento de "${budget.category}" em 80%! Gasto: R$ ${spent.toFixed(2)} / R$ ${budget.amount.toFixed(2)}`, 0);
        }
    });
}

// ========== VERIFICAR METAS ATINGIDAS ==========
function checkGoalsNotifications() {
    DB.goals.forEach(goal => {
        const percentage = (goal.currentAmount / goal.targetAmount) * 100;
        
        if (percentage >= 100) {
            notify.success(`🎉 Parabéns! Meta "${goal.name}" atingida!`, 0);
        } else if (percentage >= 75 && percentage < 100) {
            notify.info(`Meta "${goal.name}" está em ${percentage.toFixed(0)}%! Continue assim!`, 0);
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
