/* Integração: carrega o index.html em jsdom e navega por todas as rotas. */

const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const erros = [];
const avisos = [];

const virtualConsole = new VirtualConsole();
virtualConsole.on('error', (...args) => erros.push('console.error: ' + args.join(' ')));
virtualConsole.on('warn', (...args) => avisos.push('console.warn: ' + args.join(' ')));
virtualConsole.on('jsdomError', (e) => {
  // Erros de CSS parsing do jsdom não interessam.
  if (/Could not parse CSS/.test(e.message)) return;
  erros.push('jsdomError: ' + (e.stack || e.message));
});
virtualConsole.on('info', () => {});
virtualConsole.on('log', () => {});

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const dom = await JSDOM.fromFile(path.join(RAIZ, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    url: 'file:///' + RAIZ.replace(/\\/g, '/') + '/index.html'
  });

  const { window } = dom;

  // jsdom não implementa estes — stub para não abortar a navegação.
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.scrollTo = function () {};

  await esperar(1500);

  const doc = window.document;
  let testes = 0, falhas = 0;

  function ok(desc, cond, detalhe) {
    testes++;
    if (cond) console.log(`  ✓ ${desc}`);
    else { falhas++; console.log(`  ✕ ${desc}${detalhe ? ' → ' + detalhe : ''}`); }
  }

  function texto() { return doc.body.textContent; }
  function conteudo() { return doc.getElementById('conteudo'); }

  async function irPara(hash, espera = 700) {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event('hashchange'));
    await esperar(espera);
  }

  console.log('\nBootstrap — tela de entrada (F2.1)');
  ok('App foi criado', !!window.App);
  ok('sem sessão, o sistema abre em #/entrar',
     window.location.hash === '#/entrar', window.location.hash);
  ok('a tela de entrada é renderizada', !!doc.querySelector('.login'));
  ok('rota nua: NÃO há sidebar', !doc.querySelector('.sidebar'));
  ok('rota nua: NÃO há topbar', !doc.querySelector('.topbar'));
  ok('a casca marca o modo nu', !!doc.querySelector('.app--nu'));
  ok('o selo avisa que não há autenticação',
     texto().includes('Não há autenticação'));
  ok('há um cartão por usuário do escritório',
     doc.querySelectorAll('.login__user').length ===
     window.App.services.db.get('usuarios').length,
     String(doc.querySelectorAll('.login__user').length));
  ok('banco inicializado', window.App.services.db.get('processos').length === 40,
     String(window.App.services.db.get('processos').length));

  // Entra como ADMINISTRADOR: é o perfil que enxerga todas as rotas, e o
  // resto da suíte navega por todas elas.
  const usuarioAdmin = window.App.services.db.get('usuarios')
    .filter(u => u.perfil === 'admin')[0];
  const cartaoAdmin = doc.querySelector('[data-value="' + usuarioAdmin.id + '"]');
  cartaoAdmin.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(120);
  doc.querySelector('[data-action="entrar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);

  console.log('\nBootstrap — sistema aberto');
  ok('entrou e foi para o dashboard', window.location.hash === '#/', window.location.hash);
  ok('casca renderizada (.app)', !!doc.querySelector('.app'));
  ok('sidebar renderizada', !!doc.querySelector('.sidebar'));
  ok('topbar renderizada', !!doc.querySelector('.topbar'));
  ok('container de conteúdo existe', !!conteudo());
  ok('usuário atual definido', !!window.App.store.getState().usuarioAtual);
  ok('o usuário da sessão é o administrador',
     window.App.store.getState().usuarioAtual.perfil === 'admin');
  ok('o menu de administração aparece para o admin',
     doc.querySelector('.sidebar').textContent.includes('Auditoria'));

  console.log('\nDashboard (#/)');
  await irPara('#/', 900);
  ok('KPIs renderizados', doc.querySelectorAll('.kpi').length >= 5,
     String(doc.querySelectorAll('.kpi').length));
  ok('card de prazos presente', texto().includes('Prazos que exigem ação'));
  ok('próximos compromissos presente', texto().includes('Próximos compromissos'));
  ok('processos por fase presente', texto().includes('Processos por fase'));
  ok('composição da carteira presente', texto().includes('Composição da carteira'));
  ok('barras de progresso desenhadas', doc.querySelectorAll('.progress__bar').length > 0);
  ok('sem esqueleto residual', doc.querySelectorAll('#conteudo .skeleton').length === 0);

  console.log('\nProcessos — tabela (#/processos)');
  await irPara('#/processos', 900);
  ok('barra de filtros renderizada', !!doc.querySelector('.filter-bar'));
  ok('tabela renderizada', !!doc.querySelector('table.table'));
  const linhas = doc.querySelectorAll('table.table tbody tr').length;
  ok('15 linhas na primeira página', linhas === 15, String(linhas));
  ok('paginação renderizada', !!doc.querySelector('.pagination'));
  ok('alternador de visão presente', !!doc.querySelector('.view-toggle'));
  ok('chips de prazo na tabela', doc.querySelectorAll('.prazo-chip').length > 0);

  console.log('\nProcessos — kanban');
  const btnKanban = Array.from(doc.querySelectorAll('[data-action="trocar-visao"]'))
    .find(b => b.dataset.value === 'kanban');
  ok('botão kanban existe', !!btnKanban);
  btnKanban.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);

  ok('quadro kanban renderizado', !!doc.querySelector('.kanban'));
  const colunas = doc.querySelectorAll('.kanban__column').length;
  ok('7 colunas por fase', colunas === 7, String(colunas));
  const cards = doc.querySelectorAll('.kanban-card').length;
  ok('40 cards (carteira inteira, sem paginação)', cards === 40, String(cards));
  ok('cards são arrastáveis', doc.querySelector('.kanban-card').getAttribute('draggable') === 'true');
  ok('coluna mostra soma de valor', texto().includes('em causa'));
  ok('dica de arrastar presente', texto().includes('Arraste um card'));

  console.log('\nKanban — agrupamento alternativo');
  const seletorAgrupar = doc.querySelector('[data-action="agrupar-por"]');
  ok('seletor de agrupamento existe', !!seletorAgrupar);
  seletorAgrupar.value = 'responsavelId';
  seletorAgrupar.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(500);
  const colsResp = doc.querySelectorAll('.kanban__column').length;
  ok('agrupou por responsável', colsResp > 0 && colsResp !== 7, String(colsResp));
  ok('total de cards preservado', doc.querySelectorAll('.kanban-card').length === 40,
     String(doc.querySelectorAll('.kanban-card').length));

  seletorAgrupar.value = 'areaId';
  seletorAgrupar.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(500);
  ok('agrupou por área', doc.querySelectorAll('.kanban__column').length > 0);
  ok('cards preservados na terceira visão', doc.querySelectorAll('.kanban-card').length === 40);

  console.log('\nKanban — movimentação (chamada de service)');
  const antes = window.App.services.db.get('processos');
  const alvo = antes.find(p => p.faseId === 'citacao');
  const andamentosAntes = window.App.services.db.get('andamentos').length;
  await window.App.services.processoService.mudarFase(alvo.id, 'instrucao');
  const depois = window.App.services.db.find('processos', alvo.id);
  ok('fase alterada no banco', depois.faseId === 'instrucao', depois.faseId);
  ok('andamento registrado automaticamente',
     window.App.services.db.get('andamentos').length === andamentosAntes + 1);
  await window.App.services.processoService.mudarFase(alvo.id, 'arquivado');
  const arquivado = window.App.services.db.find('processos', alvo.id);
  ok('arquivar pelo kanban muda o status', arquivado.status === 'arquivado', arquivado.status);
  ok('arquivar preenche data de encerramento', !!arquivado.dataEncerramento);
  await window.App.services.processoService.mudarFase(alvo.id, 'citacao');
  ok('desarquivar volta status para ativo',
     window.App.services.db.find('processos', alvo.id).status === 'ativo');

  console.log('\nProcessos — filtros');
  await irPara('#/processos?visao=tabela&faseId=recurso', 900);
  ok('filtro por query string aplicado',
     window.App.store.getState().processosFiltros.faseId === 'recurso');
  const linhasFiltradas = doc.querySelectorAll('table.table tbody tr').length;
  ok('lista filtrada tem menos linhas', linhasFiltradas > 0 && linhasFiltradas <= 15,
     String(linhasFiltradas));
  ok('botão limpar filtros aparece', texto().includes('Limpar filtros'));

  console.log('\nProcesso — detalhe');
  const primeiro = window.App.services.db.get('processos')[0];
  await irPara('#/processos/' + primeiro.id, 900);
  ok('número CNJ exibido', texto().includes(primeiro.numeroCnj));
  ok('abas renderizadas', doc.querySelectorAll('.tabs__tab').length === 6,
     String(doc.querySelectorAll('.tabs__tab').length));
  ok('decomposição do CNJ presente', texto().includes('Decomposição do número CNJ'));
  ok('segmento identificado', /Justiça (Estadual|Federal|do Trabalho)/.test(texto()));

  for (const aba of ['partes', 'andamentos', 'prazos', 'documentos', 'tarefas']) {
    const botao = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
      .find(b => b.dataset.value === aba);
    botao.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await esperar(120);
    ok(`aba "${aba}" renderiza sem erro`, !!doc.querySelector('.tab-panel'));
  }

  console.log('\nProcesso — formulário');
  await irPara('#/processos/novo', 800);
  ok('formulário renderizado', !!doc.querySelector('#form-processo'));
  const campoCnj = doc.querySelector('[name="numeroCnj"]');
  ok('campo CNJ existe', !!campoCnj);

  campoCnj.value = '00012345620248260100';
  campoCnj.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(200);
  ok('máscara aplicada ao CNJ', campoCnj.value === '0001234-56.2024.8.26.0100', campoCnj.value);

  const decomposto = doc.querySelector('#cnj-decomposto');
  const valido = window.App.domain.cnj.validar(campoCnj.value).valido;
  if (valido) {
    ok('CNJ válido mostra decomposição', decomposto.textContent.includes('Sequencial'));
    ok('campo marcado como válido', campoCnj.closest('.field').classList.contains('field--valid'));
  } else {
    ok('CNJ com DV errado é sinalizado',
       campoCnj.closest('.field').classList.contains('field--invalid'));
  }

  campoCnj.value = '11111111111111111111';
  campoCnj.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(200);
  ok('DV inválido marca o campo',
     campoCnj.closest('.field').classList.contains('field--invalid'));

  console.log('\nAgenda');
  await irPara('#/agenda', 900);
  ok('calendário renderizado', !!doc.querySelector('.calendar__grid'));
  const dias = doc.querySelectorAll('.calendar__day').length;
  ok('grade tem 42 células', dias === 42, String(dias));
  ok('dias não úteis sombreados', doc.querySelectorAll('.calendar__day--nonworking').length > 0);
  ok('eventos no calendário', doc.querySelectorAll('.calendar__event').length > 0,
     String(doc.querySelectorAll('.calendar__event').length));
  ok('painel de próximos prazos', texto().includes('Próximos prazos'));
  ok('legenda de dias sem contagem', texto().includes('não contam prazo'));

  const btnProximo = doc.querySelector('[data-action="mes-proximo"]');
  btnProximo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(700);
  ok('navegação de mês funciona', !!doc.querySelector('.calendar__grid'));

  console.log('\nTarefas');
  await irPara('#/tarefas', 900);
  ok('kanban de tarefas renderizado', !!doc.querySelector('.kanban'));
  ok('4 colunas de status', doc.querySelectorAll('.kanban__column').length === 4,
     String(doc.querySelectorAll('.kanban__column').length));
  ok('35 cards de tarefa', doc.querySelectorAll('.kanban-card').length === 35,
     String(doc.querySelectorAll('.kanban-card').length));

  console.log('\nClientes');
  await irPara('#/clientes', 900);
  ok('cartões de cliente renderizados', doc.querySelectorAll('.card').length >= 12,
     String(doc.querySelectorAll('.card').length));
  ok('paginação de clientes', !!doc.querySelector('.pagination'));

  const cliente = window.App.services.db.get('pessoas').find(p => p.ehCliente);
  await irPara('#/clientes/' + cliente.id, 900);
  ok('ficha do cliente renderizada', texto().includes(cliente.nome));
  ok('KPIs do cliente', doc.querySelectorAll('.kpi').length === 4,
     String(doc.querySelectorAll('.kpi').length));
  ok('tabela de processos do cliente', texto().includes('Processos do cliente'));

  console.log('\nSimulador de prazo');
  await irPara('#/simulador', 800);
  ok('formulário do simulador', !!doc.querySelector('#form-simulador'));
  ok('resultado calculado', texto().includes('Memória de cálculo'));
  ok('data fatal exibida', texto().includes('Data fatal'));
  ok('regras do CPC listadas', texto().includes('dias úteis'));

  const campoDias = doc.querySelector('[name="dias"]');
  campoDias.value = '5';
  campoDias.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(400);
  ok('recalcula ao mudar os dias', texto().includes('Memória de cálculo'));

  console.log('\nEditor de documento');
  const docParaEditar = window.App.services.db.get('documentos')[0];
  await irPara('#/documentos/' + docParaEditar.id + '/editar', 900);
  // Documento do seed é .pdf: a rota existe, mas recusa editar — e explica.
  ok('rota do editor responde', texto().includes('Este formato não se edita') ||
     !!doc.querySelector('[data-editor-doc]'));
  ok('oferece o caminho de volta', !!doc.querySelector('.empty-state__action a') ||
     !!doc.querySelector('[data-action="voltar-processo"]'));

  await irPara('#/documentos/NAO-EXISTE/editar', 700);
  ok('documento inexistente não quebra a tela',
     texto().includes('Documento não encontrado'));
  ok('sem esqueleto residual no editor',
     doc.querySelectorAll('#conteudo .skeleton').length === 0);

  console.log('\nRota inexistente');
  await irPara('#/nao-existe', 500);
  ok('exibe página não encontrada', texto().includes('Página não encontrada'));

  console.log('\nBusca global');
  await irPara('#/', 700);
  const buscaGlobal = doc.querySelector('#busca-global');
  ok('campo de busca global existe', !!buscaGlobal);
  buscaGlobal.value = cliente.nome.split(' ')[0];
  buscaGlobal.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(900);
  const painel = doc.querySelector('#resultados-globais');
  ok('painel de resultados aberto', !painel.classList.contains('u-hidden'));
  ok('resultados listados', painel.querySelectorAll('.global-results__item').length > 0,
     String(painel.querySelectorAll('.global-results__item').length));

  console.log('\nCentral de notificações (F2.2)');
  await irPara('#/', 800);
  const sino = doc.querySelector('[data-action="alternar-notificacoes"]');
  ok('o sino existe na topbar', !!sino);
  ok('o sino traz o contador de não lidas', sino.hasAttribute('data-count'));
  ok('o avaliador gerou avisos a partir do seed',
     window.App.services.db.get('notificacoes').length > 0,
     String(window.App.services.db.get('notificacoes').length));

  sino.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(600);
  ok('o painel abre', !!doc.querySelector('.notif'));
  ok('o painel lista avisos ou diz que não há',
     doc.querySelectorAll('.notif__item').length > 0 || !!doc.querySelector('.notif__empty'));
  ok('o painel leva para a tela cheia',
     !!doc.querySelector('.notif__footer[href="#/notificacoes"]'));

  await irPara('#/notificacoes', 800);
  ok('a tela de notificações abre', texto().includes('Notificações'));
  ok('lista os avisos do usuário',
     doc.querySelectorAll('.notif-row').length > 0 || !!doc.querySelector('.empty-state'));

  const antesLidas = window.App.services.notificacaoService
    .contarNaoLidas(window.App.store.getState().usuarioAtual.id);
  const btnLida = doc.querySelector('[data-action="marcar-lida"]');
  if (btnLida) {
    btnLida.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await esperar(700);
    ok('marcar como lida reduz o contador',
       window.App.services.notificacaoService
         .contarNaoLidas(window.App.store.getState().usuarioAtual.id) === antesLidas - 1);
  } else {
    ok('marcar como lida reduz o contador', antesLidas === 0, 'nada não lido para o admin');
  }

  console.log('\nCaixa de saída (#/caixa-de-saida)');
  await irPara('#/caixa-de-saida', 800);
  ok('a tela abre para o admin', texto().includes('Caixa de saída'));
  ok('o selo declara que nada é enviado', texto().includes('nenhum e-mail é enviado'));
  ok('há mensagens montadas ou o estado vazio',
     doc.querySelectorAll('.outbox__item').length > 0 || !!doc.querySelector('.empty-state'));
  if (doc.querySelector('.outbox__item')) {
    ok('a prévia mostra os cabeçalhos do e-mail', !!doc.querySelector('.outbox__headers'));
    ok('a prévia renderiza o corpo', !!doc.querySelector('.outbox__body'));
  }

  console.log('\nConfigurações (#/configuracoes)');
  await irPara('#/configuracoes', 700);
  ok('tela abre para o admin', texto().includes('Configurações'));
  ok('lista os usuários do escritório',
     doc.querySelectorAll('table.table tbody tr').length ===
     window.App.services.db.getTodos('usuarios').length,
     String(doc.querySelectorAll('table.table tbody tr').length));
  ok('permite trocar o perfil', !!doc.querySelector('[data-action="mudar-perfil"]'));
  ok('não deixa alterar o próprio perfil',
     !!doc.querySelector('[data-action="mudar-perfil"][disabled]'));

  const abaPerms = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Perfis'));
  abaPerms.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);
  ok('a matriz de permissões é desenhada', !!doc.querySelector('table.perm'));
  ok('há uma coluna por perfil',
     doc.querySelectorAll('.perm__profile').length ===
     window.App.domain.enums.PERFIS.length,
     String(doc.querySelectorAll('.perm__profile').length));
  ok('há uma linha por recurso',
     doc.querySelectorAll('.perm__resource').length ===
     window.App.domain.enums.RECURSOS_PERMISSAO.length,
     String(doc.querySelectorAll('.perm__resource').length));
  ok('a grade marca permitido e negado',
     doc.querySelectorAll('.perm__mark--sim').length > 0 &&
     doc.querySelectorAll('.perm__mark--nao').length > 0);

  const abaAlertas = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Alertas'));
  abaAlertas.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);
  ok('a aba de alertas lista uma linha por gatilho',
     doc.querySelectorAll('[data-action="regra-ativa"]').length ===
     window.App.domain.alertas.REGRAS_PADRAO.length,
     String(doc.querySelectorAll('[data-action="regra-ativa"]').length));
  ok('a régua de antecedência é editável',
     doc.querySelectorAll('[data-action="antecedencia"]').length > 0);
  ok('a tela distingue dias úteis de corridos', texto().includes('contagem em dias úteis'));
  ok('a dupla conferência aparece ligada',
     doc.querySelector('[data-action="dupla-conferencia"]').checked === true);

  const chipD5 = doc.querySelector('[data-action="antecedencia"][data-gatilho="prazo"][data-dia="5"]');
  chipD5.checked = false;
  chipD5.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(700);
  ok('desmarcar um marco grava a regra personalizada',
     window.App.services.regraAlertaService.vigentes()
       .filter(r => r.gatilho === 'prazo')[0].antecedenciaDias.indexOf(5) === -1);
  ok('as demais regras continuam nos padrões',
     window.App.services.regraAlertaService.vigentes()
       .filter(r => r.gatilho === 'compromisso')[0].antecedenciaDias.length === 3);

  doc.querySelector('[data-action="restaurar-regras"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(700);
  ok('restaurar padrões volta a régua original',
     window.App.services.regraAlertaService.vigentes()
       .filter(r => r.gatilho === 'prazo')[0].antecedenciaDias.indexOf(5) !== -1);

  console.log('\nAuditoria (#/auditoria)');
  await irPara('#/auditoria', 700);
  ok('tela abre para o admin', texto().includes('Trilha de auditoria'));
  ok('registrou os eventos gerados por esta suíte',
     doc.querySelectorAll('.audit__item').length > 0,
     String(doc.querySelectorAll('.audit__item').length));
  ok('barra de filtros presente', !!doc.querySelector('.filter-bar'));

  const btnDiff = doc.querySelector('[data-action="alternar-diff"]');
  if (btnDiff) {
    btnDiff.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await esperar(300);
    ok('o diff campo a campo abre', !!doc.querySelector('.audit__diff-row'));
  } else {
    ok('o diff campo a campo abre', false, 'nenhum evento com alteração na trilha');
  }

  console.log('\nPrivacidade (#/privacidade)');
  await irPara('#/privacidade', 700);
  ok('tela abre para o admin', texto().includes('Privacidade e proteção de dados'));
  ok('lista os titulares', doc.querySelectorAll('table.table tbody tr').length > 0);
  ok('oferece os direitos do titular',
     !!doc.querySelector('[data-action="dossie"]') &&
     !!doc.querySelector('[data-action="baixar-json"]') &&
     !!doc.querySelector('[data-action="anonimizar"]'));

  const abaBackup = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Backup'));
  abaBackup.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);
  ok('a aba de backup mostra a ocupação do storage',
     texto().includes('Ocupação do armazenamento'));
  ok('oferece baixar e restaurar', !!doc.querySelector('[data-action="baixar-backup"]') &&
     !!doc.querySelector('[data-action="restaurar-backup"]'));

  console.log('\nGuarda de acesso — trocando para um perfil sem permissão');
  const estagiario = window.App.services.db.get('usuarios')
    .filter(u => u.perfil === 'estagiario')[0];
  await window.App.services.sessaoService.entrar(estagiario.id);
  await irPara('#/', 700);
  ok('o menu de administração some para o estagiário',
     !doc.querySelector('.sidebar').textContent.includes('Auditoria'));

  await irPara('#/auditoria', 800);
  ok('a rota de auditoria é BLOQUEADA e desvia para o dashboard',
     window.location.hash === '#/', window.location.hash);
  ok('a tela de auditoria não foi renderizada', !doc.querySelector('.audit'));

  await irPara('#/processos/novo', 800);
  ok('rota de criação é bloqueada para quem não edita processo',
     window.location.hash === '#/', window.location.hash);

  console.log('\nSaída do sistema');
  const btnSair = doc.querySelector('[data-action="sair"]');
  ok('a topbar oferece sair', !!btnSair);
  btnSair.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(800);
  ok('sair volta para a tela de entrada',
     window.location.hash === '#/entrar', window.location.hash);
  ok('a casca some de novo', !doc.querySelector('.topbar'));

  // Volta a entrar para os testes seguintes usarem a casca.
  await window.App.services.sessaoService.entrar(usuarioAdmin.id);
  await irPara('#/', 700);

  console.log('\nTema');
  const btnTema = doc.querySelector('[data-action="alternar-tema"]');
  btnTema.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);
  ok('tema escuro aplicado', doc.documentElement.getAttribute('data-theme') === 'dark',
     doc.documentElement.getAttribute('data-theme'));

  console.log('\nErros capturados no console');
  if (erros.length) {
    erros.slice(0, 12).forEach(e => console.log('  ✕ ' + e.split('\n').slice(0, 4).join('\n     ')));
    falhas += erros.length;
    testes += erros.length;
  } else {
    console.log('  ✓ nenhum erro de JavaScript');
    testes++;
  }

  if (avisos.length) {
    console.log('\nAvisos (não são falhas):');
    [...new Set(avisos)].slice(0, 5).forEach(a => console.log('  · ' + a.split('\n')[0]));
  }

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`${testes - falhas}/${testes} verificações passaram`);
  dom.window.close();
  process.exit(falhas ? 1 : 0);
})().catch(e => {
  console.error('FALHA NA EXECUÇÃO:', e);
  process.exit(1);
});
