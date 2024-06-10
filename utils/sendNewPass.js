var nodemailer = require("nodemailer");

function sendEmail(ds_email, ds_senha) {

  let transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com", 
    port: 587, 
    secure: false, 
    auth: {
      user: "suporte@cicatribio.com.br", 
      pass: "$up@Rt3ApP", 
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

 
  transporter.verify(function (error, success) {
    if (error) {
      console.log("Erro na configuração do transportador: ", error);
    } else {
      console.log("Transportador de e-mail pronto: ", success);
    }
  });


  let mailOptions = {
    from: "suporte@cicatribio.com.br", 
    to: ds_email, 
    subject: "Recuperação de senha: Aplicativo CicatribioVET", 
    text: "Essa é a sua nova senha: " + ds_senha, 
  };

  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log("Erro ao enviar e-mail: ", error);
    }
    console.log("E-mail enviado: %s", info.messageId);
    console.log("Informações do e-mail: ", info);
  });
}

module.exports = {
  sendEmail,
};


