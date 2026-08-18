/* Verificação do padrão de responsividade do projeto.

   POR QUE ESTA SUÍTE EXISTE

   "Todas as páginas são responsivas" é uma frase que envelhece mal. Ninguém
   abre 27 telas no celular a cada commit, e o layout que estourou não avisa:
   ele empurra a página de lado e continua funcionando no monitor de quem
   escreveu o código.

   O QUE ELA CONSEGUE E O QUE NÃO CONSEGUE VERIFICAR

   Não há motor de layout aqui. O jsdom monta o DOM mas **não calcula largura
   nenhuma**, então é impossível medir estouro de verdade sem um navegador.
   Fingir que mede seria pior que não medir.

   O que dá para verificar sem layout — e é o que esta suíte faz — são as
   CAUSAS mecânicas de estouro horizontal, na fonte:

     1. a meta viewport existe e libera a largura do dispositivo;
     2. todo breakpoint sai da escala declarada (senão vira o zoológico de
        oito valores ad-hoc que existia antes deste padrão);
     3. toda grade de largura fixa tem regra de colapso em algum breakpoint;
     4. toda tabela mora dentro de um container com rolagem própria;
     5. nada declara largura mínima maior que o telefone fora desses
        containers.

   Passar aqui não prova que a tela está bonita no celular. Prova que as
   armadilhas conhecidas não foram reintroduzidas — que é o que um teste
   automático pode honestamente garantir.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { criarPlacar } = require('./ambiente');

const RAIZ = path.resolve(__dirname, '..');
const { ok, secao, encerrar } = criarPlacar();

/* A ESCALA. Quatro degraus, cada um com um motivo físico — não são números
   redondos escolhidos por gosto:

     600  telefone em pé
     720  telefone deitado / tablet estreito
     900  tablet — é onde a sidebar vira gaveta
    1100  desktop estreito — é onde um layout de dois painéis deixa de caber

   Acrescentar um degrau é decisão de projeto, não de arquivo: mexa aqui e o
   motivo do degrau novo entra junto. */
const ESCALA = [600, 720, 900, 1100];

const ARQUIVOS_CSS = ['tokens', 'base', 'layout', 'components', 'pages', 'portal']
  .map(function (n) { return { nome: n + '.css', caminho: path.join(RAIZ, 'assets/css', n + '.css') }; });

function lerCss(a) { return fs.readFileSync(a.caminho, 'utf8'); }

/** Escapa um seletor para uso dentro de RegExp. */
function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regras de nível superior: [{ seletor, corpo, emMedia }]. */
function extrairRegras(css) {
  const regras = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;

  while ((m = re.exec(css)) !== null) {
    const bruto = m[1];
    // O seletor real é a última linha antes da chave (descarta comentários
    // e o "@media (...) {" que ficou pendurado acima).
    const seletor = bruto.split('\n').pop().trim();
    if (!seletor || seletor.startsWith('@')) continue;

    // Está dentro de um @media? Conta chaves abertas e fechadas até aqui.
    const antes = css.slice(0, m.index);
    const abertas = (antes.match(/\{/g) || []).length;
    const fechadas = (antes.match(/\}/g) || []).length;

    regras.push({ seletor: seletor, corpo: m[2], emMedia: abertas > fechadas });
  }
  return regras;
}

// ===================== 1. Viewport =====================
secao('A meta viewport');

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const viewport = /<meta\s+name="viewport"\s+content="([^"]+)"/.exec(html);

ok('index.html declara a meta viewport', !!viewport);
ok('a viewport usa a largura do dispositivo',
   !!viewport && /width\s*=\s*device-width/.test(viewport[1]),
   viewport ? viewport[1] : 'ausente');

/* `user-scalable=no` e `maximum-scale=1` impedem o usuário de dar zoom. Num
   sistema que exibe número de processo com 20 dígitos, tirar o zoom de quem
   enxerga mal não é decisão de layout — é barreira de acessibilidade. */
ok('a viewport NÃO bloqueia o zoom do usuário',
   !!viewport && !/user-scalable\s*=\s*no|maximum-scale/.test(viewport[1]),
   viewport ? viewport[1] : '');

// ===================== 2. Escala de breakpoints =====================
secao('Escala de breakpoints');

const foraDaEscala = [];
let totalBreakpoints = 0;

