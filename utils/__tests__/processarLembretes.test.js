// ESM aqui de propósito: o Vitest não pode ser carregado por require(). O módulo
// sob teste continua CommonJS — o interop do Vite resolve o default export.
import { describe, it, expect } from 'vitest';
import processarLembretesModule from '../processarLembretes.js';

const { montarMensagem } = processarLembretesModule;

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSÃO DE FUSO — o bug que esta base já shipou DUAS vezes.
//
// O processo da Vercel roda em UTC. `montarMensagem` usava getHours()/toLocale*
// sem `timeZone`, então um agendamento das 16:30 (Brasília) chegava ao
// responsável como 19:30 no e-mail e no WhatsApp. Na máquina do dev (-03:00)
// parecia certo, e por isso passou.
//
// O vitest.config.js fixa TZ=UTC justamente para que estes testes rodem no mesmo
// fuso da produção. Se alguém trocar Intl.DateTimeFormat por toLocaleString sem
// timeZone, estes testes quebram.
// ─────────────────────────────────────────────────────────────────────────────

// 2026-08-03T19:30:00Z == 16:30 em Brasília (-03:00). É a hora que o vet marcou.
const INSTANTE = '2026-08-03T19:30:00.000Z';

const rowAgendamento = (extra = {}) => ({
  tp_origem: 'agendamento',
  tp_lembrete: 'lembrete_24h',
  tp_agendamento: 'consulta',
  dt_inicio: INSTANTE,
  animal_nome: 'Margot',
  responsavel_nome: 'André',
  vet_nome: 'Dra. Ana',
  ds_local: null,
  conferencia_link: null,
  ...extra,
});

describe('montarMensagem — fuso horário', () => {
  it('mostra a hora de Brasília, não a UTC do servidor', () => {
    const m = montarMensagem(rowAgendamento());
    expect(m.assunto).toContain('16:30');
    expect(m.assunto).not.toContain('19:30'); // seria o bug de +3h
  });

  it('a hora correta aparece em TODOS os canais (assunto, html, e-mail, whatsapp)', () => {
    const m = montarMensagem(rowAgendamento());
    for (const campo of [m.assunto, m.html, m.textoEmail, m.textoWhats]) {
      expect(campo).toContain('16:30');
      expect(campo).not.toContain('19:30');
    }
  });

  it('a DATA também respeita o fuso — 21:00Z é ainda o mesmo dia em Brasília', () => {
    // 2026-08-03T21:00Z = 18:00 de 03/08 em Brasília. Sem timeZone, daria 03/08
    // às 21:00 — mesma data por sorte. O caso perigoso é a virada:
    const m = montarMensagem(rowAgendamento({ dt_inicio: '2026-08-04T02:00:00.000Z' }));
    // 04/08 02:00 UTC = 03/08 23:00 em Brasília → tem que dizer 03, não 04.
    expect(m.textoEmail).toContain('03');
    expect(m.textoEmail).toMatch(/agosto/i);
    expect(m.textoEmail).toContain('23:00');
  });

  it('usa formato 24h, sem AM/PM', () => {
    const m = montarMensagem(rowAgendamento({ dt_inicio: '2026-08-03T23:00:00.000Z' }));
    // 23:00Z = 20:00 em Brasília
    expect(m.textoEmail).toContain('20:00');
    expect(m.textoEmail).not.toMatch(/\bPM\b|\bAM\b/);
  });
});

describe('montarMensagem — conteúdo do lembrete de agendamento', () => {
  it('lembrete de 24h diz "amanhã"', () => {
    const m = montarMensagem(rowAgendamento({ tp_lembrete: 'lembrete_24h' }));
    expect(m.textoEmail).toContain('amanhã');
  });

  it('lembrete de 2h diz "hoje"', () => {
    const m = montarMensagem(rowAgendamento({ tp_lembrete: 'lembrete_2h' }));
    expect(m.textoEmail).toContain('hoje');
    expect(m.textoEmail).not.toContain('amanhã');
  });

  it('inclui paciente, responsável e profissional', () => {
    const m = montarMensagem(rowAgendamento());
    expect(m.textoEmail).toContain('Margot');
    expect(m.textoEmail).toContain('André');
    expect(m.textoEmail).toContain('Dra. Ana');
  });

  it('cai em textos genéricos quando responsável/vet não têm nome', () => {
    const m = montarMensagem(rowAgendamento({ responsavel_nome: null, vet_nome: null }));
    expect(m.textoEmail).toContain('responsável');
    expect(m.textoEmail).toContain('seu veterinário');
  });

  it('inclui o local só quando houver', () => {
    expect(montarMensagem(rowAgendamento()).textoEmail).not.toContain('Local:');
    expect(montarMensagem(rowAgendamento({ ds_local: 'Rua X, 10' })).textoEmail).toContain('Local: Rua X, 10');
  });
});

