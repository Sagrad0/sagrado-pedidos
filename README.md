# 🛒 Sagrado Pedidos

Sistema de gestão de pedidos interno para a marca **SAGRADO**. Um MVP funcional e pronto para produção que oferece controle completo de clientes, produtos e pedidos com geração automática de PDF e suporte a instalação como aplicativo (PWA).

---

## 📖 Visão Geral

O **Sagrado Pedidos** é uma aplicação web moderna desenvolvida para otimizar o processo de criação e gestão de orçamentos e pedidos da equipe de vendas interna da SAGRADO. O sistema permite cadastrar clientes e produtos, criar pedidos com cálculo automático de totais, gerar PDFs profissionais para envio aos clientes, e acompanhar o status de cada pedido desde o orçamento até a faturação.

### Público-Alvo
- Equipe interna de vendas da SAGRADO
- Gestores que precisam acompanhar pedidos
- Usuários que necessitam de uma solução rápida e instalável em múltiplos dispositivos

### Principais Benefícios
- **Agilidade**: Criação rápida de orçamentos e pedidos com interface intuitiva
- **Mobilidade**: Aplicativo instalável em celulares, tablets e desktops (PWA)
- **Rastreabilidade**: Histórico completo de pedidos com snapshots de dados
- **Profissionalismo**: PDFs formatados prontos para envio ao cliente

---

## ✨ Funcionalidades

### 🔐 Autenticação
- Login com email/senha através do Firebase Authentication
- Proteção de rotas (apenas usuários autenticados acessam o sistema)
- Lista branca de emails autorizados nas regras do Firestore
- Página de setup para criação do primeiro usuário administrador

### 👥 Gestão de Clientes
- Cadastro completo com nome fantasia, razão social, CPF/CNPJ, telefone, email
- Gerenciamento de dois endereços por cliente (principal/fiscal e entrega)
- Busca inteligente por nome, telefone ou documento
- Edição e exclusão de registros
- Dados de endereço estruturados (CEP, rua, número, complemento, bairro, cidade, estado)

### 📦 Gestão de Produtos
- Cadastro com SKU único, nome, unidade, peso e preço
- Toggle de ativação/desativação direto na lista
- Produtos inativos não aparecem na criação de novos pedidos
- Busca por nome ou SKU
- Validação de dados com Zod

### 🛒 Gestão de Pedidos
- **Numeração automática**: Formato `SAG-YYYYMM-XXXX` (ex: SAG-202401-0001)
- **Três status**: Orçamento → Pedido → Faturado
- **Cálculo automático**: Subtotal, desconto, frete e total
- **Seleção inteligente**: Autocomplete para busca de clientes e produtos
- **Snapshots imutáveis**: Dados do cliente e produtos são salvos no momento do pedido
- **Observações**: Campo livre para anotações
- **Duplicação**: Crie novos pedidos baseados em existentes

### 📄 Geração de PDF
- Layout profissional em formato A4
- Cabeçalho com identidade visual SAGRADO
- Dados completos do cliente
- Tabela de itens com SKU, produto, quantidade, preço unitário e total
- Resumo financeiro (subtotal, desconto, frete, total)
- Observações quando presentes
- Download automático com nome padronizado

### 📱 Progressive Web App (PWA)
- Instalável em Android, iOS e Desktop
- Funciona offline (interface disponível, dados requerem conexão)
- Ícones otimizados para cada plataforma
- Experiência de app nativo

---

## 🏗️ Arquitetura

### Stack Tecnológica

| Tecnologia | Versão | Finalidade |
|------------|--------|------------|
| Next.js | 14.0.4 | Framework React com App Router |
| TypeScript | 5.3.3 | Tipagem estática |
| TailwindCSS | 3.4.0 | Estilização utilitária |
| Firebase Auth | 10.14.1 | Autenticação |
| Firestore | 10.14.1 | Banco de dados NoSQL |
| React Hook Form | 7.48.2 | Gerenciamento de formulários |
| Zod | 3.22.4 | Validação de schemas |
| pdf-lib | 1.17.1 | Geração de PDF no browser |
| next-pwa | 5.6.0 | Suporte a PWA |
| date-fns | 2.30.0 | Manipulação de datas |

### Estrutura de Diretórios

