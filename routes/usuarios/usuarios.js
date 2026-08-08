const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const route = express.Router();
const models = require("../../models");
const usuarios = models.mob_usuarios;
const administradores = models.mob_administradores;
const { sendEmail } = require("../../utils/sendNewPass");
const mob_animais = require("../../models/mob_animais");
const Sequelize = require("sequelize");
const config = require("../../config/config.js")[process.env.NODE_ENV || "development"];
const bcrypt = require("bcrypt");
const mob_logs = models.mob_logs
const moment = require('moment-timezone');
let sequelize = new Sequelize(config);
const axios = require('axios')
const GOOGLE_CLIENT_ID = "867699850241-sfm2tk642at1j3g0anrntcu044ki9h48.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/*
 * AUDIENCES ACEITOS EM /usuarioGoogleLogin — preparado em 07/08/2026.
 *
 * ⚠️ POR QUE PRECISA SER LISTA. O `aud` de um ID token é o OAuth client que
 * INICIOU o pedido. No app, o `expo-auth-session` escolhe o client por
 * plataforma e não deixa escolher outro:
 *
 *     Platform.select({ ios:'iosClientId', android:'androidClientId',
 *                       default:'webClientId' })
 *
 * Ou seja: no Android o token chega com `aud` = client ANDROID, que é diferente
 * do `GOOGLE_CLIENT_ID` acima. Com `audience` string, o `verifyIdToken` recusa
 * um token legítimo. (O contorno antigo — proxy `auth.expo.io` para usar o
 * client web em nativo — não existe mais: `useProxy` saiu da API do
 * expo-auth-session e o que sobrou está marcado @deprecated.)
 *
 * O `verifyIdToken` aceita `string | string[]` (google-auth-library), então
 * basta listar os clients legítimos.
 *
 * ⚠️ NÃO é "aceitar qualquer origem": só entram os client IDs deste projeto
 * Google. Token emitido para outro app continua sendo rejeitado.
 *
 * ---------------------------------------------------------------------------
 * COMO ATIVAR, quando o OAuth client Android existir no Google Cloud Console:
 *
 *   1. criar o client ANDROID para `com.cicatribioVet` com o SHA-1 da keystore
 *      usada no build (a do EAS hoje é a `3RHLJ_BTQ1`; o SHA-1 sai de
 *      `eas credentials -p android`);
 *   2. definir a env var na Vercel e redeployar:
 *          GOOGLE_CLIENT_ID_ANDROID=<id>.apps.googleusercontent.com
 *      (ou, se preferir cravar no código, preencher a constante abaixo);
 *   3. no app, preencher `GOOGLE_CLIENT_ID_ANDROID` em
 *      `utils/loginGoogleNativo/config.js`.
 *
 * ⚠️ Se o app for publicado na Play Store com ASSINATURA GERENCIADA pelo
 * Google, são DOIS SHA-1 a registrar: o da chave de upload e o da chave de
 * assinatura da Play. Com só o primeiro, o login funciona no APK interno e
 * quebra na versão da loja.
 * ---------------------------------------------------------------------------
 *
 * O client ANDROID (upload) foi criado em 07/08/2026 e está na lista abaixo.
 */

/*
 * Clients OAuth DESTE projeto (867699850241) que podem emitir token para o app.
 *
 * ⚠️ Ficam no código, e não em env var, de propósito: client ID não é segredo
 * (vai dentro do bundle do app de qualquer forma), muda muito raramente, e
 * cravar aqui evita que o login quebre porque alguém esqueceu de configurar a
 * variável num ambiente novo.
 */
