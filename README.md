# FinControl Pro

Aplicação web de controle financeiro pessoal, desenvolvida em HTML, CSS e JavaScript, com autenticação e armazenamento em nuvem pelo Firebase.

O projeto reúne em um só lugar o acompanhamento de receitas, despesas, orçamentos, metas, investimentos, cartões e contas. A interface é responsiva e pode ser instalada como aplicativo em dispositivos compatíveis (PWA).

## Funcionalidades

- **Dashboard:** visão geral das receitas, despesas e saldo.
- **Lançamentos:** registro e organização de receitas e despesas.
- **Relatórios:** gráficos de evolução financeira e distribuição de gastos.
- **Orçamentos:** acompanhamento de limites e gastos por categoria.
- **Metas:** controle do progresso de objetivos financeiros.
- **Investimentos:** organização e visualização da carteira.
- **Cartões e contas:** acompanhamento de compromissos financeiros.
- **Exportação:** geração de relatórios em PDF e planilhas Excel.
- **Backup:** exportação e restauração dos dados em JSON.
- **Personalização:** tema claro, escuro e automático.
- **PWA:** instalação e suporte básico para uso offline.

## Tecnologias

- HTML5, CSS3 e JavaScript (sem framework de interface).
- Firebase Authentication para autenticação.
- Cloud Firestore para persistência dos dados.
- Chart.js para gráficos.
- jsPDF para relatórios PDF.
- SheetJS para exportação Excel.
- Service Worker e Web App Manifest para recursos PWA.

## Estrutura do projeto

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da aplicação, configuração e carregamento dos módulos |
| `styles-modern.css` | Layout, componentes, temas e responsividade |
| `app.js` | Autenticação, dados e funcionalidades principais |
| `app-charts.js` | Gráficos e indicadores |
| `app-notifications.js` | Notificações e avisos |
| `app-export.js` | Exportação PDF e Excel |
| `manifest.json` | Metadados e configuração de instalação PWA |
| `sw.js` | Cache dos recursos e estratégia offline |
| `icon-*.png`, `logo-mark.png` | Ícones e identidade visual |

## Executar localmente

É necessário servir os arquivos por HTTP(S). Abrir o `index.html` diretamente pelo explorador de arquivos não é recomendado, pois recursos como Firebase e Service Worker dependem de uma origem válida.

Com Python instalado:

```bash
python -m http.server 8080
```

Depois, acesse:

```
http://localhost:8080
```

Também é possível publicar em GitHub Pages, Netlify, Vercel ou Firebase Hosting.

## Configuração do Firebase

O projeto utiliza Firebase Authentication e Cloud Firestore.

1. Crie ou selecione um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ative o método de autenticação por e-mail e senha.
3. Crie o banco de dados Cloud Firestore.
4. Configure os dados do aplicativo web Firebase no bloco de configuração do `index.html`.
5. Em **Authentication → Settings → Authorized domains**, adicione o domínio de publicação e os domínios usados nos testes.

### Regras recomendadas do Firestore

As regras devem garantir que cada usuário acesse somente os documentos associados ao próprio UID. Ajuste a estrutura caso a organização das coleções seja alterada:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

**Importante:** nunca publique credenciais privadas de servidor, chaves de service account ou tokens administrativos. A chave de configuração web do Firebase é utilizada no cliente, mas deve ter as restrições e APIs permitidas configuradas no Google Cloud. As regras do Firestore são a proteção efetiva dos dados.

## Publicação e atualização

- Publique a pasta do projeto mantendo os caminhos relativos dos arquivos.
- Configure os domínios autorizados no Firebase.
- Após modificar recursos do aplicativo, atualize o identificador `VERSION` no início de `sw.js` para invalidar o cache antigo do PWA.
- Teste login, cadastro, gravação no Firestore, exportações e instalação no dispositivo após cada publicação.

## Segurança e privacidade

Os dados financeiros são informações sensíveis. Utilize regras restritivas no Firestore, mantenha as dependências atualizadas e teste as permissões com contas diferentes. Não use dados financeiros reais em ambientes de demonstração ou testes compartilhados.

## Autor

**Felipe Andrade**  
Desenvolvimento: **FELIPE ANDRADE DEV**

---

Este repositório contém o código-fonte do FinControl Pro. A disponibilidade do serviço depende da configuração do Firebase e da plataforma de hospedagem utilizada.
