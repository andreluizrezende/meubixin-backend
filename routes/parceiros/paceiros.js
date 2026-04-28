"use strict";

const express = require('express');
const route = express.Router();
const models = require('../../models');
const { web_parceiros } = models;
const { uploadFile, deleteFile, getFileStream } = require('../../utils/s3_teste');
const fs = require('fs');
const path = require('path');

const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client('867699850241-is78nhfgn1blt5ji6ag9tfpdcn0cuspb.apps.googleusercontent.com');

// ============= ROTAS PARA WEB_PARCEIROS =============

// Rota de login com Google
route.post('/web-parceiros/login/google', async (req, res) => {
  try {
    const { token } = req.body;
    console.log("Tentativa de login web parceiro com Google token");

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: '867699850241-is78nhfgn1blt5ji6ag9tfpdcn0cuspb.apps.googleusercontent.com',
    });

    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    const email = payload['email'];

    console.log("Token Google válido. Google ID:", googleId, "Email:", email);

    const parceiro = await web_parceiros.findOne({
      where: { google_id: googleId }
    });

    if (!parceiro) {
      console.log("Parceiro não encontrado para o Google ID:", googleId);

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

    console.log("Parceiro web autenticado com Google com sucesso!");

    const { ds_senha: _, ...parceiroResponse } = parceiro.toJSON();

    res.status(200).json({
      success: true,
      message: "Login com Google realizado com sucesso!",
      token: `jwt_token_here_${parceiro.id}`,
      parceiro: parceiroResponse,
      googleData: {
        sub: payload['sub'],
        email: payload['email'],
        name: payload['name'],
        picture: payload['picture'],
        email_verified: payload['email_verified']
      }
    });

  } catch (error) {
    console.log("Erro em /web-parceiros/login/google!");
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Rota de login por email e senha
route.post('/web-parceiros/login', async (req, res) => {
  try {
    const { email, password, ds_email, ds_senha } = req.body;

    const emailToUse = email || ds_email;
    const passwordToUse = password || ds_senha;

    console.log("Tentativa de login web parceiro com email:", emailToUse);

    if (!emailToUse || !passwordToUse) {
      return res.status(400).json({
        success: false,
        message: "Email e senha são obrigatórios"
      });
    }

    const parceiro = await web_parceiros.findOne({
      where: { ds_email: emailToUse }
    });

    if (!parceiro) {
      console.log("Parceiro não encontrado para o email:", emailToUse);
      return res.status(401).json({
        success: false,
        message: "Email ou senha incorretos."
      });
    }

    if (!parceiro.ds_senha) {
      return res.status(401).json({
        success: false,
        message: "Esta conta só pode fazer login com Google."
      });
    }

    const isMatch = await bcrypt.compare(passwordToUse, parceiro.ds_senha);

    if (!isMatch) {
      console.log("Senha incorreta para o parceiro:", parceiro.id);
      return res.status(401).json({
        success: false,
        message: "Email ou senha incorretos."
      });
    }

    console.log("Parceiro web autenticado com sucesso!");

    const { ds_senha: _, ...parceiroResponse } = parceiro.toJSON();

    res.json({
      success: true,
      message: "Login realizado com sucesso!",
      token: `jwt_token_here_${parceiro.id}`,
      parceiro: parceiroResponse
    });

  } catch (error) {
    console.log("Erro em /web-parceiros/login!");
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Rota de cadastro
route.post('/web-parceiros/cadastro', async (req, res) => {
  try {
    const {
      // Dados da empresa
      no_empresa,
      ds_email,
      nu_cnpj,
      nu_telefone_completo,
      ds_logo_s3_path,

      // Endereço
      ds_endereco,
      ds_complemento,
      ds_bairro,
      ds_cidade,
      ds_estado,
      nu_cep,
      nu_latitude,
      nu_longitude,

      // Autenticação
      ds_senha,
      googleToken,
      google_id
    } = req.body;

    console.log("🚀 Iniciando cadastro web parceiro");
    console.log("📋 Dados recebidos:", {
      hasGoogleToken: !!googleToken,
      hasGoogleId: !!google_id,
      hasPassword: !!ds_senha,
      email: ds_email,
      empresa: no_empresa
    });

    // ========== VALIDAÇÕES BÁSICAS ==========

    if (!no_empresa || !ds_email) {
      return res.status(400).json({
        success: false,
        message: "Nome da empresa e email são obrigatórios."
      });
    }

    if (!ds_senha && !googleToken && !google_id) {
      return res.status(400).json({
        success: false,
        message: "É necessário definir uma senha ou usar autenticação Google."
      });
    }

    // ========== PROCESSAMENTO DO GOOGLE (se fornecido) ==========

    let googleData = null;
    let finalGoogleId = google_id;

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

        finalGoogleId = payload['sub'];

        console.log("✅ Token Google válido:", googleData.google_id);

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

    const emailExistente = await web_parceiros.findOne({ where: { ds_email } });
    if (emailExistente) {
      return res.status(409).json({
        success: false,
        message: "Este email já está cadastrado na plataforma."
      });
    }

    if (nu_cnpj) {
      const cnpjExistente = await web_parceiros.findOne({ where: { nu_cnpj } });
      if (cnpjExistente) {
        return res.status(409).json({
          success: false,
          message: "Este CNPJ já está cadastrado na plataforma."
        });
      }
    }

    if (finalGoogleId) {
      const googleIdExistente = await web_parceiros.findOne({ where: { google_id: finalGoogleId } });
      if (googleIdExistente) {
        return res.status(409).json({
          success: false,
          message: "Esta conta Google já está vinculada a outro parceiro."
        });
      }
    }

    // ========== HASH DA SENHA ==========

    let senhaHash = null;
    if (ds_senha) {
      console.log("🔐 Gerando hash da senha...");
      senhaHash = await bcrypt.hash(ds_senha, 10);
    }

    // ========== CRIAÇÃO DO REGISTRO ==========

    const dadosCriacao = {
      google_id: finalGoogleId || null,
      no_empresa,
      ds_email,
      ds_senha: senhaHash,
      nu_cnpj: nu_cnpj || null,
      nu_telefone_completo: nu_telefone_completo || null,
      ds_logo_s3: ds_logo_s3_path || null,
      ds_endereco: ds_endereco || null,
      ds_complemento: ds_complemento || null,
      ds_bairro: ds_bairro || null,
      ds_cidade: ds_cidade || null,
      ds_estado: ds_estado || null,
      nu_cep: nu_cep || null,
      nu_latitude: nu_latitude || null,
      nu_longitude: nu_longitude || null
    };

    console.log("💾 Criando parceiro com dados:", {
      ...dadosCriacao,
      ds_senha: dadosCriacao.ds_senha ? '[HASH]' : null
    });

    const novoParceiro = await web_parceiros.create(dadosCriacao);

    console.log("✅ Web parceiro criado com sucesso! ID:", novoParceiro.id);

    const { ds_senha: _, ...parceiroResponse } = novoParceiro.toJSON();

    res.json({
      success: true,
      message: googleData
        ? "Conta criada com sucesso usando Google!"
        : "Conta criada com sucesso!",
      token: `jwt_token_here_${novoParceiro.id}`,
      parceiro: parceiroResponse,
      ...(googleData && {
        googleData: {
          sub: googleData.google_id,
          email: googleData.email,
          name: googleData.name,
          picture: googleData.picture
        }
      })
    });

    console.log("🎉 Cadastro finalizado com sucesso!");

  } catch (error) {
    console.error('❌ ERRO em /web-parceiros/cadastro:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Vincular conta Google a conta existente
route.post('/web-parceiros/link-google', async (req, res) => {
  try {
    const { userId, googleId, googleEmail } = req.body;
    console.log(`Vinculando Google ID ${googleId} ao parceiro ${userId}`);

    const parceiro = await web_parceiros.findByPk(userId);
    if (!parceiro) {
      return res.status(404).json({
        success: false,
        message: 'Parceiro não encontrado'
      });
    }

    const existingGoogle = await web_parceiros.findOne({ where: { google_id: googleId } });
    if (existingGoogle && existingGoogle.id !== parseInt(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Esta conta Google já está vinculada a outro parceiro'
      });
    }

    await web_parceiros.update(
      {
        google_id: googleId,
        ...(parceiro.ds_email !== googleEmail && { ds_email: googleEmail })
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

// Verificar disponibilidade de email
route.post('/web-parceiros/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email é obrigatório"
      });
    }

    const parceiroExistente = await web_parceiros.findOne({ where: { ds_email: email } });

    res.json({
      success: true,
      available: !parceiroExistente,
      message: parceiroExistente ? "Email já está em uso" : "Email disponível"
    });

  } catch (error) {
    console.log('ERRO em /web-parceiros/check-email');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Buscar parceiro por email
route.post('/web-parceiros/find-by-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email é obrigatório"
      });
    }

    const parceiro = await web_parceiros.findOne({
      where: { ds_email: email },
      attributes: ['id', 'no_empresa', 'ds_email', 'nu_cnpj', 'google_id']
    });

    if (!parceiro) {
      return res.status(404).json({
        success: false,
        message: "Nenhuma conta encontrada com este email"
      });
    }

    res.json({
      success: true,
      parceiro,
      hasGoogle: !!parceiro.google_id
    });

  } catch (error) {
    console.log('ERRO em /web-parceiros/find-by-email');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Buscar todos os parceiros
route.get('/web-parceiros', async (req, res) => {
  try {
    const resposta = await web_parceiros.findAll({
      attributes: { exclude: ['ds_senha'] }
    });
    res.json(resposta);
  } catch (error) {
    console.log('ERRO em /web-parceiros');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Buscar parceiro por ID
route.get('/web-parceiros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await web_parceiros.findByPk(id, {
      attributes: { exclude: ['ds_senha'] }
    });

    if (!resposta) {
      return res.status(404).json({
        success: false,
        message: "Parceiro não encontrado"
      });
    }

    res.json(resposta);
  } catch (error) {
    console.log('ERRO em /web-parceiros/:id');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Atualizar parceiro
route.put('/web-parceiros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ds_senha, google_id, created_at, updated_at, ...dadosAtualizacao } = req.body;

    const parceiroExistente = await web_parceiros.findByPk(id);
    if (!parceiroExistente) {
      return res.status(404).json({
        success: false,
        message: "Parceiro não encontrado"
      });
    }

    if (ds_senha) {
      dadosAtualizacao.ds_senha = await bcrypt.hash(ds_senha, 10);
    }

    await web_parceiros.update(dadosAtualizacao, { where: { id } });

    const parceiroAtualizado = await web_parceiros.findByPk(id, {
      attributes: { exclude: ['ds_senha'] }
    });

    res.json({
      success: true,
      message: "Parceiro atualizado com sucesso!",
      parceiro: parceiroAtualizado
    });

  } catch (error) {
    console.log('ERRO em /web-parceiros/:id PUT');
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Upload de logo do parceiro
route.put('/web-parceiros/:id/upload-image', async (req, res) => {
  try {
    const { id } = req.params;
    const { imagem_base64, remover = false } = req.body;

    console.log('📥 Parâmetros recebidos:', {
      remover,
      tem_imagem: !!imagem_base64,
      tamanho_imagem: imagem_base64?.length || 0
    });

    if (remover !== true && !imagem_base64) {
      return res.status(400).json({
        success: false,
        message: "Imagem é obrigatória ou use 'remover: true'"
      });
    }

    const parceiro = await web_parceiros.findByPk(id);
    if (!parceiro) {
      return res.status(404).json({
        success: false,
        message: "Parceiro não encontrado"
      });
    }

    // Key baseada no CNPJ (ou ID se não tiver CNPJ)
    const key = `parceiros/${parceiro.nu_cnpj || parceiro.id}_logo`;

    const fileStream = await getFileStream(key);
    const imageExists = fileStream !== undefined;

    // CASO 1: REMOÇÃO
    if (remover === true) {
      console.log(`🗑️ Removendo logo do parceiro ${parceiro.no_empresa}...`);

      if (imageExists) {
        await deleteFile(key);
        console.log("✅ Logo excluída do S3 com sucesso!");
      }

      await web_parceiros.update({ ds_logo_s3: null }, { where: { id } });

      return res.json({
        success: true,
        message: "Logo removida com sucesso!"
      });
    }

    // CASO 2: UPLOAD
    console.log("📤 Realizando upload da logo...");

    if (imageExists) {
      await deleteFile(key);
      console.log("✅ Logo anterior excluída!");
    }

    const tempFilePath = path.resolve(__dirname, `temp_${Date.now()}.png`);

    fs.writeFileSync(
      tempFilePath,
      imagem_base64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const fileStreamUpload = fs.createReadStream(tempFilePath);
    await uploadFile(fileStreamUpload, key);
    fs.unlinkSync(tempFilePath);

    await web_parceiros.update({ ds_logo_s3: key }, { where: { id } });

    console.log("✅ Upload de logo concluído com sucesso!");

    res.json({
      success: true,
      message: "Logo atualizada com sucesso!"
    });

  } catch (error) {
    console.log('❌ ERRO em /web-parceiros/:id/upload-image');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

// Buscar logo do parceiro
route.get('/web-parceiros/:id/imagem', async (req, res) => {
  try {
    const { id } = req.params;

    const parceiro = await web_parceiros.findByPk(id);
    if (!parceiro) {
      return res.status(404).json({ error: 'Parceiro não encontrado' });
    }

    const key = `parceiros/${parceiro.nu_cnpj || parceiro.id}_logo`;

    const fileStream = await getFileStream(key);
    const imageExists = fileStream !== undefined;

    if (!imageExists) {
      return res.status(404).json({ error: "Logo não encontrada" });
    }

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, max-age=0'
    });

    if (fileStream.pipe) {
      fileStream.pipe(res);
    } else {
      const chunks = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    }

  } catch (error) {
    console.log('ERRO em /web-parceiros/:id/imagem');
    console.log(error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alterar senha
route.post('/web-parceiros/:id/change-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { senha_atual, nova_senha, confirmar_senha } = req.body;

    console.log(`🔐 Tentativa de alteração de senha para parceiro ${id}`);

    if (!nova_senha || !confirmar_senha) {
      return res.status(400).json({
        success: false,
        message: "Nova senha e confirmação são obrigatórias",
        code: "MISSING_REQUIRED_FIELDS"
      });
    }

    if (nova_senha !== confirmar_senha) {
      return res.status(400).json({
        success: false,
        message: "Nova senha e confirmação não coincidem",
        code: "PASSWORD_MISMATCH"
      });
    }

    if (nova_senha.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Nova senha deve ter pelo menos 6 caracteres",
        code: "PASSWORD_TOO_SHORT"
      });
    }

    const parceiro = await web_parceiros.findByPk(id);
    if (!parceiro) {
      return res.status(404).json({
        success: false,
        message: "Parceiro não encontrado",
        code: "USER_NOT_FOUND"
      });
    }

    const jaTemSenha = parceiro.ds_senha && parceiro.ds_senha.trim() !== '';

    if (jaTemSenha) {
      if (!senha_atual) {
        return res.status(400).json({
          success: false,
          message: "Senha atual é obrigatória para alterar a senha",
          code: "CURRENT_PASSWORD_REQUIRED"
        });
      }

      const senhaAtualCorreta = await bcrypt.compare(senha_atual, parceiro.ds_senha);
      if (!senhaAtualCorreta) {
        return res.status(401).json({
          success: false,
          message: "Senha atual incorreta",
          code: "INVALID_CURRENT_PASSWORD"
        });
      }

      const novaSenhaIgualAtual = await bcrypt.compare(nova_senha, parceiro.ds_senha);
      if (novaSenhaIgualAtual) {
        return res.status(400).json({
          success: false,
          message: "A nova senha deve ser diferente da senha atual",
          code: "SAME_PASSWORD"
        });
      }
    } else {
      console.log(`ℹ️ Definindo primeira senha para parceiro ${id} (conta Google)`);
    }

    const novaSenhaHash = await bcrypt.hash(nova_senha, 10);
    await web_parceiros.update({ ds_senha: novaSenhaHash }, { where: { id } });

    console.log(`✅ Senha alterada com sucesso para parceiro ${id}`);

    res.json({
      success: true,
      message: jaTemSenha ? "Senha alterada com sucesso!" : "Senha definida com sucesso!",
      code: "PASSWORD_CHANGED"
    });

  } catch (error) {
    console.error('❌ ERRO em /web-parceiros/:id/change-password:', error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      code: "INTERNAL_ERROR"
    });
  }
});

// Status de segurança
route.get('/web-parceiros/:id/security-status', async (req, res) => {
  try {
    const { id } = req.params;

    const parceiro = await web_parceiros.findByPk(id, {
      attributes: ['id', 'google_id', 'ds_senha', 'updatedAt', 'createdAt']
    });

    if (!parceiro) {
      return res.status(404).json({
        success: false,
        message: "Parceiro não encontrado",
        code: "USER_NOT_FOUND"
      });
    }

    const hasPassword = !!(parceiro.ds_senha && parceiro.ds_senha.trim() !== '');
    const hasGoogle = !!(parceiro.google_id && parceiro.google_id.trim() !== '');

    let securityScore = 0;
    if (hasPassword) securityScore += 50;
    if (hasGoogle) securityScore += 50;

    const securityLevel = securityScore >= 100 ? 'high' : securityScore >= 50 ? 'medium' : 'low';

    const securityStatus = {
      has_password: hasPassword,
      has_google: hasGoogle,
      password_set_date: hasPassword ? parceiro.updatedAt : null,
      security_level: securityLevel,
      security_score: securityScore,
      login_methods: [],
      recommendations: []
    };

    if (hasGoogle) securityStatus.login_methods.push('google');
    if (hasPassword) securityStatus.login_methods.push('email_password');

    if (!hasPassword && hasGoogle) securityStatus.recommendations.push('consider_setting_backup_password');
    if (!hasGoogle && hasPassword) securityStatus.recommendations.push('consider_linking_google_account');

    if (hasPassword) {
      const passwordAge = (Date.now() - new Date(parceiro.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (passwordAge > 90) securityStatus.recommendations.push('password_update_recommended');
    }

    res.json({
      success: true,
      message: "Status de segurança obtido com sucesso",
      data: securityStatus
    });

  } catch (error) {
    console.error('❌ ERRO em /web-parceiros/:id/security-status:', error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      code: "INTERNAL_ERROR"
    });
  }
});

// Deletar parceiro
route.delete('/web-parceiros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rowsAffected = await web_parceiros.destroy({ where: { id } });

    if (rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: "Parceiro não encontrado"
      });
    }

    res.json({
      success: true,
      message: "Parceiro deletado com sucesso!"
    });
  } catch (error) {
    console.log('ERRO em /web-parceiros/:id DELETE');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor"
    });
  }
});

module.exports = route;