ARQUIVOS_CSS.forEach(function (a) {
  const css = lerCss(a);
  const re = /@media[^{]*?\((?:max|min)-width:\s*(\d+)px\)/g;
  let m;

  while ((m = re.exec(css)) !== null) {
    const valor = parseInt(m[1], 10);
    totalBreakpoints++;
    // `min-width` costuma ser o degrau + 1 (901 é o par de max-width: 900).
    const naEscala = ESCALA.indexOf(valor) !== -1 || ESCALA.indexOf(valor - 1) !== -1;
    if (!naEscala) foraDaEscala.push(a.nome + ': ' + valor + 'px');
  }
});

ok('há breakpoints declarados', totalBreakpoints > 0, String(totalBreakpoints));
ok('todo breakpoint sai da escala do projeto', foraDaEscala.length === 0,
   foraDaEscala.join(' · '));

// ===================== 3. Grades de largura fixa =====================
secao('Grades de largura fixa colapsam');

/* Uma grade tipo `300px 1fr` não encolhe: abaixo de ~400px de container ela
   empurra a página inteira de lado. Toda grade assim precisa de uma regra
   que a transforme em coluna única em algum breakpoint. */
const gradesSemColapso = [];
let gradesFixas = 0;

ARQUIVOS_CSS.forEach(function (a) {
  const css = lerCss(a);

  extrairRegras(css).forEach(function (regra) {
    if (regra.emMedia) return;              // a própria regra de colapso

    const achado = /grid-template-columns:\s*([^;]+)/.exec(regra.corpo);
    if (!achado) return;

    const valor = achado[1].trim();
    if (/auto-fit|auto-fill/.test(valor)) return;   // já se reorganiza sozinha

    // Trilhas separadas por espaço, ignorando espaços dentro de minmax(...).
    const trilhas = valor.split(/\s+(?![^(]*\))/);
    if (trilhas.length < 2) return;
    if (!trilhas.some(function (t) { return /^\d+px$/.test(t); })) return;

    gradesFixas++;

    const colapsa = new RegExp(
      escaparRegex(regra.seletor) + '\\s*\\{[^}]*grid-template-columns'
    );
    // Procura a regra de colapso apenas dentro de blocos @media.
    const dentroDeMedia = css.split('@media').slice(1).join('@media');

    if (!colapsa.test(dentroDeMedia)) {
      gradesSemColapso.push(a.nome + ': ' + regra.seletor + ' (' + valor + ')');
    }
  });
});

ok('há grades de largura fixa para conferir', gradesFixas > 0, String(gradesFixas));
ok('toda grade de largura fixa colapsa em algum breakpoint',
   gradesSemColapso.length === 0, gradesSemColapso.join(' · '));

// ===================== 4. Tabelas com rolagem própria =====================
secao('Tabelas rolam dentro do próprio container');

/* `.table` declara `min-width` de propósito: tabela espremida é ilegível. O
   preço é que ela PRECISA morar num container que role sozinho — senão quem
   rola de lado é a página inteira, e aí some o menu, some o cabeçalho e o
   usuário se perde. */
const CONTAINERS_ROLAGEM = ['table-wrap', 'chart__table-scroll'];

const tabelasSoltas = [];
const arquivosJs = [];

(function varrer(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p);
    else if (e.name.endsWith('.js')) arquivosJs.push(p);
  });
})(path.join(RAIZ, 'src'));

arquivosJs.forEach(function (arquivo) {
  const fonte = fs.readFileSync(arquivo, 'utf8');
  const re = /<table\b[^>]*>/g;
  let m;

  while ((m = re.exec(fonte)) !== null) {
    // Tabela de impressão não vive na tela — não estoura layout nenhum.
    if (/border\s*=/.test(m[0])) continue;

    // O container precisa aparecer antes da tabela, perto o bastante para
    // ser o mesmo trecho de HTML montado.
    const antes = fonte.slice(Math.max(0, m.index - 400), m.index);
    const protegida = CONTAINERS_ROLAGEM.some(function (c) {
      return antes.indexOf(c) !== -1;
    });

    if (!protegida) {
      tabelasSoltas.push(path.relative(RAIZ, arquivo) + ' → ' + m[0].slice(0, 40));
    }
  }
});

ok('há tabelas para conferir', arquivosJs.length > 0);
ok('toda tabela de tela está dentro de um container com rolagem',
   tabelasSoltas.length === 0, tabelasSoltas.join(' · '));

