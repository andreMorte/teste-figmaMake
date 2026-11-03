# UX Test Lab — ambiente contínuo de testes de usabilidade (Figma Make)

Painel do pesquisador + runner de participantes + verificador do SDK UXLab, rodando como **um único serviço Node (Express + Vite/React)** com dados salvos em disco.

## Como funciona

| Rota | Para quem | O que faz |
|---|---|---|
| `/` | Pesquisador | Painel: criar testes, validar protótipo, ver resultados |
| `/run/<TEST-ID>?p=<url-do-protótipo>` | Participante | Executa as tarefas no protótipo e responde o SUS |
| `/api/*` | — | Telemetria (sessões, eventos, SUS, snapshots) e verificação |
| `/api/health` | — | Status + onde os dados estão salvos |

Os dados (testes, participantes, sessões, eventos, SUS, capturas de tela) ficam em `DATA_DIR`:
- `db.json` — tudo menos as imagens
- `snapshots.json` — capturas de tela (até 200, a mais recente por sessão/tela)

> Enquanto um teste não tem nenhuma sessão real, o painel continua mostrando os **dados de demonstração** originais. Assim que o primeiro participante interage, passa a mostrar só dados reais.

## Deploy grátis (Render Free + Neon Postgres)

O plano Free do Render não tem disco persistente e hiberna após 15 min sem acesso — ao acordar o disco está zerado. Por isso os dados vão para um **Postgres grátis do Neon** (0,5 GB). O app cria as tabelas sozinho.

1. **Neon** (neon.tech) → criar conta → *New project* → copiar a *connection string* (`postgresql://...?sslmode=require`).
2. **GitHub** → criar repositório e subir esta pasta.
3. **Render** → *New + → Blueprint* → selecionar o repositório. Ele lê o `render.yaml` (plano free, Docker).
4. Quando pedir as variáveis: `DATABASE_URL` = string do Neon. Após o primeiro deploy, preencha `APP_URL` com a URL do serviço (ex.: `https://ux-test-lab.onrender.com`).
5. Abra `https://<seu-serviço>.onrender.com/api/health` → deve mostrar `"mode":"postgres"`.

Limitações do Free:
- Primeiro acesso após hibernar leva ~1 min. Abra o link você mesmo antes de mandar aos participantes (ou use um monitor gratuito como UptimeRobot pingando `/api/health` a cada 10 min).
- 750 h/mês de instância — suficiente para 1 serviço ligado o mês todo.

Sem `DATABASE_URL`, o app salva em disco (`DATA_DIR`), útil localmente ou em planos com disco.

## Rodar localmente

```bash
npm install
npm run dev          # http://localhost:3000 (hot reload, dados em ./data)
```

Produção local:

```bash
npm run build
npm start            # usa PORT e DATA_DIR do ambiente
```

Docker:

```bash
docker build -t ux-test-lab .
docker run -p 3000:3000 -v $(pwd)/data:/var/data ux-test-lab
```

## Rotina para cada novo teste

1. **Criar Teste** no painel (nome, tarefas, URL do protótipo `*.figma.site`).
2. No protótipo Figma Make, adicione `UXLab.init({ testId, trackingId })` com os IDs mostrados e publique.
3. **Validador Runtime** → confirma o SDK e libera o link.
4. Em *Resultados* → **Copiar Link /share** e envie aos participantes.
5. Acompanhe os resultados no painel; para zerar um teste: `POST /api/tests/<ID>/reset`.

## Backup

Com Neon: o painel do Neon tem backups/branches automáticos; as tabelas são `uxlab_store` e `uxlab_snapshots`. Em disco: copie `db.json` e `snapshots.json` de `DATA_DIR`.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta HTTP (o Render define sozinho) |
| `DATABASE_URL` | — | Postgres (Neon/Supabase). Se definido, substitui o disco |
| `DATA_DIR` | `./data` | Pasta do banco JSON (quando não há `DATABASE_URL`) |
| `APP_URL` | host da requisição | Base dos links gerados |
| `NODE_ENV` | — | `production` serve o build de `dist/` |
