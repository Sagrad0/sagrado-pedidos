# Estrutura Completa do Projeto

```
sagrado-pedidos/
├── .vscode/
│   └── settings.json                    # Configurações do VS Code
├── public/
│   ├── icons/
│   │   ├── icon-192x192.png            # Ícone PWA 192x192
│   │   ├── icon-512x512.png            # Ícone PWA 512x512
│   │   └── icon.svg                    # Ícone SVG fonte
│   └── manifest.json                   # Manifest PWA
├── src/
│   ├── app/                            # App Router (Next.js 14)
│   │   ├── api/
│   │   │   └── hello/
│   │   │       └── route.ts            # API de teste
│   │   ├── customers/
│   │   │   └── page.tsx                # CRUD de clientes
│   │   ├── login/
│   │   │   └── page.tsx                # Página de login
│   │   ├── orders/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx            # Detalhe do pedido
│   │   │   ├── new/
│   │   │   │   └── page.tsx            # Novo pedido
│   │   │   └── page.tsx                # Lista de pedidos
│   │   ├── products/
│   │   │   └── page.tsx                # CRUD de produtos
│   │   ├── setup/
│   │   │   └── page.tsx                # Setup inicial
│   │   ├── globals.css                 # Estilos globais
│   │   └── layout.tsx                  # Layout principal
│   ├── components/
│   │   ├── Navbar.tsx                  # Navegação superior
│   │   └── ProtectedRoute.tsx          # Proteção de rotas
│   ├── lib/
│   │   ├── db/
│   │   │   ├── counters.ts             # Numeração automática
│   │   │   ├── customers.ts            # CRUD clientes
│   │   │   ├── orders.ts               # CRUD pedidos
│   │   │   └── products.ts             # CRUD produtos
│   │   ├── auth.ts                     # Contexto de autenticação
│   │   └── firebase.ts                 # Configuração Firebase
│   ├── pdf/
│   │   └── generateOrderPdf.ts         # Geração de PDF
│   └── types/
│       └── index.ts                    # Tipos TypeScript
├── .env.local.example                  # Exemplo de variáveis de ambiente
├── .eslintrc.json                      # Configuração ESLint
├── .gitignore                          # Arquivos ignorados pelo Git
├── CHECKLIST_TESTE.md                  # Checklist de testes
├── DEPLOY.md                           # Guia de deploy
├── ESTRUTURA.md                        # Este arquivo
├── PROJECT_SUMMARY.md                  # Resumo do projeto
├── README.md                           # Documentação principal
├── CHECKLIST_TESTE.md                  # Checklist de teste
├── firestore.indexes.json              # Índices Firestore
├── firestore.rules                     # Regras de segurança
├── firebase.json                       # Configuração Firebase
├── next.config.js                      # Configuração Next.js
├── package.json                        # Dependências do projeto
├── postcss.config.js                   # Configuração PostCSS
├── tailwind.config.js                  # Configuração Tailwind
└── tsconfig.json                       # Configuração TypeScript
```

## Arquivos de Configuração

### Firebase
- `firestore.rules` - Regras de segurança do banco
- `firestore.indexes.json` - Índices do banco
- `firebase.json` - Configuração do Firebase CLI

### Next.js
- `next.config.js` - Configuração do Next.js com PWA
- `tsconfig.json` - Configuração TypeScript
- `tailwind.config.js` - Configuração TailwindCSS

### Ambiente
- `.env.local.example` - Exemplo de variáveis de ambiente
- `.eslintrc.json` - Configuração do linter
- `.gitignore` - Arquivos ignorados pelo Git

## Documentação

- `README.md` - Documentação completa do projeto
- `DEPLOY.md` - Guia de deploy passo a passo
- `CHECKLIST_TESTE.md` - Checklist completo de testes
- `PROJECT_SUMMARY.md` - Resumo das funcionalidades
- `ESTRUTURA.md` - Esta estrutura de arquivos

## Código Fonte

### Tipos TypeScript (`src/types/`)
- `index.ts` - Todos os tipos e interfaces do projeto

### Lib - Firebase (`src/lib/`)
- `firebase.ts` - Inicialização do Firebase
- `auth.ts` - Contexto de autenticação

### Lib - Banco de Dados (`src/lib/db/`)
- `customers.ts` - Operações de clientes
- `products.ts` - Operações de produtos
- `orders.ts` - Operações de pedidos
- `counters.ts` - Numeração automática de pedidos

### Lib - PDF (`src/lib/pdf/`)
- `generateOrderPdf.ts` - Geração de PDF no browser

### Componentes (`src/components/`)
- `Navbar.tsx` - Barra de navegação
- `ProtectedRoute.tsx` - Rota protegida

### Páginas (`src/app/`)

#### Autenticação
- `login/page.tsx` - Tela de login
- `setup/page.tsx` - Criação de primeiro usuário

#### Cadastros
- `customers/page.tsx` - CRUD de clientes
- `products/page.tsx` - CRUD de produtos

#### Pedidos
- `orders/page.tsx` - Lista de pedidos
- `orders/new/page.tsx` - Criar novo pedido
- `orders/[id]/page.tsx` - Detalhe do pedido

#### Configuração
- `layout.tsx` - Layout principal do app
- `globals.css` - Estilos globais
- `api/hello/route.ts` - API de teste

## Recursos Estáticos

### PWA (`public/`)
- `manifest.json` - Manifest do PWA
- `icons/` - Ícones para instalação

## Scripts NPM

```bash
npm run dev          # Desenvolvimento
npm run build        # Build de produção
npm run start        # Iniciar servidor de produção
npm run lint         # Verificar erros de lint
```

## Configuração de Ambiente

Criar arquivo `.env.local` na raiz:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

**Total de arquivos: ~50+ arquivos**
**Tamanho: ~5MB (sem node_modules)**
**Pronto para deploy imediato** ✅