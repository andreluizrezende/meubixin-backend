var nodemailer = require("nodemailer");

function sendEmail(ds_email, ds_senha) {

  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
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
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
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
