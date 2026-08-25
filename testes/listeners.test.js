/* Regressão: listeners não podem vazar entre rotas nem acumular no re-render. */

const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const erros = [];
const vc = new VirtualConsole();
vc.on('error', (...a) => erros.push(a.join(' ')));
vc.on('jsdomError', e => { if (!/Could not parse CSS/.test(e.message)) erros.push(e.message); });
['warn', 'info', 'log', 'debug'].forEach(k => vc.on(k, () => {}));

const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromFile(path.join(RAIZ, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    url: 'file:///' + RAIZ.replace(/\\/g, '/') + '/index.html'
  });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  await esperar(1500);

  const d = w.document, App = w.App;
  let testes = 0, falhas = 0;

  // F2.1: entra antes de tudo — esta suíte investiga vazamento de listener
  // entre rotas, e sem sessão a guarda desviaria toda navegação para /entrar.
  const usuarioAdmin = App.services.db.get('usuarios').filter(u => u.perfil === 'admin')[0];
  await App.services.sessaoService.entrar(usuarioAdmin.id);
  w.location.hash = '#/';
  w.dispatchEvent(new w.Event('hashchange'));
  await esperar(700);
  const ok = (dsc, c, det) => {
    testes++;
    if (c) console.log(`  ✓ ${dsc}`);
    else { falhas++; console.log(`  ✕ ${dsc}${det ? ' → ' + det : ''}`); }
  };
  const clicar = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const disparar = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true, cancelable: true }));
  const ir = async (h, ms = 900) => {
    w.location.hash = h;
    w.dispatchEvent(new w.Event('hashchange'));
    await esperar(ms);
  };

  console.log('\nContainer é substituído a cada rota');
  await ir('#/');
  const el1 = d.getElementById('conteudo');
  await ir('#/processos');
  const el2 = d.getElementById('conteudo');
  await ir('#/agenda');
  const el3 = d.getElementById('conteudo');
  ok('nó de conteúdo muda entre rotas', el1 !== el2 && el2 !== el3);
  ok('nó antigo foi desconectado do documento', !el1.isConnected && !el2.isConnected);

  console.log('\nVazamento entre kanban de Processos e kanban de Tarefas');
  App.store.setState({ processosVisao: 'kanban', processosAgruparPor: 'faseId' });
  await ir('#/processos', 1100);
  ok('kanban de processos montado', !!d.querySelector('.kanban'));

  // Sai para Tarefas e arrasta um card lá. O handler de Processos NÃO pode disparar.
  await ir('#/tarefas', 1100);
  const andamentosAntes = App.services.db.get('andamentos').length;
  const processosAntes = JSON.stringify(App.services.db.get('processos').map(p => p.faseId));

  const colA = d.querySelector('.kanban__column[data-coluna="a_fazer"]');
  const colRev = d.querySelector('.kanban__column[data-coluna="em_revisao"]');
  const cardT = colA.querySelector('.kanban-card');
  const idTarefa = cardT.dataset.id;

  disparar(cardT, 'dragstart');
  disparar(colRev.querySelector('[data-dropzone]'), 'dragover');
  disparar(colRev.querySelector('[data-dropzone]'), 'drop');
  await esperar(1100);

  ok('tarefa mudou de status',
     App.services.db.find('tarefas', idTarefa).status === 'em_revisao',
     App.services.db.find('tarefas', idTarefa).status);
  ok('NENHUM processo foi alterado pelo handler órfão',
     JSON.stringify(App.services.db.get('processos').map(p => p.faseId)) === processosAntes);
  ok('nenhum andamento espúrio foi criado',
     App.services.db.get('andamentos').length === andamentosAntes,
     `${App.services.db.get('andamentos').length} vs ${andamentosAntes}`);
  ok('continua na tela de Tarefas', d.body.textContent.includes('Nova tarefa'));

  console.log('\nRe-render dentro da mesma tela não duplica handlers');
  const proc = App.services.db.get('processos')[0];
  await ir('#/processos/' + proc.id, 1000);

  // Alternar abas várias vezes força vários re-renders do conteúdo.
  for (let i = 0; i < 4; i++) {
    for (const aba of ['prazos', 'dados']) {
      const btn = Array.from(d.querySelectorAll('[data-action="trocar-aba"]'))
        .find(b => b.dataset.value === aba);
      clicar(btn);
      await esperar(120);
    }
  }

  const abaPrazos = Array.from(d.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'prazos');
  clicar(abaPrazos);
  await esperar(250);

  const btnBaixar = d.querySelector('[data-action="cumprir-prazo"]');
  if (btnBaixar) {
    const idPrazo = btnBaixar.dataset.value;
    const andAntes = App.services.db.get('andamentos').length;
    clicar(btnBaixar);
    await esperar(1100);
    ok('baixa de prazo cria exatamente 1 andamento (não N)',
       App.services.db.get('andamentos').length === andAntes + 1,
       `+${App.services.db.get('andamentos').length - andAntes}`);
    ok('prazo baixado uma única vez',
       App.services.db.find('prazos', idPrazo).status === 'cumprido');
  } else {
    ok('processo tinha prazo aberto para testar', false, 'nenhum botão de baixa');
  }

  console.log('\nFiltros repetidos não duplicam requisições de página');
  await ir('#/processos?visao=tabela', 1000);
  /* O filtro da barra deixou de ser um `<select>` nativo e virou o combo com
     painel próprio — a lista de um select é desenhada pelo sistema e não
     aceita estilo. O teste passa a dirigir os dois cliques que a pessoa dá:
     abrir e escolher. */
  const comboArea = () => d.querySelector('.combo[data-combo="areaId"]');
  ok('o filtro de área virou combo', !!comboArea());

  for (let i = 0; i < 5; i++) {
    clicar(comboArea().querySelector('.combo__trigger'));
    await esperar(80);
    const alvo = i % 2 ? 'civel' : '';
    const item = comboArea()
      .querySelector('.combo__item[data-combo-valor="' + alvo + '"]');
    ok('opção do combo existe na volta ' + (i + 1), !!item, alvo || '(vazio)');
    clicar(item);
    await esperar(450);
  }
  ok('tabela continua consistente após 5 trocas de filtro',
     d.querySelectorAll('table.table tbody tr').length > 0);
  ok('o painel do combo fecha depois de escolher',
     comboArea().querySelector('.combo__painel').classList.contains('u-hidden'));
  ok('sem erro após filtros repetidos', erros.length === 0,
     erros.slice(0, 2).join(' | '));

  console.log('\nTopbar re-renderizada não acumula listener global');
  await ir('#/', 900);
  const btnTema = d.querySelector('[data-action="alternar-tema"]');
  for (let i = 0; i < 6; i++) {
    clicar(d.querySelector('[data-action="alternar-tema"]'));
    await esperar(150);
  }
  ok('alternar tema 6× não gera erro', erros.length === 0, erros.slice(0, 2).join(' | '));
  ok('tema final é claro (6 trocas = par)',
     d.documentElement.getAttribute('data-theme') === 'light',
     d.documentElement.getAttribute('data-theme'));

  console.log('\nErros de JavaScript');
  if (erros.length) {
    [...new Set(erros)].slice(0, 8).forEach(e => console.log('  ✕ ' + e.split('\n')[0]));
    falhas += erros.length; testes += erros.length;
  } else { console.log('  ✓ nenhum'); testes++; }

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`${testes - falhas}/${testes} verificações passaram`);
  dom.window.close();
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('FALHA:', e); process.exit(1); });
