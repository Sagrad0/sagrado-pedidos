# Checklist de Teste - Sagrado Pedidos

Use este checklist para validar que todas as funcionalidades estão funcionando corretamente após o setup.

## 🚀 Setup Inicial

- [ ] Projeto clonado do repositório
- [ ] `npm install` executado com sucesso
- [ ] Arquivo `.env.local` criado com credenciais Firebase
- [ ] `npm run dev` executado sem erros
- [ ] Página de login carrega em `http://localhost:3000`

## 🔐 Autenticação

### Criar Primeiro Usuário
- [ ] Acessar `/setup`
- [ ] Criar usuário com email válido
- [ ] Senha com mínimo 6 caracteres
- [ ] Redirecionamento para `/orders` após criação

### Login
- [ ] Acessar `/login`
- [ ] Fazer login com credenciais criadas
- [ ] Redirecionamento para `/orders`
- [ ] Navbar exibe email do usuário logado
- [ ] Botão "Sair" funciona corretamente

## 👥 Clientes

### Criar Cliente
- [ ] Acessar `/customers`
- [ ] Clicar em "Novo Cliente"
- [ ] Preencher nome (obrigatório)
- [ ] Preencher telefone (obrigatório)
- [ ] Preencher CPF/CNPJ (opcional)
- [ ] Preencher email (opcional)
- [ ] Preencher endereço (opcional)
- [ ] Salvar e ver cliente na lista
- [ ] Validação exibe erro se nome/telefone vazios

### Buscar Cliente
- [ ] Buscar por nome (case insensitive)
- [ ] Buscar por telefone
- [ ] Buscar por CPF/CNPJ
- [ ] Resultados filtram corretamente

### Editar Cliente
- [ ] Clicar em "Editar" ao lado do cliente
- [ ] Modal abre com dados preenchidos
- [ ] Alterar informações
- [ ] Salvar e ver alterações na lista

### Excluir Cliente
- [ ] Clicar em "Excluir"
- [ ] Confirmar exclusão
- [ ] Cliente removido da lista

## 📦 Produtos

### Criar Produto
- [ ] Acessar `/products`
- [ ] Clicar em "Novo Produto"
- [ ] Preencher SKU (obrigatório)
- [ ] Preencher nome (obrigatório)
- [ ] Selecionar unidade (obrigatório)
- [ ] Preencher peso em gramas (opcional)
- [ ] Preencher preço (obrigatório, >= 0)
- [ ] Status ativo por padrão
- [ ] Salvar e ver produto na lista
- [ ] Validação exibe erro se SKU/nome vazios ou preço negativo

### Buscar Produto
- [ ] Buscar por nome (case insensitive)
- [ ] Buscar por SKU (case insensitive)
- [ ] Resultados filtram corretamente

### Editar Produto
- [ ] Clicar em "Editar" ao lado do produto
- [ ] Modal abre com dados preenchidos
- [ ] Alterar informações
- [ ] Salvar e ver alterações na lista

### Toggle Ativo/Inativo
- [ ] Clicar em "Desativar" no produto ativo
- [ ] Status muda para "Inativo"
- [ ] Clicar em "Ativar" no produto inativo
- [ ] Status muda para "Ativo"

## 🛒 Pedidos

### Criar Pedido
- [ ] Acessar `/orders/new`
- [ ] Buscar e selecionar cliente
- [ ] Buscar e adicionar produto
- [ ] Quantidade padrão = 1
- [ ] Preço unitário puxado do produto
- [ ] Editar quantidade (número inteiro)
- [ ] Editar preço unitário manualmente
- [ ] Adicionar múltiplos produtos
- [ ] Remover item do pedido
- [ ] Calcular subtotal automático
- [ ] Adicionar desconto
- [ ] Adicionar frete
- [ ] Calcular total (subtotal - desconto + frete)
- [ ] Adicionar observações
- [ ] Clicar em "Salvar Pedido"
- [ ] Redirecionamento para detalhe do pedido

### Ver Pedido
- [ ] Acessar `/orders/[id]`
- [ ] Número do pedido exibido corretamente (SAG-YYYYMM-XXXX)
- [ ] Dados do cliente (snapshot) exibidos
- [ ] Itens do pedido listados
- [ ] Totais calculados corretamente
- [ ] Observações exibidas se houver

### Alterar Status do Pedido
- [ ] Status inicial: "Orçamento"
- [ ] Clicar em "Marcar como Pedido"
- [ ] Status muda para "Pedido"
- [ ] Clicar em "Marcar como Faturado"
- [ ] Status muda para "Faturado"
- [ ] Clicar em "Voltar para Orçamento"
- [ ] Status muda para "Orçamento"

### Buscar Pedidos
- [ ] Acessar `/orders`
- [ ] Buscar por número do pedido
- [ ] Buscar por nome do cliente
- [ ] Buscar por telefone do cliente
- [ ] Filtrar por status (Orçamento/Pedido/Faturado)
- [ ] Resultados filtram corretamente

