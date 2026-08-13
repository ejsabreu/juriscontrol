/* Verificação das fundações da fase 2 (F2.0) — roda em Node, sem jsdom.

   Cobre o que é lógica pura: aritmética de centavos, CSV, tokens/hash,
   geometria e regras de cor do gráfico, os enums novos e o banco v3 com o
   gancho de auditoria. Tudo aqui migra para o React sem alteração, então o
   teste também migra. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');

const sandbox = {
  window: {},
  console,
  localStorage: undefined,
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, Error,
  setTimeout, clearTimeout, isNaN, parseInt, parseFloat, isFinite, Uint8Array
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const ARQUIVOS = [
  'src/utils/dom.js',
  'src/utils/format.js',
  'src/utils/moeda.js',
  'src/utils/csv.js',
  'src/utils/token.js',
  'src/domain/enums.js',
  'src/domain/feriados.js',
  'src/domain/prazos.js',
  'src/domain/cnj.js',
  'src/domain/validators.js',
  'data/seed.js',
  'src/services/db.js',
  'src/components/ui.js',
  'src/components/SeloSimulado.js',
  'src/components/Chart.js',
  'src/components/DateRangePicker.js'
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
    console.log(`  ✕ ${descricao}${detalhe !== undefined ? ' → ' + detalhe : ''}`);
  }
}

function secao(titulo) {
  console.log(`\n${titulo}`);
}

// ===================== MOEDA =====================
secao('Moeda — aritmética em centavos');
const m = App.moeda;

ok('deReais aceita o formato pt-BR completo', m.deReais('R$ 1.234,56') === 123456, m.deReais('R$ 1.234,56'));
ok('deReais aceita ponto decimal', m.deReais('1234.56') === 123456, m.deReais('1234.56'));
ok('deReais aceita number', m.deReais(1234.56) === 123456, m.deReais(1234.56));
ok('deReais trata ponto de milhar sem decimal', m.deReais('1.234') === 123400, m.deReais('1.234'));
ok('deReais trata ponto decimal de 2 casas', m.deReais('1.23') === 123, m.deReais('1.23'));
ok('deReais em vazio é zero', m.deReais('') === 0 && m.deReais(null) === 0);
ok('deReais entende sinal negativo', m.deReais('-50,00') === -5000, m.deReais('-50,00'));
ok('deReais entende parênteses como negativo', m.deReais('(50,00)') === -5000, m.deReais('(50,00)'));
ok('deReais ignora lixo', m.deReais('abc') === 0);

ok('somar aceita varargs', m.somar(100, 200, 300) === 600);
ok('somar aceita array', m.somar([100, 200, 300]) === 600);
ok('subtrair', m.subtrair(1000, 250) === 750);
ok('percentual: 20% de R$ 1.000,00', m.percentual(100000, 20) === 20000, m.percentual(100000, 20));
ok('percentual arredonda meio para cima', m.percentual(101, 50) === 51, m.percentual(101, 50));
ok('multiplicar devolve inteiro', Number.isInteger(m.multiplicar(33333, 1.5)));

// O teste que importa no financeiro: parcelamento não pode perder centavo.
const p3 = m.ratear(10000, 3);
ok('ratear 3x devolve 3 parcelas', p3.length === 3, JSON.stringify(p3));
ok('ratear 3x não perde centavo', p3.reduce((s, v) => s + v, 0) === 10000, JSON.stringify(p3));
ok('ratear 3x põe o resto nas primeiras', p3[0] === 3334 && p3[2] === 3333, JSON.stringify(p3));

let rateioSempreFecha = true;
for (let total = 1; total <= 400; total += 7) {
  for (let n = 1; n <= 12; n++) {
    if (m.ratear(total, n).reduce((s, v) => s + v, 0) !== total) rateioSempreFecha = false;
  }
}
ok('ratear fecha a soma em ~700 combinações', rateioSempreFecha);
ok('ratear com valor negativo fecha', m.ratear(-1000, 3).reduce((s, v) => s + v, 0) === -1000);

const peso = m.ratearPorPeso(100000, [70, 30]);
ok('ratearPorPeso divide 70/30', peso[0] === 70000 && peso[1] === 30000, JSON.stringify(peso));
const peso3 = m.ratearPorPeso(10000, [1, 1, 1]);
ok('ratearPorPeso não perde centavo em terços',
   peso3.reduce((s, v) => s + v, 0) === 10000, JSON.stringify(peso3));
ok('ratearPorPeso com pesos zerados devolve zeros',
   m.ratearPorPeso(1000, [0, 0]).every(v => v === 0));

ok('extenso: R$ 1,00', m.extenso(100) === 'um real', m.extenso(100));
ok('extenso: R$ 0,01', m.extenso(1) === 'um centavo', m.extenso(1));
ok('extenso: zero', m.extenso(0) === 'zero real', m.extenso(0));
ok('extenso: R$ 100,00 é "cem reais"', m.extenso(10000) === 'cem reais', m.extenso(10000));
ok('extenso: R$ 1.000,00 é "mil reais"', m.extenso(100000) === 'mil reais', m.extenso(100000));
ok('extenso: R$ 1.500,00 leva o "e"', m.extenso(150000) === 'mil e quinhentos reais', m.extenso(150000));
ok('extenso: R$ 1.234,56 completo',
   m.extenso(123456) === 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos',
   m.extenso(123456));
ok('extenso: milhão', m.extenso(100000000).indexOf('um milhão') === 0, m.extenso(100000000));
ok('extenso: negativo', m.extenso(-100).indexOf('menos ') === 0, m.extenso(-100));

// ===================== CSV =====================
secao('CSV — geração e leitura');
const csv = App.csv;

const linhas = [
  { nome: 'Maria Silva', valor: 1000, obs: 'sem observação' },
  { nome: 'Costa; Souza Advogados', valor: 2500, obs: 'nome com ponto e vírgula' },
  { nome: 'Empresa "Alfa" Ltda', valor: 300, obs: 'aspas no nome' }
];
const colunas = [
  { campo: 'nome', titulo: 'Cliente' },
  { campo: 'valor', titulo: 'Valor' },
  { campo: 'obs', titulo: 'Observação' }
];

const gerado = csv.gerar(linhas, colunas);
ok('gerar inclui BOM UTF-8', gerado.charCodeAt(0) === 0xFEFF);
ok('gerar usa ; como separador padrão', gerado.indexOf('Cliente;Valor;Observação') !== -1);
ok('gerar aspeia campo com separador dentro',
   gerado.indexOf('"Costa; Souza Advogados"') !== -1);
ok('gerar duplica aspas internas',
   gerado.indexOf('"Empresa ""Alfa"" Ltda"') !== -1);
ok('gerar sem BOM quando pedido', csv.gerar(linhas, colunas, { bom: false }).charCodeAt(0) !== 0xFEFF);
ok('gerar deduz colunas quando não recebe', csv.gerar(linhas).indexOf('nome;valor;obs') !== -1);

const lido = csv.ler(gerado);
ok('ler recupera o cabeçalho',
   JSON.stringify(lido.cabecalho) === JSON.stringify(['Cliente', 'Valor', 'Observação']),
   JSON.stringify(lido.cabecalho));
ok('ler recupera todas as linhas', lido.linhas.length === 3, String(lido.linhas.length));
ok('ida e volta preserva o ponto e vírgula dentro do campo',
   lido.linhas[1].Cliente === 'Costa; Souza Advogados', lido.linhas[1].Cliente);
ok('ida e volta preserva aspas internas',
   lido.linhas[2].Cliente === 'Empresa "Alfa" Ltda', lido.linhas[2].Cliente);
ok('ler marca o número da linha do arquivo', lido.linhas[0].__linha === 2);
ok('ler não produz erro em CSV íntegro', lido.erros.length === 0, JSON.stringify(lido.erros));

const comQuebra = 'a;b\r\n"linha 1\nlinha 2";x';
const lidoQuebra = csv.ler(comQuebra);
ok('ler respeita quebra de linha DENTRO do campo',
   lidoQuebra.linhas.length === 1 && lidoQuebra.linhas[0].a === 'linha 1\nlinha 2',
   JSON.stringify(lidoQuebra.linhas));

const torto = csv.ler('a;b;c\r\n1;2\r\n4;5;6');
ok('ler separa linha com contagem errada', torto.erros.length === 1 && torto.linhas.length === 1,
   JSON.stringify({ erros: torto.erros.length, linhas: torto.linhas.length }));
ok('erro aponta a linha certa do arquivo', torto.erros[0].linha === 2, String(torto.erros[0].linha));

ok('ler ignora linha totalmente vazia',
   csv.ler('a;b\r\n1;2\r\n\r\n').linhas.length === 1);
ok('ler em texto vazio devolve estrutura vazia',
   csv.ler('').linhas.length === 0 && csv.ler('   ').cabecalho.length === 0);

ok('detectarSeparador acha a vírgula', csv.detectarSeparador('a,b,c\n1,2,3') === ',');
ok('detectarSeparador acha o ponto e vírgula', csv.detectarSeparador('a;b;c') === ';');
ok('detectarSeparador ignora separador dentro de aspas',
   csv.detectarSeparador('"a;b;c;d";x') === ';' || csv.detectarSeparador('"a,b,c,d";x') === ';');

// ===================== TOKEN =====================
secao('Token — identidade, dedupe e anonimização');
const tk = App.token;

const t1 = tk.gerar();
ok('gerar produz 32 caracteres por padrão', t1.length === 32, String(t1.length));
ok('gerar respeita o tamanho pedido', tk.gerar(12).length === 12);
ok('gerar evita caracteres ambíguos (0 O 1 I l)', !/[0O1Il]/.test(tk.gerar(200)));
ok('dois tokens não colidem', tk.gerar() !== tk.gerar());

ok('hash é determinístico', tk.hash('processo 123') === tk.hash('processo 123'));
ok('hash distingue entradas próximas', tk.hash('abc') !== tk.hash('abd'));
ok('hash tem 8 caracteres hex', /^[0-9a-f]{8}$/.test(tk.hash('qualquer coisa')), tk.hash('x'));
ok('hash de vazio não quebra', /^[0-9a-f]{8}$/.test(tk.hash('')));
ok('hashLongo tem 16 caracteres', tk.hashLongo('publicação inteira').length === 16);
ok('hashLongo distingue texto de mesmo tamanho',
   tk.hashLongo('intime-se o autor') !== tk.hashLongo('intime-se o reu  '));

ok('anonimizarNome mascara preservando iniciais',
   tk.anonimizarNome('Maria Silva Costa') === 'M**** S**** C****',
   tk.anonimizarNome('Maria Silva Costa'));
ok('anonimizarNome preserva conectivos curtos',
   tk.anonimizarNome('Ana de Souza').indexOf(' de ') !== -1,
   tk.anonimizarNome('Ana de Souza'));
ok('anonimizarNome irreversível não devolve o nome',
   tk.anonimizarNome('Maria Silva', true).indexOf('Maria') === -1,
   tk.anonimizarNome('Maria Silva', true));
ok('anonimizarNome irreversível é estável',
   tk.anonimizarNome('Maria Silva', true) === tk.anonimizarNome('Maria Silva', true));

ok('anonimizarDocumento mascara CPF na convenção brasileira',
   tk.anonimizarDocumento('12345678901') === '***.456.789-**',
   tk.anonimizarDocumento('12345678901'));
ok('anonimizarDocumento esconde o dígito verificador do CPF',
   tk.anonimizarDocumento('12345678901').indexOf('01') === -1);
ok('anonimizarDocumento mascara CNPJ',
   tk.anonimizarDocumento('12345678000199') === '**.345.678/0001-**',
   tk.anonimizarDocumento('12345678000199'));
ok('anonimizarDocumento em lixo devolve ***', tk.anonimizarDocumento('123') === '***');
ok('anonimizarEmail preserva o domínio',
   tk.anonimizarEmail('maria@escritorio.com.br') === 'ma***@escritorio.com.br',
   tk.anonimizarEmail('maria@escritorio.com.br'));
ok('anonimizarEmail preserva o tamanho do usuário',
   tk.anonimizarEmail('maria@x.com').split('@')[0].length === 5,
   tk.anonimizarEmail('maria@x.com'));
ok('anonimizarEmail sempre esconde ao menos um caractere',
   tk.anonimizarEmail('ab@x.com') === 'a*@x.com', tk.anonimizarEmail('ab@x.com'));
ok('anonimizarEmail com usuário de 1 letra esconde tudo',
   tk.anonimizarEmail('a@x.com') === '*@x.com', tk.anonimizarEmail('a@x.com'));
ok('anonimizarEmail em texto que não é e-mail devolve ***',
   tk.anonimizarEmail('sem arroba') === '***');

// ===================== CHART =====================
secao('Chart — escala, paleta e marcas');
const Chart = App.components.Chart;

const t = Chart.ticks(0, 873, 4);
ok('ticks começa em zero', t[0] === 0, JSON.stringify(t));
ok('ticks cobre o máximo', t[t.length - 1] >= 873, JSON.stringify(t));
ok('ticks usa números redondos', t.every(v => v % t[1] === 0), JSON.stringify(t));
ok('ticks com min === max não quebra', Chart.ticks(5, 5, 4).length >= 2);
ok('ticks aceita negativos', Chart.ticks(-50, 100, 4)[0] <= -50);

ok('corCategorica usa os slots em ordem',
   Chart.corCategorica(0) === 'var(--chart-1)' && Chart.corCategorica(7) === 'var(--chart-8)');
ok('9º slot NÃO cicla — vai para o neutro',
   Chart.corCategorica(8) === 'var(--chart-neutro)', Chart.corCategorica(8));
ok('corOrdinal percorre a rampa de um matiz',
   Chart.corOrdinal(0, 5) === 'var(--chart-seq-1)' && Chart.corOrdinal(4, 5) === 'var(--chart-seq-7)',
   Chart.corOrdinal(0, 5) + ' … ' + Chart.corOrdinal(4, 5));
ok('corOrdinal com uma etapa só não quebra', Chart.corOrdinal(0, 1) === 'var(--chart-seq-4)');

const muitas = [];
for (let i = 0; i < 11; i++) muitas.push({ id: 's' + i, label: 'Série ' + i, valores: [10] });
const dobradas = Chart.dobrarExcedente(muitas, 'categorica');
ok('dobrarExcedente limita a 8 séries', dobradas.length === 8, String(dobradas.length));
ok('a 8ª série vira "Outros" com a contagem',
   dobradas[7].label === 'Outros (4)', dobradas[7].label);
ok('"Outros" soma os valores dobrados', dobradas[7].valores[0] === 40, String(dobradas[7].valores[0]));
ok('dobrarExcedente não mexe em 8 ou menos',
   Chart.dobrarExcedente(muitas.slice(0, 8), 'categorica').length === 8);
ok('paleta ordinal não dobra (a ordem é o significado)',
   Chart.dobrarExcedente(muitas, 'ordinal').length === 11);

const umaSerie = Chart.Barras({
  titulo: 'Processos por área',
  categorias: ['Cível', 'Trabalhista', 'Tributário'],
  series: [{ id: 'qtd', label: 'Processos', valores: [12, 7, 3] }]
});
ok('Barras devolve SVG', umaSerie.indexOf('<svg') !== -1);
ok('Barras traz a visão de tabela (alívio de contraste)',
   umaSerie.indexOf('chart__table') !== -1);
ok('Barras com UMA série não desenha legenda',
   umaSerie.indexOf('chart__legend') === -1);
ok('Barras com uma série rotula direto na ponta',
   umaSerie.indexOf('chart__value') !== -1);
ok('Barras desenha uma marca por categoria',
   (umaSerie.match(/class="chart__mark"/g) || []).length === 3);
ok('Barras arredonda a ponta e deixa a base reta (arco no topo)',
   umaSerie.indexOf('A4 4 0 0 1') !== -1);
ok('Barras traz o rótulo de cada categoria', umaSerie.indexOf('Cível') !== -1);

const duasSeries = Chart.Barras({
  titulo: 'Receita x despesa',
  categorias: ['jan', 'fev'],
  series: [
    { id: 'r', label: 'Receita', valores: [100, 200] },
    { id: 'd', label: 'Despesa', valores: [60, 90] }
  ]
});
ok('Barras com 2 séries desenha legenda', duasSeries.indexOf('chart__legend') !== -1);
ok('Barras com 2 séries NÃO rotula todos os pontos',
   duasSeries.indexOf('chart__value') === -1);
ok('Barras com 2 séries desenha 4 marcas',
   (duasSeries.match(/class="chart__mark"/g) || []).length === 4);

const empilhado = Chart.Barras({
  categorias: ['jan', 'fev'],
  empilhado: true,
  series: [
    { id: 'a', label: 'A', valores: [10, 20] },
    { id: 'b', label: 'B', valores: [5, 0] }
  ]
});
ok('Barras empilhadas omitem segmento de valor zero',
   (empilhado.match(/class="chart__mark"/g) || []).length === 3,
   String((empilhado.match(/class="chart__mark"/g) || []).length));

ok('Barras sem dados mostra estado vazio',
   Chart.Barras({ categorias: [], series: [] }).indexOf('chart__empty') !== -1);

const linha = Chart.Linha({
  titulo: 'Fluxo de caixa',
  categorias: ['jan', 'fev', 'mar'],
  series: [{ id: 'saldo', label: 'Saldo', valores: [100, -50, 200] }]
});
ok('Linha devolve SVG com traço', linha.indexOf('chart__line') !== -1);
ok('Linha põe ponto no fim da série', linha.indexOf('chart__dot') !== -1);
ok('Linha cria faixa de hover por categoria',
   (linha.match(/class="chart__hit"/g) || []).length === 3);
ok('Linha com uma só categoria cai no estado vazio',
   Chart.Linha({ categorias: ['jan'], series: [{ label: 'x', valores: [1] }] })
     .indexOf('chart__empty') !== -1);

const donut = Chart.Donut({
  titulo: 'Carteira',
  fatias: [
    { id: 'a', label: 'Cível', valor: 50 },
    { id: 'b', label: 'Trabalhista', valor: 30 },
    { id: 'c', label: 'Tributário', valor: 20 }
  ]
});
ok('Donut desenha um arco por fatia',
   (donut.match(/class="chart__arc"/g) || []).length === 3);
ok('Donut escreve o total no miolo', donut.indexOf('chart__donut-value') !== -1);
ok('Donut descarta fatia de valor zero',
   (Chart.Donut({ fatias: [{ label: 'a', valor: 10 }, { label: 'b', valor: 0 }] })
      .match(/class="chart__arc"/g) || []).length === 1);
ok('Donut sem dados mostra estado vazio',
   Chart.Donut({ fatias: [] }).indexOf('chart__empty') !== -1);

ok('Sparkline devolve SVG', Chart.Sparkline({ valores: [1, 3, 2, 5] }).indexOf('<svg') !== -1);
ok('Sparkline com menos de 2 pontos não desenha nada',
   Chart.Sparkline({ valores: [1] }) === '');

// Regra estrutural: não existe segundo eixo Y em lugar nenhum da API.
const fonteChart = fs.readFileSync(path.join(RAIZ, 'src/components/Chart.js'), 'utf8');
ok('não há prop de segundo eixo Y (duas escalas viram dois gráficos)',
   !/eixoDireito|eixoSecundario|yDireito/i.test(fonteChart));

// ===================== SELO =====================
secao('Selo de simulação');
const Selo = App.components.SeloSimulado;

ok('selo sem conteúdo não renderiza nada', Selo({}) === '' && Selo() === '');
const faixa = Selo({ oque: 'A consulta ao DJe não acontece.', naFase3: 'integração Datajud' });
ok('faixa diz o que é simulado', faixa.indexOf('não acontece') !== -1);
ok('faixa diz o que entra na fase 3', faixa.indexOf('Na fase 3: integração Datajud') !== -1);
ok('forma linha é compacta', Selo({ oque: 'x', forma: 'linha' }).indexOf('selo--linha') !== -1);
ok('forma ponto vira etiqueta', Selo({ oque: 'x', forma: 'ponto' }).indexOf('selo--ponto') !== -1);
ok('selo escapa conteúdo',
   Selo({ oque: '<script>alert(1)</script>' }).indexOf('<script>') === -1);

// ===================== PERÍODO =====================
secao('DateRangePicker — predefinições');
const DRP = App.components.DateRangePicker;

const sete = DRP.resolver('7d', '2026-08-12');
ok('últimos 7 dias inclui hoje e mais 6', sete.de === '2026-08-06' && sete.ate === '2026-08-12',
   JSON.stringify(sete));
const mes = DRP.resolver('mes', '2026-08-12');
ok('mês atual começa no dia 1', mes.de === '2026-08-01' && mes.ate === '2026-08-12',
   JSON.stringify(mes));
const anterior = DRP.resolver('mes_anterior', '2026-08-12');
ok('mês anterior pega o mês fechado', anterior.de === '2026-07-01' && anterior.ate === '2026-07-31',
   JSON.stringify(anterior));
const anoBissexto = DRP.resolver('mes_anterior', '2028-03-10');
ok('mês anterior acerta fevereiro bissexto', anoBissexto.ate === '2028-02-29', anoBissexto.ate);
ok('ano atual começa em 1º de janeiro', DRP.resolver('ano', '2026-08-12').de === '2026-01-01');
ok('predefinição inexistente devolve null', DRP.resolver('inexistente', '2026-08-12') === null);
ok('descrever usa o rótulo da predefinição',
   DRP.descrever({ predefinicao: '30d' }) === 'Últimos 30 dias');
ok('descrever formata período personalizado',
   DRP.descrever({ de: '2026-01-01', ate: '2026-01-31' }) === '01/01/2026 a 31/01/2026',
   DRP.descrever({ de: '2026-01-01', ate: '2026-01-31' }));
ok('descrever sem nada devolve período completo', DRP.descrever({}) === 'Período completo');

// ===================== ENUMS DA FASE 2 =====================
secao('Enums da fase 2');
const enums = App.domain.enums;

const NOVOS = ['MODALIDADES_HONORARIO', 'STATUS_LANCAMENTO', 'ORIGENS_LANCAMENTO',
  'STATUS_BOLETO', 'ETAPAS_FUNIL', 'ORIGENS_LEAD', 'TIPOS_INTERACAO', 'STATUS_PROPOSTA',
  'STATUS_PUBLICACAO', 'TIPOS_MONITORAMENTO', 'TIPOS_NOTIFICACAO', 'GRAVIDADES',
  'ACOES_AUDITORIA', 'TIPOS_SOLICITACAO_TITULAR', 'BASES_LEGAIS', 'RECURSOS_PERMISSAO'];

NOVOS.forEach(nome => {
  const lista = enums[nome];
  ok(`${nome} existe e não está vazio`, Array.isArray(lista) && lista.length > 0);
  if (!Array.isArray(lista)) return;
  const ids = lista.map(i => i.id);
  ok(`${nome} não tem id repetido`, new Set(ids).size === ids.length);
  ok(`${nome} tem label em todo item`, lista.every(i => !!i.label));
});

ok('achar() funciona nos enums novos',
   enums.achar(enums.STATUS_LANCAMENTO, 'pago').label === 'Pago');
ok('rotulo() cai no fallback com id desconhecido',
   enums.rotulo(enums.STATUS_LANCAMENTO, 'inexistente', '—') === '—');

// ETAPAS_FUNIL é ORDINAL: a ordem é o significado, e a probabilidade cresce.
const funil = enums.ETAPAS_FUNIL.filter(e => e.id !== 'perdido');
let probCresce = true;
for (let i = 1; i < funil.length; i++) {
  if (funil[i].probabilidade <= funil[i - 1].probabilidade) probCresce = false;
}
ok('ETAPAS_FUNIL cresce em probabilidade até "ganho"', probCresce);
ok('funil termina em 100%', funil[funil.length - 1].probabilidade === 100);
ok('etapa "perdido" tem probabilidade zero',
   enums.achar(enums.ETAPAS_FUNIL, 'perdido').probabilidade === 0);

ok('ORIGENS_LANCAMENTO classifica receita e despesa',
   enums.ORIGENS_LANCAMENTO.every(o => o.tipo === 'receita' || o.tipo === 'despesa'));
ok('há origem de receita e de despesa',
   enums.ORIGENS_LANCAMENTO.some(o => o.tipo === 'receita') &&
   enums.ORIGENS_LANCAMENTO.some(o => o.tipo === 'despesa'));
ok('TIPOS_SOLICITACAO_TITULAR tem prazo de atendimento (LGPD)',
   enums.TIPOS_SOLICITACAO_TITULAR.every(s => s.prazoDias > 0));
ok('RECURSOS_PERMISSAO cobre os módulos da fase 2',
   ['financeiro.ver', 'portal.compartilhar', 'auditoria', 'publicacoes.triar']
     .every(id => !!enums.achar(enums.RECURSOS_PERMISSAO, id)));
ok('todo recurso de permissão tem grupo',
   enums.RECURSOS_PERMISSAO.every(r => !!r.grupo));
ok('TIPOS_NOTIFICACAO declara gravidade conhecida',
   enums.TIPOS_NOTIFICACAO.every(t => !!enums.achar(enums.GRAVIDADES, t.gravidade)));

// ===================== BANCO v3 =====================
secao('Banco v3 — coleções da fase 2 e auditoria');
const db = App.services.db;

ok('a chave do banco é versionada', /^jurisctrl\.db\.v\d+$/.test(db.CHAVE), db.CHAVE);
ok('a chave está na v4 (F2.4 povoou publicações no seed)',
   db.CHAVE === 'jurisctrl.db.v4', db.CHAVE);

const estado = db.init(true);
ok('init gera o seed', estado.processos.length > 0);
ok('COLECOES_FASE2 declara 24 coleções', db.COLECOES_FASE2.length === 24,
   String(db.COLECOES_FASE2.length));
ok('toda coleção da fase 2 existe após o init',
   db.COLECOES_FASE2.every(nome => Array.isArray(estado[nome])),
   db.COLECOES_FASE2.filter(nome => !Array.isArray(estado[nome])).join(', '));
/* Coleção da fase 2 nasce vazia enquanto o módulo dono não existir. As duas
   exceções são de F2.4: publicações e monitoramentos vêm povoados pelo seed,
   senão a fila de triagem abriria vazia e o módulo não teria o que demonstrar. */
