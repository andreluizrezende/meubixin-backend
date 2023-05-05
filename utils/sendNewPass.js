var nodemailer = require('nodemailer');

function sendEmail(ds_email, ds_senha){

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'isisbia14@gmail.com',
          pass: 'cmfifhymbvbsaglj'
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
        } else {
          console.log('Email sent: ' + info.response);
        }
      });

}

module.exports = {
sendEmail
  }

