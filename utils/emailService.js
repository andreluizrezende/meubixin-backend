// ===============================================
// SERVIÇO DE EMAIL - utils/emailService.js
// ===============================================

const nodemailer = require("nodemailer");

// Configurar transportador de email
const createTransporter = () => {
    return nodemailer.createTransport({
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
};

// Template HTML para email de reset
const createResetEmailTemplate = ({ name, resetUrl, expiresAt }) => {
    // TZ explícito: em produção (Vercel) o processo roda em UTC e o horário sairia +3h.
    const expirationTime = new Date(expiresAt).toLocaleTimeString('pt-BR', {
        timeZone: process.env.APP_TZ || 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinição de Senha - Meu Bixin</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #8BC34A 0%, #6a9e2f 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 5px 0 0 0;
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px 20px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #2c3e50;
        }
        .message {
            margin-bottom: 30px;
            line-height: 1.7;
            color: #555;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #8BC34A 0%, #6a9e2f 100%);
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s ease;
            box-shadow: 0 3px 10px rgba(139, 195, 74, 0.3);
        }
        .reset-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(139, 195, 74, 0.4);
        }
        .security-info {
            background-color: #f8f9fa;
            border-left: 4px solid #8BC34A;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .security-info h4 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 16px;
        }
        .security-info ul {
            margin: 10px 0;
            padding-left: 20px;
            color: #666;
        }
        .security-info li {
            margin-bottom: 5px;
        }
        .expiration-warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 12px 15px;
            border-radius: 6px;
            margin: 20px 0;
            text-align: center;
            font-weight: 500;
        }
        .footer {
            background-color: #2c3e50;
            color: #ecf0f1;
            padding: 20px;
            text-align: center;
            font-size: 14px;
        }
        .footer a {
            color: #8BC34A;
            text-decoration: none;
        }
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #ddd, transparent);
            margin: 25px 0;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }
            .content {
                padding: 20px 15px;
            }
            .reset-button {
                padding: 12px 25px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🔐 Redefinição de Senha</h1>
            <p>Meu Bixin</p>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                Olá, <strong>${name}</strong>!
            </div>

            <div class="message">
                Recebemos uma solicitação para redefinir a senha da sua conta no sistema Meu Bixin.
                Se você fez esta solicitação, clique no botão abaixo para criar uma nova senha:
            </div>

<div class="button-container">
    <a href="${resetUrl}" class="reset-button" style="color: white;">
        🔑 Redefinir Minha Senha
    </a>
</div>

            <div class="expiration-warning">
                ⏰ <strong>Atenção:</strong> Este link expira às <strong>${expirationTime}</strong> por motivos de segurança.
            </div>

            <div class="divider"></div>

            <div class="security-info">
                <h4>🛡️ Informações de Segurança</h4>
                <ul>
                    <li>Este link é válido por apenas 15 minutos</li>
                    <li>Use apenas em dispositivos confiáveis</li>
                    <li>Nunca compartilhe este link com outras pessoas</li>
                    <li>Escolha uma senha forte com pelo menos 6 caracteres</li>
                </ul>
            </div>

            <div class="message">
                <strong>❓ Não solicitou esta redefinição?</strong><br>
                Se você não fez esta solicitação, ignore este email. Sua conta permanece segura 
                e nenhuma ação é necessária.
            </div>

            <div class="message">
                Em caso de dúvidas, entre em contato conosco através do email 
                <a href="mailto:suporte@cicatribio.com.br" style="color: #8BC34A;">suporte@cicatribio.com.br</a>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>
                <strong>Meu Bixin</strong><br>
                Sistema de Gestão Veterinária com Análise de Feridas<br>
                <a href="mailto:suporte@cicatribio.com.br">suporte@cicatribio.com.br</a>
            </p>
            <p style="margin-top: 15px; opacity: 0.7; font-size: 12px;">
                Este é um email automático, não responda a esta mensagem.
            </p>
        </div>
    </div>
</body>
</html>`;
};

// Função para enviar email de reset
async function sendResetPasswordEmail({ email, name, resetUrl, expiresAt }) {
    try {
        const transporter = createTransporter();

        // Verificar configuração do transportador
        await transporter.verify();
        console.log('✅ Servidor de email pronto');

        const mailOptions = {
            from: process.env.SMTP_FROM || `"Meu Bixin" <${process.env.SMTP_USER}>`,
            to: email,
            subject: '🔐 Redefinição de Senha - Meu Bixin',
            html: createResetEmailTemplate({ name, resetUrl, expiresAt }),
            text: `
Olá, ${name}!

Recebemos uma solicitação para redefinir a senha da sua conta no Meu Bixin.

Clique no link abaixo para redefinir sua senha:
${resetUrl}

Este link expira em 15 minutos por segurança.

Se você não solicitou esta redefinição, ignore este email.

---
Meu Bixin
suporte@cicatribio.com.br
      `.trim()
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Email enviado com sucesso');
        console.log('📧 Message ID:', info.messageId);

        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        throw error;
    }
}

module.exports = {
    sendResetPasswordEmail
};