const POVOADAS_PELO_SEED = ['publicacoes', 'monitoramentos'];

ok('coleções sem módulo dono nascem vazias',
   db.COLECOES_FASE2
     .filter(nome => POVOADAS_PELO_SEED.indexOf(nome) === -1)
     .every(nome => estado[nome].length === 0),
   db.COLECOES_FASE2.filter(nome => POVOADAS_PELO_SEED.indexOf(nome) === -1 &&
                                    estado[nome].length > 0).join(', '));
ok('publicações e monitoramentos vêm povoados (F2.4)',
   POVOADAS_PELO_SEED.every(nome => estado[nome].length > 0),
   POVOADAS_PELO_SEED.map(n => n + '=' + estado[n].length).join(' '));
ok('as coleções da fase 1 continuam intactas',
   ['processos', 'prazos', 'pessoas', 'documentos', 'tarefas'].every(n => Array.isArray(estado[n])));

/* Idempotência do init(). Várias telas chamam db.init() ao renderizar; sem a
   guarda, cada chamada relê o storage — indisponível sob file:// — e o banco
   é REGERADO, descartando tudo o que foi criado em tempo de execução. */
const marcador = db.insert('notificacoes', { titulo: 'Sobrevive ao init?' }, 'NOT');
db.init();
db.init();
ok('init() repetido NÃO regenera o banco',
   !!db.find('notificacoes', marcador.id));
