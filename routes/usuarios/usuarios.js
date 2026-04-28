const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const route = express.Router();
const models = require("../../models");
const usuarios = models.mob_usuarios;
const administradores = models.mob_administradores;
const veterinarios = models.mob_veterinarios;
const { sendEmail } = require("../../utils/sendNewPass");
const mob_animais = require("../../models/mob_animais");
const Sequelize = require("sequelize");
const config = require("../../config/config.json")["production"];
const bcrypt = require("bcrypt");
const mob_logs = models.mob_logs
const moment = require('moment-timezone');
let sequelize = new Sequelize(config);
const axios = require('axios')
const GOOGLE_CLIENT_ID = "867699850241-sfm2tk642at1j3g0anrntcu044ki9h48.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

route.post("/usuarioRegister", async (req, res) => {
  try {
    const { no_completo, ds_senha, ds_email, nu_telefone_completo, nu_cpf } =
      req.body;
    const hashedPassword = await bcrypt.hash(ds_senha, 10);
    const st_lgpd = 1;
    await usuarios.create({
      no_completo,
      ds_senha: hashedPassword,
      ds_email,
      nu_telefone_completo,
      nu_cpf,
      st_lgpd,
    });
    const resp = await usuarios.findOne({ where: { nu_cpf, ds_senha: hashedPassword } });
    resp ? res.send(resp) : res.send(false);
  } catch (error) {
    console.log("Erro em /usuarioRegister!");
    console.log(error.message);
  }
});

route.put("/usuarioEdit", async (req, res) => {
  try {
    const { no_completo, ds_email, nu_telefone_completo, nu_cpf, ds_senha, st_envia_mensagem } = req.body;

    let updateData = {
      no_completo,
      ds_email,
      nu_telefone_completo,
      nu_cpf
    };

    // Adiciona o campo st_envia_mensagem se ele foi fornecido
    if (st_envia_mensagem !== undefined) {
      updateData.st_envia_mensagem = st_envia_mensagem;
    }

    if (ds_senha) {
      const hashedPassword = await bcrypt.hash(ds_senha, 10);
      updateData.ds_senha = hashedPassword;
    }

    // Atualizar o usuário
    const resposta = await usuarios.update(updateData, { where: { nu_cpf } });

    if (resposta[0]) {
      // Buscar o usuário atualizado
      const resp = await usuarios.findOne({ where: { nu_cpf } });
      res.send(resp);
    } else {
      res.send(false);
    }
  } catch (error) {
    console.log("ERRO em /usuarioEdit");
    console.log(error.message);
  }
});

route.post("/usuarioGoogleLogin", async (req, res) => {
  try {
    const { token: idToken } = req.body;
    console.log("Dados que chegaram", req.body)

    // Verifica o token recebido do Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    let user = await usuarios.findOne({ where: { ds_email: email } });

    if (!user) {
      // Se o usuário não existe, retorna dados para cadastro
      return res.json({
        status: "success",
        exists: false,
        user,
        viaGoogle: true,
      });
    }

    // Registra o login no log
    const currentDateTime = moment()
      .tz("America/Sao_Paulo")
      .format("YYYY-MM-DD HH:mm:ss");

    await mob_logs.create({
      ds_funcionalidade: "Autenticação Google",
      nu_cpf: user.nu_cpf,
      dt_acesso: currentDateTime,
    });

    res.json({ status: "success", exists: true, user });
  } catch (error) {
    console.log("Erro no login com Google:", error.message);
    res.status(400).json({ error: "Falha na autenticação do Google" });
  }
});

