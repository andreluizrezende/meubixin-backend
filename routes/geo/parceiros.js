'use strict';
/*
 * PARCEIROS PRÓXIMOS — alimenta a tela "Onde comprar" do app do responsável.
 *
 * Router PÚBLICO (o app consome sem sessão) → montar ANTES dos routers que
 * fazem `route.use(requireAuth)` sem path, senão cai em 401. Mesma regra do
 * `routes/geo/veterinarios.js`, que este arquivo espelha.
 *
 * ⚠️ O caminho é `/geo/parceiros-proximos`, e NÃO `/web-parceiros/proximos`:
 * já existe `GET /web-parceiros/:id` em `routes/parceiros/paceiros.js`, que
 * casaria "proximos" como id. Namespace próprio elimina a colisão
 * independentemente da ordem de montagem — foi a mesma decisão do vet.
 *
 * ---------------------------------------------------------------------------
 * POR QUE `web_parceiros` E NÃO `mob_parcerias` (08/08/2026)
 *
 * São duas tabelas, e a escolha não é indiferente:
 *
 *   mob_parcerias   parcerias que um USUÁRIO cadastra pelo app. Guarda estado,
 *                   cidade e CEP — sem logradouro e SEM COORDENADA.
 *   web_parceiros   a empresa parceira de fato: endereço completo, CNPJ, login
 *                   próprio, e já traz `nu_latitude`/`nu_longitude`.
 *
 * 🔴 NÃO HÁ FK ENTRE AS DUAS. Ao contrário de
 * `web_veterinarios.mob_veterinarios_id`, nenhuma coluna liga um registro ao
 * outro — a relação é conceitual. Não tente juntá-las: casar por nome é frágil,
 * e `mob_parcerias` não tem CNPJ para casar direito.
 *
 * 💡 Escolher `web_parceiros` também resolve de graça a restrição do projeto de
 * NÃO ALTERAR tabelas `mob_`: nada em `mob_` é tocado. Pela outra tabela seria
 * preciso uma satélite só para guardar endereço e coordenada.
 *
 * ⚠️ O cadastro do parceiro vive no SISTEMA WEB, onde há autenticação. O app
 * só lê — por isso aqui existe apenas o GET.
 * ---------------------------------------------------------------------------
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize } = models;

const RAIO_PADRAO_KM = 25;
const RAIO_MAX_KM = 200;
const LIMITE_PADRAO = 50;

/*
 * ⚠️ Raio maior que o dos veterinários (padrão 20, teto 100), de propósito: o
 * vet a domicílio VAI ATÉ VOCÊ, então raio grande não faz sentido; a loja é o
 * responsável quem alcança, e onde há poucos revendedores 100 km pode devolver
 * lista vazia. Os chips do app espelham estes valores.
 */

// GET /geo/parceiros-proximos?lat=&lng=&raio=&limite=
route.get('/geo/parceiros-proximos', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'Informe lat e lng válidos.' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Coordenadas fora do intervalo válido.' });
    }

    const raio = Math.min(Math.max(Number(req.query.raio) || RAIO_PADRAO_KM, 1), RAIO_MAX_KM);
    const limite = Math.min(Math.max(Number(req.query.limite) || LIMITE_PADRAO, 1), 200);

    /*
     * ST_Distance_Sphere devolve METROS e existe no MariaDB 10.4 (dev) e no
     * MySQL 8.0 (produção). Atenção à ordem: POINT(longitude, latitude).
     *
     * 🔴 AS COLUNAS SÃO LISTADAS UMA A UMA, e isso não é estilo: `web_parceiros`
     * guarda `ds_senha`, `ds_email`, `nu_cnpj` e `google_id`, e ESTA ROTA É
     * ABERTA. Um `SELECT *` aqui vazaria credencial para qualquer um com a URL.
     */
    const linhas = await sequelize.query(
      `SELECT p.id, p.no_empresa, p.nu_telefone_completo, p.ds_logo_s3,
              p.ds_endereco, p.ds_complemento, p.ds_bairro, p.ds_cidade,
              p.ds_estado, p.nu_cep,
              p.nu_latitude, p.nu_longitude,
              ROUND(ST_Distance_Sphere(
                POINT(p.nu_longitude, p.nu_latitude),
                POINT(:lng, :lat)
              ) / 1000, 2) AS distancia_km
         FROM web_parceiros p
        WHERE p.nu_latitude IS NOT NULL
          AND p.nu_longitude IS NOT NULL
       HAVING distancia_km <= :raio
        ORDER BY distancia_km ASC
        LIMIT :limite`,
      { replacements: { lat, lng, raio, limite }, type: QueryTypes.SELECT }
    );

    const parceiros = linhas.map((p) => ({
      id: p.id,
      nome: p.no_empresa,
      telefone: p.nu_telefone_completo,
      logo: p.ds_logo_s3 || null,
      endereco: [
        [p.ds_endereco, p.ds_complemento].filter(Boolean).join(', '),
        p.ds_bairro,
        [p.ds_cidade, p.ds_estado].filter(Boolean).join('/'),
      ].filter(Boolean).join(' — '),
      latitude: p.nu_latitude != null ? Number(p.nu_latitude) : null,
      longitude: p.nu_longitude != null ? Number(p.nu_longitude) : null,
      distancia_km: Number(p.distancia_km),
    }));

    return res.json({ success: true, raio_km: raio, total: parceiros.length, parceiros });
  } catch (err) {
    console.error('GET /geo/parceiros-proximos', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar parceiros próximos: ' + err.message });
  }
});

module.exports = route;