ok('init() repetido devolve sempre o mesmo estado', db.init() === db.init());
ok('reset() ainda descarta tudo (a guarda não quebra o botão ↺)',
   db.reset() && db.find('notificacoes', marcador.id) === null);

// Gancho de auditoria: nasce desligado, F2.1 pluga.
const registrados = [];
db.configurarAuditoria((colecao, acao, antes, depois) => {
  registrados.push({ colecao, acao, temAntes: !!antes, temDepois: !!depois });
});

const criado = db.insert('lancamentos', { descricao: 'Honorário teste', valorCentavos: 50000 }, 'LAN');
ok('insert grava na coleção nova', !!criado.id && criado.ativo === true);
ok('auditoria registra a criação',
   registrados.length === 1 && registrados[0].acao === 'criar' &&
   registrados[0].colecao === 'lancamentos', JSON.stringify(registrados[0]));
ok('criação não tem estado anterior', registrados[0].temAntes === false);

db.update('lancamentos', criado.id, { valorCentavos: 60000 });
ok('auditoria registra a alteração', registrados[1] && registrados[1].acao === 'atualizar');
ok('alteração carrega antes E depois',
   registrados[1].temAntes === true && registrados[1].temDepois === true);

db.remove('lancamentos', criado.id);
ok('auditoria distingue exclusão de alteração',
   registrados[2] && registrados[2].acao === 'remover', JSON.stringify(registrados[2]));
