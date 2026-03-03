# Migração customers -> customers_v2 (controlada)

Objetivo: copiar **customers** para **customers_v2** preservando o **mesmo ID**, normalizando endereços para **objeto** e recalculando `search`.

## Pré-requisitos
- Node 18+ (ideal Node 20)
- `serviceAccountKey.json` do Firebase (Admin SDK)

## Passo a passo (rápido)
1) Instale deps:
```bash
npm i
Exporte credenciais (método recomendado):

export GOOGLE_APPLICATION_CREDENTIALS="/CAMINHO/serviceAccountKey.json"
export FIREBASE_PROJECT_ID="SEU_PROJECT_ID"
Simule (não escreve):

DRY_RUN=true npm run migrate:customers_v2
Execute de verdade:

npm run migrate:customers_v2
Flags úteis
ONLY_MISSING=true → só cria no v2 se o doc ainda não existir

BATCH_SIZE=400 → tamanho do batch (<=500)

SRC_CUSTOMERS=customers / DST_CUSTOMERS=customers_v2

O que o script faz
Lê todos os docs de customers (paginado)

Para cada doc:

Calcula addressMain e addressDelivery como objeto { raw, cep, street, ... } (se vier string, vira { raw })

Mantém campos legados (address, etc.)

Recalcula search (nome/telefone/doc/email/endereço)

Escreve em customers_v2/{MESMO_ID}

Marca metadados migrationVersion: "customers_v2" e migratedAt

Segurança
O script usa Admin SDK → ignora rules. Você está alterando banco deliberadamente.

Não apaga nada.


---

## Como você executa agora (sem erro e sem gambiarra)

```bash
npm i
export GOOGLE_APPLICATION_CREDENTIALS="/caminho/serviceAccountKey.json"
export FIREBASE_PROJECT_ID="SEU_PROJECT_ID"

# simula primeiro
DRY_RUN=true npm run migrate:customers_v2

# depois roda valendo
npm run migrate:customers_v2
Se você quiser ir mais agressivo e não sobrescrever nada que já tenha no v2:

ONLY_MISSING=true npm run migrate:customers_v2