route.post("/usuarioLogin", async (req, res) => {
  try {
    const { nu_cpf, ds_senha } = req.body;
    // 1. Tenta encontrar na tabela de usuários comuns (Tutores)
    let user = await usuarios.findOne({ where: { nu_cpf } });
    let isVeterinario = false;

    // 2. Se não encontrou, tenta na tabela de veterinários
    if (!user) {
      user = await veterinarios.findOne({ where: { ds_cpf: nu_cpf } });
      if (user) isVeterinario = true;
    }

    if (user) {
      let isMatch;
      // Validação de senha comum a ambos os perfis
      if (ds_senha.startsWith('$2b$')) {
        isMatch = ds_senha === user.ds_senha;
      } else {
        isMatch = await bcrypt.compare(ds_senha, user.ds_senha);
      }

      if (isMatch) {
        const currentDateTime = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
        await mob_logs.create({
          ds_funcionalidade: isVeterinario ? "Autenticação Veterinário" : "Autenticação",
          nu_cpf,
          dt_acesso: currentDateTime
        });

        // Retorna o usuário com a flag de tipo para o frontend
        const userData = user.toJSON();
        if (isVeterinario) userData.userType = 4;
        res.send(userData);
      } else {
        res.send(false);
      }
    } else {
      res.send(false);
    }
  } catch (error) {
    console.log("Erro em /usuarioLogin!", error.message);
    res.status(500).send("Erro interno do servidor");
  }
});

route.post("/usuarioLoginIntegrado", async (req, res) => {
  try {
    const { nu_cpf, ds_senha } = req.body;
    
    // Tenta primeiro usuários comuns (Tutores/ADM)
    const user = await usuarios.findOne({ where: { nu_cpf } });
    
    if (user) {
      const isMatch = ds_senha.startsWith('$2b$') ? 
        ds_senha === user.ds_senha : await bcrypt.compare(ds_senha, user.ds_senha);

      if (!isMatch) return res.send(false);

      const resposta_adm = await administradores.findOne({ where: { mob_usuarios_id: user.id } });
      
      if (resposta_adm != null) {
        return res.send(JSON.stringify(resposta_adm.ds_perfil === 'parceiro' ? 2 : 3));
      }
      return res.send(JSON.stringify(1));
    } 

    // Se não encontrou em usuários, tenta veterinários
    const vet = await veterinarios.findOne({ where: { ds_cpf: nu_cpf } });
    if (vet) {
      const isMatchVet = await bcrypt.compare(ds_senha, vet.ds_senha);
      if (isMatchVet) return res.send(JSON.stringify(4)); // Código para Veterinário[cite: 3]
    }

    res.send(false);
  } catch (error) {
    res.status(500).send("Erro interno");
  }
});