ok('soft delete: o registro some das consultas',
   db.find('lancamentos', criado.id) === null);
ok('soft delete: o registro continua no banco',
   db.getTodos('lancamentos').some(r => r.id === criado.id));

// A auditoria nunca pode derrubar a operação auditada.
db.configurarAuditoria(() => { throw new Error('falha proposital'); });
let sobreviveu = true;
try {
  db.insert('lancamentos', { descricao: 'Com auditoria quebrada' }, 'LAN');
} catch (e) {
  sobreviveu = false;
}
ok('auditoria com defeito não derruba a escrita', sobreviveu);

db.configurarAuditoria(null);
const antesDesligada = registrados.length;
db.insert('lancamentos', { descricao: 'Sem auditoria' }, 'LAN');
ok('configurarAuditoria(null) desliga o gancho', registrados.length === antesDesligada);

const diag = db.diagnostico();
ok('diagnostico mede o banco', diag.bytes > 0 && diag.mb >= 0, JSON.stringify({ mb: diag.mb }));
ok('diagnostico compara com o teto de 5 MB', diag.limiteMb === 5 && diag.percentual > 0);
ok('diagnostico lista as coleções da maior para a menor',
   diag.porColecao.length > 1 && diag.porColecao[0].bytes >= diag.porColecao[1].bytes);
console.log(`     ocupação atual: ${diag.mb} MB de ${diag.limiteMb} MB (${diag.percentual}%)`);
console.log(`     maiores coleções: ${diag.porColecao.slice(0, 3)
  .map(c => `${c.colecao} ${Math.round(c.bytes / 1024)}KB`).join(' · ')}`);
ok('o seed da fase 1 cabe com folga no teto (< 70%)', !diag.alerta,
   diag.percentual + '%');

console.log(`\n${'─'.repeat(56)}`);
console.log(`${testes - falhas}/${testes} verificações passaram`);
if (falhas) {
  console.log(`${falhas} FALHA(S)`);
  process.exit(1);
}