```
sagrado-pedidos/
├── 📁 public/
│   ├── 📁 brand/              # Logo e identidade visual
│   ├── 📁 icons/              # Ícones para PWA
│   └── manifest.json          # Configuração do PWA
│
├── 📁 src/
│   ├── 📁 app/                # App Router (páginas)
│   │   ├── 📁 api/            # Rotas de API
│   │   ├── 📁 customers/      # Gestão de clientes
│   │   ├── 📁 login/          # Autenticação
│   │   ├── 📁 orders/         # Gestão de pedidos
│   │   │   ├── 📁 [id]/       # Detalhe do pedido
│   │   │   └── 📁 new/        # Novo pedido
│   │   ├── 📁 products/       # Gestão de produtos
│   │   ├── layout.tsx         # Layout principal
│   │   └── globals.css        # Estilos globais
│   │
│   ├── 📁 components/         # Componentes reutilizáveis
│   │   ├── AuthGate.tsx       # Gate de autenticação
│   │   ├── FirebaseBoot.tsx   # Inicialização Firebase
│   │   └── Navbar.tsx         # Barra de navegação
│   │
│   ├── 📁 lib/                # Lógica de negócio
│   │   ├── 📁 db/             # Operações de banco
│   │   │   ├── counters.ts    # Numeração automática
│   │   │   ├── customers.ts   # CRUD clientes
│   │   │   ├── orders.ts      # CRUD pedidos
│   │   │   └── products.ts    # CRUD produtos
│   │   ├── 📁 pdf/            # Geração de documentos
│   │   │   └── generateOrderPdf.ts
│   │   ├── address.ts         # Utilitários de endereço
│   │   ├── brLookups.ts       # Lookups Brasil (estados)
│   │   ├── firebase.ts        # Configuração Firebase
│   │   └── localdb.ts         # Armazenamento local
│   │
│   └── 📁 types/              # Tipos TypeScript
│       └── index.ts           # Definições de tipos
│
├── 📁 scripts/                # Scripts de migração
│   └── migrate-customers-to-v2.mjs
│
├── firestore.rules            # Regras de segurança
├── next.config.js             # Configuração Next.js
├── tailwind.config.js         # Configuração Tailwind
├── tsconfig.json              # Configuração TypeScript
└── package.json               # Dependências
```

### Modelo de Dados

#### Cliente (Customer)
```typescript
interface Customer {
  id: string
  name: string           // Nome fantasia
  legalName?: string     // Razão social
  doc?: string           // CPF/CNPJ
  phone: string          // Telefone (obrigatório)
  email?: string
  addressMain?: Address  // Endereço fiscal
  addressDelivery?: Address // Endereço de entrega
  search: string[]       // Tokens de busca
  createdAt: number      // Epoch ms
  updatedAt: number      // Epoch ms
}
```

#### Produto (Product)
```typescript
interface Product {
  id: string
  sku: string            // Código único
  name: string
  unit: string           // Unidade (un, kg, cx, etc.)
  weight?: number        // Peso em gramas
  price: number          // Preço unitário
  active: boolean        // Status ativo/inativo
  createdAt: number
  updatedAt: number
}
```

#### Pedido (Order)
```typescript
interface Order {
  id: string
  orderNumber?: string      // SAG-YYYYMM-XXXX (após virar pedido)
  budgetNumber?: string     // ORC-XXXXXX (orçamento)
  status: 'orcamento' | 'pedido' | 'faturado'
  customerId: string
  customerSnapshot: {...}   // Dados do cliente no momento
  items: OrderItem[]
  totals: OrderTotals
  notes?: string
  createdAt: number
  updatedAt: number
}
```

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- npm ou bun
- Conta no Firebase

### 1. Clonar o Repositório

```bash
git clone https://github.com/Sagrad0/sagrado-pedidos.git
cd sagrado-pedidos
```

### 2. Instalar Dependências

```bash
npm install
# ou
bun install
```

### 3. Configurar Firebase

#### 3.1 Criar Projeto Firebase
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Siga o assistente de criação

#### 3.2 Ativar Serviços
1. **Authentication**: Ative o método "Email/Senha"
2. **Firestore Database**: Crie o banco no modo bloqueado

#### 3.3 Obter Credenciais
1. Vá em Configurações do Projeto > Geral
2. Role até "Seus aplicativos"
3. Clique no ícone Web (`</>`)
4. Copie as credenciais

#### 3.4 Configurar Variáveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 4. Configurar Regras do Firestore