const GOOGLE_CLIENT_IDS_CONHECIDOS = [
  // Web do projeto 867699850241 — usado pelo PORTAL DO VETERINÁRIO e valor
  // histórico desta rota. Continua aceito por causa do portal.
  GOOGLE_CLIENT_ID,

  /*
   * 🟢 Web do projeto 291028585576 (`meu-bixin`) — é o `aud` do app MEU BIXIN
   * desde 08/08/2026, quando o app ganhou pacote (`com.meubixin`) e projeto
   * Google Cloud próprios. O CicatriBioVET segue nas lojas com o de cima.
   *
   * ⚠️ TEM DE SER O CLIENT **WEB**, e é o erro fácil desta lista: o app passa
   * o web como `serverClientId` ao `google-signin`, então é ele que vira o
   * `aud`. O client ANDROID nunca aparece como audience neste fluxo — ele
   * serve para o Google reconhecer o app pelo par pacote + SHA-1, e não é lido
   * por código nenhum, nem daqui nem do app.
   */
  "291028585576-0spegjl01gb8n6bn0vorp8itv05rphdl.apps.googleusercontent.com",

  // Android, pacote com.cicatribioVet, chave de UPLOAD (SHA-1 4F:75:…:F2:A9).
  // ⚠️ Herança do tempo do `expo-auth-session`, quando o `aud` PODIA ser um
  // client Android. Com o `google-signin` isso não acontece mais; fica só
  // porque o app antigo, publicado, ainda pode emitir token assim.
  "867699850241-d39bs25uhhp2n2fstt5dip20bgvl45m6.apps.googleusercontent.com",
];

/*
 * Escape hatch para acrescentar audience sem deploy:
 *     GOOGLE_CLIENT_IDS_APP=<id>     (aceita vários, separados por vírgula)
 *
 * 🔴 SE FOR USAR, PONHA UM CLIENT **WEB**. O comentário anterior aqui dizia só
 * "<id>", num contexto que falava de client ANDROID, e isso induziu ao erro em
 * 08/08/2026: a variável chegou a ser configurada com o client Android do Meu
 * Bixin. Não funcionaria — com o `google-signin` o `aud` é sempre o web,
 * passado como `serverClientId`. O sintoma seria um token legítimo recusado por
 * audience, que não se parece com o DEVELOPER_ERROR e manda o diagnóstico para
 * o lado errado.
 *
 * ⚠️ Hoje esta variável NÃO é necessária: o client web do Meu Bixin está
 * cravado na lista acima.
 *
 * ---------------------------------------------------------------------------
 * 🟡 O QUE AINDA FALTA — chave de ASSINATURA DA PLAY
 *
 * A Play reassina o app com a chave dela, então na versão publicada o Google
 * reconhece o app por OUTRO SHA-1. Isso exige um SEGUNDO client Android no
 * projeto 291028585576, e o SHA-1 só aparece depois do primeiro envio, em
 * Play Console → Configuração → Integridade do app.
 *
 * ⚠️ Sem ele, o login funciona no APK interno e FALHA na versão da loja, com
 * DEVELOPER_ERROR (código 10).
 *
 * ⚠️ Isto NÃO se resolve nesta lista: o client Android não é audience. É
 * registro no Google Cloud Console, e nada muda aqui.
 *
 * 💡 O impasse antigo — o Console recusava a chave da Play do CicatriBioVET com
 * "nome do pacote e impressão digital já estão em uso" — morreu com a troca de
 * pacote: o conflito era do PAR pacote+SHA-1.
 * ---------------------------------------------------------------------------
 */
