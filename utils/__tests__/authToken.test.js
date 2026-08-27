import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

// ⚠️ O módulo lê JWT_SECRET na CHAMADA, não na importação — por isso dá para
// definir aqui. Se um dia passar a ler no topo, este beforeAll precisa virar
// uma variável de ambiente do vitest.config.
beforeAll(() => {
  process.env.JWT_SECRET = 'segredo-de-teste';
});

const {
  signAuthToken,
  verifyAuthToken,
  TIPO_VETERINARIO,
  TIPO_PARCEIRO,
} = require('../authToken');

describe('signAuthToken', () => {
  it('emite token de veterinário com sub e tipo', () => {
    const token = signAuthToken(7, TIPO_VETERINARIO);
    expect(verifyAuthToken(token)).toEqual({ id: 7, tipo: 'veterinario' });
  });

  it('emite token de parceiro com o tipo próprio', () => {
    const token = signAuthToken(7, TIPO_PARCEIRO);
    expect(verifyAuthToken(token)).toEqual({ id: 7, tipo: 'parceiro' });
  });

  // 🔴 A razão de existir do `tipo`: o veterinário 7 e o parceiro 7 são pessoas
  // diferentes. Se os dois tokens fossem iguais, um entraria como o outro.
  it('mesmo id em tipos diferentes gera identidades DISTINTAS', () => {
    const vet = verifyAuthToken(signAuthToken(7, TIPO_VETERINARIO));
    const parceiro = verifyAuthToken(signAuthToken(7, TIPO_PARCEIRO));
    expect(vet.id).toBe(parceiro.id);
    expect(vet.tipo).not.toBe(parceiro.tipo);
  });

  // Sem isto, um `sign` novo em qualquer rota nasceria como veterinário em
  // silêncio — o erro que este parâmetro existe para impedir.
  it.each([undefined, null, '', 'admin', 'Veterinario'])(
    'recusa tipo inválido (%s)',
    (tipo) => {
      expect(() => signAuthToken(7, tipo)).toThrow(/tipo inválido/);
    },
  );
});

describe('verifyAuthToken', () => {
  it('recusa token assinado com outro segredo', () => {
    const intruso = jwt.sign({ sub: '7', tipo: 'veterinario' }, 'outro-segredo');
    expect(() => verifyAuthToken(intruso)).toThrow();
  });

  it('recusa token sem sub utilizável', () => {
    const semSub = jwt.sign({ tipo: 'veterinario' }, process.env.JWT_SECRET);
    expect(() => verifyAuthToken(semSub)).toThrow(/sub/);
  });

  it('recusa tipo desconhecido vindo do payload', () => {
    const forjado = jwt.sign({ sub: '7', tipo: 'admin' }, process.env.JWT_SECRET);
    expect(() => verifyAuthToken(forjado)).toThrow(/tipo desconhecido/);
  });

  // ⚠️ COMPATIBILIDADE: tokens emitidos antes da mudança não têm `tipo` e
  // valem 7 dias. Todos eram de veterinário — o parceiro nunca teve token real.
  // Este teste trava esse fallback; ele pode sair 7 dias depois da publicação.
  it('token ANTIGO sem tipo é lido como veterinário', () => {
    const antigo = jwt.sign({ sub: '7' }, process.env.JWT_SECRET);
    expect(verifyAuthToken(antigo)).toEqual({ id: 7, tipo: 'veterinario' });
  });

  it('recusa token expirado', () => {
    const expirado = jwt.sign(
      { sub: '7', tipo: 'veterinario' },
      process.env.JWT_SECRET,
      { expiresIn: -1 },
    );
    expect(() => verifyAuthToken(expirado)).toThrow();
  });
});
