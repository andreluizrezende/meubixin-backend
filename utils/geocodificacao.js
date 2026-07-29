'use strict';
/*
 * Geocodificação de endereços — converte o endereço profissional do veterinário
 * em latitude/longitude para a busca "veterinários próximos".
 *
 * Provedor: Nominatim (OpenStreetMap), gratuito e sem chave. A política de uso
 * (https://operations.osmfoundation.org/policies/nominatim/) exige:
 *   - User-Agent identificando a aplicação  → obrigatório, senão devolve 403
 *   - no máximo 1 requisição por segundo    → fila serial com espaçamento
 *   - nada de geocodificação em massa       → aqui só roda quando o vet SALVA o
 *     perfil, então o volume é naturalmente baixo
 *
 * Falha é sempre silenciosa (retorna null): endereço que não geocodifica não
 * pode impedir o veterinário de salvar o perfil. Ele fica sem coordenada e
 * simplesmente não aparece no mapa até corrigir o endereço ou ajustar o pino.
 *
 * Para trocar de provedor (ex.: Google), basta reimplementar `consultar`.
 */
const https = require('https');

const NOMINATIM_HOST = 'nominatim.openstreetmap.org';
const INTERVALO_MS = 1100; // > 1s exigido pela política
const TIMEOUT_MS = 8000;

// A política pede identificação real da aplicação e um contato.
const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || 'MeuBixin/1.0 (suporte@cicatribio.com.br)';

let ultimaChamada = 0;

// Espaça as chamadas para não violar o limite de 1 req/s. Como as requisições
// podem chegar concorrentes, a espera é calculada sobre um relógio compartilhado
// e o marcador é reservado ANTES do await (senão duas chamadas simultâneas
// calculariam a mesma folga e sairiam juntas).
async function respeitarLimite() {
  const agora = Date.now();
  const alvo = Math.max(agora, ultimaChamada + INTERVALO_MS);
  ultimaChamada = alvo;
  const espera = alvo - agora;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

function consultar(query) {
  return new Promise((resolve) => {
    const caminho = '/search?' + new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'br', // o sistema é brasileiro; reduz falso positivo
      addressdetails: '0',
    }).toString();

    const req = https.get({
      host: NOMINATIM_HOST,
      path: caminho,
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
      timeout: TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode !== 200) {
        console.warn('[geo] Nominatim HTTP', res.statusCode, 'para:', query);
        res.resume();
        return resolve(null);
      }
      let corpo = '';
      res.on('data', (c) => { corpo += c; });
      res.on('end', () => {
        try {
          const dados = JSON.parse(corpo);
          if (!Array.isArray(dados) || dados.length === 0) return resolve(null);
          const lat = Number(dados[0].lat);
          const lon = Number(dados[0].lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return resolve(null);
          resolve({ latitude: lat, longitude: lon });
        } catch {
          resolve(null);
        }
      });
    });

    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', (e) => { console.warn('[geo] erro:', e.message); resolve(null); });
  });
}

// Monta o texto do endereço a partir das colunas do perfil. Sem cidade a busca
// fica ambígua demais (há "Rua das Flores" em todo lugar) — nesse caso desiste.
function montarEndereco(p = {}) {
  const cidade = (p.ds_cidade || '').trim();
  if (!cidade) return null;
  const rua = [p.ds_logradouro, p.nu_numero].filter(Boolean).join(', ').trim();
  return [rua, p.ds_bairro, cidade, p.ds_uf, p.nu_cep, 'Brasil']
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Geocodifica um endereço. Tenta o endereço completo e, se não achar, cai para
 * cidade/UF — coordenada aproximada é melhor que nenhuma para uma busca por raio.
 * @returns {Promise<{latitude:number, longitude:number, aproximado:boolean}|null>}
 */
async function geocodificar(perfil) {
  const completo = montarEndereco(perfil);
  if (!completo) return null;

  await respeitarLimite();
  const exato = await consultar(completo);
  if (exato) return { ...exato, aproximado: false };

  // Fallback: só cidade/UF. Útil para o vet que não preencheu logradouro.
  const cidadeUf = [perfil.ds_cidade, perfil.ds_uf, 'Brasil'].filter(Boolean).join(', ');
  await respeitarLimite();
  const aprox = await consultar(cidadeUf);
  return aprox ? { ...aprox, aproximado: true } : null;
}

module.exports = { geocodificar, montarEndereco };