const GOOGLE_CLIENT_IDS_EXTRA = String(process.env.GOOGLE_CLIENT_IDS_APP || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// `Set` porque repetir um audience não quebra, mas polui o log de diagnóstico.
const GOOGLE_AUDIENCES = [
  ...new Set([...GOOGLE_CLIENT_IDS_CONHECIDOS, ...GOOGLE_CLIENT_IDS_EXTRA].filter(Boolean)),
];

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

    /*
     * ⚠️ NÃO logar `req.body`: ele contém o ID token inteiro, que é uma
     * credencial válida por ~1h. Log de plataforma é lido por mais gente do que
     * se imagina, e um token no log é uma sessão de graça para quem o achar.
     * Antes aqui havia `console.log("Dados que chegaram", req.body)`.
     */
    if (!idToken) {
      return res.status(400).json({ error: "Token do Google não enviado." });
    }

    // Verifica o token recebido do Google. Ver GOOGLE_AUDIENCES no topo.
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_AUDIENCES,
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

    /*
     * ⚠️ Diagnóstico do erro MAIS PROVÁVEL desta rota, e o mais difícil de
     * adivinhar: `aud` fora da lista. A mensagem do google-auth-library é
     * "Wrong recipient, payload audience != requiredAudience", que não diz qual
     * client faltou. Sem esta linha, quem estiver plugando o login Google do
     * app vê só "Falha na autenticação" e não tem como saber que falta
     * registrar o client Android.
     *
     * O `aud` recebido vai só para o LOG do servidor, nunca para a resposta:
     * é client ID de terceiro e não ajuda quem está na tela.
     */
    if (/audience/i.test(error.message || "")) {
      let audRecebido = "(não foi possível ler)";
      try {
        const corpo = JSON.parse(
          Buffer.from(String(req.body?.token).split(".")[1], "base64").toString("utf8")
        );
        audRecebido = corpo.aud;
      } catch {}
      console.log(
        "  ↳ audience recusado. Recebido:", audRecebido,
        "| aceitos:", GOOGLE_AUDIENCES.join(", "),
        "| Falta registrar o client desta plataforma? Ver GOOGLE_AUDIENCES no topo deste arquivo."
      );
    }

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
    const user = await usuarios.findOne({ where: { nu_cpf } });

    if (user) {
      let isMatch;
      // Trata a senha vinda do App vs Banco (Hash ou Texto Simples)[cite: 1]
      if (user.ds_senha.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(ds_senha, user.ds_senha);
      } else {
        isMatch = ds_senha === user.ds_senha;
      }

      if (!isMatch) return res.send(false);

      const adminEntry = await administradores.findOne({
        where: { mob_usuarios_id: user.id },
      });

      if (adminEntry) {
        if (adminEntry.ds_perfil === 'parceiro') return res.send(JSON.stringify(2));
        
        // Retorna 4 apenas se o perfil for EXATAMENTE 'veterinario'
        if (adminEntry.ds_perfil === 'veterinario') return res.send(JSON.stringify(4));
        
        return res.send(JSON.stringify(3)); // Admin
      }
      return res.send(JSON.stringify(1)); // Tutor
    } else {
      res.send(false);
    }
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

      // ⚠️ Devolvia o REGISTRO INTEIRO (ds_senha em hash, CPF, e-mail, telefone)
      // para quem acertasse CPF + telefone. Agora só confirma a existência.
      // O app antigo só testa `resUser === false`, então isto não o quebra.
      if (usuarioEncontrado) {
        return res.send(true);
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
    // Mesmo motivo do caminho por telefone: nada de devolver o registro.
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("Erro em /recuperarSenha!");
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
});

/*
 * ⚠️ ROTA LEGADA E INSEGURA — SUBSTITUÍDA POR /app/senha/*
 *
 * Ela troca a senha de qualquer conta sabendo só CPF + e-mail (ou telefone),
 * SEM nenhuma prova de posse: não há código, token nem senha atual. É takeover
 * de conta em uma requisição, e os dois dados são descobríveis.
 *
 * Continua ligada por um motivo só: a versão do app que está NAS LOJAS depende
 * dela. Desligar hoje deixaria esses usuários sem recuperar senha.
 *
 * COMO DESLIGAR, quando o app novo (com /app/senha/*) estiver publicado e
 * adotado: definir a env var
 *
 *     APP_SENHA_LEGADO=off
 *
 * na Vercel (Production) e redeployar. Não precisa mexer no código.
 */
route.put("/updateSenha", async (req, res) => {
  if (String(process.env.APP_SENHA_LEGADO || 'on').toLowerCase() === 'off') {
    return res.status(410).json({
      success: false,
      message: 'Atualize o aplicativo para redefinir sua senha com segurança.',
    });
  }

  console.warn(
    '[LEGADO INSEGURO] PUT /updateSenha chamado (troca senha sem prova de posse). ' +
    'Migrar para /app/senha/* e desligar com APP_SENHA_LEGADO=off.'
  );

  try {
    const { nu_cpf, ds_email, nu_telefone_completo, ds_senha } = req.body;

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
          // (log da senha em claro removido)

          res.send(true);
        } catch (whatsappError) {
          console.error('Erro ao enviar mensagem WhatsApp:', whatsappError);
          // Mesmo com erro no envio do WhatsApp, a senha foi alterada
          // (log da senha em claro removido)
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

route.get("/veterinarios/:id/animais", async (req, res) => {
  try {
    const { id } = req.params; 
    const pacientes = await models.mob_animais.findAll({
      // No seu SQL, veterinários usam a coluna mob_veterinarios_id
      where: { mob_veterinarios_id: id } 
    });
    res.send(pacientes);
  } catch (error) {
    res.status(500).send("Erro ao buscar pacientes");
  }
});

module.exports = route;
