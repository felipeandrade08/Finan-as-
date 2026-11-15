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
        doc.setTextColor(11, 59, 60); // Verde-petróleo da marca
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
        doc.setDrawColor(11, 59, 60);
        doc.setLineWidth(0.5);
        doc.line(20, yPos, pageWidth - 20, yPos);
        
        yPos += 10;
        
        // ========== RESUMO FINANCEIRO ==========
        doc.setFontSize(14);
        doc.setTextColor(11, 59, 60);
        doc.setFont(undefined, 'bold');
        doc.text('Resumo Financeiro', 20, yPos);
        
        yPos += 10;
        
        const totals = calculateTotals();
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        
        // Box de receitas (verde)
        doc.setFillColor(223, 243, 234);
        doc.roundedRect(20, yPos, (pageWidth - 50) / 3, 25, 3, 3, 'F');
        doc.setTextColor(19, 121, 91);
        doc.setFont(undefined, 'bold');
        doc.text('Receitas', 30, yPos + 8);
        doc.setFontSize(14);
        doc.text(formatCurrency(totals.income), 30, yPos + 18);
        
        // Box de despesas (vermelho)
        const xPos2 = 20 + (pageWidth - 50) / 3 + 5;
        doc.setFillColor(249, 228, 224);
        doc.roundedRect(xPos2, yPos, (pageWidth - 50) / 3, 25, 3, 3, 'F');
        doc.setTextColor(185, 60, 43);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('Despesas', xPos2 + 10, yPos + 8);
        doc.setFontSize(14);
        doc.text(formatCurrency(totals.expense), xPos2 + 10, yPos + 18);
        
        // Box de saldo (azul)
        const xPos3 = 20 + 2 * ((pageWidth - 50) / 3 + 5);
        doc.setFillColor(221, 247, 240);
        doc.roundedRect(xPos3, yPos, (pageWidth - 50) / 3, 25, 3, 3, 'F');
        doc.setTextColor(11, 59, 60);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('Saldo', xPos3 + 10, yPos + 8);
        doc.setFontSize(14);
        doc.text(formatCurrency(totals.balance), xPos3 + 10, yPos + 18);
        
        yPos += 35;
        
        // ========== TRANSAÇÕES RECENTES ==========
        doc.setFontSize(14);
        doc.setTextColor(11, 59, 60);
        doc.setFont(undefined, 'bold');
        doc.text('Transações Recentes (últimas 10)', 20, yPos);
        
        yPos += 8;
        
        const recentTransactions = sortByDate(DB.transactions).slice(-10).reverse();
        
        if (recentTransactions.length > 0) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            
            recentTransactions.forEach((t, index) => {
                if (yPos > pageHeight - 30) {
                    doc.addPage();
                    yPos = 20;
                }
                
                const date = parseLocalDate(t.date).toLocaleDateString('pt-BR');
                const amountColor = t.type === 'income' ? [19, 121, 91] : [185, 60, 43];
                
                doc.setTextColor(60, 60, 60);
                doc.text(`${date}`, 20, yPos);
                doc.text(String(t.category), 50, yPos);
                
                doc.setTextColor(...amountColor);
                doc.setFont(undefined, 'bold');
                doc.text(`${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}`, pageWidth - 20, yPos, { align: 'right' });
                doc.setFont(undefined, 'normal');
                
                yPos += 7;
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text('Nenhuma transação registrada.', 20, yPos);
            yPos += 10;
        }
        
        // Usa o gráfico visível (Relatórios ou Início), com fundo branco para o PDF.
        const source = ['reports-evolution-chart', 'evolution-chart']
            .map(id => document.getElementById(id))
            .find(c => c && c.width && c.offsetParent !== null);
        let canvas = null;
        if (source) {
            canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const c2 = canvas.getContext('2d');
            c2.fillStyle = '#ffffff';
            c2.fillRect(0, 0, canvas.width, canvas.height);
            c2.drawImage(source, 0, 0);
        }

        // ========== GRÁFICO (capturar do canvas) ==========
        yPos += 10;
        
        if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(11, 59, 60);
        doc.setFont(undefined, 'bold');
        doc.text(source && source.id === 'reports-evolution-chart' ? 'Saldo acumulado' : 'Entradas e saídas por mês', 20, yPos);
        
        yPos += 10;
        
        if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            const imgW = pageWidth - 40;
            const imgH = Math.min(imgW * (canvas.height / canvas.width), 100); // mantém a proporção
            doc.addImage(imgData, 'PNG', 20, yPos, imgW, imgH);
            yPos += imgH + 10;
        }
        
        // ========== RODAPÉ ==========
        // Rodapé em todas as páginas, com numeração correta.
        const footerY = pageHeight - 15;
        const totalPages = doc.getNumberOfPages();
        for (let page = 1; page <= totalPages; page++) {
            doc.setPage(page);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.setFont(undefined, 'normal');
            doc.text('Gerado por FinControl Pro - Sistema de Gestão Financeira', pageWidth / 2, footerY, { align: 'center' });
            doc.text(`Página ${page} de ${totalPages}`, pageWidth - 20, footerY, { align: 'right' });
        }
        
        // Salvar
        const filename = `fincontrol-relatorio-${todayISO()}.pdf`;
        doc.save(filename);
        
        notify.success('Relatório PDF gerado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        notify.error('Erro ao gerar PDF. Tente novamente.');
    }
}

