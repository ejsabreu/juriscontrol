/* Verificação da camada de domínio + seed, rodando em Node com shim de window. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');

// Shim mínimo: os módulos de domínio só tocam window e console.
const sandbox = {
  window: {},
  console,
  localStorage: undefined,
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, Error,
  setTimeout, clearTimeout, isNaN, parseInt, parseFloat
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const ARQUIVOS = [
  'src/utils/dom.js',
  'src/utils/format.js',
  'src/utils/mask.js',
  // O seed passou a depender de token.js em F2.4: a publicação nasce com o
  // hash do conteúdo, que é o que permite deduplicar a captura.
  'src/utils/token.js',
  'src/domain/enums.js',
  'src/domain/feriados.js',
  'src/domain/prazos.js',
  'src/domain/cnj.js',
  'src/domain/validators.js',
  'data/seed.js',
  'src/store/selectors.js'
];

for (const arquivo of ARQUIVOS) {
  const codigo = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  try {
    vm.runInContext(codigo, sandbox, { filename: arquivo });
  } catch (e) {
    console.error(`✕ FALHA AO CARREGAR ${arquivo}:`, e.message);
    process.exit(1);
  }
}

const App = sandbox.window.App;
let falhas = 0;
let testes = 0;

function ok(descricao, condicao, detalhe) {
  testes++;
  if (condicao) {
    console.log(`  ✓ ${descricao}`);
  } else {
    falhas++;
    console.log(`  ✕ ${descricao}${detalhe ? ' → ' + detalhe : ''}`);
  }
}

function secao(titulo) {
  console.log(`\n${titulo}`);
}

// ============================= CNJ =============================
secao('CNJ — número único de processo');
const cnj = App.domain.cnj;

const numeroMontado = cnj.montar(1234, 2024, 8, 26, 100);
ok('montar() produz formato correto', /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(numeroMontado), numeroMontado);
ok('número montado é válido', cnj.validar(numeroMontado).valido, JSON.stringify(cnj.validar(numeroMontado)));

// Caso real conhecido (DV correto): 0000001-02.2024.8.26.0100
const dvCalculado = cnj.calcularDV('0001234', '2024', '8', '26', '0100');
ok('DV é numérico de 2 dígitos', /^\d{2}$/.test(dvCalculado), dvCalculado);

const partes = cnj.parsear(numeroMontado);
ok('parsear() extrai ano', partes.ano === '2024', partes.ano);
ok('parsear() extrai segmento', partes.segmento === '8', partes.segmento);
ok('parsear() nomeia segmento', partes.segmentoNome === 'Justiça Estadual', partes.segmentoNome);
ok('parsear() extrai tribunal', partes.tribunal === '26', partes.tribunal);

// Corromper o DV precisa ser detectado
const digitos = cnj.digitos(numeroMontado);
const dvErrado = digitos.slice(0, 7) + (digitos.slice(7, 9) === '00' ? '99' : '00') + digitos.slice(9);
ok('DV incorreto é rejeitado', !cnj.validar(dvErrado).valido);
ok('número curto é rejeitado', !cnj.validar('123').valido);
ok('segmento inexistente é rejeitado', !cnj.validar('00012340020240026 0100'.replace(/\s/g, '')).valido);

// Roundtrip em vários casos
let roundtripOk = true;
for (let i = 0; i < 500; i++) {
  const seq = Math.floor(Math.random() * 9999999);
  const ano = 2000 + Math.floor(Math.random() * 26);
  const seg = [4, 5, 8][Math.floor(Math.random() * 3)];
  const trib = 1 + Math.floor(Math.random() * 26);
  const org = Math.floor(Math.random() * 9999);
  if (!cnj.validar(cnj.montar(seq, ano, seg, trib, org)).valido) { roundtripOk = false; break; }
}
ok('500 números gerados aleatoriamente validam', roundtripOk);

// ============================= Feriados =============================
secao('Feriados — calendário forense');
const fer = App.domain.feriados;

// Páscoa conhecida
const pascoas = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28' };
Object.entries(pascoas).forEach(([ano, esperado]) => {
  const p = fer.pascoa(Number(ano));
  const iso = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`;
  ok(`Páscoa de ${ano} = ${esperado}`, iso === esperado, iso);
});

ok('Natal é feriado', !!fer.ehFeriado('2026-12-25'));
ok('Sexta-feira Santa 2026 (03/04) é feriado', !!fer.ehFeriado('2026-04-03'));
ok('Carnaval 2026 (16/02) é feriado', !!fer.ehFeriado('2026-02-16'));
ok('Corpus Christi 2026 (04/06) é feriado', !!fer.ehFeriado('2026-06-04'));
ok('Consciência Negra é feriado nacional', fer.ehFeriado('2026-11-20')?.abrangencia === 'nacional');
ok('dia comum não é feriado', !fer.ehFeriado('2026-03-10'));

ok('25/12 está em recesso', fer.estaEmRecesso('2026-12-25'));
ok('05/01 está em recesso', fer.estaEmRecesso('2026-01-05'));
ok('20/01 está em recesso (inclusive)', fer.estaEmRecesso('2026-01-20'));
ok('21/01 NÃO está em recesso', !fer.estaEmRecesso('2026-01-21'));
ok('19/12 NÃO está em recesso', !fer.estaEmRecesso('2026-12-19'));

// ============================= Prazos =============================
secao('Prazos — motor de contagem (CPC)');
const pz = App.domain.prazos;

ok('sábado não é dia útil', !pz.ehDiaUtil('2026-03-07'));
ok('domingo não é dia útil', !pz.ehDiaUtil('2026-03-08'));
ok('segunda comum é dia útil', pz.ehDiaUtil('2026-03-09'));
ok('feriado não é dia útil', !pz.ehDiaUtil('2026-12-25'));
ok('dia em recesso não é contável', !pz.ehDiaContavel('2026-12-28'));

// Caso 1: disponibilização numa segunda comum, 15 dias úteis.
// Seg 09/03/2026 (disp) → publicação ter 10/03 → início qua 11/03 (dia 1)
// 15 dias úteis a partir de 11/03: 11,12,13,16,17,18,19,20,23,24,25,26,27,30,31 → 31/03
const c1 = pz.calcular({ dataDisponibilizacao: '2026-03-09', dias: 15, tipoContagem: 'uteis', diasAntecedencia: 3 });
ok('publicação = 1º dia útil seguinte (10/03)', c1.dataPublicacao === '2026-03-10', c1.dataPublicacao);
ok('início da contagem = 11/03', c1.dataInicioContagem === '2026-03-11', c1.dataInicioContagem);
ok('data fatal = 31/03/2026', c1.dataFatal === '2026-03-31', c1.dataFatal);
ok('prazo interno é 3 dias úteis antes (26/03)', c1.dataInterna === '2026-03-26', c1.dataInterna);
ok('memória de cálculo tem passos', c1.memoria.length >= 4, String(c1.memoria.length));

// Caso 2: disponibilização numa sexta → publicação na segunda seguinte
const c2 = pz.calcular({ dataDisponibilizacao: '2026-03-13', dias: 5, tipoContagem: 'uteis' });
ok('sexta 13/03 → publicação seg 16/03', c2.dataPublicacao === '2026-03-16', c2.dataPublicacao);
ok('início ter 17/03', c2.dataInicioContagem === '2026-03-17', c2.dataInicioContagem);
// 5 dias úteis: 17,18,19,20,23 → 23/03
ok('5 dias úteis → 23/03', c2.dataFatal === '2026-03-23', c2.dataFatal);

// Caso 3: prazo que atravessa o recesso (art. 220)
const c3 = pz.calcular({ dataDisponibilizacao: '2026-12-10', dias: 15, tipoContagem: 'uteis' });
const puladosRecesso = c3.diasPulados.filter(d => d.motivo && d.motivo.includes('recesso')).length;
ok('prazo em dezembro pula dias de recesso', puladosRecesso > 0, `${puladosRecesso} dias`);
ok('data fatal cai depois de 20/01', c3.dataFatal > '2026-01-20', c3.dataFatal);
ok('data fatal é dia contável', pz.ehDiaContavel(c3.dataFatal), c3.dataFatal);

// Caso 4: prazo em dobro (art. 229)
const c4 = pz.calcular({ dataDisponibilizacao: '2026-03-09', dias: 15, dobro: true });
ok('dobro aplica 30 dias', c4.diasEfetivos === 30, String(c4.diasEfetivos));
ok('dobro gera data posterior', c4.dataFatal > c1.dataFatal, `${c4.dataFatal} vs ${c1.dataFatal}`);

// Caso 5: dias corridos com prorrogação (art. 224 §1º)
const c5 = pz.calcular({ dataDisponibilizacao: '2026-03-09', dias: 5, tipoContagem: 'corridos' });
ok('contagem corrida termina em dia contável', pz.ehDiaContavel(c5.dataFatal), c5.dataFatal);

// Invariante: em 300 cálculos aleatórios a data fatal é sempre dia contável e >= início
let invarianteOk = true, detalheInvariante = '';
for (let i = 0; i < 300; i++) {
  const dia = new Date(2025, 0, 1 + Math.floor(Math.random() * 700));
  const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
  const dias = [5, 10, 15, 30][Math.floor(Math.random() * 4)];
  const r = pz.calcular({ dataDisponibilizacao: iso, dias, tipoContagem: 'uteis' });
  if (!r || !pz.ehDiaContavel(r.dataFatal) || r.dataFatal < r.dataInicioContagem) {
    invarianteOk = false;
    detalheInvariante = `${iso} +${dias} → ${r && r.dataFatal}`;
    break;
  }
}
ok('300 cálculos aleatórios mantêm invariantes', invarianteOk, detalheInvariante);

// Semáforo
ok('semáforo vencido', pz.semaforo(-1) === 'vencido');
ok('semáforo crítico em 0', pz.semaforo(0) === 'critico');
ok('semáforo crítico em 2', pz.semaforo(2) === 'critico');
ok('semáforo atenção em 5', pz.semaforo(5) === 'atencao');
ok('semáforo ok em 6', pz.semaforo(6) === 'ok');

// diasUteisEntre
ok('diasUteisEntre exclui início e inclui fim', pz.diasUteisEntre('2026-03-09', '2026-03-13') === 4,
   String(pz.diasUteisEntre('2026-03-09', '2026-03-13')));

// ============================= Validadores =============================
secao('Validadores');
const v = App.domain.validators;
ok('CPF válido aceito', v.cpf('529.982.247-25').valido);
ok('CPF inválido rejeitado', !v.cpf('111.111.111-11').valido);
ok('CPF com DV errado rejeitado', !v.cpf('529.982.247-26').valido);
ok('CNPJ válido aceito', v.cnpj('11.222.333/0001-81').valido);
ok('CNPJ inválido rejeitado', !v.cnpj('11.222.333/0001-82').valido);
ok('e-mail válido aceito', v.email('teste@exemplo.com.br').valido);
ok('e-mail inválido rejeitado', !v.email('teste@').valido);
ok('OAB válida aceita', v.oab('148522', 'SP').valido);
ok('OAB com UF inválida rejeitada', !v.oab('148522', 'XX').valido);

// ============================= Format =============================
secao('Formatação');
const f = App.format;
ok('moeda formata centavos', f.moeda(125000) === 'R$ 1.250,00', f.moeda(125000));
ok('moedaCompacta em milhões', f.moedaCompacta(130000000).includes('mi'), f.moedaCompacta(130000000));
ok('data ISO → BR', f.data('2026-03-09') === '09/03/2026', f.data('2026-03-09'));
ok('CPF formatado', f.documento('52998224725') === '529.982.247-25', f.documento('52998224725'));
ok('CNPJ formatado', f.documento('11222333000181') === '11.222.333/0001-81', f.documento('11222333000181'));
ok('iniciais ignoram conectivos', f.iniciais('Maria de Souza Lima') === 'ML', f.iniciais('Maria de Souza Lima'));
ok('parseISO não desloca por fuso', f.parseISO('2026-03-09').getDate() === 9, String(f.parseISO('2026-03-09').getDate()));

// ============================= Máscaras =============================
secao('Máscaras');
const m = App.mask;
ok('máscara CNJ', m.cnj('00012345620248260100') === '0001234-56.2024.8.26.0100', m.cnj('00012345620248260100'));
ok('máscara CPF', m.cpf('52998224725') === '529.982.247-25', m.cpf('52998224725'));
ok('máscara CNPJ', m.cnpj('11222333000181') === '11.222.333/0001-81', m.cnpj('11222333000181'));
ok('máscara telefone 11 dígitos', m.telefone('11987654321') === '(11) 98765-4321', m.telefone('11987654321'));
ok('moeda → centavos', m.moedaParaCentavos('R$ 1.250,00') === 125000, String(m.moedaParaCentavos('R$ 1.250,00')));

// ============================= Seed =============================
secao('Seed — geração de dados fictícios');
let seed;
try {
  seed = App.seed.gerar();
  ok('seed gerado sem erro', true);
} catch (e) {
  ok('seed gerado sem erro', false, e.message + '\n' + e.stack);
  seed = null;
}

if (seed) {
  ok('9 usuários', seed.usuarios.length === 9, String(seed.usuarios.length));
  ok('há exatamente um administrador (F2.1 exige)',
     seed.usuarios.filter(u => u.perfil === 'admin').length === 1);
  ok('todos os cinco perfis estão povoados',
     new Set(seed.usuarios.map(u => u.perfil)).size === 5,
     String(new Set(seed.usuarios.map(u => u.perfil)).size));
  ok('65 pessoas (25 clientes + 40 partes)', seed.pessoas.length === 65, String(seed.pessoas.length));
  ok('25 clientes', seed.pessoas.filter(p => p.ehCliente).length === 25);
  ok('40 processos', seed.processos.length === 40, String(seed.processos.length));
  ok('60 prazos', seed.prazos.length === 60, String(seed.prazos.length));
  ok('35 tarefas', seed.tarefas.length === 35, String(seed.tarefas.length));
  ok('há andamentos', seed.andamentos.length > 100, String(seed.andamentos.length));
  ok('há compromissos', seed.compromissos.length > 0, String(seed.compromissos.length));

  const cnjInvalidos = seed.processos.filter(p => !cnj.validar(p.numeroCnj).valido);
  ok('todos os números CNJ são válidos', cnjInvalidos.length === 0,
     cnjInvalidos.slice(0, 3).map(p => p.numeroCnj).join(', '));

  const cpfInvalidos = seed.pessoas.filter(p => p.tipo === 'PF' && !v.cpf(p.documento).valido);
  ok('todos os CPFs gerados são válidos', cpfInvalidos.length === 0, String(cpfInvalidos.length));

  const cnpjInvalidos = seed.pessoas.filter(p => p.tipo === 'PJ' && !v.cnpj(p.documento).valido);
  ok('todos os CNPJs gerados são válidos', cnpjInvalidos.length === 0, String(cnpjInvalidos.length));

  const ids = new Set(seed.processos.map(p => p.id));
  ok('IDs de processo são únicos', ids.size === seed.processos.length);

  const clienteIds = new Set(seed.pessoas.map(p => p.id));
  const orfaos = seed.processos.filter(p => !clienteIds.has(p.clienteId));
  ok('nenhum processo órfão de cliente', orfaos.length === 0, String(orfaos.length));

  const processoIds = new Set(seed.processos.map(p => p.id));
  const prazosOrfaos = seed.prazos.filter(p => !processoIds.has(p.processoId));
  ok('nenhum prazo órfão de processo', prazosOrfaos.length === 0, String(prazosOrfaos.length));

  const fatalNaoContavel = seed.prazos.filter(p => !pz.ehDiaContavel(p.dataFatal));
  ok('toda data fatal é dia contável', fatalNaoContavel.length === 0,
     fatalNaoContavel.slice(0, 3).map(p => p.dataFatal).join(', '));

  // Distribuição do semáforo — o dashboard precisa de variedade
  const abertos = seed.prazos.filter(p => p.status === 'pendente' || p.status === 'em_andamento');
  const dist = { ok: 0, atencao: 0, critico: 0, vencido: 0 };
  abertos.forEach(p => { dist[pz.avaliar(p).semaforo]++; });
  console.log(`     distribuição do semáforo (${abertos.length} abertos):`, JSON.stringify(dist));
  ok('há prazos críticos no seed', dist.critico > 0, String(dist.critico));
  ok('há prazos em atenção no seed', dist.atencao > 0, String(dist.atencao));

  // Distribuição por fase — o kanban precisa de colunas povoadas
  const porFase = {};
  seed.processos.forEach(p => { porFase[p.faseId] = (porFase[p.faseId] || 0) + 1; });
  console.log('     processos por fase:', JSON.stringify(porFase));
  ok('pelo menos 5 fases povoadas', Object.keys(porFase).length >= 5, String(Object.keys(porFase).length));

  // Selectors do kanban
  const enriquecidos = seed.processos.map(p => Object.assign({}, p, {
    clienteNome: 'x', responsavelNome: 'y', prazoProximo: null
  }));
  const colunas = App.selectors.colunasKanbanProcessos(enriquecidos, 'faseId', seed.usuarios);
  ok('kanban por fase gera 7 colunas', colunas.length === 7, String(colunas.length));
  ok('soma das colunas = total de processos',
     colunas.reduce((s, c) => s + c.total, 0) === seed.processos.length);

  const colunasResp = App.selectors.colunasKanbanProcessos(enriquecidos, 'responsavelId', seed.usuarios);
  ok('kanban por responsável gera colunas', colunasResp.length > 0, String(colunasResp.length));
  ok('soma por responsável = total',
     colunasResp.reduce((s, c) => s + c.total, 0) === seed.processos.length);

  const colunasArea = App.selectors.colunasKanbanProcessos(enriquecidos, 'areaId', seed.usuarios);
  ok('soma por área = total',
     colunasArea.reduce((s, c) => s + c.total, 0) === seed.processos.length);

  // Determinismo
  const seed2 = App.seed.gerar();
  ok('geração é determinística (mesmos números CNJ)',
     JSON.stringify(seed.processos.map(p => p.numeroCnj)) ===
     JSON.stringify(seed2.processos.map(p => p.numeroCnj)));
}

console.log(`\n${'─'.repeat(56)}`);
console.log(`${testes - falhas}/${testes} verificações passaram`);
if (falhas) {
  console.log(`${falhas} FALHA(S)`);
  process.exit(1);
}
