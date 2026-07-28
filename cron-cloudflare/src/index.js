/**
 * Cron do Meu Bixin — Cloudflare Worker.
 *
 * Substitui o disparo MANUAL das telas temporárias (Fase 2e). Bate nas duas
 * rotas públicas do backend, protegidas por WORKER_TOKEN (header x-worker-token):
 *
 *   POST /agenda/lembretes/processar  → envia lembretes vencidos (agendamento + dose)
 *   POST /retencao/processar          → envia campanhas de retenção pendentes
 *
 * Dois agendamentos (ver wrangler.toml), separados porque lembrete é sensível a
 * horário (24h/2h antes da consulta) e campanha de retenção não é:
 *   - lembretes: a cada 15 minutos
 *   - retenção:  de hora em hora, aos :05
 * (as expressões cron estão nas constantes abaixo — escrevê-las aqui fecharia
 * este bloco de comentário, porque a barra-asterisco de "a cada 15" termina o /*)
 *
 * Sem retentativa automática (limitação do Cron Trigger). Não é problema aqui:
 * o motor é idempotente e reprocessa — quem ficou 'pendente' e vencido sai na
 * execução seguinte. Cada lembrete é reivindicado com
 * `UPDATE ... st_status='enviando' WHERE st_status='pendente'`, então uma
 * execução sobreposta não duplica envio.
 */

const CRON_LEMBRETES = '*/15 * * * *';
const CRON_RETENCAO = '5 * * * *';

// A Vercel corta a função bem antes disso; o limite aqui é só para o Worker não
// ficar pendurado se o backend não responder.
const TIMEOUT_MS = 25_000;

async function chamar(env, caminho) {
  const base = (env.BACKEND_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('BACKEND_URL não configurada');
  if (!env.WORKER_TOKEN) throw new Error('WORKER_TOKEN não configurado (wrangler secret put WORKER_TOKEN)');

  const inicio = Date.now();
  const resp = await fetch(`${base}${caminho}`, {
    method: 'POST',
    headers: {
      'x-worker-token': env.WORKER_TOKEN,
      'content-type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const texto = await resp.text();
  const ms = Date.now() - inicio;

  // 401 aqui = token do Worker diferente do WORKER_TOKEN da Vercel.
  if (!resp.ok) {
    throw new Error(`${caminho} → HTTP ${resp.status} em ${ms}ms: ${texto.slice(0, 300)}`);
  }
  console.log(`${caminho} → HTTP ${resp.status} em ${ms}ms: ${texto.slice(0, 300)}`);
  return texto;
}

// Roda os alvos do agendamento que disparou. allSettled para que a falha de um
// não impeça o outro (relevante quando os dois rodam no mesmo tick).
async function executar(env, alvos) {
  const res = await Promise.allSettled(alvos.map((c) => chamar(env, c)));
  const erros = res.filter((r) => r.status === 'rejected');
  erros.forEach((r) => console.error('FALHA:', r.reason?.message || r.reason));
  return { total: alvos.length, ok: alvos.length - erros.length, erros: erros.length };
}

function alvosDoCron(cron) {
  if (cron === CRON_RETENCAO) return ['/retencao/processar'];
  if (cron === CRON_LEMBRETES) return ['/agenda/lembretes/processar'];
  // Agendamento desconhecido (alguém mexeu no wrangler.toml): roda os dois.
  return ['/agenda/lembretes/processar', '/retencao/processar'];
}

export default {
  async scheduled(event, env, ctx) {
    const alvos = alvosDoCron(event.cron);
    console.log(`cron "${event.cron}" → ${alvos.join(', ')}`);
    ctx.waitUntil(executar(env, alvos));
  },

  // Disparo manual, para validar a configuração sem esperar 15 min:
  //   curl -X POST https://<worker>.workers.dev -H "x-worker-token: <token>"
  // Exige o MESMO token do backend — sem ele o Worker não expõe nada.
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    if (!env.WORKER_TOKEN || request.headers.get('x-worker-token') !== env.WORKER_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
    const url = new URL(request.url);
    const alvos = url.searchParams.get('alvo') === 'retencao'
      ? ['/retencao/processar']
      : url.searchParams.get('alvo') === 'lembretes'
        ? ['/agenda/lembretes/processar']
        : ['/agenda/lembretes/processar', '/retencao/processar'];

    const r = await executar(env, alvos);
    return Response.json({ disparado: alvos, ...r });
  },
};
