const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_veterinarios, web_veterinarios, mob_usuarios, mob_administradores, mob_animais } = models;

const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');

// Configurar o Google OAuth client
const client = new OAuth2Client('867699850241-is78nhfgn1blt5ji6ag9tfpdcn0cuspb.apps.googleusercontent.com');

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
      where: { mob_veterinarios_id: mobVeterinario.id }
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
      token: `jwt_token_here_${veterinario.id}`, // Substitua por seu JWT real
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
      token: `jwt_token_here_${veterinario.id}`, // Substitua por seu JWT real
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

    // Verificar se mob_veterinarios_id já tem cadastro web
    const webVeterinarioExistente = await web_veterinarios.findOne({
      where: { mob_veterinarios_id }
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
      token: `jwt_token_here_${novoWebVeterinario.id}`, // Substitua por seu JWT real
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

// Rota para atualizar um web veterinário
route.put('/web-veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ds_senha, ...dadosAtualizacao } = req.body;
    
    // Se foi enviada uma nova senha, faz o hash
    if (ds_senha) {
      dadosAtualizacao.ds_senha = await bcrypt.hash(ds_senha, 10);
    }
    
    const [rowsAffected] = await web_veterinarios.update(
      dadosAtualizacao,
      { where: { id } }
    );
    
    if (rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: "Veterinário não encontrado"
      });
    }
    
    res.json({
      success: true,
      message: "Veterinário atualizado com sucesso!"
    });
  } catch (error) {
    console.log('ERRO em /web-veterinarios/:id PUT');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
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
route.delete('/veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_veterinarios.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

module.exports = route;