// ========== EXPORTAR PARA EXCEL ==========
// Células numéricas formatadas (somam e ordenam no Excel, ao contrário de texto).
const XLSX_MONEY = '"R$" #,##0.00;-"R$" #,##0.00';
function xlsMoney(value) {
    return { t: 'n', v: Math.round((Number(value) || 0) * 100) / 100, z: XLSX_MONEY };
}
function xlsPercent(ratio) {
    return { t: 'n', v: Number.isFinite(ratio) ? ratio : 0, z: '0.0%' };
}
function xlsDate(value) {
    const d = parseLocalDate(value);
    return isNaN(d) ? '-' : { t: 'd', v: d, z: 'dd/mm/yyyy' };
}

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
        summaryData.push(['Receitas Totais:', xlsMoney(totals.income)]);
        summaryData.push(['Despesas Totais:', xlsMoney(totals.expense)]);
        summaryData.push(['Saldo:', xlsMoney(totals.balance)]);
        summaryData.push([]);
        
        const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws_summary, 'Resumo');
        
        // ========== ABA 2: TRANSAÇÕES ==========
        const transactionsData = [['Data', 'Tipo', 'Categoria', 'Valor', 'Descrição']];
        
        sortByDate(DB.transactions).forEach(t => {
            transactionsData.push([
                xlsDate(t.date),
                t.type === 'income' ? 'Receita' : 'Despesa',
                t.category,
                xlsMoney(t.type === 'income' ? t.amount : -t.amount),
                t.description || '-'
            ]);
        });
        
        const ws_transactions = XLSX.utils.aoa_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(wb, ws_transactions, 'Transações');
        
        // ========== ABA 3: ORÇAMENTOS ==========
        const budgetsData = [['Categoria', 'Limite mensal', `Gasto em ${currentMonthName()}`, 'Disponível', 'Percentual']];
        
        DB.budgets.forEach(b => {
            const spent = getMonthSpending(b.category);
            
            const available = b.amount - spent;
            budgetsData.push([
                b.category,
                xlsMoney(b.amount),
                xlsMoney(spent),
                xlsMoney(available),
                xlsPercent(spent / b.amount)
            ]);
        });
        
        const ws_budgets = XLSX.utils.aoa_to_sheet(budgetsData);
        XLSX.utils.book_append_sheet(wb, ws_budgets, 'Orçamentos');
        
        // ========== ABA 4: METAS ==========
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const savedThisMonth = (g) => (g.deposits || [])
            .filter(d => { const dt = parseLocalDate(d.date); return dt >= monthStart && dt <= monthEnd; })
            .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const goalsData = [['Nome', 'Valor alvo', 'Valor guardado', 'Falta', 'Progresso', 'Prazo', `Guardado em ${currentMonthName()}`]];
        
        DB.goals.forEach(g => {
            const remaining = g.targetAmount - g.currentAmount;
            goalsData.push([
                g.name,
                xlsMoney(g.targetAmount),
                xlsMoney(g.currentAmount),
                xlsMoney(Math.max(remaining, 0)),
                xlsPercent(g.currentAmount / g.targetAmount),
                xlsDate(g.deadline),
                xlsMoney(savedThisMonth(g))
            ]);
        });
        
        const ws_goals = XLSX.utils.aoa_to_sheet(goalsData);
        XLSX.utils.book_append_sheet(wb, ws_goals, 'Metas');
        
        // ========== ABA 5: INVESTIMENTOS ==========
        const investmentsData = [['Nome', 'Tipo', 'Investido', 'Valor Atual', 'Rendimento', 'Retorno %', 'Data']];
        
        DB.investments.forEach(inv => {
            const profit = inv.currentValue - inv.amount;
            investmentsData.push([
                inv.name,
                INVESTMENT_TYPES[inv.type] || inv.type,
                xlsMoney(inv.amount),
                xlsMoney(inv.currentValue),
                xlsMoney(profit),
                xlsPercent(profit / inv.amount),
                xlsDate(inv.date)
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
                xlsMoney(bill.amount),
                bill.dueDay,
                status.text,
                bill.notes || '-'
            ]);
        });
        
        const ws_bills = XLSX.utils.aoa_to_sheet(billsData);
        XLSX.utils.book_append_sheet(wb, ws_bills, 'Contas Mensais');
        
        // Salvar arquivo
        const filename = `fincontrol-dados-${todayISO()}.xlsx`;
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
