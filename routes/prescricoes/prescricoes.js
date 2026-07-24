const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_tutores, WebAnamneses, WebProtocolos, WebProtocolosAgendas } = models;
const MobProtocolosSaude = models['mob_protocolos_saude'];
const { Op } = require('sequelize');
const { uploadToS3, getSignedUrlForDownload } = require("../../utils/s3_teste");
const {verifyPDF} = require("../../utils/pdfVerification")

const sequelize = models.sequelize;

// Função auxiliar para gerar agendas baseadas no protocolo
const gerarAgendas = (protocoloId, numDoses, intervalo, tipoIntervalo, dataInicial) => {
  const agendas = [];
  const dataBase = new Date(dataInicial);

  for (let i = 0; i < numDoses; i++) {
    const dataAplicacao = new Date(dataBase);

    // Calcular data baseada no intervalo (primeira dose = data da anamnese)
    if (i > 0) {
      switch (tipoIntervalo) {
        case 'H': // Horas
          dataAplicacao.setHours(dataBase.getHours() + (intervalo * i));
          break;
        case 'D': // Dias
          dataAplicacao.setDate(dataBase.getDate() + (intervalo * i));
          break;
        case 'M': // Meses
          dataAplicacao.setMonth(dataBase.getMonth() + (intervalo * i));
          break;
        case 'A': // Anos
          dataAplicacao.setFullYear(dataBase.getFullYear() + (intervalo * i));
          break;
        default:
          // Default para dias se tipo não reconhecido
          dataAplicacao.setDate(dataBase.getDate() + (intervalo * i));
      }
    }

    agendas.push({
      web_protocolos_id: protocoloId,
      dt_data_aplicacao: dataAplicacao.toISOString(),
      st_concluido: 0
    });
  }

  return agendas;
};

// ========= ROTAS EXISTENTES DE TUTORES =========

route.get('/tutores', async (req, res) => {
  try {
    const resposta = await mob_tutores.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});

route.get('/tutores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tutores.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});

route.get('/tutoresCpf/:nu_cpf', async (req, res) => {
  try {
    const { nu_cpf } = req.params;
    const resposta = await mob_tutores.findOne({ where: { nu_cpf } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});

route.post('/tutores', async (req, res) => {
  try {
    const { no_completo, nu_cpf, ds_email, nu_telefone_completo } = req.body;
    const resposta = await mob_tutores.create({ no_completo, nu_cpf, ds_email, nu_telefone_completo });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tutores');
    console.log(error.message);
  }
});

route.put('/tutores', async (req, res) => {
  try {
    const { id, no_completo, nu_cpf, ds_email, nu_telefone_completo } = req.body;
    const resposta = await mob_tutores.update({ no_completo, nu_cpf, ds_email, nu_telefone_completo }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tutores');
    console.log(error.message);
  }
});

route.delete('/tutores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tutores.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});

// ========= NOVAS ROTAS DE PRESCRIÇÕES =========

// Criar prescrição completa (anamnese + protocolos + agendas)
route.post('/prescricoes', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { anamnese, protocolos } = req.body;

    // Validação básica
    if (!anamnese || !anamnese.mob_animais_id || !anamnese.web_veterinarios_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Dados da anamnese incompletos'
      });
    }

    // 1. Criar a anamnese
    const anamneseCriada = await WebAnamneses.create({
      web_veterinarios_id: anamnese.web_veterinarios_id,
      mob_animais_id: anamnese.mob_animais_id,
      dt_data_anamnese: anamnese.dt_data_anamnese,
      ds_quadro_clinico: anamnese.ds_quadro_clinico,
      ds_resultados_exames_anteriores: anamnese.ds_resultados_exames_anteriores,
      ds_diagnostico: anamnese.ds_diagnostico,
      ds_tratamento: anamnese.ds_tratamento,
      ds_orientacoes: anamnese.ds_orientacoes,
      vl_peso: anamnese.vl_peso,
      ds_temperatura: anamnese.ds_temperatura
    }, { transaction });

    console.log('Anamnese criada:', anamneseCriada.id);

    // 2. Criar protocolos e suas agendas
    const protocolosCriados = [];
    const agendasCriadas = [];

    for (const protocolo of protocolos || []) {
      // Criar o protocolo
      const protocoloCriado = await WebProtocolos.create({
        web_anamneses_id: anamneseCriada.id,
        web_protocolos_saude_id: protocolo.web_protocolos_saude_id,
        nome_protocolo: protocolo.nome_protocolo || null,
        st_uso_humano: !!protocolo.st_uso_humano,
        ds_concentracao: protocolo.ds_concentracao || null,
        ds_forma_farmaceutica: protocolo.ds_forma_farmaceutica || null,
        ds_quantidade: protocolo.ds_quantidade || null,
        ds_via_administracao: protocolo.ds_via_administracao || null,
        nu_doses: protocolo.nu_doses,
        nu_intervalo_uso: protocolo.nu_intervalo_uso,
        tipo_intervalo_uso: protocolo.tipo_intervalo_uso,
        ds_dosagem: protocolo.ds_dosagem,
        st_tipo_protocolo: protocolo.st_tipo_protocolo
      }, { transaction });

      protocolosCriados.push(protocoloCriado);
      console.log('Protocolo criado:', protocoloCriado.id);

      // Gerar e criar agendas para este protocolo
      const agendasProtocolo = gerarAgendas(
        protocoloCriado.id,
        protocolo.nu_doses,
        protocolo.nu_intervalo_uso,
        protocolo.tipo_intervalo_uso,
        anamnese.dt_data_anamnese
      );

      // Criar as agendas no banco
      for (const agenda of agendasProtocolo) {
        const agendaCriada = await WebProtocolosAgendas.create({
          web_protocolos_id: protocoloCriado.id,
          dt_data_aplicacao: agenda.dt_data_aplicacao,
          st_concluido: 0 // Sempre inicia como não concluído
        }, { transaction });

        agendasCriadas.push(agendaCriada);
      }

      console.log(`${agendasProtocolo.length} agendas criadas para protocolo ${protocoloCriado.id}`);
    }

    // Commit da transação
    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Prescrição criada com sucesso',
      data: {
        anamneseId: anamneseCriada.id,
        totais: {
          protocolos: protocolosCriados.length,
          agendas: agendasCriadas.length,
          vacinas: protocolosCriados.filter(p => p.st_tipo_protocolo === 0).length,
          medicamentos: protocolosCriados.filter(p => p.st_tipo_protocolo === 1).length,
          vermifugos: protocolosCriados.filter(p => p.st_tipo_protocolo === 2).length
        }
      }
    });

  } catch (error) {
    // Rollback em caso de erro
    await transaction.rollback();

    console.log('ERRO em /prescricoes');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao criar prescrição',
      error: error.message
    });
  }
});

