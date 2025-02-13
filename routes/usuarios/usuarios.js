const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const route = express.Router();
const models = require("../../models");
const usuarios = models.mob_usuarios;
const administradores = models.mob_administradores;
const { sendEmail } = require("../../utils/sendNewPass");
const mob_animais = require("../../models/mob_animais");
const Sequelize = require("sequelize");
const config = require("../../config/config.json")["production"];
const bcrypt = require("bcrypt");
const mob_logs = models.mob_logs
const moment = require('moment-timezone');
let sequelize = new Sequelize(config);

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
      ds_senha:hashedPassword,
      ds_email,
      nu_telefone_completo,
      nu_cpf,
      st_lgpd,
    });
    const resp = await usuarios.findOne({ where: { nu_cpf, ds_senha:hashedPassword } });
    resp ? res.send(resp) : res.send(false);
  } catch (error) {
    console.log("Erro em /usuarioRegister!");
    console.log(error.message);
  }
});

route.put("/usuarioEdit", async (req, res) => {
  try {
    const { no_completo, ds_email, nu_telefone_completo, nu_cpf, ds_senha } = req.body;

    let updateData = { no_completo, ds_email, nu_telefone_completo, nu_cpf };

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
    console.log("recebeu no backend::", nu_cpf, ds_senha)
    const user = await usuarios.findOne({ where: { nu_cpf } });
    console.log("achou user com cpf??::", user)


    if (user) {
      let isMatch;

      // Verifica se a senha recebida já está criptografada
      if (ds_senha.startsWith('$2b$')) {
        console.log("Senha ja criptografada")
        console.log(ds_senha, "==", user.ds_senha)
        // Se a senha recebida já está criptografada, compara diretamente
        isMatch = ds_senha === user.ds_senha;
        console.log('resposta', isMatch)
      } else {
        // Se a senha recebida não está criptografada, segue o fluxo normal
        if (user.ds_senha.startsWith('$2b$')) {
          // Senha no banco está criptografada, usa bcrypt para comparar
          isMatch = await bcrypt.compare(ds_senha, user.ds_senha);
        } else {
          // Senha no banco não está criptografada, compara diretamente
          isMatch = ds_senha === user.ds_senha;
          if (isMatch) {
            // Criptografa a senha e atualiza o banco de dados
            const hashedPassword = await bcrypt.hash(ds_senha, 10);
            await usuarios.update(
              { ds_senha: hashedPassword },
              { where: { nu_cpf } }
            );
          }
        }
      }

      if (isMatch) {
        console.log("resposta do login, ", user);
        const currentDateTime = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
        console.log("Dados enviados pro log: ", "Autenticação", "Cpf:", nu_cpf, "dt_acesso:", currentDateTime);
        await mob_logs.create({ ds_funcionalidade: "Autenticação", nu_cpf, dt_acesso: currentDateTime });
        res.send(user);
      } else {
        res.send(false);
      }
    } else {
      res.send(false);
    }
  } catch (error) {
    console.log("Erro em /usuarioLogin!");
    console.log(error.message);
    res.status(500).send("Erro interno do servidor");
  }
});

route.post("/usuarioLoginIntegrado", async (req, res) => {
  try {
    const { nu_cpf, ds_senha } = req.body;
    console.log("Tentativa de login com CPF:", nu_cpf); // Log para controle

    const user = await usuarios.findOne({ where: { nu_cpf } });
    
    if (user) {
      console.log("Usuário encontrado no banco de dados:", user.id); // Log para controle

      let isMatch;

      // Verifica se a senha recebida já está criptografada
      if (ds_senha.startsWith('$2b$')) {
        console.log("Senha recebida já está criptografada. Comparando diretamente."); // Log para controle
        isMatch = ds_senha === user.ds_senha;
      } else {
        console.log("Senha recebida não está criptografada. Usando bcrypt para comparar."); // Log para controle
        isMatch = await bcrypt.compare(ds_senha, user.ds_senha);
      }

      if (!isMatch) {
        console.log("Senha incorreta para o usuário:", user.id); // Log para controle
        return res.send(false);
      }

      console.log("Senha válida. Verificando perfil do administrador..."); // Log para controle

      const resposta_adm = await administradores.findOne({
        where: { mob_usuarios_id: user.id },
      });

      console.log("Resposta do administrador:", resposta_adm); // Log para controle
      
      if (resposta_adm != null) {
        // Verifica se o campo ds_perfil é igual a 'parceiro'
        if (resposta_adm.ds_perfil === 'parceiro') {
          console.log("Usuário é um parceiro. Retornando 2."); // Log para controle
          return res.send(JSON.stringify(2));
        }
        
        // Caso contrário, retorna 3 para administradores comuns
        console.log("Usuário é um administrador comum. Retornando 3."); // Log para controle
        return res.send(JSON.stringify(3));
      } else {
        // Retorna 1 para usuários comuns
        console.log("Usuário é comum. Retornando 1."); // Log para controle
        return res.send(JSON.stringify(1));
      }
    } else {
      console.log("Usuário não encontrado para o CPF:", nu_cpf); // Log para controle
      res.send(false);
    }
  } catch (error) {
    console.log("Erro em /usuarioLoginIntegrado!");
    console.log(error.message);
    res.status(500).send("Erro interno do servidor"); // Resposta em caso de erro
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

route.post("/recuperarSenha", async (req, res) => {
  try {
    const { nu_cpf, ds_email } = req.body;
    const resposta = await usuarios.findOne({ where: { nu_cpf, ds_email } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("Erro em /recuperarSenha!");
    console.log(error.message);
  }
});

route.put("/updateSenha", async (req, res) => {
  try {
    const { nu_cpf, ds_email, ds_senha } = req.body;

    const senha = ds_senha.toString()

    const hashedPassword = await bcrypt.hash(senha, 10); 

    const resposta = await usuarios.update(
      { ds_senha: hashedPassword },
      { where: { nu_cpf, ds_email } }
    );

    if (resposta[0]) {
      res.send(true);
      sendEmail(ds_email, ds_senha); 
    } else {
      res.send(false);
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

module.exports = route;