route.post("/checkUsuarioCPF", async (req, res) => {
  try {
    const { nu_cpf } = req.body;
    const resposta = await usuarios.findOne({ where: { nu_cpf } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("/checkUsuarioCPF");
    console.log(error.message);
  }
});

//remover em 30 dias

route.post("/administradorLogin", async (req, res) => {
  try {
    const { mob_usuarios_id } = req.body;
    const resposta = await administradores.findOne({
      where: { mob_usuarios_id },
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("Erro em /usuarioLogin!");
    console.log(error.message);
  }
});

route.get("/usuario/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await usuarios.findOne({
      where: { id },
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("Erro em /usuario/:id");
    console.log(error.message);
  }
});

route.post("/recuperarSenha", async (req, res) => {
  console.log('aqui');
  try {
    const { nu_cpf, ds_email, nu_telefone_completo } = req.body;
    console.log("passou aqui", req.body);

    let whereClause = { nu_cpf };
    console.log("passou aqui 2");

    // Adiciona o critério de busca baseado no que foi fornecido (email ou telefone)
    if (ds_email) {
      whereClause.ds_email = ds_email;
    } else if (nu_telefone_completo) {
      // Usaremos uma abordagem diferente para garantir precisão na busca
      const { Op } = require('sequelize');

      // Normaliza o número removendo caracteres não numéricos
      const numeroLimpo = nu_telefone_completo.replace(/\D/g, '');

      // Verifica se o número tem 11 dígitos (com 9) ou 10 dígitos (sem 9)
      const temNoveDigitos = numeroLimpo.length === 11 && numeroLimpo[2] === '9';
      const ddd = numeroLimpo.substring(0, 2);

      // Abordagem mais segura: buscar todos os usuários com o CPF
      // e verificar programaticamente o número de telefone
      whereClause = { nu_cpf };

      // Fazemos a busca inicial apenas pelo CPF
      const usuarios_encontrados = await usuarios.findAll({ where: whereClause });

      // Verificamos cada usuário para ver se o telefone corresponde
      const usuarioEncontrado = usuarios_encontrados.find(user => {
        // Normaliza o telefone do banco removendo caracteres não numéricos
        const telefoneBanco = user.nu_telefone_completo.replace(/\D/g, '');

        // Caso 1: Números exatamente iguais
        if (telefoneBanco === numeroLimpo) return true;

        // Caso 2: Número do banco tem o 9, mas o informado não tem
        if (temNoveDigitos && telefoneBanco === ddd + numeroLimpo.substring(3)) return true;

        // Caso 3: Número informado tem o 9, mas o do banco não tem
        if (!temNoveDigitos && telefoneBanco === ddd + '9' + numeroLimpo.substring(2)) return true;

        return false;
      });

      if (usuarioEncontrado) {
        return res.send(usuarioEncontrado);
      } else {
        return res.send(false);
      }
    } else {
      console.log("Ta sendo retornado aqui");
      // Se nem email nem telefone foram fornecidos
      return res.send(false);
    }

    // Se chegamos aqui, estamos lidando com busca por e-mail
    console.log(whereClause);
    console.log('até aqui vem');

    const resposta = await usuarios.findOne({ where: whereClause });
    console.log(whereClause);
    console.log(resposta);
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("Erro em /recuperarSenha!");
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
});

route.put("/updateSenha", async (req, res) => {
  console.log('ta na rota')
  console.log(req.body)

  try {
    const { nu_cpf, ds_email, nu_telefone_completo, ds_senha } = req.body;
    console.log(req.body)

    const senha = ds_senha.toString();
    const hashedPassword = await bcrypt.hash(senha, 10);

    let resposta;
    let whereClause = { nu_cpf };

    // Verifica qual método foi escolhido (e-mail ou telefone)
    if (ds_email) {
      // Recuperação por e-mail
      whereClause.ds_email = ds_email;

      resposta = await usuarios.update(
        { ds_senha: hashedPassword },
        { where: whereClause }
      );

      if (resposta[0]) {
        res.send(true);
        sendEmail(ds_email, ds_senha); // Envia e-mail com a nova senha
      } else {
        res.send(false);
      }
    } else if (nu_telefone_completo) {
      // Recuperação por telefone
      whereClause.nu_telefone_completo = nu_telefone_completo;

      console.log(whereClause)

      resposta = await usuarios.update(
        { ds_senha: hashedPassword },
        { where: whereClause }
      );

      if (resposta[0]) {
        // Formata o número para o WhatsApp
        let telefone = nu_telefone_completo.replace(/\D/g, ''); // Remove todos caracteres não numéricos

        // Se o telefone tiver DDD + 9 dígitos (formato comum no Brasil), remover o 9 extra
        if (telefone.length == 11 && telefone[2] == '9') {
          telefone = telefone.substring(0, 2) + telefone.substring(3);
        }

        // Garante que o número está no formato internacional
        if (telefone.startsWith('0')) {
          telefone = telefone.substring(1);
        }
        if (!telefone.startsWith('55')) {
          telefone = '55' + telefone;
        }

        const to_number = `${telefone}@s.whatsapp.net`;

        // Prepara a mensagem com a senha em negrito
        const message = `Sua nova senha de acesso é: ${ds_senha}. Recomendamos que você a altere após o login.`;

        // Prepara o payload
        const payload = {
          "to": to_number,
          "message": message
        };

        try {

          const whatsappResponse = await axios.post(
            "https://coral-app-f97ui.ondigitalocean.app/send-message",
            payload,
            {
              headers: {
                "Content-Type": "application/json"
              }
            }
          );

          console.log('Resposta do envio de WhatsApp:', whatsappResponse.data);
          console.log(`Senha alterada para o telefone ${nu_telefone_completo}. Nova senha: ${ds_senha}`);

          res.send(true);
        } catch (whatsappError) {
          console.error('Erro ao enviar mensagem WhatsApp:', whatsappError);
          // Mesmo com erro no envio do WhatsApp, a senha foi alterada
          console.log(`Senha alterada para o telefone ${nu_telefone_completo}, mas houve um erro ao enviar a mensagem.`);
          res.send(true);
        }
      } else {
        console.log('ta aqui')
        res.send(false);
      }
    } else {
      // Nem e-mail nem telefone foram fornecidos
      res.status(400).send('E-mail ou telefone devem ser fornecidos');
    }
  } catch (error) {
    console.log("ERRO em /updateSenha");
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
});

route.get("/mocks", async (req, res) => {
  try {
    // const tipoFeridas = await sequelize.query('select * from mob_tipo_feridas', { type: sequelize.QueryTypes.SELECT });
    // const tipoPelagem = await sequelize.query('select * from mob_tipo_pelagem', { type: sequelize.QueryTypes.SELECT });
    const tipoTecidos = await sequelize.query(
      "select id, ds_tipo_tecidos as description from mob_tipo_tecidos",
      { type: sequelize.QueryTypes.SELECT }
    );
    const localFerida = await sequelize.query(
      "select id, ds_local_feridas as description from mob_local_feridas",
      { type: sequelize.QueryTypes.SELECT }
    );
    // const tipoEspecies = await sequelize.query('select * from mob_tipo_especies', { type: sequelize.QueryTypes.SELECT });

    res.send({ localFerida, tipoTecidos });
  } catch (error) {
    console.error(error);
    res.status(500).send("Ocorreu um erro ao obter os dados.");
  }
});

// Adicione essa rota no seu arquivo de rotas do backend
route.post("/usuarioLoginGoogle", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Login Google - Email recebido:", email);

    // Busca usuário pelo email
    const user = await usuarios.findOne({ where: { ds_email: email } });

    if (user) {
      console.log("Usuário encontrado pelo email:", user.id);

      // Log de acesso
      const currentDateTime = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
      console.log("Dados enviados pro log: ", "Autenticação Google", "Email:", email, "dt_acesso:", currentDateTime);
      await mob_logs.create({
        ds_funcionalidade: "Autenticação Google",
        nu_cpf: user.nu_cpf,
        dt_acesso: currentDateTime
      });

      // Verifica o tipo de usuário
      console.log("Verificando perfil do administrador...");
      const resposta_adm = await administradores.findOne({
        where: { mob_usuarios_id: user.id },
      });

      console.log("Resposta do administrador:", resposta_adm);

      let userType;
      if (resposta_adm != null) {
        if (resposta_adm.ds_perfil === 'parceiro') {
          console.log("Usuário é um parceiro. Tipo: 2");
          userType = 2;
        } else {
          console.log("Usuário é um administrador comum. Tipo: 3");
          userType = 3;
        }
      } else {
        console.log("Usuário é comum. Tipo: 1");
        userType = 1;
      }

      // Retorna tanto os dados do usuário quanto o tipo
      res.send({
        user: user,
        userType: userType
      });
    } else {
      console.log("Usuário não encontrado para o email:", email);
      res.send(false);
    }
  } catch (error) {
    console.log("Erro em /usuarioLoginGoogle!");
    console.log(error.message);
    res.status(500).send("Erro interno do servidor");
  }
});


// Nova rota para listar animais vinculados a um veterinário específico[cite: 2]
route.get("/veterinarios/:id/animais", async (req, res) => {
  try {
    const { id } = req.params;
    const pacientes = await models.mob_animais.findAll({
      where: { mob_veterinarios_id: id } // Filtra pela coluna de vínculo médico[cite: 1]
    });
    res.send(pacientes);
  } catch (error) {
    console.log("Erro ao buscar animais do veterinário:", error.message);
    res.status(500).send("Erro ao buscar pacientes");
  }
});

module.exports = route;