No Firebase Console:
1. Vá para **Firestore Database** > **Regras**
2. Cole o conteúdo do arquivo `firestore.rules`
3. **Importante**: Atualize a lista de emails autorizados:
   ```
   request.auth.token.email in ['email1@exemplo.com', 'email2@exemplo.com']
   ```
4. Clique em **Publicar**

### 5. Executar o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

### 6. Criar Primeiro Usuário

1. Acesse: http://localhost:3000/login
2. Crie uma conta com email autorizado nas regras
3. Faça login com as credenciais criadas

---

## 📋 Uso do Sistema

### Fluxo de Trabalho Recomendado

```
1. Cadastrar Clientes → 2. Cadastrar Produtos → 3. Criar Orçamento → 4. Converter em Pedido → 5. Faturar
```

### Criando um Orçamento

1. Acesse **Pedidos** > **Novo Pedido**
2. Busque e selecione um cliente
3. Adicione produtos buscando por nome ou SKU
4. Ajuste quantidades e preços se necessário
5. Adicione desconto e/ou frete
6. Preencha observações (opcional)
7. Clique em **Salvar Orçamento**

### Convertendo em Pedido

1. Acesse o orçamento em **Pedidos**
2. Clique em **Marcar como Pedido**
3. O número do pedido será gerado automaticamente

### Gerando PDF

1. Acesse o pedido desejado
2. Clique em **Gerar PDF**
3. O arquivo será baixado automaticamente

### Instalando como App (PWA)

**Android (Chrome)**:
1. Acesse o site
2. Toque no banner "Adicionar à tela inicial" ou menu > "Instalar app"

**iOS (Safari)**:
1. Acesse o site
2. Toque em "Compartilhar"
3. Selecione "Adicionar à Tela de Início"

**Desktop (Chrome/Edge)**:
1. Acesse o site
2. Clique no ícone de instalação na barra de endereços

---

## 🔐 Segurança

### Autenticação
- Apenas usuários autenticados acessam o sistema
- Emails devem estar na lista branca das regras Firestore
- Sessões gerenciadas pelo Firebase Auth

### Regras Firestore
- Validação de dados no backend
- Controle de acesso por email
- Operações CRUD restritas a usuários autorizados

### Boas Práticas Implementadas
- Snapshots de dados para histórico imutável
- Validação frontend (Zod) e backend (Firestore Rules)
- Nenhum dado sensível exposto no cliente

---

## 🛠️ Manutenção

### Comandos Disponíveis

```bash
npm run dev          # Desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run lint         # Verificar erros de lint
```

### Scripts de Migração

```bash
npm run migrate:customers_v2   # Migra clientes para formato v2
```

### Solução de Problemas

| Problema | Solução |
|----------|---------|
| Erro de CORS | Adicione o domínio em Firebase > Authentication > Authorized domains |
| PDF não gera | Verifique se o navegador permite downloads |
| Login falha | Confirme que o email está na lista branca das regras |
| PWA não instala | Verifique se está em HTTPS |

---

## 📊 Status do Projeto

| Módulo | Status | Observações |
|--------|--------|-------------|
| Autenticação | ✅ Completo | Firebase Auth com lista branca |
| Clientes | ✅ Completo | CRUD com endereços v2 |
| Produtos | ✅ Completo | CRUD com toggle ativo |
| Pedidos | ✅ Completo | Fluxo orçamento → faturado |
| PDF | ✅ Completo | Layout profissional A4 |
| PWA | ✅ Completo | Instalável multi-plataforma |

---

## 🗺️ Roadmap

### Próximas Funcionalidades Planejadas
- [ ] Dashboard com métricas de vendas
- [ ] Relatórios por período
- [ ] Integração com sistemas de estoque
- [ ] Notificações push
- [ ] Múltiplos idiomas
- [ ] Exportação para Excel

---

## 👥 Contribuição

Este é um projeto interno da SAGRADO. Para contribuir:

1. Crie uma branch para sua feature
2. Faça commits descritivos
3. Abra um Pull Request
4. Aguarde revisão

---

## 📞 Suporte

Para problemas técnicos:
1. Verifique os logs no console do navegador
2. Confira as regras do Firestore
3. Teste em modo de desenvolvimento
4. Entre em contato com a equipe de TI

---

## 📄 Licença

Este projeto é **privado** e de uso interno exclusivo da **SAGRADO**.

---

<p align="center">
  <strong>SAGRADO</strong> - Sistema de Pedidos Interno
</p>
