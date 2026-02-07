// =============================================
// FINCONTROL PRO v4.0 - EXPORTAÇÃO PDF/EXCEL
// =============================================

// ========== EXPORTAR PARA PDF ==========
async function exportToPDF() {
    try {
        notify.info('Gerando relatório PDF...');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        let yPos = 20;
        
        // ========== CABEÇALHO ==========
        doc.setFontSize(24);
        doc.setTextColor(30, 58, 138); // Azul da logo
        doc.setFont(undefined, 'bold');
        doc.text('FinControl Pro', pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 10;
        doc.setFontSize(16);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, 'normal');
        doc.text('Relatório Financeiro Completo', pageWidth / 2, yPos, { align: 'center' });
        
        yPos += 15;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        const now = new Date();
        doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });
        
        // Linha separadora
        yPos += 5;
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.5);
        doc.line(20, yPos, pageWidth - 20, yPos);
        
        yPos += 10;
        
        // ========== RESUMO FINANCEIRO ==========
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.setFont(undefined, 'bold');
        doc.text('Resumo Financeiro', 20, yPos);
        
        yPos += 10;
        
        const totals = calculateTotals();
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        
        // Box de receitas (verde)
        doc.setFillColor(209, 250, 229);
        doc.roundedRect(20, yPos, (pageWidth - 50) / 3, 25, 3, 3, 'F');
        doc.setTextColor(22, 163, 74);
        doc.setFont(undefined, 'bold');
        doc.text('Receitas', 30, yPos + 8);
        doc.setFontSize(14);
        doc.text(`R$ ${totals.income.toFixed(2)}`, 30, yPos + 18);
        
        // Box de despesas (vermelho)
        const xPos2 = 20 + (pageWidth - 50) / 3 + 5;
        doc.setFillColor(254, 226, 226);
        doc.roundedRect(xPos2, yPos, (pageWidth - 50) / 3, 25, 3, 3, 'F');
        doc.setTextColor(220, 38, 38);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('Despesas', xPos2 + 10, yPos + 8);
        doc.setFontSize(14);
        doc.text(`R$ ${totals.expense.toFixed(2)}`, xPos2 + 10, yPos + 18);
        
        // Box de saldo (azul)
        const xPos3 = 20 + 2 * ((pageWidth - 50) / 3 + 5);
        doc.setFillColor(219, 234, 254);
        doc.roundedRect(xPos3, yPos, (pageWidth - 50) / 3, 25, 3, 3, 'F');
        doc.setTextColor(30, 58, 138);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('Saldo', xPos3 + 10, yPos + 8);
        doc.setFontSize(14);
        doc.text(`R$ ${totals.balance.toFixed(2)}`, xPos3 + 10, yPos + 18);
        
        yPos += 35;
        
        // ========== TRANSAÇÕES RECENTES ==========
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.setFont(undefined, 'bold');
        doc.text('Transações Recentes (últimas 10)', 20, yPos);
        
        yPos += 8;
        
        const recentTransactions = DB.transactions.slice(-10).reverse();
        
        if (recentTransactions.length > 0) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            
            recentTransactions.forEach((t, index) => {
                if (yPos > pageHeight - 30) {
                    doc.addPage();
                    yPos = 20;
                }
                
                const date = new Date(t.date).toLocaleDateString('pt-BR');
                const typeIcon = t.type === 'income' ? '↑' : '↓';
                const amountColor = t.type === 'income' ? [22, 163, 74] : [220, 38, 38];
                
                doc.setTextColor(60, 60, 60);
                doc.text(`${date}`, 20, yPos);
                doc.text(`${typeIcon} ${t.category}`, 50, yPos);
                
                doc.setTextColor(...amountColor);
                doc.setFont(undefined, 'bold');
                doc.text(`${t.type === 'income' ? '+' : '-'} R$ ${t.amount.toFixed(2)}`, pageWidth - 50, yPos, { align: 'right' });
                doc.setFont(undefined, 'normal');
                
                yPos += 7;
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text('Nenhuma transação registrada.', 20, yPos);
            yPos += 10;
        }
        
        // ========== GRÁFICO (capturar do canvas) ==========
        yPos += 10;
        
        if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.setFont(undefined, 'bold');
        doc.text('Evolução Financeira', 20, yPos);
        
        yPos += 10;
        
        const canvas = document.getElementById('evolution-chart');
        if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 20, yPos, pageWidth - 40, 80);
            yPos += 90;
        }
        
        // ========== RODAPÉ ==========
        const footerY = pageHeight - 15;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Gerado por FinControl Pro - Sistema de Gestão Financeira', pageWidth / 2, footerY, { align: 'center' });
        doc.text(`Página 1 de ${doc.internal.pages.length - 1}`, pageWidth - 20, footerY, { align: 'right' });
        
        // Salvar
        const filename = `fincontrol-relatorio-${now.toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        notify.success('Relatório PDF gerado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        notify.error('Erro ao gerar PDF. Tente novamente.');
    }
}

// ========== EXPORTAR PARA EXCEL ==========
function exportToExcel() {
    try {
        notify.info('Gerando planilha Excel...');
        
        // Criar workbook
        const wb = XLSX.utils.book_new();
        
        // ========== ABA 1: RESUMO ==========
        const summaryData = [];
        const totals = calculateTotals();
        
        summaryData.push(['FinControl Pro - Relatório Financeiro']);
        summaryData.push([]);
        summaryData.push(['Data de Geração:', new Date().toLocaleDateString('pt-BR')]);
        summaryData.push([]);
        summaryData.push(['RESUMO FINANCEIRO']);
        summaryData.push(['Receitas Totais:', `R$ ${totals.income.toFixed(2)}`]);
        summaryData.push(['Despesas Totais:', `R$ ${totals.expense.toFixed(2)}`]);
        summaryData.push(['Saldo:', `R$ ${totals.balance.toFixed(2)}`]);
        summaryData.push([]);
        
        const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws_summary, 'Resumo');
        
        // ========== ABA 2: TRANSAÇÕES ==========
        const transactionsData = [['Data', 'Tipo', 'Categoria', 'Valor', 'Descrição']];
        
        DB.transactions.forEach(t => {
            transactionsData.push([
                new Date(t.date).toLocaleDateString('pt-BR'),
                t.type === 'income' ? 'Receita' : 'Despesa',
                t.category,
                t.amount.toFixed(2),
                t.description || '-'
            ]);
        });
        
        const ws_transactions = XLSX.utils.aoa_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(wb, ws_transactions, 'Transações');
        
        // ========== ABA 3: ORÇAMENTOS ==========
        const budgetsData = [['Categoria', 'Limite', 'Gasto', 'Disponível', 'Percentual']];
        
        DB.budgets.forEach(b => {
            const spent = DB.transactions
                .filter(t => t.type === 'expense' && t.category === b.category)
                .reduce((sum, t) => sum + t.amount, 0);
            
            const available = b.amount - spent;
            const percentage = ((spent / b.amount) * 100).toFixed(1);
            
            budgetsData.push([
                b.category,
                b.amount.toFixed(2),
                spent.toFixed(2),
                available.toFixed(2),
                `${percentage}%`
            ]);
        });
        
        const ws_budgets = XLSX.utils.aoa_to_sheet(budgetsData);
        XLSX.utils.book_append_sheet(wb, ws_budgets, 'Orçamentos');
        
        // ========== ABA 4: METAS ==========
        const goalsData = [['Nome', 'Valor Alvo', 'Valor Atual', 'Falta', 'Progresso', 'Prazo']];
        
        DB.goals.forEach(g => {
            const remaining = g.targetAmount - g.currentAmount;
            const percentage = ((g.currentAmount / g.targetAmount) * 100).toFixed(1);
            
            goalsData.push([
                g.name,
                g.targetAmount.toFixed(2),
                g.currentAmount.toFixed(2),
                remaining.toFixed(2),
                `${percentage}%`,
                new Date(g.deadline).toLocaleDateString('pt-BR')
            ]);
        });
        
        const ws_goals = XLSX.utils.aoa_to_sheet(goalsData);
        XLSX.utils.book_append_sheet(wb, ws_goals, 'Metas');
        
        // ========== ABA 5: INVESTIMENTOS ==========
        const investmentsData = [['Nome', 'Tipo', 'Investido', 'Valor Atual', 'Rendimento', 'Retorno %', 'Data']];
        
        DB.investments.forEach(inv => {
            const profit = inv.currentValue - inv.amount;
            const returnRate = ((profit / inv.amount) * 100).toFixed(2);
            
            investmentsData.push([
                inv.name,
                inv.type,
                inv.amount.toFixed(2),
                inv.currentValue.toFixed(2),
                profit.toFixed(2),
                `${returnRate}%`,
                new Date(inv.date).toLocaleDateString('pt-BR')
            ]);
        });
        
        const ws_investments = XLSX.utils.aoa_to_sheet(investmentsData);
        XLSX.utils.book_append_sheet(wb, ws_investments, 'Investimentos');
        
        // ========== ABA 6: CONTAS MENSAIS ==========
        const billsData = [['Tipo', 'Valor', 'Dia Vencimento', 'Status', 'Observações']];
        
        DB.monthlyBills.forEach(bill => {
            const status = getBillStatus(bill);
            
            billsData.push([
                bill.type,
                bill.amount.toFixed(2),
                bill.dueDay,
                status.text,
                bill.notes || '-'
            ]);
        });
        
        const ws_bills = XLSX.utils.aoa_to_sheet(billsData);
        XLSX.utils.book_append_sheet(wb, ws_bills, 'Contas Mensais');
        
        // Salvar arquivo
        const filename = `fincontrol-dados-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        notify.success('Planilha Excel gerada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar Excel:', error);
        notify.error('Erro ao gerar Excel. Verifique se a biblioteca está carregada.');
    }
}

// Exportar funções
if (typeof window !== 'undefined') {
    window.exportToPDF = exportToPDF;
    window.exportToExcel = exportToExcel;
}