CONTAINERS_ROLAGEM.forEach(function (classe) {
  const temRegra = ARQUIVOS_CSS.some(function (a) {
    const re = new RegExp('\\.' + escaparRegex(classe) + '\\s*\\{[^}]*overflow-x:\\s*auto');
    return re.test(lerCss(a));
  });
  ok('.' + classe + ' realmente rola no eixo x', temRegra);
});

// ===================== 5. Larguras mínimas =====================
secao('Larguras mínimas não estouram o telefone');

/* Qualquer `min-width` maior que o menor degrau da escala é, por definição,
   mais largo que um telefone. Só é aceitável dentro de um container que
   rola sozinho — que é exatamente o caso da tabela. */
const PISO = ESCALA[0];
const EXCECOES = ['.table'];      // vive dentro de .table-wrap

const minimosLargos = [];

ARQUIVOS_CSS.forEach(function (a) {
  const css = lerCss(a);

  extrairRegras(css).forEach(function (regra) {
    const achado = /(?:^|[\s;])min-width:\s*(\d+)px/.exec(regra.corpo);
    if (!achado) return;

    const valor = parseInt(achado[1], 10);
    if (valor <= PISO) return;
    if (EXCECOES.indexOf(regra.seletor) !== -1) return;

    minimosLargos.push(a.nome + ': ' + regra.seletor + ' (' + valor + 'px)');
  });
});

ok('nenhuma largura mínima passa do telefone fora de container com rolagem',
   minimosLargos.length === 0, minimosLargos.join(' · '));

/* `100vw` inclui a barra de rolagem em vários navegadores, então um elemento
   com `width: 100vw` fica alguns pixels mais largo que o espaço útil e
   produz uma barra horizontal que ninguém consegue explicar. */
const usos100vw = [];

ARQUIVOS_CSS.forEach(function (a) {
  const css = lerCss(a);
  extrairRegras(css).forEach(function (regra) {
    if (/width:\s*100vw\s*[;}]/.test(regra.corpo)) {
      usos100vw.push(a.nome + ': ' + regra.seletor);
    }
  });
});

ok('nada usa width: 100vw puro', usos100vw.length === 0, usos100vw.join(' · '));

// ===================== 6. Linhas de ação quebram =====================
secao('Linhas que guardam botões quebram em vez de estourar');

/* Esta lista é CURADA de propósito, e não uma varredura de todo `display:
   flex` do projeto. Há 75 linhas flex no CSS, e a grande maioria é um par
   ícone + texto que encolhe sozinho — exigir `flex-wrap` em todas encheria a
   suíte de ruído e treinaria quem lê a ignorar a falha.
   As de baixo são diferentes: guardam BOTÕES ou itens repetidos, cujo
   tamanho não depende do container. Quando não cabem, empurram a página. */
const LINHAS_DE_ACAO = [
  ['components.css', '.card__header'],      // título + ações do cartão
  ['components.css', '.card__actions'],
  ['components.css', '.modal__footer'],     // Cancelar + Confirmar
  ['components.css', '.stepper__track'],    // N passos da conversão de lead
  ['components.css', '.calendar__header'],  // mês + navegação
  ['components.css', '.daterange__custom'], // dois campos de data
  ['components.css', '.chart__header'],
  ['components.css', '.filter-bar'],
  ['components.css', '.prazo-card__actions'],  // Baixar + Perdido + avatar
  ['layout.css', '.page-header'],
  ['pages.css', '.form-actions'],           // rodapé fixo do formulário
  ['pages.css', '.cliente-hero']
];

const semQuebra = [];

LINHAS_DE_ACAO.forEach(function (par) {
  const arquivo = ARQUIVOS_CSS.filter(function (a) { return a.nome === par[0]; })[0];
  const css = lerCss(arquivo);

  const bloco = new RegExp(escaparRegex(par[1]) + '\\s*\\{([^}]*)\\}').exec(css);
  if (!bloco) { semQuebra.push(par[0] + ': ' + par[1] + ' (seletor sumiu)'); return; }
  if (!/flex-wrap:\s*wrap/.test(bloco[1])) semQuebra.push(par[0] + ': ' + par[1]);
});

ok('toda linha de ação declara flex-wrap: wrap',
   semQuebra.length === 0, semQuebra.join(' · '));

encerrar();