// Editar prescrição completa (anamnese + protocolos + agendas)
route.put('/prescricoes/:anamneseId', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { anamneseId } = req.params;
    const { anamnese, protocolos, agendas: agendasStatus } = req.body;

    console.log('=== PUT /prescricoes/:anamneseId ===');
    console.log('anamneseId (raw):', anamneseId, '| tipo:', typeof anamneseId);
    console.log('anamnese recebida:', JSON.stringify(anamnese, null, 2));
    console.log('protocolos recebidos:', JSON.stringify(protocolos, null, 2));

    if (!anamneseId || !anamnese) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Dados da anamnese são obrigatórios'
      });
    }

    // Verificar se a anamnese existe antes de qualquer coisa
    const anamneseExistente = await WebAnamneses.findOne({
      where: { id: parseInt(anamneseId) },
      transaction
    });

    console.log('Anamnese existente no banco:', anamneseExistente ? `encontrada (id: ${anamneseExistente.id})` : 'NÃO ENCONTRADA');

    if (!anamneseExistente) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Anamnese ${anamneseId} não encontrada no banco`
      });
    }

    // 1. Atualizar a anamnese existente
    const updateResult = await WebAnamneses.update({
      web_veterinarios_id: anamnese.web_veterinarios_id,
      mob_animais_id: anamnese.mob_animais_id,
      dt_data_anamnese: anamnese.dt_data_anamnese,
      ds_quadro_clinico: anamnese.ds_quadro_clinico,
      ds_resultados_exames_anteriores: anamnese.ds_resultados_exames_anteriores,
      ds_diagnostico: anamnese.ds_diagnostico,
      ds_tratamento: anamnese.ds_tratamento,
      ds_orientacoes: anamnese.ds_orientacoes,
      vl_peso: anamnese.vl_peso,
      ds_temperatura: anamnese.ds_temperatura
    }, {
      where: { id: parseInt(anamneseId) },
      transaction
    });

    console.log('Linhas afetadas pelo UPDATE da anamnese:', updateResult[0]);

    // 2. Buscar protocolos antigos
    const protocolosAntigos = await WebProtocolos.findAll({
      where: { web_anamneses_id: parseInt(anamneseId) },
      attributes: ['id'],
      transaction
    });

    const protocolosIds = protocolosAntigos.map(p => p.id);
    console.log(`Protocolos antigos encontrados: ${protocolosIds.length} | ids:`, protocolosIds);

    // 3. Deletar agendas antigas
    if (protocolosIds.length > 0) {
      const agendasDeletadas = await WebProtocolosAgendas.destroy({
        where: {
          web_protocolos_id: { [Op.in]: protocolosIds }
        },
        transaction
      });
      console.log('Agendas deletadas:', agendasDeletadas);
    }

    // 4. Deletar protocolos antigos
    const protocolosDeletados = await WebProtocolos.destroy({
      where: { web_anamneses_id: parseInt(anamneseId) },
      transaction
    });
    console.log('Protocolos deletados:', protocolosDeletados);

    // 5. Recriar protocolos e agendas
    const protocolosCriados = [];
    const agendasCriadas = [];

    for (let protocoloIdx = 0; protocoloIdx < (protocolos || []).length; protocoloIdx++) {
      const protocolo = protocolos[protocoloIdx];
      console.log('Criando protocolo:', JSON.stringify(protocolo));

      const protocoloCriado = await WebProtocolos.create({
        web_anamneses_id: parseInt(anamneseId),
        web_protocolos_saude_id: protocolo.web_protocolos_saude_id,
        nome_protocolo: protocolo.nome_protocolo || null,
        st_uso_humano: !!protocolo.st_uso_humano,
        ds_concentracao: protocolo.ds_concentracao || null,
        ds_forma_farmaceutica: protocolo.ds_forma_farmaceutica || null,
        ds_quantidade: protocolo.ds_quantidade || null,
        ds_via_administracao: protocolo.ds_via_administracao || null,
        nu_doses: protocolo.nu_doses,
        nu_intervalo_uso: protocolo.nu_intervalo_uso,
        tipo_intervalo_uso: protocolo.tipo_intervalo_uso,
        ds_dosagem: protocolo.ds_dosagem,
        st_tipo_protocolo: protocolo.st_tipo_protocolo
      }, { transaction });

      console.log('Protocolo criado com id:', protocoloCriado.id, '| web_anamneses_id:', protocoloCriado.web_anamneses_id);

      protocolosCriados.push(protocoloCriado);

      const agendasProtocolo = gerarAgendas(
        protocoloCriado.id,
        protocolo.nu_doses,
        protocolo.nu_intervalo_uso,
        protocolo.tipo_intervalo_uso,
        anamnese.dt_data_anamnese
      );

      console.log(`Agendas geradas para protocolo ${protocoloCriado.id}:`, agendasProtocolo.length);

      const statusDosesProtocolo = agendasStatus && agendasStatus[protocoloIdx] ? agendasStatus[protocoloIdx] : [];

      for (let agendaIdx = 0; agendaIdx < agendasProtocolo.length; agendaIdx++) {
        const agenda = agendasProtocolo[agendaIdx];
        const stConcluido = statusDosesProtocolo[agendaIdx]?.st_concluido === 1 ? 1 : 0;

        const agendaCriada = await WebProtocolosAgendas.create({
          web_protocolos_id: protocoloCriado.id,
          dt_data_aplicacao: agenda.dt_data_aplicacao,
          st_concluido: stConcluido
        }, { transaction });

        agendasCriadas.push(agendaCriada);
      }
    }

    console.log(`Total criado: ${protocolosCriados.length} protocolos, ${agendasCriadas.length} agendas`);

    // 6. Commit
    await transaction.commit();
    console.log('✅ Commit realizado com sucesso');

    // 7. Verificar se ainda existe após commit
    const anamneseAposCommit = await WebAnamneses.findOne({
      where: { id: parseInt(anamneseId) }
    });
    console.log('Anamnese após commit:', anamneseAposCommit ? `existe (mob_animais_id: ${anamneseAposCommit.mob_animais_id})` : 'SUMIU DO BANCO');

    res.json({
      success: true,
      message: 'Prescrição atualizada com sucesso',
      data: {
        anamneseId,
        totais: {
          protocolos: protocolosCriados.length,
          agendas: agendasCriadas.length,
          vacinas: protocolosCriados.filter(p => p.st_tipo_protocolo === 0).length,
          medicamentos: protocolosCriados.filter(p => p.st_tipo_protocolo === 1).length,
          vermifugos: protocolosCriados.filter(p => p.st_tipo_protocolo === 2).length
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ ERRO em PUT /prescricoes/:anamneseId:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao editar prescrição',
      error: error.message
    });
  }
});


// Buscar prescrições por veterinário
route.get('/prescricoes/veterinario/:veterinarioId', async (req, res) => {
  try {
    const { veterinarioId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows } = await WebAnamneses.findAndCountAll({
      where: {
        web_veterinarios_id: veterinarioId
      },
      include: [
        {
          model: WebProtocolos,
          as: 'protocolos',
          include: [
            {
              model: WebProtocolosAgendas,
              as: 'agendas'
            },
            {
              model: MobProtocolosSaude,
              as: 'protocolo_saude'
            }
          ]
        }
      ],
      order: [['dt_data_anamnese', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        prescricoes: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.log('ERRO em /prescricoes/veterinario');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar prescrições',
      error: error.message
    });
  }
});

route.get('/prescricoes/:anamneseId', async (req, res) => {
  try {
    const { anamneseId } = req.params;
    console.log("Buscando prescrição por ID:", anamneseId);

    // Buscar anamnese
    const [anamneseResults] = await sequelize.query(`
      SELECT * FROM web_anamneses WHERE id = ?
    `, {
      replacements: [anamneseId],
      type: sequelize.QueryTypes.SELECT
    });

    if (!anamneseResults) {
      return res.status(404).json({
        success: false,
        message: 'Prescrição não encontrada'
      });
    }

    const anamnese = anamneseResults;

    // Verificar se existe prescrição assinada
    const [registroAssinado] = await sequelize.query(`
      SELECT * FROM web_registros_prescricoes 
      WHERE web_anamneses_id = ? AND status = 'assinada'
      LIMIT 1
    `, {
      replacements: [anamneseId],
      type: sequelize.QueryTypes.SELECT
    });

    const assinada = !!registroAssinado;

    // Buscar protocolos
    const protocolos = await sequelize.query(`
      SELECT
        wp.*,
        COALESCE(wp.nome_protocolo, mps.ds_protocolos_saude) as nome_protocolo
      FROM web_protocolos wp
      LEFT JOIN web_protocolos_saude mps ON wp.web_protocolos_saude_id = mps.id
      WHERE wp.web_anamneses_id = ?
    `, {
      replacements: [anamneseId],
      type: sequelize.QueryTypes.SELECT
    });

    // Buscar agendas de todos os protocolos
    const protocoloIds = protocolos.map(p => p.id);
    let agendas = [];

    if (protocoloIds.length > 0) {
      agendas = await sequelize.query(`
        SELECT * FROM web_protocolos_agendas 
        WHERE web_protocolos_id IN (?)
        ORDER BY dt_data_aplicacao ASC
      `, {
        replacements: [protocoloIds],
        type: sequelize.QueryTypes.SELECT
      });
    }

    // Agrupar agendas por protocolo
    const agendasPorProtocolo = {};
    protocolos.forEach(protocolo => {
      agendasPorProtocolo[protocolo.id] = agendas.filter(
        agenda => agenda.web_protocolos_id === protocolo.id
      );
    });

    // Calcular progresso
    const totalDoses = agendas.length;
    const dosesAplicadas = agendas.filter(agenda => agenda.st_concluido === 1).length;

    // Montar resposta da prescrição
    const prescricao = {
      id: anamnese.id,
      anamnese_id: anamnese.id,
      mob_animais_id: anamnese.mob_animais_id,         // ← adicionado
      web_veterinarios_id: anamnese.web_veterinarios_id, // ← adicionado
      dt_data: anamnese.dt_data_anamnese,
      assinada: assinada,
      protocolos: protocolos.map(protocolo => ({
        ...protocolo,
        nome_protocolo: protocolo.nome_protocolo || 'Protocolo não identificado'
      })),
      agendas: agendasPorProtocolo,
      status: dosesAplicadas === totalDoses ? 'finalizada' : 'ativa',
      observacoes: anamnese.ds_orientacoes || null,
      dados_anamnese: {
        quadro_clinico: anamnese.ds_quadro_clinico,
        diagnostico: anamnese.ds_diagnostico,
        tratamento: anamnese.ds_tratamento,
        peso: anamnese.vl_peso,
        temperatura: anamnese.ds_temperatura,
        exames_anteriores: anamnese.ds_resultados_exames_anteriores
      }
    };

    res.json(prescricao);

  } catch (error) {
    console.log('ERRO em /prescricoes/:anamneseId');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar prescrição',
      error: error.message
    });
  }
});

// Rota para gerar URL de download do PDF assinado
route.get('/prescricoes/:anamneseId/url-pdf', async (req, res) => {
  try {
    const { anamneseId } = req.params;
    const expiresIn = parseInt(req.query.expiresIn) || 3600; // 1 hora por padrão

    // Buscar registro assinado
    const registro = await web_registros_prescricoes.findOne({
      where: {
        web_anamneses_id: anamneseId,
        status: 'assinada'
      }
    });

    if (!registro) {
      return res.status(404).json({
        success: false,
        message: 'Prescrição assinada não encontrada'
      });
    }

    if (!registro.arquivo_s3_path) {
      return res.status(404).json({
        success: false,
        message: 'Caminho do arquivo não encontrado'
      });
    }

    // Gerar URL assinada
    const urlData = await getSignedUrlForDownload(registro.arquivo_s3_path, expiresIn);

    res.json({
      success: true,
      url: urlData.url,
      expiresIn: urlData.expiresIn,
      fileName: `prescricao-${registro.codigo_verificacao}.pdf`,
      codigoVerificacao: registro.codigo_verificacao
    });

  } catch (error) {
    console.error('Erro ao gerar URL:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar URL de download',
      error: error.message
    });
  }
});



// Atualizar status de agenda
route.put('/prescricoes/agendas/:agendaId/status', async (req, res) => {
  try {
    const { agendaId } = req.params;
    const { st_concluido } = req.body;

    const resposta = await WebProtocolosAgendas.update(
      { st_concluido },
      { where: { id: agendaId } }
    );

    resposta[0] ? res.send(true) : res.send(false);

  } catch (error) {
    console.log('ERRO em /prescricoes/agendas/status');
    console.log(error.message);
    res.send(false);
  }
});

// Buscar prescrições por animal
route.get('/prescricoes/animal/:animalId', async (req, res) => {
  try {
    const { animalId } = req.params;
    console.log("Buscando prescrições por animal (SQL, snake_case):", animalId);

    const prescricoesSQL = `
      SELECT 
        a.id AS anamnese_id,
        a.dt_data_anamnese,
        a.ds_orientacoes,
        p.id AS protocolo_id,
        COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
        p.st_uso_humano,
        ps.web_tipo_protocolos_saude_id,
        pa.id AS agenda_id,
        pa.dt_data_aplicacao,
        pa.st_concluido,
        p.nu_intervalo_uso,
        p.ds_dosagem,
        p.tipo_intervalo_uso
      FROM web_anamneses a
      LEFT JOIN web_protocolos p ON p.web_anamneses_id = a.id
      LEFT JOIN web_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
      LEFT JOIN web_protocolos_agendas pa ON pa.web_protocolos_id = p.id
      WHERE a.mob_animais_id = :animalId
      ORDER BY a.dt_data_anamnese DESC, p.id, pa.dt_data_aplicacao ASC
    `;

    const results = await sequelize.query(prescricoesSQL, {
      replacements: { animalId },
      type: sequelize.QueryTypes.SELECT
    });

    console.log(results);

    const prescricoesMap = {};

    results.forEach((row) => {
      if (!prescricoesMap[row.anamnese_id]) {
        prescricoesMap[row.anamnese_id] = {
          id: row.anamnese_id,
          anamnese_id: row.anamnese_id,
          dt_data: row.dt_data_anamnese,
          protocolos: {},
          agendas: {},
          observacoes: row.ds_orientacoes || null,
          status: 'ativa',
          progresso: {
            totalDoses: 0,
            dosesAplicadas: 0,
            percentual: 0
          }
        };
      }

      const anamnese = prescricoesMap[row.anamnese_id];

      // Só processa protocolo/agenda se houver protocolo_id (LEFT JOIN pode retornar null)
      if (row.protocolo_id) {
        if (!anamnese.protocolos[row.protocolo_id]) {
          anamnese.protocolos[row.protocolo_id] = {
            nu_intervalo_uso: row.nu_intervalo_uso,
            tipo_intervalo_uso: row.tipo_intervalo_uso,
            ds_dosagem: row.ds_dosagem,
            st_tipo_protocolo: row.web_tipo_protocolos_saude_id,
            st_uso_humano: !!row.st_uso_humano,
            id: row.protocolo_id,
            nome_protocolo: row.nome_protocolo || 'Protocolo não identificado',
            agendas: []
          };
          anamnese.agendas[row.protocolo_id] = [];
        }

        if (row.agenda_id) {
          anamnese.protocolos[row.protocolo_id].agendas.push({
            id: row.agenda_id,
            dt_data_aplicacao: row.dt_data_aplicacao,
            st_concluido: row.st_concluido
          });
          anamnese.agendas[row.protocolo_id].push({
            id: row.agenda_id,
            dt_data_aplicacao: row.dt_data_aplicacao,
            st_concluido: row.st_concluido
          });
        }
      }
    });

    // Descobrir quais anamneses já possuem prescrição assinada digitalmente
    // (fonte de verdade: web_registros_prescricoes, igual à rota de detalhe).
    const anamneseIds = Object.keys(prescricoesMap);
    let assinadasSet = new Set();
    if (anamneseIds.length > 0) {
      const assinadas = await web_registros_prescricoes.findAll({
        where: { web_anamneses_id: anamneseIds, status: 'assinada' },
        attributes: ['web_anamneses_id']
      });
      assinadasSet = new Set(assinadas.map(r => String(r.web_anamneses_id)));
    }

    const prescricoes = Object.values(prescricoesMap).map((anamnese) => {
      let totalDoses = 0;
      let dosesAplicadas = 0;
      let temDoseAtrasada = false;
      const agora = new Date();

      Object.values(anamnese.protocolos).forEach((protocolo) => {
        totalDoses += protocolo.agendas.length;
        protocolo.agendas.forEach((agenda) => {
          if (agenda.st_concluido === 1) dosesAplicadas++;
          else if (new Date(agenda.dt_data_aplicacao) < agora) temDoseAtrasada = true;
        });
      });

      // O status de assinatura vem do registro assinado, não do progresso de doses.
      const assinada = assinadasSet.has(String(anamnese.id));

      let status;
      if (assinada) status = 'assinado_digitalmente';
      else if (totalDoses === 0) status = 'pendente';
      else if (dosesAplicadas === totalDoses) status = 'finalizada';
      else if (temDoseAtrasada) status = 'atrasada';
      else status = 'aguardando_assinatura';

      anamnese.status = status;
      anamnese.assinada = assinada;
      anamnese.progresso = {
        totalDoses,
        dosesAplicadas,
        percentual: totalDoses > 0 ? Math.round((dosesAplicadas / totalDoses) * 100) : 0
      };

      anamnese.protocolos = Object.values(anamnese.protocolos);

      return anamnese;
    });

    res.json(prescricoes);

  } catch (error) {
    console.log('ERRO em /prescricoes/animal/:animalId (SQL)');
    console.log(error.message);
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar prescrições do animal',
      error: error.message
    });
  }
});



// Buscar protocolos por animal
route.get('/protocolos/animal/:animalId', async (req, res) => {
  try {
    const { animalId } = req.params;
    console.log("Buscando protocolos por animal:", animalId);

    // Buscar anamneses do animal primeiro
    const anamneses = await WebAnamneses.findAll({
      where: { mob_animais_id: animalId },
      attributes: ['id']
    });

    if (!anamneses || anamneses.length === 0) {
      return res.json([]);
    }

    const anamneseIds = anamneses.map(a => a.id);

    // Buscar protocolos das anamneses
    const protocolos = await WebProtocolos.findAll({
      where: {
        web_anamneses_id: anamneseIds
      },
      include: [
        {
          model: WebProtocolosAgendas,
          as: 'agendas',
          order: [['dt_data_aplicacao', 'ASC']]
        },
        {
          model: MobProtocolosSaude,
          as: 'protocolo_saude'
        }
      ],
      order: [['id', 'DESC']]
    });

    // Adicionar nome do protocolo e formatar resposta
    const protocolosFormatados = protocolos.map(protocolo => ({
      ...protocolo.dataValues,
      nome_protocolo: protocolo.nome_protocolo || protocolo.protocolo_saude?.ds_protocolos_saude || 'Protocolo não identificado',
      agendas: protocolo.agendas || []
    }));

    res.json(protocolosFormatados);

  } catch (error) {
    console.log('ERRO em /protocolos/animal/:animalId');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar protocolos do animal',
      error: error.message
    });
  }
});

// Buscar anamneses por animal
route.get('/anamneses/animal/:animalId', async (req, res) => {
  try {
    const { animalId } = req.params;
    console.log("Buscando anamneses por animal:", animalId);

    const anamneses = await WebAnamneses.findAll({
      where: { mob_animais_id: animalId },
      order: [['dt_data_anamnese', 'DESC']]
    });

    res.json(anamneses || []);

  } catch (error) {
    console.log('ERRO em /anamneses/animal/:animalId');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar anamneses do animal',
      error: error.message
    });
  }
});

// ========= ROTAS MELHORADAS PARA BUSCAR POR ID =========

// Buscar prescrição por ID (melhorada)
route.get('/prescricoes/:anamneseId', async (req, res) => {
  try {
    const { anamneseId } = req.params;
    console.log("Buscando prescrição por ID:", anamneseId);

    const anamnese = await WebAnamneses.findByPk(anamneseId, {
      include: [
        {
          model: WebProtocolos,
          as: 'protocolos',
          include: [
            {
              model: WebProtocolosAgendas,
              as: 'agendas',
              order: [['dt_data_aplicacao', 'ASC']]
            },
            {
              model: MobProtocolosSaude,
              as: 'protocolo_saude'
            }
          ]
        }
      ]
    });

    if (!anamnese) {
      return res.status(404).json({
        success: false,
        message: 'Prescrição não encontrada'
      });
    }

    // Agrupar agendas por protocolo
    const agendasPorProtocolo = {};
    anamnese.protocolos.forEach(protocolo => {
      agendasPorProtocolo[protocolo.id] = protocolo.agendas || [];
    });

    // Calcular progresso
    let totalDoses = 0;
    let dosesAplicadas = 0;
    anamnese.protocolos.forEach(protocolo => {
      const agendas = protocolo.agendas || [];
      totalDoses += agendas.length;
      dosesAplicadas += agendas.filter(agenda => agenda.st_concluido === 1).length;
    });

    // Montar resposta da prescrição
    const prescricao = {
      id: anamnese.id,
      anamnese_id: anamnese.id,
      dt_data: anamnese.dt_data_anamnese,
      protocolos: anamnese.protocolos.map(protocolo => ({
        ...protocolo.dataValues,
        nome_protocolo: protocolo.nome_protocolo || protocolo.protocolo_saude?.ds_protocolos_saude || 'Protocolo não identificado'
      })),
      agendas: agendasPorProtocolo,
      status: dosesAplicadas === totalDoses ? 'finalizada' : 'ativa',
      observacoes: anamnese.ds_orientacoes || null,
      dados_anamnese: {
        quadro_clinico: anamnese.ds_quadro_clinico,
        diagnostico: anamnese.ds_diagnostico,
        tratamento: anamnese.ds_tratamento,
        peso: anamnese.vl_peso,
        temperatura: anamnese.ds_temperatura,
        exames_anteriores: anamnese.ds_resultados_exames_anteriores
      }
    };

    res.json(prescricao);

  } catch (error) {
    console.log('ERRO em /prescricoes/:anamneseId');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar prescrição',
      error: error.message
    });
  }
});

// Buscar protocolos por anamnese específica
route.get('/protocolos/anamnese/:anamneseId', async (req, res) => {
  try {
    const { anamneseId } = req.params;
    console.log("Buscando protocolos por anamnese:", anamneseId);

    const protocolos = await WebProtocolos.findAll({
      where: { web_anamneses_id: anamneseId },
      include: [
        {
          model: WebProtocolosAgendas,
          as: 'agendas',
          order: [['dt_data_aplicacao', 'ASC']]
        },
        {
          model: MobProtocolosSaude,
          as: 'protocolo_saude'
        }
      ]
    });

    const protocolosFormatados = protocolos.map(protocolo => ({
      ...protocolo.dataValues,
      nome_protocolo: protocolo.nome_protocolo || protocolo.protocolo_saude?.ds_protocolos_saude || 'Protocolo não identificado'
    }));

    res.json(protocolosFormatados);

  } catch (error) {
    console.log('ERRO em /protocolos/anamnese/:anamneseId');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar protocolos da anamnese',
      error: error.message
    });
  }
});

// ========= ROTAS AUXILIARES =========

// Buscar agendas por múltiplos protocolos
route.post('/agendas/protocolos', async (req, res) => {
  try {
    const { protocoloIds } = req.body;
    console.log("Buscando agendas por protocolos:", protocoloIds);

    if (!protocoloIds || !Array.isArray(protocoloIds)) {
      return res.status(400).json({
        success: false,
        message: 'protocoloIds deve ser um array'
      });
    }

    const agendas = await WebProtocolosAgendas.findAll({
      where: { web_protocolos_id: protocoloIds },
      order: [['dt_data_aplicacao', 'ASC']]
    });

    // Agrupar por protocolo
    const agendasPorProtocolo = {};
    agendas.forEach(agenda => {
      if (!agendasPorProtocolo[agenda.web_protocolos_id]) {
        agendasPorProtocolo[agenda.web_protocolos_id] = [];
      }
      agendasPorProtocolo[agenda.web_protocolos_id].push(agenda);
    });

    res.json(agendasPorProtocolo);

  } catch (error) {
    console.log('ERRO em /agendas/protocolos');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar agendas',
      error: error.message
    });
  }
});

// Buscar estatísticas de prescrições por animal
route.get('/prescricoes/animal/:animalId/estatisticas', async (req, res) => {
  try {
    const { animalId } = req.params;
    console.log("Buscando estatísticas de prescrições por animal:", animalId);

    // Buscar todas as prescrições do animal
    const anamneses = await WebAnamneses.findAll({
      where: { mob_animais_id: animalId },
      include: [
        {
          model: WebProtocolos,
          as: 'protocolos',
          include: [
            {
              model: WebProtocolosAgendas,
              as: 'agendas'
            }
          ]
        }
      ]
    });

    let totalPrescricoes = 0;
    let totalProtocolos = 0;
    let totalDoses = 0;
    let dosesAplicadas = 0;
    let prescricoesAtivas = 0;
    let prescricoesFinalizadas = 0;

    anamneses.forEach(anamnese => {
      if (anamnese.protocolos && anamnese.protocolos.length > 0) {
        totalPrescricoes++;
        totalProtocolos += anamnese.protocolos.length;

        let dosesAnamnese = 0;
        let aplicadasAnamnese = 0;

        anamnese.protocolos.forEach(protocolo => {
          const agendas = protocolo.agendas || [];
          dosesAnamnese += agendas.length;
          aplicadasAnamnese += agendas.filter(a => a.st_concluido === 1).length;
        });

        totalDoses += dosesAnamnese;
        dosesAplicadas += aplicadasAnamnese;

        if (aplicadasAnamnese === dosesAnamnese && dosesAnamnese > 0) {
          prescricoesFinalizadas++;
        } else {
          prescricoesAtivas++;
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalPrescricoes,
        totalProtocolos,
        totalDoses,
        dosesAplicadas,
        prescricoesAtivas,
        prescricoesFinalizadas,
        percentualConclusao: totalDoses > 0 ? Math.round((dosesAplicadas / totalDoses) * 100) : 0
      }
    });

  } catch (error) {
    console.log('ERRO em /prescricoes/animal/:animalId/estatisticas');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas',
      error: error.message
    });
  }
});

const gerarCodigoVerificacao = () => {
  const ano = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RX-${ano}-${timestamp}${random}`;
};