describe('montarMensagem — teleconsulta', () => {
  it('inclui o botão/link quando é teleconsulta com link', () => {
    const m = montarMensagem(rowAgendamento({
      tp_agendamento: 'teleconsulta',
      conferencia_link: 'https://meet.example/sala/1',
    }));
    expect(m.html).toContain('https://meet.example/sala/1');
    expect(m.textoWhats).toContain('https://meet.example/sala/1');
  });

  it('NÃO vaza o link quando o tipo não é teleconsulta', () => {
    // O link só entra se tp_agendamento === 'teleconsulta' — uma consulta comum
    // com link pendurado na linha não pode mandar sala de vídeo ao responsável.
    const m = montarMensagem(rowAgendamento({
      tp_agendamento: 'consulta',
      conferencia_link: 'https://meet.example/sala/1',
    }));
    expect(m.html).not.toContain('meet.example');
    expect(m.textoWhats).not.toContain('meet.example');
  });

  it('não quebra quando é teleconsulta sem link', () => {
    const m = montarMensagem(rowAgendamento({ tp_agendamento: 'teleconsulta' }));
    expect(m.assunto).toContain('teleconsulta');
  });
});

describe('montarMensagem — rótulo do tipo', () => {
  const tipos = [
    ['consulta', 'Consulta'],
    ['retorno', 'Retorno'],
    ['procedimento', 'Procedimento'],
    ['teleconsulta', 'Teleconsulta'],
  ];
  it.each(tipos)('tp_agendamento %s vira "%s"', (tp, label) => {
    expect(montarMensagem(rowAgendamento({ tp_agendamento: tp })).html).toContain(label);
  });

  it('tipo desconhecido cai em "Consulta" em vez de sair vazio', () => {
    const m = montarMensagem(rowAgendamento({ tp_agendamento: 'inexistente' }));
    expect(m.assunto).toContain('consulta');
  });
});

describe('montarMensagem — origem dose', () => {
  // O nome do produto vem de `ds_titulo` (montado na geração do lembrete), não de
  // nome_protocolo. E o subtipo está em tp_lembrete: dose_vacina | dose_vermifugo
  // | dose_medicamento — é ele que escolhe a redação.
  const rowDose = (extra = {}) => ({
    tp_origem: 'dose',
    tp_lembrete: 'dose_vacina',
    dt_agendado_para: INSTANTE,
    animal_nome: 'Margot',
    responsavel_nome: 'André',
    ds_titulo: 'Antirrábica',
    ...extra,
  });

  it('cita o produto e o paciente', () => {
    const m = montarMensagem(rowDose());
    expect(m.textoEmail).toContain('Antirrábica');
    expect(m.textoEmail).toContain('Margot');
    expect(m.textoWhats).toContain('Antirrábica');
  });

  it('funciona sem ds_titulo, sem deixar espaço duplo na frase', () => {
    // O item entra como ` ${ds_titulo}`; sem ele a frase não pode ficar com
    // "A vacina  do Margot".
    const m = montarMensagem(rowDose({ ds_titulo: null }));
    expect(m.textoEmail).toContain('Margot');
    expect(m.textoEmail).not.toMatch(/ {2}/);
  });

  it('vacina usa artigo "A"; vermífugo usa "O"', () => {
    expect(montarMensagem(rowDose({ tp_lembrete: 'dose_vacina' })).textoEmail).toContain('A vacina');
    expect(montarMensagem(rowDose({ tp_lembrete: 'dose_vermifugo' })).textoEmail).toContain('O vermífugo');
  });

  it('medicamento tem redação DIÁRIA, diferente da de vencimento', () => {
    const med = montarMensagem(rowDose({ tp_lembrete: 'dose_medicamento' }));
    expect(med.assunto).toContain('Doses de hoje');
    expect(med.textoEmail).toContain('hoje');
    expect(med.textoEmail).not.toContain('vencimento');

    const vac = montarMensagem(rowDose({ tp_lembrete: 'dose_vacina' }));
    expect(vac.assunto).toContain('vencimento');
  });

  it('o texto de e-mail sai sem tags HTML', () => {
    // textoEmail é derivado do corpoHtml por replace de tags — se a regex
    // quebrar, o responsável recebe markup cru.
    const m = montarMensagem(rowDose());
    expect(m.textoEmail).not.toMatch(/<[^>]+>/);
    expect(m.html).toMatch(/<p>/);
  });

  it('devolve os quatro canais preenchidos', () => {
    const m = montarMensagem(rowDose());
    expect(m.assunto).toBeTruthy();
    expect(m.html).toBeTruthy();
    expect(m.textoEmail).toBeTruthy();
    expect(m.textoWhats).toBeTruthy();
  });
});
