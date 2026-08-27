const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_veterinarios, web_veterinarios, mob_protocolos_saude, mob_animais } = models;
const { uploadFile, deleteFile, getFileStream } = require('../../utils/s3_teste');
const { enviarImagem } = require('../../utils/imagemResposta');

const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');

// Configurar o Google OAuth client
const client = new OAuth2Client('867699850241-is78nhfgn1blt5ji6ag9tfpdcn0cuspb.apps.googleusercontent.com');

const { 
  generateSecureToken, 
  hashToken, 
  verifyToken, 
  getExpirationDate, 
  validateTokenRecord,
  parseUserAgent,
  checkRateLimit,
  validateResetRequest,
  sanitizeForLog
} = require('../../utils/token');

const { Op } = require('sequelize');
const axios = require('axios');
const { signAuthToken, TIPO_VETERINARIO } = require('../../utils/authToken');
// ============= ROTAS PARA WEB_VETERINARIOS =============

// Rota para validar CRMV + Estado e buscar dados pré-existentes
route.post('/web-veterinarios/validar-crmv', async (req, res) => {
  try {
    const { nu_crmv, ds_estado_crmv } = req.body;
    
    console.log(`Validando CRMV: ${nu_crmv} - Estado: ${ds_estado_crmv}`);
    
    // Busca na tabela mob_veterinarios se existe o CRMV + Estado
    const mobVeterinario = await mob_veterinarios.findOne({
      where: { 
        nu_crmv,
        ds_estado_crmv 
      }
    });
    
    if (!mobVeterinario) {
      console.log("CRMV não encontrado na base de dados mobile");
      return res.status(404).json({
        success: false,
        message: "CRMV não encontrado em nossa base de dados. Não é possível realizar o cadastro nesta plataforma."
      });
    }
    
    console.log("CRMV encontrado! Retornando dados para pré-preenchimento");
    
    // Verifica se já existe um cadastro web para este veterinário
    const webVeterinarioExistente = await web_veterinarios.findOne({
      where: { mob_veterinarios_id: mobVeterinario.id, nu_crmv: mobVeterinario.nu_crmv }
    });
    
    if (webVeterinarioExistente) {
      return res.status(409).json({
        success: false,
        message: "Este veterinário já possui cadastro na plataforma web.",
        veterinario_existente: true
      });
    }
    
    // Retorna os dados para pré-preenchimento do formulário
    res.json({
      success: true,
      message: "CRMV válido! Dados encontrados para pré-preenchimento.",
      dados_preenchimento: {
        nu_crmv: mobVeterinario.nu_crmv,
        ds_estado_crmv: mobVeterinario.ds_estado_crmv,
        no_completo: mobVeterinario.no_completo,
        ds_email: mobVeterinario.ds_email,
        nu_telefone_completo: mobVeterinario.nu_telefone_completo,
        mob_veterinarios_id: mobVeterinario.id
      }
    });
    
  } catch (error) {
    console.log('ERRO em /web-veterinarios/validar-crmv');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// ============= ROTAS ATUALIZADAS PARA WEB_VETERINARIOS =============

// Rota de login com Google para web veterinários (MODIFICADA)
route.post('/web-veterinarios/login/google', async (req, res) => {
  try {
    const { token } = req.body; // Mudança: agora espera 'token' em vez de 'id_token'
    console.log("Tentativa de login web veterinário com Google token");

    // Verifica e decodifica o token do Google
    const ticket = await client.verifyIdToken({
      idToken: token, // Usando o token recebido
      audience: '867699850241-is78nhfgn1blt5ji6ag9tfpdcn0cuspb.apps.googleusercontent.com',
    });

    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    const email = payload['email'];

    console.log("Token Google válido. Google ID:", googleId, "Email:", email);

    // Busca o veterinário pelo Google ID
    const veterinario = await web_veterinarios.findOne({ 
      where: { google_id: googleId } 
    });
    
    if (!veterinario) {
      console.log("Veterinário não encontrado para o Google ID:", googleId);
      
      // NOVA LÓGICA: Retorna 200 com código específico
      return res.status(200).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Nenhuma conta encontrada para este Google',
        googleData: {
          email: payload['email'],
          name: payload['name'],
          picture: payload['picture'],
          googleId: payload['sub']
        }
      });
    }

    console.log("Veterinário web autenticado com Google com sucesso!");
    
    // Retorna os dados do veterinário
    const { ds_senha: _, ...veterinarioResponse } = veterinario.toJSON();
    
    res.status(200).json({
      success: true,
      message: "Login com Google realizado com sucesso!",
      token: signAuthToken(veterinario.id, TIPO_VETERINARIO),
      veterinario: veterinarioResponse,
      googleData: {
        sub: payload['sub'],
        email: payload['email'],
        name: payload['name'],
        picture: payload['picture'],
        email_verified: payload['email_verified']
      }
    });

  } catch (error) {
    console.log("Erro em /web-veterinarios/login/google!");
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// NOVA ROTA: Vincular conta Google a conta existente
route.post('/web-veterinarios/link-google', async (req, res) => {
  try {
    const { userId, googleId, googleEmail } = req.body;
    console.log(`Vinculando Google ID ${googleId} ao usuário ${userId}`);

    // Verificar se usuário existe
    const user = await web_veterinarios.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuário não encontrado' 
      });
    }

    // Verificar se Google ID já está vinculado a outra conta
    const existingGoogle = await web_veterinarios.findOne({
      where: { google_id: googleId }
    });
    
    if (existingGoogle && existingGoogle.id !== parseInt(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Esta conta Google já está vinculada a outro usuário' 
      });
    }

    // Vincular conta Google
    await web_veterinarios.update(
      { 
        google_id: googleId,
        // Opcionalmente atualizar email se diferente
        ...(user.ds_email !== googleEmail && { ds_email: googleEmail })
      },
      { where: { id: userId } }
    );

    console.log("Conta Google vinculada com sucesso!");
    
    res.json({ 
      success: true, 
      message: 'Conta Google vinculada com sucesso' 
    });

  } catch (error) {
    console.error('Erro ao vincular Google:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
});

// Rota de login por email e senha (ATUALIZADA para compatibilidade)
route.post('/web-veterinarios/login', async (req, res) => {
  try {
    const { email, password, ds_email, ds_senha } = req.body;
    
    // Aceita tanto o formato novo quanto o antigo
    const emailToUse = email || ds_email;
    const passwordToUse = password || ds_senha;
    
    console.log("Tentativa de login web veterinário com email:", emailToUse);

    if (!emailToUse || !passwordToUse) {
      return res.status(400).json({
        success: false,
        message: "Email e senha são obrigatórios"
      });
    }

    // Busca o veterinário pelo email
    const veterinario = await web_veterinarios.findOne({ 
      where: { ds_email: emailToUse } 
    });
    
    if (!veterinario) {
      console.log("Veterinário não encontrado para o email:", emailToUse);
      return res.status(401).json({
        success: false,
        message: "Email ou senha incorretos."
      });
    }

    console.log("Veterinário encontrado no banco de dados:", veterinario.id);

    // Verifica se tem senha definida
    if (!veterinario.ds_senha) {
      return res.status(401).json({
        success: false,
        message: "Esta conta só pode fazer login com Google."
      });
    }

    // Verifica a senha
    const isMatch = await bcrypt.compare(passwordToUse, veterinario.ds_senha);

    if (!isMatch) {
      console.log("Senha incorreta para o veterinário:", veterinario.id);
      return res.status(401).json({
        success: false,
        message: "Email ou senha incorretos."
      });
    }

    console.log("Veterinário web autenticado com sucesso!");
    
    // Retorna os dados do veterinário (sem a senha)
    const { ds_senha: _, ...veterinarioResponse } = veterinario.toJSON();
    
    res.json({
      success: true,
      message: "Login realizado com sucesso!",
      token: signAuthToken(veterinario.id, TIPO_VETERINARIO),
      veterinario: veterinarioResponse
    });

  } catch (error) {
    console.log("Erro em /web-veterinarios/login!");
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// NOVA ROTA: Criar conta com dados do Google (para novos usuários)
route.post('/web-veterinarios/cadastro', async (req, res) => {
  try {
    const { 
      // Dados obrigatórios do CRMV (já validados)
      mob_veterinarios_id,
      nu_crmv,
      ds_estado_crmv,
      
      // Dados pessoais
      no_completo,
      ds_email,
      nu_cpf,
      nu_telefone_completo,
      ds_logo_s3_path,
      
      // Autenticação - pode ser senha OU Google
      ds_senha,
      
      // Dados do Google (opcionais)
      googleToken,
      google_id
    } = req.body;
    
    console.log("🚀 Iniciando cadastro web veterinário unificado");
    console.log("📋 Dados recebidos:", {
      hasGoogleToken: !!googleToken,
      hasGoogleId: !!google_id,
      hasPassword: !!ds_senha,
      email: ds_email,
      crmv: nu_crmv
    });

    // ========== VALIDAÇÕES BÁSICAS ==========
    
    // Verificar se tem CRMV validado
    if (!mob_veterinarios_id || !nu_crmv || !ds_estado_crmv) {
      return res.status(400).json({
        success: false,
        message: "Dados do CRMV são obrigatórios. Valide o CRMV primeiro."
      });
    }

    // Verificar se tem nome e email
    if (!no_completo || !ds_email) {
      return res.status(400).json({
        success: false,
        message: "Nome completo e email são obrigatórios."
      });
    }

    // Verificar se tem pelo menos uma forma de autenticação
    if (!ds_senha && !googleToken && !google_id) {
      return res.status(400).json({
        success: false,
        message: "É necessário definir uma senha ou usar autenticação Google."
      });
    }

    // ========== PROCESSAMENTO DO GOOGLE (se fornecido) ==========
    
    let googleData = null;
    let finalGoogleId = google_id; // Pode vir direto ou do token
    
    if (googleToken) {
      try {
        console.log("🔍 Validando token Google...");
        
        const ticket = await client.verifyIdToken({
          idToken: googleToken,
          audience: '867699850241-is78nhfgn1blt5ji6ag9tfpdcn0cuspb.apps.googleusercontent.com',
        });

        const payload = ticket.getPayload();
        googleData = {
          google_id: payload['sub'],
          email: payload['email'],
          name: payload['name'],
          picture: payload['picture']
        };
        
        finalGoogleId = payload['sub']; // Usar Google ID do token
        
        console.log("✅ Token Google válido:", googleData.google_id);
        
        // Verificar se o email do Google confere com o fornecido
        if (googleData.email !== ds_email) {
          return res.status(400).json({
            success: false,
            message: "Email do Google não confere com o email fornecido."
          });
        }
        
      } catch (error) {
        console.error("❌ Erro ao validar token Google:", error.message);
        return res.status(400).json({
          success: false,
          message: "Token Google inválido."
        });
      }
    }

    // ========== VERIFICAÇÕES DE DUPLICAÇÃO ==========
    
    // Verificar se email já existe
    const emailExistente = await web_veterinarios.findOne({
      where: { ds_email }
    });
    
    if (emailExistente) {
      return res.status(409).json({
        success: false,
        message: "Este email já está cadastrado na plataforma."
      });
    }

    // Verificar se Google ID já está sendo usado (se fornecido)
    if (finalGoogleId) {
      const googleIdExistente = await web_veterinarios.findOne({
        where: { google_id: finalGoogleId }
      });
      
      if (googleIdExistente) {
        return res.status(409).json({
          success: false,
          message: "Esta conta Google já está vinculada a outro veterinário."
        });
      }
    }

    // Verificar se mob_veterinarios_id já tem cadastro web com o mesmo CRMV
    const webVeterinarioExistente = await web_veterinarios.findOne({
      where: { mob_veterinarios_id, nu_crmv }
    });
    
    if (webVeterinarioExistente) {
      return res.status(409).json({
        success: false,
        message: "Este veterinário já possui cadastro na plataforma web."
      });
    }

    // ========== PREPARAÇÃO DOS DADOS ==========
    
    // Hash da senha (se fornecida)
    let senhaHash = null;
    if (ds_senha) {
      console.log("🔐 Gerando hash da senha...");
      senhaHash = await bcrypt.hash(ds_senha, 10);
    }

    // Dados para criação
    const dadosCriacao = {
      mob_veterinarios_id,
      google_id: finalGoogleId || null,
      nu_crmv,
      ds_estado_crmv,
      no_completo,
      ds_email,
      ds_senha: senhaHash,
      nu_cpf: nu_cpf || null,
      nu_telefone_completo: nu_telefone_completo || null,
      ds_logo_s3: ds_logo_s3_path || null,
      ds_assinatura_s3:  ds_logo_s3_path || null
    };

    console.log("💾 Criando veterinário com dados:", {
      ...dadosCriacao,
      ds_senha: dadosCriacao.ds_senha ? '[HASH]' : null
    });

    // ========== CRIAÇÃO DO REGISTRO ==========
    
    const novoWebVeterinario = await web_veterinarios.create(dadosCriacao);
    
    console.log("✅ Web veterinário criado com sucesso! ID:", novoWebVeterinario.id);
    
    // ========== RESPOSTA ==========
    
    // Retornar dados do usuário criado (sem a senha)
    const { ds_senha: _, ...veterinarioResponse } = novoWebVeterinario.toJSON();
    
    const response = {
      success: true,
      message: googleData 
        ? "Conta criada com sucesso usando Google!" 
        : "Conta criada com sucesso!",
      token: signAuthToken(novoWebVeterinario.id, TIPO_VETERINARIO),
      veterinario: veterinarioResponse,
      ...(googleData && {
        googleData: {
          sub: googleData.google_id,
          email: googleData.email,
          name: googleData.name,
          picture: googleData.picture
        }
      })
    };

    console.log("🎉 Cadastro finalizado com sucesso!");
    res.json(response);

  } catch (error) {
    console.error('❌ ERRO em /web-veterinarios/cadastro:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// NOVA ROTA: Verificar disponibilidade de email
route.post('/web-veterinarios/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email é obrigatório"
      });
    }

    const veterinarioExistente = await web_veterinarios.findOne({
      where: { ds_email: email }
    });

    res.json({
      success: true,
      available: !veterinarioExistente,
      message: veterinarioExistente 
        ? "Email já está em uso" 
        : "Email disponível"
    });

  } catch (error) {
    console.log('ERRO em /web-veterinarios/check-email');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// NOVA ROTA: Buscar veterinário por email (para vincular conta)
route.post('/web-veterinarios/find-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email é obrigatório"
      });
    }

    const veterinario = await web_veterinarios.findOne({
      where: { ds_email: email },
      attributes: ['id', 'no_completo', 'ds_email', 'nu_crmv', 'ds_estado_crmv', 'google_id']
    });

    if (!veterinario) {
      return res.status(404).json({
        success: false,
        message: "Nenhuma conta encontrada com este email"
      });
    }

    res.json({
      success: true,
      veterinario: veterinario,
      hasGoogle: !!veterinario.google_id
    });

  } catch (error) {
    console.log('ERRO em /web-veterinarios/find-by-email');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Rota para buscar todos os web veterinários
route.get('/web-veterinarios', async (req, res) => {
  try {
    const resposta = await web_veterinarios.findAll({
      attributes: { exclude: ['ds_senha'] } // Exclui a senha da resposta
    });
    res.json(resposta);
  } catch (error) {
    console.log('ERRO em /web-veterinarios');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Rota para buscar um web veterinário por ID
route.get('/web-veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await web_veterinarios.findByPk(id, {
      attributes: { exclude: ['ds_senha'] }
    });
    
    if (!resposta) {
      return res.status(404).json({
        success: false,
        message: "Veterinário não encontrado"
      });
    }
    
    res.json(resposta);
  } catch (error) {
    console.log('ERRO em /web-veterinarios/:id');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Campos que compõem o endereço geocodificável. Mudou algum → recalcula.
const CAMPOS_ENDERECO = ['ds_logradouro', 'nu_numero', 'ds_bairro', 'ds_cidade', 'ds_uf', 'nu_cep'];

async function geocodificarSeNecessario(id, antes, alterado) {
  try {
    // Coordenada enviada explicitamente (ajuste manual do pino) tem prioridade
    // sobre a geocodificação automática — o vet sabe melhor onde ele está.
    if (alterado.nu_latitude != null && alterado.nu_longitude != null) {
      await web_veterinarios.update({ dt_geocodificado: new Date() }, { where: { id } });
      return;
    }

    const mudou = CAMPOS_ENDERECO.some(
      (c) => c in alterado && String(alterado[c] ?? '') !== String(antes[c] ?? '')
    );
    const semCoordenada = antes.nu_latitude == null || antes.nu_longitude == null;
    if (!mudou && !semCoordenada) return;

    // Usa o endereço já persistido (o update acabou de rodar).
    const atual = await web_veterinarios.findByPk(id);
    const { geocodificar } = require('../../utils/geocodificacao');
    const ponto = await geocodificar(atual);
    if (!ponto) {
      console.warn('[geo] sem coordenada para o veterinário', id);
      return;
    }
    await web_veterinarios.update({
      nu_latitude: ponto.latitude,
      nu_longitude: ponto.longitude,
      dt_geocodificado: new Date(),
    }, { where: { id } });
    console.log('[geo] veterinário', id, '->', ponto.latitude, ponto.longitude, ponto.aproximado ? '(aproximado)' : '(exato)');
  } catch (e) {
    console.warn('[geo] falhou para o veterinário', id, '-', e.message);
  }
}

route.put('/web-veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ds_senha, google_id, created_at, updated_at, ...dadosAtualizacao } = req.body;
    
    // Validar se veterinário existe
    const veterinarioExistente = await web_veterinarios.findByPk(id);
    if (!veterinarioExistente) {
      return res.status(404).json({
        success: false,
        message: "Veterinário não encontrado"
      });
    }
    
    // Se foi enviada uma nova senha, faz o hash
    if (ds_senha) {
      dadosAtualizacao.ds_senha = await bcrypt.hash(ds_senha, 10);
    }
    
    // Atualizar dados
    await web_veterinarios.update(dadosAtualizacao, { where: { id } });

    // Geocodificação do endereço profissional (busca de veterinários próximos).
    // Roda DEPOIS do update e só quando o endereço mudou — geocodificar a cada
    // salvamento desperdiçaria a cota do Nominatim sem necessidade.
    // É awaited de propósito: em serverless (Vercel) a função pode ser encerrada
    // logo após a resposta, então "fire-and-forget" não completaria.
    // Falha nunca bloqueia o salvamento: o vet fica sem coordenada e não aparece
    // no mapa até corrigir o endereço.
    await geocodificarSeNecessario(id, veterinarioExistente, dadosAtualizacao);

    // ✅ Buscar dados atualizados para retornar
    const veterinarioAtualizado = await web_veterinarios.findByPk(id, {
      attributes: { exclude: ['ds_senha'] }
    });
    
    res.json({
      success: true,
      message: "Veterinário atualizado com sucesso!",
      veterinario: veterinarioAtualizado // 🎯 Frontend precisa!
    });
    
  } catch (error) {
    console.log('ERRO em /web-veterinarios/:id PUT');
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});


// Rota para upload de imagens do veterinário (logo e assinatura)
route.put('/web-veterinarios/:id/upload-image', async (req, res) => {
 try {
   const { id } = req.params;
   const { tipo, imagem_base64, remover = false } = req.body;

   // ✅ ADICIONAR LOG PARA DEBUG
   console.log('📥 Parâmetros recebidos:', { 
     tipo, 
     remover, 
     tem_imagem: !!imagem_base64,
     tamanho_imagem: imagem_base64?.length || 0 
   });

   // Validar parâmetros obrigatórios
   if (!tipo || !['logo', 'assinatura'].includes(tipo)) {
     return res.status(400).json({
       success: false,
       message: "Tipo deve ser 'logo' ou 'assinatura'"
     });
   }

   // ✅ CORRIGIR VALIDAÇÃO: Se não é remoção, validar se tem imagem
   if (remover !== true && !imagem_base64) {
     console.log('❌ Falha na validação - remover:', remover, 'tem_imagem:', !!imagem_base64);
     return res.status(400).json({
       success: false,
       message: "Imagem é obrigatória ou use 'remover: true'"
     });
   }

   // Buscar dados do veterinário para gerar key única
   const veterinario = await web_veterinarios.findByPk(id);
   if (!veterinario) {
     return res.status(404).json({
       success: false,
       message: "Veterinário não encontrado"
     });
   }

   // Gerar key única: veterinarios/12345_SP_logo ou veterinarios/12345_SP_assinatura
   const key = `${veterinario.nu_crmv}_${veterinario.ds_estado_crmv}_${tipo}`;
   const filePath = `veterinarios/${key}`;

   // Verificar se já existe imagem no S3
   const fileStream = await getFileStream(filePath);
   const imageExists = fileStream !== undefined;

   // Campo do banco correspondente
   const updateField = tipo === 'logo' ? 'ds_logo_s3' : 'ds_assinatura_s3';

   // ✅ CASO 1: REMOÇÃO DA IMAGEM
   if (remover === true) {
     console.log(`🗑️ Removendo ${tipo} do veterinário ${veterinario.no_completo}...`);
     
     // Se existe no S3, excluir
     if (imageExists) {
       await deleteFile(filePath);
       console.log(`✅ Imagem ${tipo} excluída do S3 com sucesso!`);
     } else {
       console.log(`ℹ️ Imagem ${tipo} não existe no S3, apenas limpando banco...`);
     }

     // Limpar campo no banco (definir como null)
     await web_veterinarios.update(
       { [updateField]: null },
       { where: { id } }
     );

     console.log(`✅ Campo ${updateField} limpo no banco com sucesso!`);

     return res.json({
       success: true,
       message: `${tipo === 'logo' ? 'Logo' : 'Assinatura'} removida com sucesso!`
     });
   }

   // ✅ CASO 2: UPLOAD DE NOVA IMAGEM
   console.log(`📤 Realizando upload da nova imagem ${tipo}...`);

   // Se existe imagem antiga, excluir primeiro
   if (imageExists) {
     console.log(`🔄 Imagem ${tipo} existente encontrada. Excluindo...`);
     await deleteFile(filePath);
     console.log(`✅ Imagem anterior excluída com sucesso!`);
   }

   // Converter base64 para Buffer (sem arquivo temporário — compatível com Vercel)
   const imageBuffer = Buffer.from(
     imagem_base64.replace(/^data:image\/\w+;base64,/, ""),
     "base64"
   );

   // Upload para S3
   await uploadFile(imageBuffer, filePath);

   // Atualizar campo correspondente no banco
   await web_veterinarios.update(
     { [updateField]: filePath },
     { where: { id } }
   );

   console.log(`✅ Upload de ${tipo} concluído com sucesso!`);

   res.json({
     success: true,
     message: `${tipo === 'logo' ? 'Logo' : 'Assinatura'} atualizada com sucesso!`
   });

 } catch (error) {
   console.log('❌ ERRO em /web-veterinarios/:id/upload-image');
   console.log(error.message);
   res.status(500).json({
     success: false,
     message: "Erro interno do servidor"
   });
 }
});

route.get('/web-veterinarios/:id/imagem/:tipo', async (req, res) => {
  try {
    const { id, tipo } = req.params;
    
    // Validar tipo
    if (!tipo || !['logo', 'assinatura'].includes(tipo)) {
      return res.status(400).json({
        error: "Tipo deve ser 'logo' ou 'assinatura'"
      });
    }
    
    // Buscar dados do veterinário para gerar a key correta
    const veterinario = await web_veterinarios.findByPk(id);
    
    if (!veterinario) {
      return res.status(404).json({ error: 'Veterinário não encontrado' });
    }
    
    // Gerar a key da imagem
    const key = `${veterinario.nu_crmv}_${veterinario.ds_estado_crmv}_${tipo}`;
    const filePath = `veterinarios/${key}`;
    
    // Verificar se a imagem existe no S3 usando getFileStream
    const fileStream = await getFileStream(filePath);
    const imageExists = fileStream !== undefined;
    
    if (!imageExists) {
      return res.status(404).json({ error: `${tipo === 'logo' ? 'Logo' : 'Assinatura'} não encontrada` });
    }
    
    // Content-Type vem dos BYTES, não fixo: as chaves no S3 não têm extensão.
    // Mantém no-store: a tela de Perfil recarrega a logo/assinatura após upload.
    return await enviarImagem(res, fileStream, 'no-store, max-age=0');

  } catch (error) {
    console.log('ERRO em /web-veterinarios/:id/imagem/:tipo');
    console.log(error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para deletar um web veterinário
route.delete('/web-veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rowsAffected = await web_veterinarios.destroy({ where: { id } });
    
    if (rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: "Veterinário não encontrado"
      });
    }
    
    res.json({
      success: true,
      message: "Veterinário deletado com sucesso!"
    });
  } catch (error) {
    console.log('ERRO em /web-veterinarios/:id DELETE');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// ============= ROTAS ANTIGAS MANTIDAS (mob_veterinarios) =============

// Rota para buscar todos os veterinários mobile
route.get('/veterinarios', async (req, res) => {
  try {
    const resposta = await mob_veterinarios.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

// Rota para buscar um veterinário por ID
route.get('/veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_veterinarios.findAll({ where: { mob_usuarios_id: id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});
// Rota para buscar um veterinário por ID
route.get('/veterinarios/:id/animais', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_animais.findAll({ where: { mob_veterinarios_id: id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

route.get('/veterinarios/details/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const resposta = await mob_veterinarios.findAll({ where: { id } });
      resposta ? res.send(resposta) : res.send(false);
    } catch (error) {
      console.log('ERRO em /veterinarios');
      console.log(error.message);
    }
  });

// Rota para criar um novo veterinário mobile
route.post('/veterinarios', async (req, res) => {
  try {
    const { nu_crmv, ds_estado_crmv, no_completo, ds_email, nu_telefone_completo, mob_usuarios_id } = req.body;
    const resposta = await mob_veterinarios.create({
      nu_crmv,
      ds_estado_crmv,
      no_completo,
      ds_email,
      nu_telefone_completo,
      mob_usuarios_id
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

// Rota para atualizar um veterinário mobile existente
route.put('/veterinarios', async (req, res) => {
  try {
    const { id, nu_crmv, ds_estado_crmv, no_completo, ds_email, nu_telefone_completo } = req.body;
    const resposta = await mob_veterinarios.update(
      { nu_crmv, ds_estado_crmv, no_completo, ds_email, nu_telefone_completo },
      { where: { id } }
    );
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

// Rota para deletar um veterinário mobile pelo ID
/*
 * Exclusão de veterinário — reescrita em 06/08/2026.
 *
 * 🔴 O QUE HAVIA ANTES, e por que era o pior tipo de falha:
 *
 *     catch (error) {
 *       console.log('ERRO em /veterinarios');
 *       console.log(error.message);
 *       // ...e nada mais: NENHUM res.send()
 *     }
 *
 * Sem resposta, a requisição fica pendurada até o cliente desistir. No app o
 * axios não tem timeout configurado, então a promessa simplesmente nunca
 * resolvia: o usuário confirmava a exclusão e **não acontecia nada** — nem
 * sucesso, nem erro, nem o veterinário saindo da lista. Foi exatamente o
 * sintoma relatado ("o processo não foi concluído").
 *
 * E o erro engolido era real e recorrente: o banco recusa apagar veterinário
 * que ainda é referenciado. Duas tabelas apontam para `mob_veterinarios`:
 *   - `mob_animais.mob_veterinarios_id`     (animais sob cuidado dele)
 *   - `web_veterinarios.mob_veterinarios_id` (conta dele no sistema web)
 *
 * ⚠️ Os vínculos são contados ANTES do delete, para a resposta poder dizer o
 * QUE impede e QUANTOS são — "não foi possível" sozinho não deixa o usuário
 * resolver nada. O catch continua tratando violação de FK como rede de
 * segurança, para o caso de um vínculo novo aparecer sem esta contagem saber.
 *
 * ⚠️ Compatibilidade com o app das lojas: o sucesso continua respondendo
 * **200**, que é o que aquele código testa (`response.status === 200`). O corpo
 * mudou de `true` para JSON, e isso é seguro porque o corpo não era lido.
 */
route.delete('/veterinarios/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const veterinario = await mob_veterinarios.findByPk(id);
    if (!veterinario) {
      return res.status(404).json({
        ok: false,
        motivo: 'nao_encontrado',
        mensagem: 'Este veterinário não existe mais. Atualize a lista.',
      });
    }

    const [animais, contasWeb] = await Promise.all([
      mob_animais.count({ where: { mob_veterinarios_id: id } }),
      web_veterinarios.count({ where: { mob_veterinarios_id: id } }),
    ]);

    if (animais > 0 || contasWeb > 0) {
      // Mensagem escrita para QUEM LÊ NA TELA: diz o vínculo, o número e a saída.
      const partes = [];
      if (animais > 0) {
        partes.push(`${animais} ${animais === 1 ? 'animal está' : 'animais estão'} sob os cuidados dele`);
      }
      if (contasWeb > 0) {
        partes.push('ele tem uma conta ativa no sistema web');
      }

      return res.status(409).json({
        ok: false,
        motivo: 'vinculado',
        animais,
        contasWeb,
        mensagem:
          `Não é possível excluir ${veterinario.no_completo ? veterinario.no_completo.trim() : 'este veterinário'}: ` +
          `${partes.join(' e ')}. ` +
          (animais > 0
            ? 'Vincule esses animais a outro veterinário antes de excluir.'
            : 'Remova a conta no sistema web antes de excluir.'),
      });
    }

    await mob_veterinarios.destroy({ where: { id } });
    return res.status(200).json({ ok: true, mensagem: 'Veterinário excluído.' });
  } catch (error) {
    console.error('ERRO em DELETE /veterinarios/:id —', error.message);

    // Rede de segurança: vínculo que a contagem acima ainda não conhece.
    const ehFk =
      error?.name === 'SequelizeForeignKeyConstraintError' ||
      /foreign key constraint/i.test(error?.message || '');

    if (ehFk) {
      return res.status(409).json({
        ok: false,
        motivo: 'vinculado',
        mensagem:
          'Não é possível excluir: este veterinário ainda está vinculado a outros registros do sistema.',
      });
    }

    return res.status(500).json({
      ok: false,
      motivo: 'erro',
      mensagem: 'Não foi possível excluir o veterinário. Tente novamente.',
    });
  }
});

// Rota para alterar senha do web veterinário
route.post('/web-veterinarios/:id/change-password', async (req, res) => {
  try {
    const { id } = req.params
    const { senha_atual, nova_senha, confirmar_senha } = req.body

    console.log(`🔐 Tentativa de alteração de senha para veterinário ${id}`)

    // ========== VALIDAÇÕES BÁSICAS ==========
    
    if (!nova_senha || !confirmar_senha) {
      return res.status(400).json({
        success: false,
        message: "Nova senha e confirmação são obrigatórias",
        code: "MISSING_REQUIRED_FIELDS"
      })
    }

    if (nova_senha !== confirmar_senha) {
      return res.status(400).json({
        success: false,
        message: "Nova senha e confirmação não coincidem",
        code: "PASSWORD_MISMATCH"
      })
    }

    if (nova_senha.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Nova senha deve ter pelo menos 6 caracteres",
        code: "PASSWORD_TOO_SHORT"
      })
    }

    // ========== BUSCAR VETERINÁRIO ==========
    
    const veterinario = await web_veterinarios.findByPk(id)
    
    if (!veterinario) {
      return res.status(404).json({
        success: false,
        message: "Veterinário não encontrado",
        code: "USER_NOT_FOUND"
      })
    }

    // ========== VALIDAR SENHA ATUAL (se já tiver senha definida) ==========
    
    const jaTemSenha = veterinario.ds_senha && veterinario.ds_senha.trim() !== ''
    
    if (jaTemSenha) {
      // Se já tem senha, deve informar a senha atual
      if (!senha_atual) {
        return res.status(400).json({
          success: false,
          message: "Senha atual é obrigatória para alterar a senha",
          code: "CURRENT_PASSWORD_REQUIRED"
        })
      }

      // Verificar se a senha atual está correta
      const senhaAtualCorreta = await bcrypt.compare(senha_atual, veterinario.ds_senha)
      
      if (!senhaAtualCorreta) {
        console.log(`❌ Senha atual incorreta para veterinário ${id}`)
        return res.status(401).json({
          success: false,
          message: "Senha atual incorreta",
          code: "INVALID_CURRENT_PASSWORD"
        })
      }
    } else {
      // Se não tem senha (só login com Google), pode definir senha sem validar atual
      console.log(`ℹ️ Definindo primeira senha para veterinário ${id} (conta Google)`)
    }

    // ========== VERIFICAR SE NOVA SENHA É DIFERENTE DA ATUAL ==========
    
    if (jaTemSenha) {
      const novaSenhaIgualAtual = await bcrypt.compare(nova_senha, veterinario.ds_senha)
      
      if (novaSenhaIgualAtual) {
        return res.status(400).json({
          success: false,
          message: "A nova senha deve ser diferente da senha atual",
          code: "SAME_PASSWORD"
        })
      }
    }

    // ========== GERAR HASH DA NOVA SENHA ==========
    
    console.log(`🔐 Gerando hash da nova senha para veterinário ${id}`)
    const novaSenhaHash = await bcrypt.hash(nova_senha, 10)

    // ========== ATUALIZAR SENHA NO BANCO ==========
    
    await web_veterinarios.update(
      { ds_senha: novaSenhaHash },
      { where: { id } }
    )

    console.log(`✅ Senha alterada com sucesso para veterinário ${id}`)

    // ========== RESPOSTA DE SUCESSO ==========
    
    res.json({
      success: true,
      message: jaTemSenha ? "Senha alterada com sucesso!" : "Senha definida com sucesso!",
      code: "PASSWORD_CHANGED"
    })

  } catch (error) {
    console.error('❌ ERRO em /web-veterinarios/:id/change-password:', error.message)
    console.error('Stack:', error.stack)
    
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      code: "INTERNAL_ERROR"
    })
  }
})

// Adicionar no arquivo de rotas dos web_veterinarios (paste.txt)

// ============= ROTA PARA STATUS DE SEGURANÇA =============

// Rota para obter status de segurança do veterinário
route.get('/web-veterinarios/:id/security-status', async (req, res) => {
  try {
    const { id } = req.params

    console.log(`🔍 Buscando status de segurança para veterinário ${id}`)

    // ========== BUSCAR VETERINÁRIO ==========
    
    const veterinario = await web_veterinarios.findByPk(id, {
      attributes: ['id', 'google_id', 'ds_senha', 'updatedAt', 'createdAt']
    })
    
    if (!veterinario) {
      return res.status(404).json({
        success: false,
        message: "Veterinário não encontrado",
        code: "USER_NOT_FOUND"
      })
    }

    // ========== CALCULAR STATUS DE SEGURANÇA ==========
    
    const hasPassword = !!(veterinario.ds_senha && veterinario.ds_senha.trim() !== '')
    const hasGoogle = !!(veterinario.google_id && veterinario.google_id.trim() !== '')
    
    // Calcular data da última atualização da senha (aproximada)
    let passwordSetDate = null
    if (hasPassword) {
      // Se tem senha, usar a data de atualização do registro
      passwordSetDate = veterinario.updatedAt
    }

    // Determinar nível de segurança
    let securityLevel = 'low'
    let securityScore = 0
    
    if (hasPassword) securityScore += 50
    if (hasGoogle) securityScore += 50
    
    if (securityScore >= 100) {
      securityLevel = 'high' // Tem senha E Google
    } else if (securityScore >= 50) {
      securityLevel = 'medium' // Tem apenas um método
    } else {
      securityLevel = 'low' // Não deveria acontecer, mas...
    }

    // ========== MONTAR RESPOSTA ==========
    
    const securityStatus = {
      has_password: hasPassword,
      has_google: hasGoogle,
      password_set_date: passwordSetDate,
      security_level: securityLevel,
      security_score: securityScore,
      login_methods: [],
      recommendations: []
    }

    // Métodos de login disponíveis
    if (hasGoogle) {
      securityStatus.login_methods.push('google')
    }
    if (hasPassword) {
      securityStatus.login_methods.push('email_password')
    }

    // Recomendações de segurança
    if (!hasPassword && hasGoogle) {
      securityStatus.recommendations.push('consider_setting_backup_password')
    }
    if (!hasGoogle && hasPassword) {
      securityStatus.recommendations.push('consider_linking_google_account')
    }
    if (hasPassword) {
      // Verificar se senha é antiga (mais de 90 dias)
      const passwordAge = passwordSetDate ? (Date.now() - new Date(passwordSetDate).getTime()) / (1000 * 60 * 60 * 24) : 0
      if (passwordAge > 90) {
        securityStatus.recommendations.push('password_update_recommended')
      }
    }

    console.log(`✅ Status de segurança calculado para veterinário ${id}:`, {
      hasPassword,
      hasGoogle,
      securityLevel,
      loginMethods: securityStatus.login_methods.length
    })

    // ========== RESPOSTA DE SUCESSO ==========
    
    res.json({
      success: true,
      message: "Status de segurança obtido com sucesso",
      data: securityStatus
    })

  } catch (error) {
    console.error('❌ ERRO em /web-veterinarios/:id/security-status:', error.message)
    console.error('Stack:', error.stack)
    
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      code: "INTERNAL_ERROR"
    })
  }
})

// ========= ROTA BUSCAR ANIMAIS (PADRÃO SEQUELIZE - ADICIONE ANTES DAS ROTAS COM :id) =========

route.get('/consulta-animais-vet-mob/:nu_cpf', async (req, res) => {
  const { nu_cpf } = req.params;

  try {
    // 1. Busca o veterinário na WEB pelo CPF
    const vetWeb = await web_veterinarios.findOne({
      where: { nu_cpf: nu_cpf }
    });

    if (!vetWeb) {
      return res.status(404).json({ message: "Veterinário não encontrado na base Web." });
    }

    // 2. Busca o vínculo no Mobile usando CRMV e UF
    const vetMob = await mob_veterinarios.findOne({
      where: { 
        nu_crmv: vetWeb.nu_crmv, 
        ds_estado_crmv: vetWeb.ds_estado_crmv 
      }
    });

    if (!vetMob) {
      return res.status(404).json({ message: "Vínculo profissional não localizado no mobile." });
    }

    // 3. Busca a lista final de animais
    const listaAnimais = await mob_animais.findAll({
      where: { mob_veterinarios_id: vetMob.id },
      order: [['no_nome', 'ASC']]
    });

    res.json(listaAnimais);

  } catch (error) {
    console.log('ERRO em /veterinarios/meus-animais/:nu_cpf:', error.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

module.exports = route;