### Gerar PDF
- [ ] No detalhe do pedido, clicar em "Gerar PDF"
- [ ] PDF gerado com nome: "Pedido_Sagrado_XXX.pdf"
- [ ] PDF contém:
  - [ ] Cabeçalho "SAGRADO"
  - [ ] Número do pedido
  - [ ] Data do pedido
  - [ ] Dados do cliente
  - [ ] Tabela de itens (SKU, produto, qtd, preço, total)
  - [ ] Resumo (subtotal, desconto, frete, total)
  - [ ] Observações se houver
- [ ] Formato A4, layout profissional

### Duplicar Pedido
- [ ] No detalhe do pedido, clicar em "Duplicar"
- [ ] Confirmar duplicação
- [ ] Novo pedido criado com:
  - [ ] Mesmos itens
  - [ ] Mesmo cliente
  - [ ] Status "Orçamento"
  - [ ] Novo número de pedido
- [ ] Redirecionamento para novo pedido

## 📱 PWA

### Instalar no Desktop (Chrome/Edge)
- [ ] Acessar o site no navegador
- [ ] Ver ícone de instalação na barra de endereços
- [ ] Clicar em "Instalar"
- [ ] App instalado e abre em janela separada

### Instalar no Android (Chrome)
- [ ] Acessar o site no Chrome
- [ ] Ver prompt de instalação
- [ ] Clicar em "Adicionar à tela inicial"
- [ ] App instalado com ícone na home

### Instalar no iOS (Safari)
- [ ] Acessar o site no Safari
- [ ] Toque em "Compartilhar"
- [ ] Selecionar "Adicionar à Tela de Início"
- [ ] App instalado com ícone na home

## 🔍 Testes Avançados

### Numeração de Pedidos
- [ ] Criar pedido em janeiro/2024
- [ ] Número: SAG-202401-0001
- [ ] Criar segundo pedido
- [ ] Número: SAG-202401-0002
- [ ] Aguardar mudança de mês (ou simular)
- [ ] Criar pedido em fevereiro/2024
- [ ] Número: SAG-202402-0001 (resetou)

### Snapshots
- [ ] Criar pedido com cliente "João"
- [ ] Editar nome do cliente para "João Silva"
- [ ] Verificar que pedido antigo ainda mostra "João"
- [ ] Criar novo pedido com mesmo cliente
- [ ] Novo pedido mostra "João Silva"

### Produtos Inativos
- [ ] Desativar um produto
- [ ] Acessar `/orders/new`
- [ ] Produto inativo não aparece na busca
- [ ] Pedidos antigos com produto inativo ainda funcionam

### Validações
- [ ] Tentar criar cliente sem nome → erro
- [ ] Tentar criar produto com preço negativo → erro
- [ ] Tentar criar pedido sem cliente → erro
- [ ] Tentar criar pedido sem itens → erro

## 🎨 Interface

### Responsividade
- [ ] Testar em desktop (1920x1080)
- [ ] Testar em tablet (iPad)
- [ ] Testar em celular (iPhone/Android)
- [ ] Layout se adapta corretamente
- [ ] Formulários são usáveis em mobile

### Navegação
- [ ] Links do Navbar funcionam corretamente
- [ ] Breadcrumb intuitivo
- [ ] Voltar do navegador funciona
- [ ] URLs são amigáveis

### Feedback ao Usuário
- [ ] Loading states ao salvar
- [ ] Mensagens de erro claras
- [ ] Confirmações de exclusão
- [ ] Feedback visual de ações

## 🔐 Segurança

### Autenticação
- [ ] Rotas protegidas redirecionam para login
- [ ] Sair limpa sessão corretamente
- [ ] Não é possível acessar páginas sem login
- [ ] Dados de outros usuários não são acessíveis

### Regras Firestore
- [ ] Somente usuários autenticados podem ler/escrever
- [ ] Validações funcionam no backend
- [ ] Exclusão de pedidos bloqueada

## 📊 Performance

### Carregamento
- [ ] Páginas carregam rapidamente (< 2s)
- [ ] Listas grandes (> 100 itens) são paginadas
- [ ] Busca é responsiva

### Offline (PWA)
- [ ] App abre sem internet após instalado
- [ ] Interface funciona (embora dados não carreguem)
- [ ] Service worker registrado corretamente

## 📝 Casos de Borda

### Dados
- [ ] Cliente com nome muito longo
- [ ] Produto com preço zero
- [ ] Pedido com 50+ itens
- [ ] Observações com 1000+ caracteres

### Comportamento
- [ ] Duplo clique em botões não cria duplicatas
- [ ] Atualizar página mantém estado (quando possível)
- [ ] Sair e voltar mantém sessão

---

Se todos os itens estiverem marcados, seu sistema está **100% funcional** e pronto para produção! 🎉