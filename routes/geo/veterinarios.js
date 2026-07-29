'use strict';
/*
 * Busca de VETERINÁRIOS PRÓXIMOS — alimenta o mapa do app do responsável.
 *
 * Router PÚBLICO (o app consome sem sessão de vet) → montar ANTES dos routers
 * que fazem `route.use(requireAuth)` sem path (connect/cobrancas/assinatura),
 * senão cai em 401.
 *
 * Privacidade: só entram os veterinários que marcaram `st_atende_domicilio`
 * (opt-in, default 0) E que têm coordenada. Nada de e-mail/CPF do profissional
 * na resposta — o contato acontece pela solicitação de agendamento, não por
 * dados soltos numa rota aberta.
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize } = models;

const RAIO_PADRAO_KM = 20;
const RAIO_MAX_KM = 100;
const LIMITE_PADRAO = 50;

// GET /geo/veterinarios-proximos?lat=&lng=&raio=&limite=
//
// ⚠️ O caminho NÃO é /veterinarios/proximos de propósito: já existe
// `GET /veterinarios/:id` (routes/veterinarios/veterinarios.js), montado antes,
// que casaria "proximos" como id e devolveria [] silenciosamente. Namespace
// próprio elimina a colisão independentemente da ordem de montagem.
route.get('/geo/veterinarios-proximos', async (req, res) => {
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

    // ST_Distance_Sphere devolve METROS e existe tanto no MariaDB 10.4 (dev)
    // quanto no MySQL 8.0 (produção) — conferido nos dois antes de usar.
    // Atenção à ordem: POINT(longitude, latitude).
    const linhas = await sequelize.query(
      `SELECT v.id, v.no_completo, v.nu_crmv, v.ds_estado_crmv,
              v.ds_clinica_nome, v.nu_telefone_completo,
              v.ds_logradouro, v.nu_numero, v.ds_bairro, v.ds_cidade, v.ds_uf,
              v.nu_latitude, v.nu_longitude, v.nu_raio_km,
              ROUND(ST_Distance_Sphere(
                POINT(v.nu_longitude, v.nu_latitude),
                POINT(:lng, :lat)
              ) / 1000, 2) AS distancia_km
         FROM web_veterinarios v
        WHERE v.st_atende_domicilio = 1
          AND v.nu_latitude IS NOT NULL
          AND v.nu_longitude IS NOT NULL
       HAVING distancia_km <= :raio
              -- respeita o raio que o próprio vet declarou atender: se ele só
              -- vai até 15 km, não aparece para quem está a 40 km
          AND (v.nu_raio_km IS NULL OR distancia_km <= v.nu_raio_km)
        ORDER BY distancia_km ASC
        LIMIT :limite`,
      { replacements: { lat, lng, raio, limite }, type: QueryTypes.SELECT }
    );

    const veterinarios = linhas.map((v) => ({
      id: v.id,
      nome: v.no_completo,
      crmv: `${v.nu_crmv}-${v.ds_estado_crmv}`,
      clinica: v.ds_clinica_nome,
      telefone: v.nu_telefone_completo,
      endereco: [
        [v.ds_logradouro, v.nu_numero].filter(Boolean).join(', '),
        v.ds_bairro,
        [v.ds_cidade, v.ds_uf].filter(Boolean).join('/'),
      ].filter(Boolean).join(' — '),
      latitude: v.nu_latitude != null ? Number(v.nu_latitude) : null,
      longitude: v.nu_longitude != null ? Number(v.nu_longitude) : null,
      distancia_km: Number(v.distancia_km),
      raio_atendimento_km: v.nu_raio_km,
    }));

    return res.json({ success: true, raio_km: raio, total: veterinarios.length, veterinarios });
  } catch (err) {
    console.error('GET /geo/veterinarios-proximos', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar veterinários próximos: ' + err.message });
  }
});

module.exports = route;
