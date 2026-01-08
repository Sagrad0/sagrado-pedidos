# Guia Rápido de Deploy

## 🚀 Deploy em 5 Minutos

### Opção 1: Vercel (Recomendado)

1. **Push para GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/sagrado-pedidos.git
   git push -u origin main
   ```

2. **Deploy no Vercel**
   - Acesse [vercel.com](https://vercel.com)
   - Importe seu repositório
   - Adicione as variáveis de ambiente
   - Clique em Deploy

3. **Configurar Firebase (obrigatório)**
   - Firebase Console > **Authentication** > **Sign-in method** > ative **Anonymous**
   - Firebase Console > **Firestore Database** > crie o banco
   - Firebase Console > **Project settings** > **Web app** > copie as chaves para `.env.local`
   - Firebase Console > Authentication > Settings > adicione seu domínio Vercel em **Authorized domains**

### Opção 2: Firebase Hosting

1. **Instalar Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Fazer login no Firebase**
   ```bash
   firebase login
   ```

3. **Inicializar Firebase**
   ```bash
   firebase init
   # Selecione: Firestore, Hosting
   # Use as configurações padrão
   ```

4. **Build do projeto**
   ```bash
   npm run build
   ```

5. **Deploy**
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only hosting
   ```

## 🔧 Configuração Firebase (MVP)

### 1. Criar Projeto

```bash
# Na raiz do projeto
firebase projects:create sagrado-pedidos
```

### 2. Authentication

- Este MVP usa **Auth Anônimo** (sem tela de login).
- Ative em: Authentication > Sign-in method > **Anonymous**.

### 3. Deploy das Regras

```bash
firebase deploy --only firestore:rules
```

## 📊 Monitoramento

> Este MVP não usa Cloud Functions.

### Analytics

Firebase Console > Analytics

## 🔄 Atualização

### Atualizar código

```bash
git pull origin main
npm run build
firebase deploy
```

### Atualizar regras

```bash
firebase deploy --only firestore:rules
```

## 🛠️ Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Lint
npm run lint

# Deploy Firebase
firebase deploy

# Deploy apenas regras
firebase deploy --only firestore:rules

# Deploy apenas hosting
firebase deploy --only hosting

# Deploy apenas functions (se houver)
firebase deploy --only functions
```

## 🚨 Solução de Problemas

### Erro: "Permission denied"
- Verifique as regras do Firestore
- Confirme que o usuário está autenticado

### Erro: "CORS"
- Adicione o domínio em Firebase Console > Authentication > Authorized domains

### Erro: "Module not found"
- Execute `npm install`
- Delete `.next` e `node_modules` e reinstale

### Erro: "Build failed"
- Verifique erros de TypeScript: `npm run build`
- Verifique erros de ESLint: `npm run lint`

## 📞 Suporte

Para problemas técnicos:
1. Verifique os logs no Firebase Console
2. Teste em modo de desenvolvimento
3. Verifique as variáveis de ambiente
4. Confira as regras do Firestore