const crypto = require('crypto');
const { web_registros_prescricoes } = models;
const multer = require('multer');

// Configurar multer para upload de PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
});

// Função auxiliar para gerar hash dos dados
function gerarHashDados(dados) {
  // Ordenar as chaves para garantir consistência
  const conteudoOrdenado = JSON.stringify(dados, Object.keys(dados).sort());
  return crypto.createHash('sha256').update(conteudoOrdenado).digest('hex');
}

route.get('/prescricoes/:anamneseId/dados-pdf', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { anamneseId } = req.params;

    const prescricaoSQL = `
      SELECT 
        a.id AS anamnese_id,
        a.web_veterinarios_id,
        a.mob_animais_id,
        a.dt_data_anamnese,
        a.ds_quadro_clinico,
        a.ds_diagnostico,
        a.ds_tratamento,
        a.ds_orientacoes,
        a.vl_peso,
        a.ds_temperatura,
        a.ds_resultados_exames_anteriores,
        p.id AS protocolo_id,
        p.web_protocolos_saude_id,
        p.nu_doses,
        p.nu_intervalo_uso,
        p.tipo_intervalo_uso,
        p.ds_dosagem,
        p.st_tipo_protocolo,
        p.st_uso_humano,
        p.ds_concentracao,
        p.ds_forma_farmaceutica,
        p.ds_quantidade,
        p.ds_via_administracao,
        COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
        v.no_completo,
        v.nu_crmv,
        v.ds_estado_crmv,
        v.ds_email,
        v.nu_telefone_completo,
        an.no_nome,
        an.ds_especie,
        an.ds_sexo,
        an.vl_idade,
        an.id,
        t.no_completo AS tutor_nome,
        t.nu_cpf AS tutor_cpf,
        t.nu_telefone_completo AS tutor_telefone
      FROM web_anamneses a
      LEFT JOIN web_protocolos p ON p.web_anamneses_id = a.id
      LEFT JOIN mob_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
      INNER JOIN web_veterinarios v ON v.id = a.web_veterinarios_id
      INNER JOIN mob_animais an ON an.id = a.mob_animais_id
      INNER JOIN mob_tutores t ON t.id = an.mob_tutores_id
      WHERE a.id = :anamneseId
    `;

    const resultados = await sequelize.query(prescricaoSQL, {
      replacements: { anamneseId },
      type: sequelize.QueryTypes.SELECT,
      transaction
    });

    if (resultados.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Prescrição não encontrada'
      });
    }

    const primeiraLinha = resultados[0];

    const anamnese = {
      dt_data_anamnese: primeiraLinha.dt_data_anamnese,
      ds_quadro_clinico: primeiraLinha.ds_quadro_clinico,
      ds_diagnostico: primeiraLinha.ds_diagnostico,
      ds_tratamento: primeiraLinha.ds_tratamento,
      ds_orientacoes: primeiraLinha.ds_orientacoes,
      vl_peso: primeiraLinha.vl_peso,
      ds_temperatura: primeiraLinha.ds_temperatura,
      ds_resultados_exames_anteriores: primeiraLinha.ds_resultados_exames_anteriores
    };

    const veterinario = {
      id: primeiraLinha.web_veterinarios_id,
      no_completo: primeiraLinha.no_completo,
      nu_crmv: primeiraLinha.nu_crmv,
      ds_estado_crmv: primeiraLinha.ds_estado_crmv,
      ds_email: primeiraLinha.ds_email,
      nu_telefone_completo: primeiraLinha.nu_telefone_completo
    };

    const animal = {
      no_nome: primeiraLinha.no_nome,
      ds_especie: primeiraLinha.ds_especie,
      ds_sexo: primeiraLinha.ds_sexo,
      vl_idade: primeiraLinha.vl_idade,
      id: primeiraLinha.id
    };

    const tutor = {
      no_completo: primeiraLinha.tutor_nome,
      nu_cpf: primeiraLinha.tutor_cpf,
      nu_telefone_completo: primeiraLinha.tutor_telefone
    };

    const protocolosMap = {};
    resultados.forEach(linha => {
      if (linha.protocolo_id && !protocolosMap[linha.protocolo_id]) {
        protocolosMap[linha.protocolo_id] = {
          nome_protocolo: linha.nome_protocolo,
          st_uso_humano: !!linha.st_uso_humano,
          ds_concentracao: linha.ds_concentracao || '',
          ds_forma_farmaceutica: linha.ds_forma_farmaceutica || '',
          ds_quantidade: linha.ds_quantidade || '',
          ds_via_administracao: linha.ds_via_administracao || '',
          ds_dosagem: linha.ds_dosagem,
          nu_doses: linha.nu_doses,
          nu_intervalo_uso: linha.nu_intervalo_uso,
          tipo_intervalo_uso: linha.tipo_intervalo_uso,
          st_tipo_protocolo: linha.st_tipo_protocolo
        };
      }
    });

    const protocolos = Object.values(protocolosMap);

    const dadosOrganizados = {
      anamnese,
      veterinario,
      animal,
      tutor,
      protocolos
    };

    const hashDados = gerarHashDados(dadosOrganizados);

    const registroExistente = await web_registros_prescricoes.findOne({
      where: {
        web_anamneses_id: anamneseId,
        status: 'pendente'
      },
      transaction
    });

    let codigoVerificacao;

    if (registroExistente) {
      const agora = new Date();
      if (agora < registroExistente.dt_expiracao) {
        if (registroExistente.hash_original === hashDados) {
          codigoVerificacao = registroExistente.codigo_verificacao;
        } else {
          await registroExistente.update({ status: 'expirada' }, { transaction });
          codigoVerificacao = gerarCodigoVerificacao();

          const agora = new Date();
          const expiracao = new Date(agora.getTime() + 30 * 60 * 1000);

          await web_registros_prescricoes.create({
            web_anamneses_id: anamneseId,
            codigo_verificacao: codigoVerificacao,
            status: 'pendente',
            hash_original: hashDados,
            dt_criacao: agora,
            dt_expiracao: expiracao
          }, { transaction });
        }
      } else {
        await registroExistente.update({ status: 'expirada' }, { transaction });
        codigoVerificacao = gerarCodigoVerificacao();

        const agora = new Date();
        const expiracao = new Date(agora.getTime() + 30 * 60 * 1000);

        await web_registros_prescricoes.create({
          web_anamneses_id: anamneseId,
          codigo_verificacao: codigoVerificacao,
          status: 'pendente',
          hash_original: hashDados,
          dt_criacao: agora,
          dt_expiracao: expiracao
        }, { transaction });
      }
    } else {
      codigoVerificacao = gerarCodigoVerificacao();

      const agora = new Date();
      const expiracao = new Date(agora.getTime() + 30 * 60 * 1000);

      await web_registros_prescricoes.create({
        web_anamneses_id: anamneseId,
        codigo_verificacao: codigoVerificacao,
        status: 'pendente',
        hash_original: hashDados,
        dt_criacao: agora,
        dt_expiracao: expiracao
      }, { transaction });
    }

    await transaction.commit();

    res.json({
      success: true,
      codigoVerificacao,
      hashDados,
      dados: {
        codigoVerificacao,
        anamnese,
        veterinario,
        animal,
        tutor,
        protocolos
      }
    });

  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error('Erro ao buscar dados para PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar dados para PDF',
      error: error.message
    });
  }
});

