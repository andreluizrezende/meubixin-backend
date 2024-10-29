const express = require("express");
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

route.post("/usuarioLogin", async (req, res) => {
  try {
    const { nu_cpf, ds_senha } = req.body;
    const user = await usuarios.findOne({ where: { nu_cpf } });

    if (user) {
      let isMatch;
      if (user.ds_senha.startsWith('$2b$')) {
        // Senha já está criptografada
        isMatch = await bcrypt.compare(ds_senha, user.ds_senha);
      } else {
        // Senha não está criptografada, compare diretamente
        isMatch = ds_senha === user.ds_senha;
        if (isMatch) {
          // Criptografe a senha e atualize o banco de dados
          const hashedPassword = await bcrypt.hash(ds_senha, 10);
          await usuarios.update(
            { ds_senha: hashedPassword },
            { where: { nu_cpf } }
          );
        }
      }

      if (isMatch) {
        console.log("resposta do login, ", user);
        const currentDateTime = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
        console.log("Dados enviados pro log: ", "Autenticação", "Cpf:", nu_cpf, "dt_acesso:", currentDateTime )
        await mob_logs.create({ds_funcionalidade:"Autenticação", nu_cpf, dt_acesso: currentDateTime})
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
  }
});

route.post("/usuarioLoginIntegrado", async (req, res) => {
  try {
    const { nu_cpf, ds_senha } = req.body;
    const user = await usuarios.findOne({ where: { nu_cpf } });
    
    if (user) {
      const isMatch = await bcrypt.compare(ds_senha, user.ds_senha);
      
      if (!isMatch) {
        return res.send(false);
      }
      
      const resposta_adm = await administradores.findOne({
        where: { mob_usuarios_id: user.id },
      });

      console.log("RESPOSTA", resposta_adm)
      
      if (resposta_adm != null) {
        // Verifica se o campo ds_perfil é igual a 'parceiro'
        if (resposta_adm.ds_perfil === 'parceiro') {
          return res.send(JSON.stringify(2));
        }
        
        // Caso contrário, retorna 3 para administradores comuns
        return res.send(JSON.stringify(3));
      } else {
        // Retorna 1 para usuários comuns
        return res.send(JSON.stringify(1));
      }
    } else {
      res.send(false);
    }
  } catch (error) {
    console.log("Erro em /usuarioLoginIntegrado!");
    console.log(error.message);
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
