# Worker do Bulário da ANVISA

Faz o **Consultar Bula** funcionar em produção. A Vercel **não roda Chrome** (e o
IP de datacenter é bloqueado pelo Cloudflare da ANVISA), então o backend na Vercel
**encaminha** as rotas `/bulario/*` para este worker, que roda o crawler
(Puppeteer) num host de **IP "bom"** (residencial/empresarial).

```
Vercel (backend) ──► cache MySQL (web_bulas_cache) ──(hit)──► resposta instantânea
                       └─(miss)─► ESTE WORKER (Chrome, host IP bom) ──► grava cache
```

O toggle é a env var **`ANVISA_WORKER_URL`** no backend:
- **definida** → o backend encaminha `/bulario/*` para o worker;
- **vazia** → o backend roda o crawler direto (dev local).

---

## A. Host do worker

- Máquina **sempre ligada** com **IP residencial/empresarial** (mesma condição em
  que o crawler funciona localmente).
- ⚠️ **VPS de datacenter comum tende a ser bloqueado pelo Cloudflare** (igual à
  Vercel). Se for VPS, use **proxy residencial**.
- Precisa de: **Node**, **Google Chrome** instalado, e poder abrir janela
  (headful) na primeira execução.

## B. Rodar o worker

```bash
git clone -b server https://github.com/andreluizrezende/meubixin-backend
cd meubixin-backend && npm install
```

Primeira vez **com janela** (para resolver o desafio do Cloudflare uma vez):

```powershell
set WORKER_TOKEN=um-segredo-forte
node worker/anvisaWorker.js
```

- Na 1ª busca, **resolva o Cloudflare** na janela do Chrome. O perfil persistente
  (`.anvisa-chrome-profile`, no `.gitignore`) guarda o cookie.
- Depois, opcional sem janela: `set ANVISA_HEADLESS=1 && node worker/anvisaWorker.js`.

Manter o processo vivo (recomendado **pm2**):

```bash
npm i -g pm2
pm2 start worker/anvisaWorker.js --name anvisa-worker
pm2 save
# pm2 startup  → para subir junto com a máquina
```

### Variáveis de ambiente do worker
| Var | Papel |
|-----|-------|
| `WORKER_TOKEN` | Exige o header `x-worker-token` igual (proteção). **Defina em produção.** |
| `WORKER_PORT` | Porta (padrão `4700`). |
| `ANVISA_HEADLESS` | `1` = sem janela (só depois que o perfil já passou o desafio). |
| `CHROME_PATH` | Caminho do Chrome, se não for detectado automaticamente. |
| `ANVISA_NO_CACHE` | Já setado como `1` dentro do worker (o cache vive no backend). |

Teste local do worker: `GET http://localhost:4700/health` → `{ "ok": true }`.

## C. Expor na internet (a Vercel precisa alcançar)

Se a máquina está atrás de NAT, use um **túnel** com URL pública + HTTPS:

- **Cloudflare Tunnel** (grátis, recomendado) ou **ngrok**.
- Ex.: `cloudflared tunnel --url http://localhost:4700` → gera algo como
  `https://anvisa-worker.seudominio.com`.

Segurança: o worker já exige `x-worker-token`. Não exponha sem token.

## D. Configurar a Vercel (projeto `meubixin-backend`)

Em **Settings → Environment Variables** (ambiente **Production**):

| Var | Valor |
|-----|-------|
| `ANVISA_WORKER_URL` | URL pública do worker (ex.: `https://anvisa-worker.seudominio.com`) |
| `WORKER_TOKEN` | **O mesmo** segredo do passo B |

Depois, **dispare um novo deploy** (env var só vale após redeploy).

## E. Validar

Em produção: Prescrições → Farmácia → **Consultar Bula** → buscar "dipirona".
- A Vercel encaminha para o worker → retorna os resultados.
- A 1ª bula de cada medicamento popula o cache (`web_bulas_cache`); **repetições
  ficam instantâneas** e nem chamam o worker.

## Detalhes que evitam dor de cabeça

- **Timeout da Vercel (~10s)**: o proxy aborta em **9s** (`routes/bulario/bulario.js`).
  Com o worker **quente** (Chrome aberto + Cloudflare resolvido), a busca leva
  ~3–4s (cabe). Mantenha o worker sempre rodando (pm2) para não esfriar.
- **Cache** reduz a carga: só o primeiro acesso a cada medicamento chama o worker.
- Se o Cloudflare voltar a pedir desafio, resolva de novo na janela (ou rode
  headful pontualmente).

## Arquivos relacionados
- `worker/anvisaWorker.js` — servidor do worker (reusa a rota + o motor).
- `utils/anvisaBulario.js` — motor do crawler (Puppeteer + pdf-parse).
- `routes/bulario/bulario.js` — rota com cache-first + proxy (toggle `ANVISA_WORKER_URL`).
- `models/web_bulas_cache.js` — cache das bulas (vive no backend/Vercel).