route.post('/prescricoes/:anamneseId/upload-assinado',
  upload.single('pdfAssinado'),
  async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { anamneseId } = req.params;
      const arquivo = req.file;
      if (!arquivo) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Arquivo PDF é obrigatório'
        });
      }
      // Verificar se o PDF tem assinatura
      const verificationResult = verifyPDF(arquivo.buffer);
      console.log(verificationResult)
      if (!verificationResult.verified) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'O arquivo PDF não contém uma assinatura digital válida.'
        });
      }
      // Buscar registro pendente
      const registro = await web_registros_prescricoes.findOne({
        where: {
          web_anamneses_id: anamneseId,
          status: 'pendente'
        },
        transaction
      });
      if (!registro) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Registro de prescrição não encontrado ou já processado'
        });
      }
      // Verificar se ainda está dentro do prazo
      const agora = new Date();
      if (agora > registro.dt_expiracao) {
        await registro.update({ status: 'expirada' }, { transaction });
        await transaction.commit();
        return res.status(400).json({
          success: false,
          message: 'Tempo para upload expirado. Gere um novo PDF.'
        });
      }
      // Nome do arquivo no S3
      const nomeArquivo = `prescricoes/${anamneseId}/${registro.codigo_verificacao}-assinado.pdf`;
      // Upload para S3
      const urlS3 = await uploadToS3(arquivo.buffer, nomeArquivo);
      // Atualizar registro
      await registro.update({
        status: 'assinada',
        arquivo_s3_path: nomeArquivo,
        dt_assinatura: agora,
        dt_upload: agora
      }, { transaction });
      await transaction.commit();
      res.json({
        success: true,
        message: 'PDF assinado enviado com sucesso!',
        codigoVerificacao: registro.codigo_verificacao,
        urlVerificacao: `${process.env.FRONTEND_URL || ''}/verificar/${registro.codigo_verificacao}`
      });
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Erro no upload:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno no upload',
        error: error.message
      });
    }
  });




