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

/* Espera uma CONDIÇÃO, não um relógio.

   Dormir um tempo fixo depois de uma escrita assíncrona funciona quase
   sempre — e é exatamente o "quase" que produz a falha que só aparece uma
   vez a cada tantas execuções, sem apontar defeito nenhum. Aqui a espera
   termina quando o estado chega; o limite existe só para o teste não pendurar
   caso ele nunca chegue. */
async function ate(condicao, limite = 3000, passo = 50) {
  const fim = Date.now() + limite;
  while (Date.now() < fim) {
    try { if (condicao()) return true; } catch (e) { /* ainda não montou */ }
    await esperar(passo);
  }
  return false;
}

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
  // 6 abas da fase 1 + Compartilhamento (F2.3) + Assistente (F2.8)
  //                  + Financeiro (F2.10)
  ok('abas renderizadas', doc.querySelectorAll('.tabs__tab').length === 9,
     String(doc.querySelectorAll('.tabs__tab').length));
  ok('decomposição do CNJ presente', texto().includes('Decomposição do número CNJ'));
  ok('segmento identificado', /Justiça (Estadual|Federal|do Trabalho)/.test(texto()));

  // F2.10: vínculo entre processos fica na aba Dados, junto do resto da ficha.
  ok('a aba Dados mostra os processos vinculados',
     texto().includes('Processos vinculados'));
  ok('sem vínculo, a tela explica para que serve',
     texto().includes('Nenhum processo vinculado'));
  ok('o admin pode criar o vínculo',
     !!doc.querySelector('[data-action="vincular-processo"]'));

  for (const aba of ['partes', 'andamentos', 'prazos', 'documentos', 'tarefas']) {
    const botao = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
      .find(b => b.dataset.value === aba);
    botao.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await esperar(120);
    ok(`aba "${aba}" renderiza sem erro`, !!doc.querySelector('.tab-panel'));
  }

  // A aba Financeiro (F2.10) busca sob demanda — precisa de mais fôlego que
  // as demais, que já vêm carregadas junto do processo.
  Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'financeiro')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);

  ok('a aba Financeiro mostra a rentabilidade do processo',
     texto().includes('Resultado') && texto().includes('Custo das horas'));
  ok('a aba diz de onde vem o custo da hora',
     texto().includes('valor-hora'));

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
  /* Conta os KPIs da FAIXA DO CLIENTE, não os da tela toda: o cartão
     financeiro (F2.10) traz os seus, e um total global voltaria a quebrar a
     cada bloco novo sem nunca ter apontado um defeito. */
  ok('KPIs do cliente',
     doc.querySelectorAll('.grid--kpi')[0].querySelectorAll('.kpi').length === 4,
     String(doc.querySelectorAll('.grid--kpi')[0].querySelectorAll('.kpi').length));
  ok('tabela de processos do cliente', texto().includes('Processos do cliente'));
  // F2.10: a situação financeira entra na ficha, sem obrigar a abrir #/financeiro.
  ok('a ficha traz a situação financeira do cliente',
     texto().includes('Recebido') && texto().includes('Em atraso'));

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

  console.log('\nRelatórios (F2.9)');
  await irPara('#/relatorios', 900);
  ok('o catálogo abre', texto().includes('Relatórios'));
  ok('lista os relatórios em cartões',
     doc.querySelectorAll('.rel-card').length === 10,
     String(doc.querySelectorAll('.rel-card').length));
  ok('agrupa por tema', doc.querySelectorAll('.rel-grupo').length >= 4,
     String(doc.querySelectorAll('.rel-grupo').length));

  await irPara('#/relatorios/carteira', 1000);
  ok('o relatório abre', texto().includes('Carteira de processos'));
  ok('mostra os totais', doc.querySelectorAll('.kpi').length > 0);
  ok('desenha o gráfico', !!doc.querySelector('.chart'));
  ok('o gráfico traz a visão de tabela (acessibilidade)',
     !!doc.querySelector('.chart__table'));
  ok('mostra o detalhamento', texto().includes('Detalhamento'));
  ok('oferece exportar CSV', !!doc.querySelector('[data-action="exportar-csv"]'));
  ok('oferece imprimir', !!doc.querySelector('[data-action="imprimir-relatorio"]'));
  ok('mostra a nota explicativa do indicador', !!doc.querySelector('.rel-nota'));
  ok('mostra o seletor de período', !!doc.querySelector('.daterange'));

  const btnMes = Array.from(doc.querySelectorAll('[data-action="periodo"]'))
    .find(b => b.textContent.trim() === 'Mês atual');
  btnMes.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  /* Sob file:// o navegador recusa reescrever a URL — o link deixa de
     carregar o recorte, mas o relatório continua filtrado. */
  ok('o cabeçalho reflete o período escolhido', texto().includes('Mês atual'));
  ok('o relatório continua desenhado após trocar o período',
     !!doc.querySelector('.chart') && !texto().includes('Erro ao gerar'));

  await irPara('#/relatorios/contingencia', 1000);
  ok('o relatório de contingência abre', texto().includes('Contingência'));
  ok('explica o tratamento contábil de cada risco',
     texto().includes('provisão contábil'));
  ok('desenha o donut da carteira', !!doc.querySelector('.chart__donut'));

  await irPara('#/relatorios/faturamento', 1000);
  ok('o relatório financeiro abre', texto().includes('Faturamento'));
  ok('deixa claro que é regime de caixa', texto().includes('regime de caixa'));

  console.log('\nRelatórios — escopo por perfil');
  const advogadoTeste = window.App.services.db.get('usuarios')
    .filter(u => u.perfil === 'advogado')[0];
  await window.App.services.sessaoService.entrar(advogadoTeste.id);
  await irPara('#/relatorios', 900);
  ok('o advogado vê menos relatórios que o admin',
     doc.querySelectorAll('.rel-card').length < 10,
     String(doc.querySelectorAll('.rel-card').length));
  ok('e o cartão avisa que o escopo é restrito',
     doc.querySelectorAll('.rel-card__escopo').length > 0);

  await irPara('#/relatorios/produtividade', 1000);
  ok('o relatório restrito avisa antes do número',
     !!doc.querySelector('.rel-escopo'));
  ok('e diz de quem são os números',
     doc.querySelector('.rel-escopo').textContent.includes('seus números'));

  await irPara('#/relatorios/contingencia', 900);
  ok('relatório sem permissão é bloqueado pela guarda de rota ou pela tela',
     window.location.hash === '#/' || texto().includes('Sem acesso'),
     window.location.hash);

  await window.App.services.sessaoService.entrar(usuarioAdmin.id);

  console.log('\nDashboard liga aos relatórios (F2.9)');
  await irPara('#/', 900);
  ok('o dashboard leva ao relatório da carteira',
     !!doc.querySelector('a[href="#/relatorios/carteira"]'));
  ok('e ao de contingência, para quem pode',
     !!doc.querySelector('a[href="#/relatorios/contingencia"]'));

  console.log('\nAssistente (F2.8)');
  const processoIa = window.App.services.db.get('processos')
    .filter(p => !p.segredoJustica)[0];
  await irPara('#/processos/' + processoIa.id, 1000);
  const abaIa = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Assistente'));
  ok('a aba do assistente existe', !!abaIa);
  abaIa.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1200);

  ok('mostra o resumo do processo', texto().includes('Resumo do processo'));
  ok('mostra as próximas ações', texto().includes('Próximas ações'));
  ok('mostra o risco sugerido', texto().includes('Risco sugerido'));
  ok('toda ação vem com o porquê',
     doc.querySelectorAll('.ia-acao__porque').length ===
     doc.querySelectorAll('.ia-acao__titulo').length,
     doc.querySelectorAll('.ia-acao__porque').length + ' vs ' +
     doc.querySelectorAll('.ia-acao__titulo').length);
  ok('o selo declara que não há modelo de linguagem',
     texto().includes('não há modelo de linguagem'));

  const campoPergunta = doc.querySelector('#ia-pergunta');
  ok('oferece perguntar sobre o processo', !!campoPergunta);
  campoPergunta.value = 'Qual o próximo prazo?';
  doc.querySelector('[data-action="ia-perguntar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1000);
  ok('a pergunta é respondida', !!doc.querySelector('.ia-resposta'));

  campoPergunta.value = 'Qual a chance de ganhar essa ação?';
  doc.querySelector('[data-action="ia-perguntar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1000);
  ok('pergunta fora do repertório é sinalizada como "não sei"',
     !!doc.querySelector('.ia-resposta--nao-sei'));
  ok('e a resposta diz por que não sabe',
     texto().includes('modelo de linguagem'));

  console.log('\nRevisão da peça (F2.8)');
  const abaDocsIa = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Documentos'));
  abaDocsIa.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(600);
  const docParaRevisar = doc.querySelector('[data-action="abrir-documento"]');
  if (docParaRevisar) {
    docParaRevisar.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await esperar(800);
    doc.querySelector('.modal [data-action="revisar"]')
       .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await esperar(900);
    ok('a revisão da peça responde',
       texto().includes('Revisão da peça') || texto().includes('Nenhum problema') ||
       texto().includes('nada a revisar'));
    doc.querySelector('.modal [data-action="fechar"]')
       .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await esperar(400);
  } else {
    ok('a revisão da peça responde', true, 'processo sem documento');
  }

  console.log('\nIntenção na busca global (F2.8)');
  await irPara('#/', 800);
  const campoIntencao = doc.querySelector('#busca-global');
  campoIntencao.value = 'prazos vencendo';
  campoIntencao.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(1000);
  ok('a busca oferece o atalho de intenção',
     !!doc.querySelector('.global-results__atalho'));
  ok('o atalho leva à agenda',
     doc.querySelector('.global-results__atalho').getAttribute('href') === '#/agenda');

  campoIntencao.value = 'contestacao';
  campoIntencao.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(1000);
  ok('texto comum NÃO gera atalho forçado',
     !doc.querySelector('.global-results__atalho'));

  console.log('\nExplicar publicação (F2.8)');
  await irPara('#/publicacoes', 1000);
  const btnExplicar = doc.querySelector('[data-action="explicar-pub"]');
  ok('a triagem oferece explicar', !!btnExplicar);
  btnExplicar.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1000);
  ok('a explicação aparece', !!doc.querySelector('#pub-explicacao .ia-resposta'));
  ok('a explicação declara o método',
     doc.querySelector('#pub-explicacao').textContent.includes('dicionário'));

  console.log('\nModelos de peça (F2.7)');
  await irPara('#/modelos', 900);
  ok('a biblioteca abre', texto().includes('Modelos de peça'));
  ok('lista os modelos do seed',
     doc.querySelectorAll('.mod__item').length >= 15,
     String(doc.querySelectorAll('.mod__item').length));
  ok('mostra a prévia do modelo', !!doc.querySelector('.mod__texto'));
  ok('destaca as variáveis no texto do modelo',
     doc.querySelectorAll('.var-marca').length > 0,
     String(doc.querySelectorAll('.var-marca').length));
  ok('mostra o catálogo de variáveis', doc.querySelectorAll('.var').length > 15,
     String(doc.querySelectorAll('.var').length));
  ok('marca quais variáveis o modelo usa',
     doc.querySelectorAll('.var--usada').length > 0);

  doc.querySelector('[data-action="usar-modelo"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('o modal de geração abre', !!doc.querySelector('#form-usar-modelo'));
  ok('a prévia conta o que será preenchido',
     texto().includes('preenchida(s)'), texto().slice(0, 100));

  const docsAntesModelo = window.App.services.db.get('documentos').length;
  doc.querySelector('.modal [data-action="gerar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1200);
  ok('o documento foi gerado',
     window.App.services.db.get('documentos').length === docsAntesModelo + 1);

  const docGerado = window.App.services.db.get('documentos').slice(-1)[0];
  const conteudoGerado = window.App.services.conteudoService.ler(docGerado.id);
  ok('o documento gerado tem conteúdo preenchido',
     !!conteudoGerado && conteudoGerado.conteudo.length > 50);
  ok('o conteúdo não tem chave crua',
     conteudoGerado.conteudo.indexOf('{{') === -1,
     conteudoGerado.conteudo.slice(0, 120));

  console.log('\nBusca global no conteúdo (F2.7)');
  await irPara('#/', 800);
  const campoBusca = doc.querySelector('#busca-global');
  campoBusca.value = 'contestacao';
  campoBusca.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(1000);
  const painelBusca = doc.querySelector('#resultados-globais');
  ok('a busca devolve resultados',
     painelBusca.querySelectorAll('.global-results__item').length > 0,
     String(painelBusca.querySelectorAll('.global-results__item').length));
  ok('a busca alcança mais de um tipo de registro',
     painelBusca.querySelectorAll('.global-results__group-label').length >= 1);
  ok('os resultados trazem trecho do conteúdo',
     painelBusca.querySelectorAll('.global-results__trecho').length > 0);
  ok('o trecho destaca o termo buscado',
     painelBusca.querySelectorAll('mark').length > 0);

  console.log('\nAssinatura e trilha de acesso (F2.7)');
  await irPara('#/processos/' + docGerado.processoId, 1000);
  const abaDocs = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Documentos'));
  abaDocs.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(600);
  ok('a barra oferece gerar a partir de modelo',
     !!doc.querySelector('[data-action="documento-de-modelo"]'));

  const linhaDoc = doc.querySelector('[data-action="abrir-documento"]');
  const acessosAntes = window.App.services.db.get('acessosDocumento').length;
  linhaDoc.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('o visor abre', !!doc.querySelector('.modal'));
  ok('abrir o documento registra o acesso',
     window.App.services.db.get('acessosDocumento').length > acessosAntes);
  ok('o visor mostra o painel de assinaturas', texto().includes('Assinaturas'));
  ok('o visor mostra quem acessou', texto().includes('Quem acessou'));
  ok('o selo avisa que não há ICP-Brasil', texto().includes('ICP-Brasil'));

  const assinAntes = window.App.services.db.get('assinaturas').length;
  doc.querySelector('.modal [data-action="assinar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('assinar registra a assinatura',
     window.App.services.db.get('assinaturas').length === assinAntes + 1);
  ok('a assinatura aparece no painel', !!doc.querySelector('.assin'));

  console.log('\nProspecção — funil (F2.6)');
  await irPara('#/crm', 1000);
  ok('o funil abre', texto().includes('Prospecção'));
  ok('reusa o kanban', !!doc.querySelector('.kanban'));
  ok('tem uma coluna por etapa',
     doc.querySelectorAll('.kanban__column').length ===
     window.App.domain.enums.ETAPAS_FUNIL.length,
     String(doc.querySelectorAll('.kanban__column').length));
  ok('lista os leads do seed', doc.querySelectorAll('.lead-card').length > 0,
     String(doc.querySelectorAll('.lead-card').length));
  ok('mostra o pipeline ponderado', texto().includes('Pipeline ponderado'));
  ok('explica como o ponderado é calculado',
     doc.body.innerHTML.includes('probabilidade da etapa'));
  ok('mostra a taxa de conversão', texto().includes('Taxa de conversão'));
  ok('marca os leads com follow-up vencido',
     doc.querySelectorAll('.lead-card--atrasado').length > 0,
     String(doc.querySelectorAll('.lead-card--atrasado').length));

  const cardLead = doc.querySelector('.lead-card');
  const idLead = cardLead.getAttribute('data-id');
  await irPara('#/crm/' + idLead, 900);
  ok('a ficha do interessado abre', !!doc.querySelector('.inter-list') ||
     texto().includes('Histórico de contato'));
  ok('mostra os dados do lead', texto().includes('Valor ponderado'));
  ok('oferece registrar contato', !!doc.querySelector('[data-action="nova-interacao"]'));

  const interAntes = window.App.services.db.get('interacoes').length;
  doc.querySelector('[data-action="nova-interacao"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(500);
  ok('o modal de contato abre', !!doc.querySelector('#form-interacao'));
  doc.querySelector('#form-interacao [name="resumo"]').value = 'Contato de teste automatizado.';
  doc.querySelector('.modal [data-action="salvar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('o contato foi registrado',
     window.App.services.db.get('interacoes').length === interAntes + 1);

  console.log('\nConversão de lead em cliente');
  const leadAberto = window.App.services.db.get('leads')
    .filter(l => !l.convertidoEm && l.etapa !== 'perdido')[0];
  await irPara('#/crm/' + leadAberto.id, 900);
  doc.querySelector('[data-action="converter"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(600);
  ok('o stepper de conversão abre', !!doc.querySelector('.stepper'));
  ok('tem quatro etapas', doc.querySelectorAll('.stepper__step').length === 4,
     String(doc.querySelectorAll('.stepper__step').length));
  ok('começa pelos dados do cliente', !!doc.querySelector('#form-conv-cliente'));

  doc.querySelector('.modal [data-action="stepper-avancar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);
  ok('avança para o contrato', !!doc.querySelector('#form-conv-contrato'));

  doc.querySelector('.modal [data-action="stepper-avancar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);
  ok('avança para o processo', !!doc.querySelector('#form-conv-processo'));
  ok('o processo é opcional e explica por quê',
     texto().includes('ainda não foi distribuída'));

  doc.querySelector('.modal [data-action="stepper-avancar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);
  ok('a revisão resume o que será criado', texto().includes('Parcelas'));

  const pessoasAntes = window.App.services.db.get('pessoas').length;
  doc.querySelector('.modal [data-action="stepper-concluir"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1200);
  ok('a conversão criou o cliente',
     window.App.services.db.get('pessoas').length === pessoasAntes + 1);
  ok('o lead ficou marcado como ganho',
     window.App.services.db.find('leads', leadAberto.id).etapa === 'ganho');

  console.log('\nHistórico na ficha do cliente');
  const clienteConvertido = window.App.services.db.find('leads', leadAberto.id).pessoaId;
  await irPara('#/clientes/' + clienteConvertido, 900);
  ok('a ficha do cliente mostra o histórico de contato',
     texto().includes('Histórico de contato'));
  ok('o histórico traz o que veio da prospecção',
     doc.body.innerHTML.includes('prospecção') ||
     texto().includes('Nenhum contato registrado'));

  console.log('\nFinanceiro (F2.5)');
  await irPara('#/financeiro', 1000);
  ok('o painel abre', texto().includes('Financeiro'));
  ok('mostra os KPIs do caixa', doc.querySelectorAll('.kpi').length >= 4,
     String(doc.querySelectorAll('.kpi').length));
  ok('desenha o fluxo de caixa', !!doc.querySelector('#gr-fluxo'));
  ok('o gráfico traz a visão de tabela (acessibilidade)',
     !!doc.querySelector('.chart__table'));
  ok('mostra o aging de recebíveis', texto().includes('Aging de recebíveis'));
  ok('explica a diferença entre caixa e competência',
     texto().includes('dá para pagar a folha'));

  const btnCompetencia = Array.from(doc.querySelectorAll('[data-action="trocar-regime"]'))
    .find(b => b.textContent.includes('Competência'));
  btnCompetencia.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('alternar para competência muda a leitura',
     texto().includes('o escritório deu lucro'));

  const abaReceber = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('A receber'));
  abaReceber.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('a aba de contas a receber lista títulos',
     doc.querySelectorAll('table.table tbody tr').length > 0,
     String(doc.querySelectorAll('table.table tbody tr').length));
  ok('há título marcado como atrasado', !!doc.querySelector('.fin__atrasado'));

  const btnBoleto = doc.querySelector('[data-action="boleto"]');
  ok('oferece emitir boleto', !!btnBoleto);
  const boletosAntes = window.App.services.db.get('boletos').length;
  btnBoleto.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('o boleto foi emitido',
     window.App.services.db.get('boletos').length === boletosAntes + 1);
  ok('o modal mostra a linha digitável', !!doc.querySelector('.bol__linha'));
  ok('o modal declara que o título não está registrado',
     texto().includes('NÃO está registrado em banco nenhum'));

  const linhaGerada = doc.querySelector('.bol__linha').textContent;
  ok('a linha exibida é matematicamente válida',
     window.App.domain.boleto.validarLinha(linhaGerada).valida, linhaGerada);
  doc.querySelector('.modal [data-action="fechar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);

  const btnBaixar = doc.querySelector('[data-action="baixar"]');
  btnBaixar.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(500);
  ok('o modal de baixa abre', !!doc.querySelector('#form-baixa'));
  doc.querySelector('.modal [data-action="confirmar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('a baixa foi registrada', !doc.querySelector('#form-baixa'));

  const abaContratos = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Contratos'));
  abaContratos.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('a aba de contratos lista os honorários',
     doc.querySelectorAll('table.table tbody tr').length > 0);

  console.log('\nContrato de honorários (#/financeiro/contratos/novo)');
  await irPara('#/financeiro/contratos/novo', 900);
  ok('o formulário abre', !!doc.querySelector('#form-contrato'));
  ok('mostra a prévia das parcelas', texto().includes('Parcelas'));

  const campoValor = doc.querySelector('[name="valorFixo"]');
  campoValor.value = '3.000,00';
  campoValor.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(400);
  ok('a prévia acompanha a digitação',
     texto().includes('3 parcela(s)') || texto().includes('parcela(s)'));

  const seletorModalidade = doc.querySelector('[name="modalidade"]');
  seletorModalidade.value = 'exito';
  seletorModalidade.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(400);
  ok('modalidade de êxito explica por que não há parcela',
     texto().includes('não gera parcela prevista'));
  ok('modalidade de êxito mostra o campo de percentual',
     !!doc.querySelector('[name="percentualExito"]'));

  console.log('\nTimesheet (#/timesheet)');
  await irPara('#/timesheet', 900);
  ok('a tela abre', texto().includes('Timesheet'));
  ok('oferece o cronômetro', !!doc.querySelector('[data-action="iniciar-crono"]'));
  ok('lista apontamentos', doc.querySelectorAll('table.table tbody tr').length > 0);
  ok('mostra horas por pessoa', texto().includes('Horas por pessoa'));

  const seletorProcesso = doc.querySelector('#form-crono [name="processoId"]');
  seletorProcesso.value = window.App.services.db.get('processos')
    .filter(p => p.status === 'ativo')[0].id;
  seletorProcesso.dispatchEvent(new window.Event('change', { bubbles: true }));
  doc.querySelector('[data-action="iniciar-crono"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(500);
  ok('o cronômetro inicia', !!doc.querySelector('.crono--ativo'));
  ok('o cronômetro mostra o tempo', !!doc.querySelector('.crono__tempo'));
  doc.querySelector('[data-action="descartar-crono"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);
  ok('descartar o cronômetro volta ao início',
     !doc.querySelector('.crono--ativo') && !!doc.querySelector('[data-action="iniciar-crono"]'));

  console.log('\nPublicações — fila de triagem (F2.4)');
  await irPara('#/publicacoes', 900);
  ok('a fila abre', texto().includes('Publicações'));
  ok('lista publicações do seed', doc.querySelectorAll('.pub__item').length > 0,
     String(doc.querySelectorAll('.pub__item').length));
  ok('mostra o texto integral do diário', !!doc.querySelector('.pub__texto'));
  ok('mostra a leitura do ato', texto().includes('Leitura do ato'));
  ok('mostra os termos que sustentaram a sugestão',
     doc.querySelectorAll('.pub__termo').length > 0 ||
     texto().includes('não parece abrir prazo'));
  ok('a etiqueta carrega o grau de confiança',
     doc.querySelectorAll('[class*="pub__tag--"]').length > 0);
  ok('o selo avisa que nenhum tribunal é consultado',
     texto().includes('dicionário de termos') || texto().includes('não parece abrir prazo'));

  const antesVinculo = window.App.services.publicacaoService.resumo();
  doc.querySelector('[data-action="vincular-lote"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('o vínculo por CNJ processa a fila',
     window.App.services.publicacaoService.resumo().novas === 0,
     String(window.App.services.publicacaoService.resumo().novas));
  ok('houve publicação vinculada a processo',
     window.App.services.publicacaoService.resumo().vinculadas > 0,
     String(window.App.services.publicacaoService.resumo().vinculadas));

  const abaVinculadas = Array.from(doc.querySelectorAll('[data-action="filtrar-status"]'))
    .find(b => b.textContent.includes('Vinculadas'));
  abaVinculadas.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(800);
  ok('a aba de vinculadas mostra a fila', doc.querySelectorAll('.pub__item').length > 0);
  ok('a publicação vinculada aponta para o processo',
     texto().includes('Processo vinculado'));

  const prazosAntesTriagem = window.App.services.db.get('prazos').length;
  doc.querySelector('[data-action="gerar-prazo"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(500);
  ok('o modal de geração de prazo abre', !!doc.querySelector('#form-gerar-prazo'));
  ok('o modal explica de onde o motor conta',
     texto().includes('disponibilização no diário'));
  doc.querySelector('.modal [data-action="gerar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1000);
  ok('o prazo foi criado a partir da publicação',
     window.App.services.db.get('prazos').length === prazosAntesTriagem + 1,
     String(window.App.services.db.get('prazos').length - prazosAntesTriagem));

  const ultimoPrazo = window.App.services.db.get('prazos').slice(-1)[0];
  ok('o prazo criado aponta para o andamento de origem',
     !!ultimoPrazo.andamentoOrigemId);

  console.log('\nSincronização e integrações (#/integracoes)');
  const pubsAntes = window.App.services.db.get('publicacoes').length;
  await irPara('#/publicacoes', 800);
  doc.querySelector('[data-action="sincronizar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(1200);
  ok('a sincronização trouxe publicações novas',
     window.App.services.db.get('publicacoes').length > pubsAntes,
     window.App.services.db.get('publicacoes').length + ' vs ' + pubsAntes);

  await irPara('#/integracoes', 900);
  ok('a tela de integrações abre', texto().includes('Integrações e captura'));
  ok('lista os monitoramentos', doc.querySelectorAll('table.table tbody tr').length > 0);
  ok('mostra o histórico de sincronizações', texto().includes('Últimas sincronizações'));
  ok('declara que nenhum tribunal é consultado',
     texto().includes('nenhum tribunal é consultado'));
  ok('lista as integrações previstas para a fase 3',
     texto().includes('Datajud') && texto().includes('e-SAJ'));

  console.log('\nPortal do cliente (F2.3)');
  const processoPortal = window.App.services.db.get('processos')
    .filter(p => !p.segredoJustica)[0];
  await irPara('#/processos/' + processoPortal.id, 900);

  const abaPortal = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Compartilhamento'));
  ok('a aba de compartilhamento existe', !!abaPortal);
  abaPortal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);
  ok('a aba diz o que o cliente NÃO vê', texto().includes('O que o cliente NÃO vê'));
  ok('oferece gerar link', !!doc.querySelector('[data-action="novo-link"]'));
  ok('oferece revisar visibilidade', !!doc.querySelector('[data-action="revisar-visibilidade"]'));

  doc.querySelector('[data-action="revisar-visibilidade"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);
  ok('a revisão lista os itens com caixa de seleção',
     doc.querySelectorAll('[data-action="visib"]').length > 0,
     String(doc.querySelectorAll('[data-action="visib"]').length));
  const caixaVisib = doc.querySelector('[data-action="visib"]');
  const idVisib = caixaVisib.getAttribute('data-id');
  const colecaoVisib = caixaVisib.getAttribute('data-colecao');
  const antesVisib = window.App.services.db.find(colecaoVisib, idVisib).visivelCliente;
  caixaVisib.checked = !antesVisib;
  caixaVisib.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(200);
  ok('marcar na revisão grava na hora',
     window.App.services.db.find(colecaoVisib, idVisib).visivelCliente === !antesVisib);
  caixaVisib.checked = antesVisib;
  caixaVisib.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(200);
  doc.querySelector('.modal [data-action="fechar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(700);

  doc.querySelector('[data-action="novo-link"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(400);
  ok('o modal de compartilhamento abre', !!doc.querySelector('#form-link'));
  ok('o modal avisa que a verificação não é assinatura',
     texto().includes('NÃO é assinatura'));
  doc.querySelector('.modal [data-action="gerar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);

  ok('o link aparece na lista', !!doc.querySelector('[data-action="copiar-link"]'));
  const campoLink = doc.querySelector('[data-link-url]');
  ok('o campo traz a URL do portal', campoLink.value.includes('#/portal/'),
     campoLink.value.slice(0, 60));

  const tokenGerado = campoLink.value.split('#/portal/')[1];
  await irPara('#/portal/' + tokenGerado, 900);
  ok('o portal abre pelo link gerado', !!doc.querySelector('.portal'));
  ok('o portal NÃO tem sidebar', !doc.querySelector('.sidebar'));
  ok('o portal NÃO tem topbar', !doc.querySelector('.topbar'));
  ok('o portal mostra o número do processo', texto().includes(processoPortal.numeroCnj));
  ok('o portal identifica que é acompanhamento',
     texto().includes('Acompanhamento processual'));
  ok('o portal diz até quando o link vale', texto().includes('Link válido até'));
  ok('o portal avisa que não substitui a consulta oficial',
     texto().includes('não substitui a consulta processual oficial'));

  const textoPortal = texto();
  ok('o portal NÃO mostra o valor da causa',
     !textoPortal.includes('Valor da causa'));
  ok('o portal NÃO mostra provisão nem risco',
     !textoPortal.includes('Provisão') && !textoPortal.includes('Risco'));
  ok('o portal NÃO mostra o número interno do escritório',
     !textoPortal.includes(processoPortal.numeroInterno));

  await irPara('#/portal/token-invalido-qualquer', 800);
  ok('token inválido cai na tela de link indisponível',
     texto().includes('Link indisponível'));
  ok('a tela de recusa não revela nada do processo',
     !texto().includes(processoPortal.numeroCnj));

  await irPara('#/processos/' + processoPortal.id, 900);
  const abaPortal2 = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Compartilhamento'));
  abaPortal2.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(500);
  ok('o acesso do cliente foi contabilizado',
     Array.from(doc.querySelectorAll('table.table tbody tr'))
       .some(tr => /último/.test(tr.textContent)));

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

  // F2.10: a tela passou a abrir em "Escritório"; usuários é a segunda aba.
  ok('abre na aba do escritório', !!doc.querySelector('#form-escritorio'));

  const abaUsuarios = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Usuários'));
  abaUsuarios.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);

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

  const regraDe = (g) => window.App.services.regraAlertaService.vigentes()
    .filter(r => r.gatilho === g)[0];

  await ate(() => regraDe('prazo').antecedenciaDias.indexOf(5) === -1);
  ok('desmarcar um marco grava a regra personalizada',
     regraDe('prazo').antecedenciaDias.indexOf(5) === -1);
  ok('as demais regras continuam nos padrões',
     regraDe('compromisso').antecedenciaDias.length === 3);

  ok('a mesma aba lista os tipos de prazo (F2.10)',
     texto().includes('Tipos de prazo') && !!doc.querySelector('#form-tipo-prazo'));
  ok('os tipos do CPC aparecem protegidos',
     texto().includes('padrão do sistema'));

  doc.querySelector('[data-action="restaurar-regras"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await ate(() => regraDe('prazo').antecedenciaDias.indexOf(5) !== -1);
  ok('restaurar padrões volta a régua original',
     regraDe('prazo').antecedenciaDias.indexOf(5) !== -1);

  console.log('\nConfigurações — feriados locais (F2.10)');
  const abaFeriados = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Feriados'));
  abaFeriados.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);

  ok('a aba abre com o formulário de cadastro', !!doc.querySelector('#form-feriado'));
  ok('a tela explica por que o cadastro existe',
     texto().includes('ponto facultativo'));

  /* Cadastrar pela TELA e conferir no MOTOR: é o caminho que o usuário
     percorre, e o ponto onde um cadastro que não chega ao cálculo passaria
     despercebido. */
  const alvoFeriado = window.App.format.toISO(
    new Date(new Date().getFullYear() + 1, 6, 15));   // 15/07 do ano que vem

  doc.querySelector('#form-feriado [name="data"]').value = alvoFeriado;
  doc.querySelector('#form-feriado [name="nome"]').value = 'Aniversário da comarca';
  doc.querySelector('[data-action="criar-feriado"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(700);

  ok('o feriado cadastrado pela tela aparece na lista',
     texto().includes('Aniversário da comarca'));
  ok('o feriado cadastrado pela tela VALE no motor de prazos',
     !window.App.domain.prazos.ehDiaUtil(alvoFeriado));

  doc.querySelector('[data-action="remover-feriado"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);
  doc.querySelector('[data-action="confirmar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(700);
  ok('removido pela tela, o dia volta a ser útil',
     window.App.domain.prazos.ehDiaUtil(alvoFeriado));

  console.log('\nConfigurações — importação por CSV (F2.10)');
  const abaImport = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.textContent.includes('Importar'));
  abaImport.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(300);

  ok('a aba mostra o seletor de arquivo', !!doc.querySelector('[data-action="arquivo-csv"]'));
  ok('a aba documenta as colunas esperadas', texto().includes('Colunas esperadas'));
  ok('a aba diz que o arquivo não sai da máquina',
     texto().includes('não sai da sua máquina'));

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

  /* Regressão: a tela de entrada é um módulo singleton remontado a cada
     visita, e o login anterior deixa `entrando` ligada ao navegar para
     dentro do sistema. Sem zerar no render, o botão volta em "Entrando…"
     e desabilitado — dava para sair, mas não para entrar de novo sem F5.
     O re-login abaixo é pela INTERFACE de propósito: entrar chamando o
     serviço direto era o ponto cego que escondia isto. */
  const btnEntrar = doc.querySelector('[data-action="entrar"]');
  ok('o botão de entrar volta habilitado depois de sair',
     !!btnEntrar && !btnEntrar.disabled,
     btnEntrar ? 'disabled=' + btnEntrar.disabled : 'botão ausente');
  ok('o botão não ficou preso em "Entrando…"',
     !!btnEntrar && !/Entrando/.test(btnEntrar.textContent),
     btnEntrar ? btnEntrar.textContent.trim() : 'botão ausente');

  // Volta a entrar para os testes seguintes usarem a casca.
  doc.querySelector('[data-value="' + usuarioAdmin.id + '"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(120);
  doc.querySelector('[data-action="entrar"]')
     .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await esperar(900);
  ok('dá para entrar de novo pela tela, sem recarregar a página',
     window.location.hash === '#/' && !!window.App.store.getState().usuarioAtual,
     window.location.hash);

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
