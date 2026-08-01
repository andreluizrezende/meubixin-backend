const { defineConfig } = require('vitest/config');

// ⚠️ TZ=UTC de propósito: em produção (Vercel) o processo roda em UTC, e esta base
// já shipou DUAS vezes um bug de fuso que não reproduzia na máquina do dev
// (-03:00) — a gravação do agendamento e o texto do lembrete saindo +3h. Rodar os
// testes em UTC faz o ambiente de teste bater com o de produção; rodar no fuso
// local esconderia exatamente a classe de bug que mais doeu aqui.
module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.js'],
    exclude: ['node_modules/**'],
    env: { TZ: 'UTC' },
  },
});
