# Sagrado Pedidos

Sistema de pedidos interno para a marca SAGRADO. MVP funcional com cadastro de clientes, produtos, pedidos e geração de PDF.

## 📋 Funcionalidades

- **Autenticação** - Login com email/senha usando Firebase Auth
- **Clientes** - CRUD completo com busca
- **Produtos** - CRUD com busca e toggle ativo/inativo
- **Pedidos** - Criação, status (orçamento/pedido/faturado), geração de PDF
- **PWA** - Aplicativo instalável em dispositivos

## 🚀 Tecnologias

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- Firebase Auth + Firestore
- React Hook Form + Zod
- pdf-lib (geração de PDF no browser)
- PWA (next-pwa)

## 📁 Estrutura do Projeto

```
sagrado-pedidos/
├── src/
│   ├── app/                    # App Router (Next.js 14)
│   │   ├── login/
│   │   ├── customers/
│   │   ├── products/
│   │   ├── orders/
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   ├── setup/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Navbar.tsx
│   │   └── ProtectedRoute.tsx
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── auth.ts
│   │   └── db/
│   │       ├── customers.ts
│   │       ├── products.ts
│   │       ├── orders.ts
│   │       └── counters.ts
│   ├── types/
│   │   └── index.ts
│   └── pdf/
│       └── generateOrderPdf.ts
├── public/
│   ├── icons/
│   └── manifest.json
├── firestore.rules
├── next.config.js
└── package.json
```

## 🔧 Setup do Projeto

### 1. Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative **Authentication** (Email/Senha)
4. Ative **Firestore Database**
5. Vá em Configurações do Projeto > Geral
6. Copie as credenciais do projeto

### 2. Configurar Variáveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. Instalar Dependências

```bash
npm install
```

### 4. Deploy das Regras Firestore

No Firebase Console:

1. Vá para **Firestore Database** > **Regras**
2. Cole o conteúdo do arquivo `firestore.rules`
3. Clique em **Publicar**

### 5. Executar o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

### 6. Criar Primeiro Usuário

1. Acesse: http://localhost:3000/setup
2. Crie o primeiro usuário administrador
3. Faça login com as credenciais criadas

## 🚀 Deploy no Vercel

### 1. Push para GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/sagrado-pedidos.git
git push -u origin main
```

### 2. Deploy no Vercel

1. Acesse [Vercel](https://vercel.com/)
2. Importe seu repositório
3. Configure as variáveis de ambiente (Environment Variables)
4. Clique em **Deploy**

### 3. Configurar Domínio Firebase

No Firebase Console:

1. Vá para **Authentication** > **Settings**
2. Em **Authorized domains**, adicione seu domínio Vercel
3. Exemplo: `sagrado-pedidos.vercel.app`

## 📋 Checklist de Teste

### Fluxo Completo

- [ ] Criar usuário em `/setup`
- [ ] Fazer login em `/login`
- [ ] Criar cliente em `/customers`
- [ ] Criar produto em `/products`
- [ ] Criar pedido em `/orders/new`
- [ ] Ver detalhes do pedido em `/orders/[id]`
- [ ] Alterar status do pedido
- [ ] Gerar PDF do pedido
- [ ] Duplicar pedido
- [ ] Buscar clientes/produtos/pedidos
- [ ] Testar PWA (instalar no celular)

### Testes Específicos

#### Clientes
- [ ] Criar cliente com campos obrigatórios (nome, telefone)
- [ ] Editar cliente existente
- [ ] Buscar cliente por nome/telefone/doc
- [ ] Excluir cliente

#### Produtos
- [ ] Criar produto com SKU único
- [ ] Editar produto
- [ ] Ativar/desativar produto
- [ ] Buscar produto por nome/SKU
- [ ] Produto inativo não aparece na criação de pedido

#### Pedidos
- [ ] Número do pedido incrementa corretamente (SAG-YYYYMM-XXXX)
- [ ] Snapshot do cliente é salvo no pedido
- [ ] Snapshot dos produtos é salvo no pedido
- [ ] Cálculo de totais (subtotal, desconto, frete, total)
- [ ] Alteração de status funciona
- [ ] PDF gerado corretamente
- [ ] Duplicar pedido cria novo com mesmo conteúdo

## 🔐 Segurança

- Somente usuários autenticados podem acessar o sistema
- Regras Firestore protegem os dados
- Snapshots são salvos nos pedidos para histórico
- Exclusão de pedidos é feita por alteração de status

## 📱 PWA

O aplicativo pode ser instalado em:
- Android (Chrome)
- iOS (Safari)
- Desktop (Chrome/Edge)

Para instalar:
1. Abra o site no navegador
2. Toque em "Adicionar à tela inicial" (iOS) ou veja o prompt de instalação (Android/Chrome)

## 🎨 Personalização

### Cores
Edite as cores no arquivo `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#1d4ed8', // Azul atual
      },
    },
  },
}
```

### Logo
Substitua os arquivos em `/public/icons/`:
- `icon-192x192.png`
- `icon-512x512.png`

### PDF
Personalize o layout do PDF em `/src/lib/pdf/generateOrderPdf.ts`

## 🐛 Solução de Problemas

### Erro de CORS no Firebase
Adicione seu domínio em:
Firebase Console > Authentication > Settings > Authorized domains

### PDF não gera
Verifique se o navegador permite downloads e pop-ups

### Pedido não cria
Verifique se:
- Cliente está selecionado
- Pelo menos 1 item foi adicionado
- Todos os campos obrigatórios estão preenchidos

### PWA não instala
Verifique se:
- O site está em HTTPS
- Service worker está registrado
- Manifest.json está acessível

## 📞 Suporte

Para suporte técnico:
1. Verifique os logs no console do navegador
2. Confira as regras do Firestore
3. Teste em modo de desenvolvimento
4. Verifique as variáveis de ambiente

## 📄 Licença

Este projeto é privado e de uso interno exclusivo da SAGRADO.