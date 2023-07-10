var nodemailer = require('nodemailer');

function sendEmail(ds_email, ds_senha){

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'suportecicatribio@gmail.com',
          pass: 'dqqujdtqiyermamv'
        }
      });
      
      var mailOptions = {
        from: 'isisbeatris.dev@gmail.com',
        to: ds_email,
        subject: 'Recuperação da sua senha de acesso',
        text: `Essa é sua nova senha de acesso ${ds_senha}`
      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } 
      });

}

module.exports = {
sendEmail
  }

