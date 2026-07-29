> # ⚠️ SEM USO — REMOVER A PARTIR DE 15/08/2026
>
> **A Fase 2e foi fechada por outro caminho.** Desde 29/07/2026 o cron roda em
> **GitHub Actions**, pelo workflow `.github/workflows/cron-workers.yml` do repo
> do **web** (`cicatribiovet-web`), já validado em produção. Este Worker nunca
> chegou a ser publicado.
>
> **Por que o Actions ganhou:** não exige conta na Cloudflare nem `wrangler`, e o
> código já vive no GitHub — um passo de infraestrutura a menos para manter.
>
> **Por que o workflow não ficou no repo do backend:** `on: schedule` só dispara
> a partir da branch PADRÃO do repositório, e aqui a padrão é
> `não-veterinários-versão-2.0`, enquanto produção sai da `server`. Um workflow
> commitado neste repo nunca rodaria — e falharia em silêncio.
>
> **Antes de apagar esta pasta**, confira se o cron do Actions continua de pé.
> Este é o plano B: se a cadência do Actions atrasar demais (o GitHub não garante
> pontualidade e desativa workflows agendados após 60 dias sem atividade no
> repositório), os Cron Triggers da Cloudflare são disparo dedicado e pontual.
>
> Diferença de cadência entre os dois, se for retomar: aqui a retenção era de
> hora em hora; no Actions ficou 1×/dia às 09:00 BRT, por ser marketing.

# Cron do Meu Bixin (Cloudflare Worker)

Fecha a **Fase 2e**: dispara automaticamente os lembretes da agenda e as campanhas
de retenção, que hoje só saem quando alguém clica nas telas temporárias.

Roda no **plano gratuito** da Cloudflare (Cron Triggers não têm custo próprio; as
execuções contam na cota normal de requisições do Workers).

| Agendamento | Chama | Por quê |
|---|---|---|
| a cada 15 min | `POST /agenda/lembretes/processar` | lembrete é sensível a horário (24h/2h antes da consulta) |
| de hora em hora (:05) | `POST /retencao/processar` | campanha não tem hora marcada |

> Por que não Vercel Cron: no plano **Hobby** o mínimo é **1 execução por dia**, e
> uma expressão mais frequente falha no deploy. Só serviria no Pro.

---

## ⚠️ Antes de tudo: confirme o `WORKER_TOKEN` na Vercel

As rotas checam o token assim:

```js
if (tokenEnv && req.headers['x-worker-token'] !== tokenEnv) return 401
```

Repare no `tokenEnv &&`: **se `WORKER_TOKEN` não estiver definido nas env vars de
Production da Vercel, as rotas ficam abertas a qualquer um** — e
`/agenda/lembretes/processar` envia e-mail e WhatsApp de verdade para os
responsáveis. Garanta que a variável existe em Production **antes** de expor o
endereço do backend a um agendador.

---

## Deploy (5 passos)

```bash
cd backend/cron-cloudflare

# 1. Editar wrangler.toml → BACKEND_URL = URL do backend em produção (sem / no fim).
#    É o mesmo valor do NEXT_PUBLIC_API_URL de Production do frontend.

# 2. Autenticar na Cloudflare (abre o navegador)
npx wrangler login

# 3. Gravar o token — MESMO valor do WORKER_TOKEN da Vercel
npx wrangler secret put WORKER_TOKEN

# 4. Publicar (já cria os dois cron triggers)
npx wrangler deploy

# 5. Testar sem esperar 15 min (o Worker exige o mesmo token)
curl -X POST "https://meubixin-cron.<SUA-CONTA>.workers.dev?alvo=lembretes" \
  -H "x-worker-token: <o mesmo token>"
```

O passo 5 deve responder algo como `{"disparado":["/agenda/lembretes/processar"],
"total":1,"ok":1,"erros":0}`. Sem o parâmetro `alvo`, dispara os dois.

### Ver os logs

```bash
npx wrangler tail
```

Cada execução loga a rota, o HTTP e o tempo — ex.:
`/agenda/lembretes/processar → HTTP 200 em 812ms: {"success":true,"enviados":3,...}`

---

## Validação de que está funcionando

Depois de ~1h, abra a tela **Lembretes** no app do vet: os que estavam `pendente`
com "Dispara em" no passado devem ter virado **`enviado`**. Se continuarem
pendentes, veja "Se der errado".

## Se der errado

| Sintoma | Causa provável |
|---|---|
| `HTTP 401` no log do Worker | Token do Worker ≠ `WORKER_TOKEN` da Vercel. Regrave com `wrangler secret put`. |
| `HTTP 404` | `BACKEND_URL` errada, ou o backend publicado é antigo e não tem as rotas do motor. |
| `HTTP 500` | Erro real do motor — a mensagem vem no corpo (o backend inclui `err.message`). |
| Nada acontece, sem log | `[observability]` desligado no `wrangler.toml`, ou o deploy não criou os triggers (`npx wrangler deployments list`). |
| Roda, `enviados: 0`, e a tela segue pendente | Nenhum lembrete **vencido**: só sai quando `dt_agendado_para <= NOW()`. Confira a coluna "Dispara em". |

**Sem retentativa automática** — se uma execução falhar, o Cron Trigger não repete.
Não é grave aqui: o motor é idempotente e reprocessa na execução seguinte (cada
lembrete é reivindicado com `UPDATE ... st_status='enviando' WHERE st_status='pendente'`,
então execuções sobrepostas não duplicam envio).

## Quando o cron estiver no ar

A tela `src/app/agenda/lembretes/page.tsx` é **temporária** (o próprio arquivo diz
isso no topo) — existe só para disparar na mão enquanto não havia cron. Com o cron
rodando, os botões "Disparar lembretes agora" e o equivalente da Retenção viram
ferramenta de depuração; a tela pode ser simplificada ou removida.
