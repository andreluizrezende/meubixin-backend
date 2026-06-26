  # Guia de Implantação na Vercel

  Guia para subir o **meubixin-backend** (API Node.js/Express) na Vercel como função serverless.

  > Repositório: `https://github.com/Gustavo-J-C/meubixin-back` — branch **`server`**

  ---

  ## 1. Pré-requisitos

  - Conta na [Vercel](https://vercel.com) conectada ao GitHub.
  - Código já enviado para o repositório (branch `server`).
  - Banco de dados MySQL acessível pela internet (CloudClusters) com o usuário liberado para conexões de qualquer host (`@'%'`).
  - Bucket AWS S3 configurado (para upload de imagens/PDFs).

  ---

  ## 2. Como o projeto está preparado

  O projeto **já está pronto** para serverless — você não precisa alterar código:

  | Item | Onde | Estado |
  |------|------|--------|
  | Roteamento serverless | `vercel.json` → encaminha `/(.*)` para `index.js` | ✅ |
  | Export do app | `index.js` → `module.exports = app` | ✅ |
  | `listen` condicional | `index.js` → só executa `app.listen` quando rodado localmente (`require.main === module`) | ✅ |
  | Versão do Node | `package.json` → `"engines": { "node": "22.x" }` | ✅ |
  | Uploads | `multer.memoryStorage()` → enviados direto ao S3 (sem disco) | ✅ |
  | Seleção de ambiente | `config/config.js` lê `PROD_DB_*` quando `NODE_ENV=production` | ✅ |

  ### `vercel.json`
  ```json
  {
    "version": 2,
    "builds": [{ "src": "index.js", "use": "@vercel/node" }],
    "routes": [{ "src": "/(.*)", "dest": "index.js" }]
  }
  ```

  ---

  ## 3. Importar o projeto na Vercel

  1. Acesse [vercel.com](https://vercel.com) → **Add New → Project**.
  2. Selecione o repositório **`Gustavo-J-C/meubixin-back`**.
  3. Em **Branch**, escolha **`server`**.
  4. **Framework Preset:** `Other` (a Vercel detecta o `vercel.json` automaticamente).
  5. **Build Command / Output:** deixe em branco (não há etapa de build).
  6. **NÃO clique em Deploy ainda** — configure as variáveis de ambiente antes (passo 4).

  ---

  ## 4. Variáveis de ambiente

  O arquivo `.env` **não** é enviado ao repositório (está no `.gitignore`). Cadastre as variáveis em
  **Settings → Environment Variables** (marque os ambientes *Production*, *Preview* e *Development* conforme necessário):

  | Variável | Descrição |
  |----------|-----------|
  | `NODE_ENV` | `production` |
  | `PROD_DB_HOST` | Host do MySQL (ex.: `mysql-xxxxx.cloudclusters.net`) |
  | `PROD_DB_PORT` | Porta do MySQL (ex.: `10042`) |
  | `PROD_DB_NAME` | Nome do banco (ex.: `cicatribiovet`) |
  | `PROD_DB_USER` | Usuário do banco |
  | `PROD_DB_PASS` | Senha do banco |
  | `AWS_BUCKET_NAME_VALUE` | Nome do bucket S3 |
  | `AWS_BUCKET_REGION_VALUE` | Região do bucket (ex.: `us-east-2`) |
  | `AWS_ACCESS_KEY_VALUE` | Access key da AWS |
  | `AWS_SECRET_KEY_VALUE` | Secret key da AWS |
  | `FRONTEND_URL` | URL do frontend em produção |
  | `CLIENT_URL` | URL usada nos links de redefinição de senha |

  > **`PORT` não é necessário** — em serverless a Vercel não usa `app.listen`.

  ---

  ## 5. Deploy

  1. Clique em **Deploy**.
  2. Ao terminar, a Vercel fornece uma URL pública (ex.: `https://meubixin-back.vercel.app`).
  3. **Deploys automáticos:** cada `git push` no branch `server` dispara um novo deploy.

  ---

  ## 6. Validação pós-deploy

  Teste a URL pública:

  ```bash
  # Rota raiz (deve retornar a mensagem de boas-vindas)
  curl https://SEU-PROJETO.vercel.app/

  # Rota que consulta o banco (valida a conexão com o MySQL)
  curl https://SEU-PROJETO.vercel.app/mob_tipo_especies
  ```

  - `/` → `{"msg":"Bem-vindo ao Cicatribiovet!"}`
  - `/mob_tipo_especies` → lista de espécies vinda do banco (confirma conexão).

  ---

  ## 7. Pontos de atenção do serverless

  - **Timeout de função:** plano *Hobby* limita ~10s por requisição. Queries pesadas ou uploads grandes podem estourar — considere o plano *Pro* (até 60s) se necessário.
  - **Conexões com o MySQL:** cada rota cria sua própria instância do Sequelize. Sob carga, várias invocações simultâneas podem esgotar o limite de conexões do banco (erro `too many connections`). Monitore.
  - **IP dinâmico:** os IPs de saída da Vercel mudam — garanta que o usuário do MySQL aceite conexões de qualquer host (`@'%'`).
  - **Cold start:** a primeira requisição após inatividade pode ser mais lenta.

  ---

  ## 8. Segurança — recomendado antes de produção

  Há segredos **hardcoded** no código (e no histórico do Git):

  - `routes/apiAI/apiAi.js` → `AI_TOKEN`
  - `utils/sendNewPass.js` → senha do SMTP (`suporte@cicatribio.com.br`)

  **Recomendação:** mover para variáveis de ambiente e **rotacionar** essas credenciais, já que estão expostas no repositório.
  (O `GOOGLE_CLIENT_ID` em `routes/usuarios/usuarios.js` é público — sem problema.)

  ---

  ## 9. Rodando localmente

  ```bash
  npm install
  # crie um arquivo .env com as variaveis acima (use DEV_DB_* para o banco local)
  npm start      # produção: node ./index
  npm run dev    # desenvolvimento com auto-reload (nodemon)
  ```

  O servidor local sobe em `http://localhost:3030`.
