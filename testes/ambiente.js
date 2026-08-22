/* ==========================================================================
   testes/ambiente.js — sandbox compartilhado das suítes sem jsdom

   POR QUE ESTE ARQUIVO EXISTE

   Cada suíte montava a própria lista de arquivos a carregar. Funcionava até
   o `seed.js` ganhar uma dependência nova: em F2.4 ele passou a usar
   `utils/token.js` (hash da publicação) e em F2.5 `domain/financeiro.js`
   (parcelas do contrato). Nas duas vezes, as suítes que não conheciam o
   arquivo novo quebraram TODAS de uma vez — e as individuais passavam,
   então o defeito só aparecia ao rodar o conjunto.

   A correção não é acrescentar o arquivo em seis listas: é ter uma lista só.
   `NUCLEO` é a ordem canônica de carregamento de tudo que não depende de
   DOM. Cada suíte acrescenta o que precisa além disso.

   Consequência prática: quando um módulo novo entrar no seed, ele entra
   AQUI, uma vez, e nenhuma suíte quebra.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');

/* Ordem de dependência conceitual, a mesma do index.html. Nenhum destes
   arquivos toca o DOM em tempo de DEFINIÇÃO, então todos carregam sob Node
   puro — é o que permite que a maior parte da verificação rode sem jsdom. */
const NUCLEO = [
  // Utilitários
  'src/utils/dom.js',
  'src/utils/format.js',
  'src/utils/mask.js',
  'src/utils/moeda.js',
  'src/utils/csv.js',
  'src/utils/token.js',
  'src/utils/exportar.js',

  // Domínio — lógica pura
  'src/domain/enums.js',
  'src/domain/feriados.js',
  'src/domain/prazos.js',
  'src/domain/cnj.js',
  'src/domain/validators.js',
  'src/domain/permissoes.js',
  'src/domain/alertas.js',
  'src/domain/classificador.js',
  'src/domain/financeiro.js',
  'src/domain/boleto.js',
  'src/domain/modelos.js',
  'src/domain/busca.js',
  'src/domain/assistente.js',
  'src/domain/indicadores.js',

  // Dados — depende do domínio acima
  'data/seed.js',

  // Estado e camada de dados
  'src/store/store.js',
  'src/store/selectors.js',
  'src/services/http.js',
  'src/services/db.js',

  // Services
  'src/services/acessoService.js',
  'src/services/painelService.js',
  'src/services/processoService.js',
  'src/services/prazoService.js',
  'src/services/clienteService.js',
  'src/services/andamentoService.js',
  'src/services/agendaService.js',
  'src/services/tarefaService.js',
  'src/services/sessaoService.js',
  'src/services/auditoriaService.js',
  'src/services/privacidadeService.js',
  'src/services/notificacaoService.js',
  'src/services/regraAlertaService.js',
  'src/services/simulado/emailService.js',
  'src/services/compartilhamentoService.js',
  'src/services/publicacaoService.js',
  'src/services/monitoramentoService.js',
  'src/services/simulado/sincronizacaoService.js',
  'src/services/contratoService.js',
  'src/services/lancamentoService.js',
  'src/services/boletoService.js',
  'src/services/repasseService.js',
  'src/services/timesheetService.js',
  'src/services/leadService.js',
  'src/services/interacaoService.js',
  'src/services/propostaService.js',
  'src/services/arquivoService.js',
  'src/services/conteudoService.js',
  'src/services/pastaDocumentoService.js',
  'src/services/documentoService.js',
  'src/services/modeloPecaService.js',
  'src/services/buscaService.js',
  'src/services/assinaturaService.js',
  'src/services/simulado/iaService.js',
  'src/services/relatorioService.js',
  'src/services/configuracaoService.js',
  'src/services/importacaoService.js'
];

/** localStorage de mentira — a sessão e o banco precisam persistir em algum lugar. */
function criarStorage() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    clear: () => mapa.clear()
  };
}

/**
 * Monta o sandbox e carrega os módulos.
 *
 * @param {object} [opcoes]
 * @param {string[]} [opcoes.extras]   arquivos além do núcleo (ex.: layout/Sidebar.js)
 * @param {string}   [opcoes.href]     window.location.href
 * @param {boolean}  [opcoes.latencia] mantém a latência simulada (padrão: desligada)
 * @returns {{ App, janela, sandbox }}
 */
function criarAmbiente(opcoes) {
  const op = opcoes || {};

  const janela = {
    localStorage: criarStorage(),
    location: { href: op.href || 'file:///index.html' }
  };

  const sandbox = {
    window: janela,
    console,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp,
    Promise, Error, Map, Set,
    setTimeout, clearTimeout, setInterval, clearInterval,
    isNaN, parseInt, parseFloat, isFinite, Uint8Array
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const arquivos = NUCLEO.concat(op.extras || []);

  for (const arquivo of arquivos) {
    const codigo = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
    try {
      vm.runInContext(codigo, sandbox, { filename: arquivo });
    } catch (e) {
      console.error(`✕ FALHA AO CARREGAR ${arquivo}:`, e.message);
      process.exit(1);
    }
  }

  const App = janela.App;
  if (op.latencia !== true) App.services.http.config.ativarLatencia = false;

  return { App, janela, sandbox };
}

/** Placar compartilhado — todas as suítes contam do mesmo jeito. */
function criarPlacar() {
  const estado = { testes: 0, falhas: 0 };

  function ok(descricao, condicao, detalhe) {
    estado.testes++;
    if (condicao) {
      console.log(`  ✓ ${descricao}`);
    } else {
      estado.falhas++;
      console.log(`  ✕ ${descricao}${detalhe !== undefined ? ' → ' + detalhe : ''}`);
    }
  }

  function secao(titulo) { console.log(`\n${titulo}`); }

  function encerrar() {
    console.log(`\n${'─'.repeat(56)}`);
    console.log(`${estado.testes - estado.falhas}/${estado.testes} verificações passaram`);
    if (estado.falhas) {
      console.log(`${estado.falhas} FALHA(S)`);
      process.exit(1);
    }
  }

  return { ok, secao, encerrar, estado };
}

module.exports = { RAIZ, NUCLEO, criarAmbiente, criarPlacar, criarStorage };
