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
        mob_veterinarios_id: mobVeterinario.id,
        mob_usuarios_id: mobVeterinario.mob_usuarios_id
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

// Rota auxiliar para vincular conta Google (retorna apenas o google_id)
route.post('/web-veterinarios/vincular-google', async (req, res) => {
  try {
    const { id_token } = req.body;
    console.log("Vinculando conta Google para cadastro");

    // Verifica e decodifica o token do Google
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    const email = payload['email'];

    console.log("Token Google válido. Google ID:", googleId, "Email:", email);

    // Verifica se este Google ID já está sendo usado por outro veterinário
    const googleIdExistente = await web_veterinarios.findOne({
      where: { google_id: googleId }
    });
    
    if (googleIdExistente) {
      return res.status(409).json({
        success: false,
        message: "Esta conta Google já está vinculada a outro veterinário."
      });
    }

    // Retorna os dados do Google para o frontend usar no cadastro
    res.json({
      success: true,
      message: "Conta Google vinculada com sucesso!",
      google_data: {
        google_id: googleId,
        email: email,
        name: payload['name'],
        picture: payload['picture'],
        email_verified: payload['email_verified']
      }
    });

  } catch (error) {
    console.log("Erro em /web-veterinarios/vincular-google!");
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro ao vincular conta Google"
    });
  }
});

// Rota para cadastro de web veterinário (após validação do CRMV)
route.post('/web-veterinarios/cadastro', async (req, res) => {
  try {
    const { 
      mob_veterinarios_id,
      mob_usuarios_id,
      google_id, // Opcional - vem se o usuário vinculou o Google
      nu_crmv,
      ds_estado_crmv,
      no_completo,
      ds_email,
      ds_senha, // Opcional - pode não ter se só usar Google
      nu_cpf,
      nu_telefone_completo,
      ds_logo_s3_path
    } = req.body;
    
    console.log("Iniciando cadastro de web veterinário");
    
    // Validações
    if (!google_id && !ds_senha) {
      return res.status(400).json({
        success: false,
        message: "É necessário definir uma senha ou vincular uma conta Google."
      });
    }
    
    // Verifica se já existe cadastro com este email
    const emailExistente = await web_veterinarios.findOne({
      where: { ds_email }
    });
    
    if (emailExistente) {
      return res.status(409).json({
        success: false,
        message: "Este email já está cadastrado na plataforma."
      });
    }
    
    // Se tem google_id, verifica se já está sendo usado
    if (google_id) {
      const googleIdExistente = await web_veterinarios.findOne({
        where: { google_id }
      });
      
      if (googleIdExistente) {
        return res.status(409).json({
          success: false,
          message: "Esta conta Google já está vinculada a outro veterinário."
        });
      }
    }
    
    // Hash da senha se foi fornecida
    let hashedPassword = null;
    if (ds_senha) {
      hashedPassword = await bcrypt.hash(ds_senha, 10);
    }
    
    // Cria o registro na web_veterinarios
    const novoWebVeterinario = await web_veterinarios.create({
      mob_veterinarios_id,
      mob_usuarios_id,
      google_id: google_id || null,
      nu_crmv,
      ds_estado_crmv,
      no_completo,
      ds_email,
      ds_senha: hashedPassword,
      nu_cpf,
      nu_telefone_completo,
      ds_logo_s3_path
    });
    
    console.log("Web veterinário cadastrado com sucesso!");
    
    // Retorna os dados do veterinário criado (sem a senha)
    const { ds_senha: _, ...veterinarioResponse } = novoWebVeterinario.toJSON();
    
    res.json({
      success: true,
      message: google_id 
        ? "Cadastro realizado com sucesso! Conta Google vinculada." 
        : "Cadastro realizado com sucesso!",
      veterinario: veterinarioResponse,
      tem_google: !!google_id
    });
    
  } catch (error) {
    console.log('ERRO em /web-veterinarios/cadastro');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Rota de login por email e senha para web veterinários
route.post('/web-veterinarios/login', async (req, res) => {
  try {
    const { ds_email, ds_senha } = req.body;
    console.log("Tentativa de login web veterinário com email:", ds_email);

    // Busca o veterinário pelo email
    const veterinario = await web_veterinarios.findOne({ 
      where: { ds_email } 
    });
    
    if (!veterinario) {
      console.log("Veterinário não encontrado para o email:", ds_email);
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
    const isMatch = await bcrypt.compare(ds_senha, veterinario.ds_senha);

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

// Rota de login com Google para web veterinários
route.post('/web-veterinarios/login/google', async (req, res) => {
  try {
    const { id_token } = req.body;
    console.log("Tentativa de login web veterinário com Google token");

    // Verifica e decodifica o token do Google
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
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
      return res.status(401).json({
        success: false,
        message: "Conta Google não encontrada. Realize o cadastro primeiro."
      });
    }

    console.log("Veterinário web autenticado com Google com sucesso!");
    
    // Retorna os dados do veterinário e informações do Google
    const { ds_senha: _, ...veterinarioResponse } = veterinario.toJSON();
    
    res.json({
      success: true,
      message: "Login com Google realizado com sucesso!",
      google_data: {
        sub: payload['sub'],
        email: payload['email'],
        name: payload['name'],
        picture: payload['picture'],
        email_verified: payload['email_verified']
      },
      veterinario: veterinarioResponse
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