// Portal de verificação pública
route.get('/prescricoes/verificar/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const verificacaoSQL = `
      SELECT 
        r.codigo_verificacao,
        r.status,
        r.dt_criacao,
        r.dt_assinatura,
        r.arquivo_s3_path,
        v.no_completo,
        v.nu_crmv,
        v.ds_estado_crmv,
        an.dt_data_anamnese
      FROM web_registros_prescricoes r
      INNER JOIN web_anamneses an ON an.id = r.web_anamneses_id
      INNER JOIN web_veterinarios v ON v.id = an.web_veterinarios_id
      INNER JOIN mob_animais a ON a.id = an.mob_animais_id
      WHERE r.codigo_verificacao = :codigo
    `;

    const resultado = await sequelize.query(verificacaoSQL, {
      replacements: { codigo },
      type: sequelize.QueryTypes.SELECT
    });

    if (resultado.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Código de verificação não encontrado'
      });
    }

    const dados = resultado[0];

    res.json({
      success: true,
      dados: {
        codigoVerificacao: dados.codigo_verificacao,
        status: dados.status,
        veterinario: {
          nome: dados.no_completo,
          crmv: `${dados.nu_crmv}-${dados.ds_estado_crmv}`
        },
        dataGeracao: dados.dt_criacao,
        dataAssinatura: dados.dt_assinatura,
        dataConsulta: dados.dt_data_anamnese,
        temArquivo: !!dados.arquivo_s3_path
      }
    });

  } catch (error) {
    console.error('Erro na verificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno na verificação'
    });
  }
});

module.exports = route;