/* Interações: drag & drop no kanban, modais, criação de prazo/tarefa/cliente. */

const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const erros = [];

const virtualConsole = new VirtualConsole();
virtualConsole.on('error', (...a) => erros.push('console.error: ' + a.join(' ')));
virtualConsole.on('jsdomError', (e) => {
  if (/Could not parse CSS/.test(e.message)) return;
  erros.push('jsdomError: ' + (e.stack || e.message));
});
['warn', 'info', 'log', 'debug'].forEach(k => virtualConsole.on(k, () => {}));

const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromFile(path.join(RAIZ, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    virtualConsole,
    url: 'file:///' + RAIZ.replace(/\\/g, '/') + '/index.html'
  });

  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.scrollTo = function () {};
  await esperar(1500);

  const doc = window.document;
  const App = window.App;
  let testes = 0, falhas = 0;

  /* F2.1: sem sessão o sistema abre em #/entrar. Esta suíte testa interações
     de todas as telas, então entra como ADMINISTRADOR — o perfil que alcança
     todas as rotas. A guarda de acesso em si é verificada por telas.test.js e
     por seguranca.test.js. */
  const usuarioAdmin = App.services.db.get('usuarios').filter(u => u.perfil === 'admin')[0];
  await App.services.sessaoService.entrar(usuarioAdmin.id);
  window.location.hash = '#/';
  window.dispatchEvent(new window.Event('hashchange'));
  await esperar(700);

  function ok(d, c, det) {
    testes++;
    if (c) console.log(`  ✓ ${d}`);
    else { falhas++; console.log(`  ✕ ${d}${det ? ' → ' + det : ''}`); }
  }

  function clicar(el) {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function disparar(el, tipo) {
    const ev = new window.Event(tipo, { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev;
  }

  async function irPara(hash, ms = 800) {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event('hashchange'));
    await esperar(ms);
  }

  // ==================== DRAG & DROP — PROCESSOS ====================
  console.log('\nKanban de processos — drag & drop');
  App.store.setState({ processosVisao: 'kanban', processosAgruparPor: 'faseId' });
  await irPara('#/processos', 1000);

  ok('quadro renderizado', !!doc.querySelector('.kanban'));

  const colDistribuicao = doc.querySelector('.kanban__column[data-coluna="distribuicao"]');
  const colInstrucao = doc.querySelector('.kanban__column[data-coluna="instrucao"]');
  ok('coluna Distribuição existe', !!colDistribuicao);
  ok('coluna Instrução existe', !!colInstrucao);

  const card = colDistribuicao.querySelector('.kanban-card');
  ok('há card na coluna Distribuição', !!card);

  const processoId = card.dataset.id;
  const faseAntes = App.services.db.find('processos', processoId).faseId;
  ok('processo está em distribuicao', faseAntes === 'distribuicao', faseAntes);

  // dragstart no card
  disparar(card, 'dragstart');
  ok('card marcado como arrastando', card.classList.contains('kanban-card--dragging'));

  // dragover na coluna destino
  const zonaDestino = colInstrucao.querySelector('[data-dropzone]');
  const evOver = disparar(zonaDestino, 'dragover');
  ok('dragover é cancelado (permite drop)', evOver.defaultPrevented);
  ok('coluna destino recebe destaque', colInstrucao.classList.contains('kanban__column--dragover'));

  // drop
  disparar(zonaDestino, 'drop');
  await esperar(900);

  const faseDepois = App.services.db.find('processos', processoId).faseId;
  ok('fase alterada por drag & drop', faseDepois === 'instrucao', faseDepois);
  ok('toast de confirmação exibido', !!doc.querySelector('.toast'),
     String(doc.querySelectorAll('.toast').length));
  ok('destaque da coluna foi limpo',
     doc.querySelectorAll('.kanban__column--dragover').length === 0);

  const ultimoAndamento = App.services.db.get('andamentos')
    .filter(a => a.processoId === processoId)
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))[0];
  ok('andamento de mudança de fase registrado',
     ultimoAndamento.titulo.includes('Fase alterada'), ultimoAndamento.titulo);
  ok('andamento é nota interna', ultimoAndamento.tipo === 'nota_interna');
  ok('andamento não é visível ao cliente', ultimoAndamento.visivelCliente === false);

  // Drop na mesma coluna não deve gerar chamada
  const andamentosAntes = App.services.db.get('andamentos').length;
  const cardEmInstrucao = doc.querySelector('.kanban__column[data-coluna="instrucao"] .kanban-card');
  disparar(cardEmInstrucao, 'dragstart');
  disparar(doc.querySelector('.kanban__column[data-coluna="instrucao"] [data-dropzone]'), 'drop');
  await esperar(500);
  ok('drop na mesma coluna é ignorado',
     App.services.db.get('andamentos').length === andamentosAntes);

  // ==================== DRAG & DROP — TAREFAS ====================
  console.log('\nKanban de tarefas — drag & drop');
  await irPara('#/tarefas', 1000);

  const colAFazer = doc.querySelector('.kanban__column[data-coluna="a_fazer"]');
  const colConcluida = doc.querySelector('.kanban__column[data-coluna="concluida"]');
  ok('colunas de tarefa presentes', !!colAFazer && !!colConcluida);

  const cardTarefa = colAFazer.querySelector('.kanban-card');
  const tarefaId = cardTarefa.dataset.id;
  ok('tarefa está em a_fazer',
     App.services.db.find('tarefas', tarefaId).status === 'a_fazer');

  disparar(cardTarefa, 'dragstart');
  disparar(colConcluida.querySelector('[data-dropzone]'), 'dragover');
  disparar(colConcluida.querySelector('[data-dropzone]'), 'drop');
  await esperar(900);

  const tarefaDepois = App.services.db.find('tarefas', tarefaId);
  ok('status da tarefa alterado', tarefaDepois.status === 'concluida', tarefaDepois.status);
  ok('data de conclusão preenchida', !!tarefaDepois.concluidoEm);

  // ==================== MODAL — NOVA TAREFA ====================
  console.log('\nModal — nova tarefa');
  const totalTarefasAntes = App.services.db.get('tarefas').length;

  clicar(doc.querySelector('[data-action="nova-tarefa"]'));
  await esperar(300);

  ok('modal aberto', !!doc.querySelector('.modal-backdrop'));
  ok('formulário presente', !!doc.querySelector('#form-tarefa'));
  ok('scroll do body travado', doc.body.style.overflow === 'hidden');

  // Submeter vazio deve avisar e não criar
  const btnCriar = Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'salvar');
  clicar(btnCriar);
  await esperar(300);
  ok('validação impede criar sem título',
     App.services.db.get('tarefas').length === totalTarefasAntes);
  ok('modal continua aberto', !!doc.querySelector('.modal-backdrop'));

  doc.querySelector('#form-tarefa [name="titulo"]').value = 'Tarefa criada pelo teste';
  clicar(btnCriar);
  await esperar(800);

  ok('tarefa criada', App.services.db.get('tarefas').length === totalTarefasAntes + 1);
  ok('modal fechado após salvar', !doc.querySelector('.modal-backdrop'));
  ok('scroll do body liberado', doc.body.style.overflow === '');
  const criada = App.services.db.get('tarefas').find(t => t.titulo === 'Tarefa criada pelo teste');
  ok('tarefa nasce em a_fazer', criada && criada.status === 'a_fazer');

  // Fechar com Escape
  clicar(doc.querySelector('[data-action="nova-tarefa"]'));
  await esperar(300);
  ok('modal reaberto', !!doc.querySelector('.modal-backdrop'));
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await esperar(200);
  ok('Escape fecha o modal', !doc.querySelector('.modal-backdrop'));

  // ==================== MODAL — NOVO PRAZO (prévia ao vivo) ====================
  console.log('\nModal — novo prazo com prévia do cálculo');
  const proc = App.services.db.get('processos')[0];
  await irPara('#/processos/' + proc.id, 900);

  const prazosAntes = App.services.db.get('prazos').length;
  clicar(doc.querySelector('[data-action="novo-prazo"]'));
  await esperar(400);

  ok('modal de prazo aberto', !!doc.querySelector('#form-prazo'));
  const previa = doc.querySelector('#previa-prazo');
  ok('prévia calculada ao abrir', previa.textContent.includes('Memória de cálculo'));
  ok('prévia mostra data fatal', previa.textContent.includes('Data fatal'));
  ok('prévia cita o art. 224 §2º', previa.textContent.includes('224 §2'));

  // Trocar o tipo de prazo deve reajustar os dias
  const seletorTipo = doc.querySelector('#form-prazo [name="tipoPrazoId"]');
  seletorTipo.value = 'embargos';
  disparar(seletorTipo, 'change');
  await esperar(400);
  ok('tipo "embargos" ajusta para 5 dias',
     doc.querySelector('#form-prazo [name="quantidadeDias"]').value === '5',
     doc.querySelector('#form-prazo [name="quantidadeDias"]').value);
  ok('título é preenchido automaticamente',
     doc.querySelector('#form-prazo [name="titulo"]').value === 'Embargos de declaração',
     doc.querySelector('#form-prazo [name="titulo"]').value);

  const dataFatalPrevia = previa.textContent;
  const btnCriarPrazo = Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'salvar');
  clicar(btnCriarPrazo);
  await esperar(900);

  ok('prazo criado', App.services.db.get('prazos').length === prazosAntes + 1);
  const novoPrazo = App.services.db.get('prazos').slice(-1)[0];
  ok('datas calculadas pelo motor',
     !!novoPrazo.dataPublicacao && !!novoPrazo.dataInicioContagem && !!novoPrazo.dataFatal);
  ok('data fatal é dia contável', App.domain.prazos.ehDiaContavel(novoPrazo.dataFatal),
     novoPrazo.dataFatal);
  ok('prazo interno anterior à data fatal', novoPrazo.dataInterna < novoPrazo.dataFatal);
  ok('publicação após disponibilização',
     novoPrazo.dataPublicacao > novoPrazo.dataDisponibilizacao);

  // ==================== BAIXA DE PRAZO ====================
  console.log('\nBaixa de prazo');
  await irPara('#/processos/' + proc.id, 900);
  const abaPrazos = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'prazos');
  clicar(abaPrazos);
  await esperar(300);

  const btnBaixar = doc.querySelector('[data-action="cumprir-prazo"]');
  ok('botão de baixa presente', !!btnBaixar);
  const prazoId = btnBaixar.dataset.value;
  const andamentosAntesBaixa = App.services.db.get('andamentos').length;

  clicar(btnBaixar);
  await esperar(900);

  const prazoBaixado = App.services.db.find('prazos', prazoId);
  ok('status vira cumprido', prazoBaixado.status === 'cumprido', prazoBaixado.status);
  ok('data de cumprimento preenchida', !!prazoBaixado.dataCumprimento);
  ok('andamento de cumprimento registrado',
     App.services.db.get('andamentos').length === andamentosAntesBaixa + 1);

  // ==================== DOCUMENTOS — PASTAS E DRAG & DROP ====================
  console.log('\nDocumentos — pastas e drag & drop');

  const pastaService = App.services.pastaDocumentoService;
  ok('serviço de pastas registrado', !!pastaService);

  // Processo com pasta na raiz e documento — e um documento forçado para a
  // raiz, para o arrasto começar sempre do mesmo lugar.
  const todasPastas = App.services.db.get('pastasDocumento');
  ok('seed traz pastas de documentos', todasPastas.length > 0, String(todasPastas.length));

  const procComPasta = App.services.db.get('processos').find(p => {
    const raizes = todasPastas.filter(x => x.processoId === p.id && !x.paiId);
    const docs = App.services.db.get('documentos').filter(d => d.processoId === p.id);
    return raizes.length >= 1 && docs.length >= 1;
  });
  ok('há processo com pasta e documento', !!procComPasta);

  const pastaRaiz = todasPastas.find(x => x.processoId === procComPasta.id && !x.paiId);
  const docAlvo = App.services.db.get('documentos').find(d => d.processoId === procComPasta.id);
  App.services.db.update('documentos', docAlvo.id, { pastaId: null });

  await irPara('#/processos/' + procComPasta.id, 900);
  const abaDocs = Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos');
  clicar(abaDocs);
  await esperar(300);

  ok('explorador renderizado', !!doc.querySelector('[data-doc-explorer]'));
  ok('migalha raiz presente', !!doc.querySelector('.doc-crumbs__item'));
  ok('botão de nova pasta presente', !!doc.querySelector('[data-action="nova-pasta"]'));

  const linhaPasta = doc.querySelector('.doc-row--pasta[data-pasta-id="' + pastaRaiz.id + '"]');
  const linhaDoc = doc.querySelector('.doc-row--documento[data-documento-id="' + docAlvo.id + '"]');
  ok('pasta listada na raiz', !!linhaPasta);
  ok('documento listado na raiz', !!linhaDoc);
  ok('linhas são arrastáveis',
     linhaDoc.getAttribute('draggable') === 'true' && linhaPasta.getAttribute('draggable') === 'true');

  // Arrastar o documento para dentro da pasta
  disparar(linhaDoc, 'dragstart');
  ok('documento marcado como arrastando', linhaDoc.classList.contains('doc-row--dragging'));

  const evOverPasta = disparar(linhaPasta, 'dragover');
  ok('dragover na pasta é cancelado (permite drop)', evOverPasta.defaultPrevented);
  ok('pasta destacada como destino', linhaPasta.classList.contains('doc-row--dragover'));

  disparar(linhaPasta, 'drop');
  await esperar(900);

  ok('documento movido para a pasta',
     App.services.db.find('documentos', docAlvo.id).pastaId === pastaRaiz.id,
     String(App.services.db.find('documentos', docAlvo.id).pastaId));
  ok('destaque de destino foi limpo', doc.querySelectorAll('.doc-row--dragover').length === 0);
  ok('documento sai da raiz',
     !doc.querySelector('.doc-row--documento[data-documento-id="' + docAlvo.id + '"]'));

  // Entrar na pasta
  clicar(doc.querySelector('.doc-row--pasta[data-pasta-id="' + pastaRaiz.id + '"] [data-action="abrir-pasta"]'));
  await esperar(250);

  ok('navegou para dentro da pasta', doc.body.textContent.includes(pastaRaiz.nome));
  ok('linha de voltar aparece', !!doc.querySelector('.doc-row--up'));
  const linhaDocDentro = doc.querySelector('.doc-row--documento[data-documento-id="' + docAlvo.id + '"]');
  ok('documento aparece dentro da pasta', !!linhaDocDentro);

  // Arrastar de volta para a raiz pela linha "voltar"
  disparar(linhaDocDentro, 'dragstart');
  const linhaUp = doc.querySelector('.doc-row--up');
  disparar(linhaUp, 'dragover');
  disparar(linhaUp, 'drop');
  await esperar(900);

  ok('documento devolvido à raiz',
     App.services.db.find('documentos', docAlvo.id).pastaId === null,
     String(App.services.db.find('documentos', docAlvo.id).pastaId));

  // ---- Criar pasta pelo modal ----
  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  const pastasAntes = App.services.db.get('pastasDocumento').length;
  clicar(doc.querySelector('[data-action="nova-pasta"]'));
  await esperar(300);
  ok('modal de nova pasta aberto', !!doc.querySelector('#form-pasta'));

  const btnSalvarPasta = () => Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'salvar');

  clicar(btnSalvarPasta());
  await esperar(300);
  ok('nome vazio não cria pasta',
     App.services.db.get('pastasDocumento').length === pastasAntes);

  doc.querySelector('#form-pasta [name="nome"]').value = 'Pasta do teste';
  clicar(btnSalvarPasta());
  await esperar(900);

  ok('pasta criada', App.services.db.get('pastasDocumento').length === pastasAntes + 1,
     String(App.services.db.get('pastasDocumento').length - pastasAntes));
  ok('modal fechado após criar', !doc.querySelector('.modal-backdrop'));

  const pastaTeste = App.services.db.get('pastasDocumento')
    .find(p => p.processoId === procComPasta.id && p.nome === 'Pasta do teste');
  ok('pasta nasce na raiz do processo', !!pastaTeste && pastaTeste.paiId === null);
  ok('pasta aparece na lista',
     !!doc.querySelector('.doc-row--pasta[data-pasta-id="' + pastaTeste.id + '"]'));

  // Nome duplicado no mesmo nível é recusado
  clicar(doc.querySelector('[data-action="nova-pasta"]'));
  await esperar(300);
  doc.querySelector('#form-pasta [name="nome"]').value = 'pasta do TESTE';
  clicar(btnSalvarPasta());
  await esperar(700);
  ok('nome duplicado (sem caixa) é recusado',
     App.services.db.get('pastasDocumento').length === pastasAntes + 1,
     String(App.services.db.get('pastasDocumento').length - pastasAntes));
  ok('modal segue aberto após erro', !!doc.querySelector('.modal-backdrop'));
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await esperar(200);

  // ---- Renomear ----
  clicar(doc.querySelector('.doc-row--pasta[data-pasta-id="' + pastaTeste.id + '"] ' +
                           '[data-action="renomear-pasta"]'));
  await esperar(300);
  ok('modal de renomear aberto', !!doc.querySelector('#form-pasta'));
  ok('campo vem preenchido',
     doc.querySelector('#form-pasta [name="nome"]').value === 'Pasta do teste');

  doc.querySelector('#form-pasta [name="nome"]').value = 'Pasta renomeada';
  clicar(btnSalvarPasta());
  await esperar(900);
  ok('pasta renomeada',
     App.services.db.find('pastasDocumento', pastaTeste.id).nome === 'Pasta renomeada',
     App.services.db.find('pastasDocumento', pastaTeste.id).nome);

  // ---- Ciclo: mover a pasta para dentro da própria descendência ----
  const subPasta = await pastaService.criar({
    processoId: procComPasta.id, nome: 'Subpasta do teste', paiId: pastaTeste.id
  });
  const cicloBarrado = await pastaService.mover(pastaTeste.id, subPasta.id)
    .then(() => false).catch(() => true);
  ok('mover pasta para dentro da própria subpasta é barrado', cicloBarrado);
  ok('hierarquia intacta após tentativa',
     App.services.db.find('pastasDocumento', pastaTeste.id).paiId === null);

  // ---- Excluir: o conteúdo sobe um nível, nada se perde ----
  await pastaService.mover(subPasta.id, pastaTeste.id).catch(() => {});
  await App.services.documentoService.mover(docAlvo.id, subPasta.id);
  ok('documento guardado na subpasta',
     App.services.db.find('documentos', docAlvo.id).pastaId === subPasta.id);

  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);
  clicar(doc.querySelector('.doc-row--pasta[data-pasta-id="' + pastaTeste.id + '"] ' +
                           '[data-action="abrir-pasta"]'));
  await esperar(250);

  clicar(doc.querySelector('.doc-row--pasta[data-pasta-id="' + subPasta.id + '"] ' +
                           '[data-action="excluir-pasta"]'));
  await esperar(300);
  ok('confirmação de exclusão aberta', !!doc.querySelector('.modal-backdrop'));

  clicar(Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'confirmar'));
  await esperar(1000);

  ok('subpasta excluída (soft delete)',
     !App.services.db.find('pastasDocumento', subPasta.id));
  ok('registro da pasta permanece no banco',
     !!App.services.db.getTodos('pastasDocumento').find(p => p.id === subPasta.id));
  ok('documento NÃO foi perdido', !!App.services.db.find('documentos', docAlvo.id));
  ok('documento subiu para a pasta-mãe',
     App.services.db.find('documentos', docAlvo.id).pastaId === pastaTeste.id,
     String(App.services.db.find('documentos', docAlvo.id).pastaId));

  // ==================== ENVIO DE DOCUMENTOS (upload simulado) ====================
  console.log('\nDocumentos — envio simulado');

  const docService = App.services.documentoService;

  // Validação acontece ANTES de "subir" — não se espera a barra para falhar.
  const erroGrande = await docService.enviar({
    processoId: procComPasta.id,
    arquivos: [{ nome: 'gigante.pdf', tamanhoBytes: docService.LIMITE_UPLOAD_BYTES + 1 }]
  }).then(() => null).catch(e => e);
  ok('arquivo acima do limite é recusado', !!erroGrande && erroGrande.codigo === 413,
     erroGrande && String(erroGrande.codigo));
  ok('recusa nomeia o arquivo', !!erroGrande && erroGrande.message.includes('gigante.pdf'));

  const erroVazio = await docService.enviar({ processoId: procComPasta.id, arquivos: [] })
    .then(() => null).catch(e => e);
  ok('envio sem arquivo é recusado', !!erroVazio && erroVazio.codigo === 422);

  const erroPastaAlheia = await docService.enviar({
    processoId: procComPasta.id,
    pastaId: 'PST-INEXISTENTE',
    arquivos: [{ nome: 'x.pdf', tamanhoBytes: 10 }]
  }).then(() => null).catch(e => e);
  ok('pasta de destino inexistente é recusada', !!erroPastaAlheia && erroPastaAlheia.codigo === 404);

  // Progresso simulado
  const percentuais = [];
  await docService.enviar({
    processoId: procComPasta.id,
    arquivos: [{ nome: 'ata-de-audiencia.PDF', tamanhoBytes: 2048 }]
  }, p => percentuais.push(p));

  ok('progresso reportado em etapas', percentuais.length >= 3, String(percentuais.length));
  ok('progresso termina em 100', percentuais[percentuais.length - 1] === 100,
     String(percentuais[percentuais.length - 1]));
  ok('progresso é crescente', percentuais.every((v, i, a) => i === 0 || v > a[i - 1]),
     percentuais.join(','));

  const enviadoDireto = App.services.db.get('documentos')
    .find(d => d.nome === 'ata-de-audiencia.PDF');
  ok('documento criado pelo envio', !!enviadoDireto);
  ok('extensão normalizada em minúsculas', enviadoDireto.extensao === 'pdf',
     enviadoDireto.extensao);
  ok('nasce na raiz quando não há pasta', enviadoDireto.pastaId === null);

  // ---- Envio pelo modal ----
  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  ok('botão de envio na barra', !!doc.querySelector('[data-action="enviar-documentos"]'));
  clicar(doc.querySelector('[data-action="enviar-documentos"]'));
  await esperar(350);

  ok('modal de envio aberto', !!doc.querySelector('#form-envio'));
  const campoArquivos = doc.querySelector('#form-envio [name="arquivos"]');
  ok('campo de arquivo aceita múltiplos', campoArquivos.hasAttribute('multiple'));

  const arq1 = new window.File(['conteudo simulado'], 'contestacao-final.docx',
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const arq2 = new window.File(['png'], 'comprovante-de-pagamento.png', { type: 'image/png' });
  Object.defineProperty(campoArquivos, 'files', { value: [arq1, arq2], configurable: true });
  disparar(campoArquivos, 'change');
  await esperar(200);

  ok('prévia lista os 2 arquivos escolhidos',
     doc.querySelectorAll('.envio-lista__item').length === 2,
     String(doc.querySelectorAll('.envio-lista__item').length));
  ok('prévia mostra o nome do arquivo',
     doc.querySelector('#envio-lista').textContent.includes('contestacao-final.docx'));

  doc.querySelector('#form-envio [name="pastaId"]').value = pastaTeste.id;
  doc.querySelector('#form-envio [name="categoria"]').value = 'procuracao';
  doc.querySelector('#form-envio [name="visivelCliente"]').checked = true;

  const docsAntesEnvio = App.services.db.get('documentos').length;
  const btnEnviar = Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'salvar');
  clicar(btnEnviar);
  await esperar(150);

  ok('botão travado durante o envio', btnEnviar.disabled);
  ok('barra de progresso exibida', !!doc.querySelector('#envio-progresso .progress'));

  await esperar(1600);

  ok('2 documentos criados',
     App.services.db.get('documentos').length === docsAntesEnvio + 2,
     String(App.services.db.get('documentos').length - docsAntesEnvio));
  ok('modal fechado ao terminar', !doc.querySelector('.modal-backdrop'));

  const enviado = App.services.db.get('documentos').find(d => d.nome === 'contestacao-final.docx');
  ok('nome real do arquivo preservado', !!enviado);
  ok('extensão extraída do nome', enviado.extensao === 'docx', enviado.extensao);
  ok('tamanho real registrado', enviado.tamanhoBytes === arq1.size,
     `${enviado.tamanhoBytes} vs ${arq1.size}`);
  ok('tipo MIME registrado', !!enviado.tipoMime);
  ok('categoria escolhida aplicada', enviado.categoria === 'procuracao', enviado.categoria);
  ok('visibilidade ao cliente aplicada', enviado.visivelCliente === true);
  ok('pasta de destino do select aplicada', enviado.pastaId === pastaTeste.id,
     String(enviado.pastaId));
  ok('autor do envio é o usuário atual',
     enviado.uploadPorId === App.store.getState().usuarioAtual.id);
  ok('binário guardado na sessão', App.services.arquivoService.total() >= 2,
     String(App.services.arquivoService.total()));

  // ---- Envio arrastando arquivo do computador ----
  const linhaDestino = doc.querySelector('.doc-row--pasta[data-pasta-id="' + pastaTeste.id + '"]');
  ok('pasta de destino visível na lista', !!linhaDestino);

  const arq3 = new window.File(['laudo'], 'laudo-pericial.pdf', { type: 'application/pdf' });
  const transferencia = { files: [arq3], types: ['Files'] };

  const evOverArquivo = new window.Event('dragover', { bubbles: true, cancelable: true });
  Object.defineProperty(evOverArquivo, 'dataTransfer', { value: transferencia });
  linhaDestino.dispatchEvent(evOverArquivo);

  ok('dragover de arquivo é cancelado (permite drop)', evOverArquivo.defaultPrevented);
  ok('pasta destacada para receber arquivo',
     linhaDestino.classList.contains('doc-row--soltar-arquivo'));

  const evDropArquivo = new window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(evDropArquivo, 'dataTransfer', { value: transferencia });
  linhaDestino.dispatchEvent(evDropArquivo);
  await esperar(1700);

  const solto = App.services.db.get('documentos').find(d => d.nome === 'laudo-pericial.pdf');
  ok('arquivo solto do computador é enviado', !!solto);
  ok('vai para a pasta sob o cursor', !!solto && solto.pastaId === pastaTeste.id,
     solto && String(solto.pastaId));
  ok('padrão do arrasto é interno', !!solto && solto.visivelCliente === false);
  ok('padrão do arrasto é categoria "outro"', !!solto && solto.categoria === 'outro');
  ok('realce de arquivo foi limpo',
     doc.querySelectorAll('.doc-row--soltar-arquivo').length === 0);

  // ==================== VISOR DE DOCUMENTO (modal interno) ====================
  console.log('\nDocumentos — visor interno');

  /** Envio completo pelo modal — jsdom não deixa preencher <input type=file>. */
  async function enviarPeloModal(arquivos, pastaId) {
    clicar(doc.querySelector('[data-action="enviar-documentos"]'));
    await esperar(350);

    const campo = doc.querySelector('#form-envio [name="arquivos"]');
    Object.defineProperty(campo, 'files', { value: arquivos, configurable: true });
    disparar(campo, 'change');
    doc.querySelector('#form-envio [name="pastaId"]').value = pastaId || '';

    clicar(Array.from(doc.querySelectorAll('.modal__footer .btn'))
      .find(b => b.dataset.action === 'salvar'));
    await esperar(1700);
  }

  // Nada de nova aba: se o visor chamar window.open, o teste acusa.
  let aberturasExternas = 0;
  window.open = function () { aberturasExternas++; return null; };

  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  const linhasDoc = Array.from(doc.querySelectorAll('.doc-row--documento'));
  ok('há documento na raiz para abrir', linhasDoc.length > 0, String(linhasDoc.length));
  ok('toda linha tem ação de abrir',
     linhasDoc.every(l => !!l.querySelector('[data-action="abrir-documento"]')));
  ok('o nome do documento é clicável',
     !!linhasDoc[0].querySelector('.doc-row__nome[data-action="abrir-documento"]'));

  // ---- Documento só com metadados (o caso do seed) ----
  const idSemBinario = linhasDoc
    .map(l => l.dataset.documentoId)
    .find(id => !App.services.arquivoService.tem(id));
  ok('há documento sem binário na sessão', !!idSemBinario);

  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + idSemBinario + '"] ' +
                           '[data-action="abrir-documento"]'));
  await esperar(350);

  ok('visor abre em modal', !!doc.querySelector('.modal-backdrop [data-doc-visor]'));
  ok('modal é largo', !!doc.querySelector('.modal--lg'));
  ok('não abriu aba externa', aberturasExternas === 0, String(aberturasExternas));

  const visor = doc.querySelector('[data-doc-visor]');
  const docSemBinario = App.services.db.find('documentos', idSemBinario);
  ok('avisa que não há prévia', visor.textContent.includes('Prévia não disponível'));
  ok('explica o motivo (só metadados)',
     visor.textContent.includes('apenas os metadados'));
  ok('ficha de metadados presente', !!visor.querySelector('.doc-visor__ficha'));
  ok('ficha mostra o nome do arquivo', visor.textContent.includes(docSemBinario.nome));
  ok('ficha mostra tamanho e versão',
     visor.textContent.includes('Tamanho') && visor.textContent.includes('Versão'));
  ok('ficha mostra a visibilidade no portal',
     visor.textContent.includes('Portal do cliente'));
  ok('ficha mostra quem enviou', visor.textContent.includes('Enviado por'));
  ok('visor oferece mover sem sair',
     !!Array.from(doc.querySelectorAll('.modal__footer .btn'))
       .find(b => b.dataset.action === 'mover'));

  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await esperar(200);
  ok('Escape fecha o visor', !doc.querySelector('.modal-backdrop'));

  // ---- Documento enviado nesta sessão: texto tem prévia real ----
  const arqTexto = new window.File(['linha 1\nlinha 2 do parecer'], 'parecer-interno.txt',
    { type: 'text/plain' });
  await enviarPeloModal([arqTexto], null);

  const docTexto = App.services.db.get('documentos').find(d => d.nome === 'parecer-interno.txt');
  ok('documento de texto enviado', !!docTexto);
  ok('binário do texto está na sessão', App.services.arquivoService.tem(docTexto.id));
  ok('tipo de prévia é texto',
     App.components.DocumentViewer.tipoPrevia(docTexto, true) === 'texto',
     App.components.DocumentViewer.tipoPrevia(docTexto, true));

  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docTexto.id + '"] ' +
                           '[data-action="abrir-documento"]'));
  await esperar(500);

  ok('visor do texto aberto', !!doc.querySelector('[data-doc-visor]'));
  const quadroTexto = doc.querySelector('.doc-visor__texto');
  ok('conteúdo do arquivo é exibido no modal',
     !!quadroTexto && quadroTexto.textContent.includes('linha 2 do parecer'),
     quadroTexto && quadroTexto.textContent.slice(0, 40));
  ok('continua sem abrir aba externa', aberturasExternas === 0, String(aberturasExternas));

  App.components.Modal.fechar();
  await esperar(200);

  // ---- Classificação de prévia por tipo ----
  const Visor = App.components.DocumentViewer;
  ok('imagem é reconhecida',
     Visor.tipoPrevia({ extensao: 'png', tipoMime: 'image/png' }, true) === 'imagem');
  ok('pdf é reconhecido',
     Visor.tipoPrevia({ extensao: 'pdf', tipoMime: 'application/pdf' }, true) === 'pdf');
  ok('formato exótico não promete prévia',
     Visor.tipoPrevia({ extensao: 'dwg', tipoMime: 'application/acad' }, true) === 'sem-previa');
  ok('sem binário nunca tem prévia',
     Visor.tipoPrevia({ extensao: 'png', tipoMime: 'image/png' }, false) === 'sem-previa');

  // ==================== DOWNLOAD DE DOCUMENTO ====================
  console.log('\nDocumentos — download');

  // Espia o <a download> que App.dom.baixar cria e clica.
  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function () {
    downloads.push({ nome: this.download, href: this.href });
  };

  /** Conteúdo do data: URL — o FileReader gera base64, a ficha vai URL-encoded. */
  function conteudoDoDownload(href) {
    if (!href) return '';
    const marcador = ';base64,';
    if (href.includes(marcador)) {
      return Buffer.from(href.slice(href.indexOf(marcador) + marcador.length), 'base64')
        .toString('utf8');
    }
    return decodeURIComponent(href);
  }

  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  ok('toda linha tem ação de baixar',
     Array.from(doc.querySelectorAll('.doc-row--documento'))
       .every(l => !!l.querySelector('[data-action="baixar-documento"]')));

  // ---- Documento enviado na sessão: baixa o arquivo real ----
  const arqBaixavel = new window.File(['conteudo do parecer para download'],
    'parecer-para-baixar.txt', { type: 'text/plain' });
  await enviarPeloModal([arqBaixavel], null);

  const docBaixavel = App.services.db.get('documentos')
    .find(d => d.nome === 'parecer-para-baixar.txt');
  ok('documento para download criado', !!docBaixavel);

  downloads.length = 0;
  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docBaixavel.id + '"] ' +
                           '[data-action="baixar-documento"]'));
  await esperar(500);

  ok('download disparado', downloads.length === 1, String(downloads.length));
  ok('nome original preservado no download',
     downloads[0] && downloads[0].nome === 'parecer-para-baixar.txt',
     downloads[0] && downloads[0].nome);
  ok('conteúdo real vai no download',
     downloads[0] && conteudoDoDownload(downloads[0].href).includes('parecer para download'),
     downloads[0] && conteudoDoDownload(downloads[0].href).slice(0, 40));
  ok('toast de sucesso exibido', !!doc.querySelector('.toast'));

  // ---- Documento só com metadados: baixa a ficha, não um arquivo falso ----
  const idSoMetadados = Array.from(doc.querySelectorAll('.doc-row--documento'))
    .map(l => l.dataset.documentoId)
    .find(id => !App.services.arquivoService.tem(id));
  ok('há documento sem binário para o teste', !!idSoMetadados);

  const docSoMetadados = App.services.db.find('documentos', idSoMetadados);
  downloads.length = 0;
  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + idSoMetadados + '"] ' +
                           '[data-action="baixar-documento"]'));
  await esperar(400);

  ok('download da ficha disparado', downloads.length === 1, String(downloads.length));
  ok('nome deixa claro que é a ficha',
     downloads[0] && downloads[0].nome.includes('ficha.txt'), downloads[0] && downloads[0].nome);
  ok('ficha NÃO se passa pelo arquivo original',
     downloads[0] && downloads[0].nome !== docSoMetadados.nome);

  const conteudoFicha = downloads[0] ? conteudoDoDownload(downloads[0].href) : '';
  ok('ficha traz o nome do documento', conteudoFicha.includes(docSoMetadados.nome));
  ok('ficha traz categoria e tamanho',
     conteudoFicha.includes('Categoria') && conteudoFicha.includes('Tamanho'));
  ok('ficha avisa que o arquivo não acompanha',
     conteudoFicha.includes('não acompanha esta ficha'));
  ok('download da ficha não abriu aba externa', aberturasExternas === 0,
     String(aberturasExternas));

  // ---- Download pelo rodapé do visor, sem fechar o visor ----
  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docBaixavel.id + '"] ' +
                           '[data-action="abrir-documento"]'));
  await esperar(400);
  ok('visor aberto para baixar de dentro', !!doc.querySelector('[data-doc-visor]'));

  const btnBaixarVisor = Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'baixar');
  ok('visor tem botão de baixar', !!btnBaixarVisor);

  downloads.length = 0;
  clicar(btnBaixarVisor);
  await esperar(500);

  ok('download pelo visor funciona', downloads.length === 1, String(downloads.length));
  ok('visor permanece aberto após baixar', !!doc.querySelector('[data-doc-visor]'));

  App.components.Modal.fechar();
  await esperar(200);

  // ==================== EDITOR DE DOCUMENTO (aba nova) ====================
  /* A única ação do sistema que abre outra aba, e de propósito: escrever é
     trabalho longo. Ver continua sendo modal — os testes acima garantem isso. */
  console.log('\nDocumentos — editor em aba nova');

  const conteudos = App.services.conteudoService;

  // Agora window.open devolve uma aba "de verdade": sem isso o código cai no
  // fallback de pop-up bloqueado e o teste não veria o caminho normal.
  let urlAberta = null;
  window.open = function (url) {
    aberturasExternas++;
    urlAberta = url;
    return { focus() {}, close() {} };
  };

  ok('modo de edição de .txt é texto',
     App.components.DocumentViewer.modoEdicao({ extensao: 'txt' }) === 'texto');
  ok('modo de edição de .docx é rico',
     App.components.DocumentViewer.modoEdicao({ extensao: 'docx' }) === 'rico');
  ok('pdf não é editável',
     App.components.DocumentViewer.modoEdicao({ extensao: 'pdf' }) === null);
  ok('imagem não é editável',
     App.components.DocumentViewer.modoEdicao({ extensao: 'png', tipoMime: 'image/png' }) === null);

  // ---- O visor oferece Editar só onde dá para editar ----
  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docTexto.id + '"] ' +
                           '[data-action="abrir-documento"]'));
  await esperar(400);

  const btnEditar = Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'editar');
  ok('visor do .txt tem botão Editar', !!btnEditar);

  /* O jsdom roda em file://, origem opaca onde o localStorage é proibido — o
     conteudoService cai para memória e o sistema, corretamente, deixa de
     abrir aba nova (o texto não atravessaria). Para exercitar o caminho
     normal, dizemos que há storage; o degrade é testado logo abaixo. */
  const suportadoReal = conteudos.suportado;
  conteudos.suportado = () => true;

  aberturasExternas = 0;
  clicar(btnEditar);
  await esperar(600);

  ok('Editar abriu exatamente uma aba', aberturasExternas === 1, String(aberturasExternas));
  ok('a aba aponta para a rota do editor',
     !!urlAberta && urlAberta.includes('#/documentos/' + docTexto.id + '/editar'), urlAberta);
  ok('o visor fecha ao ir para o editor', !doc.querySelector('.modal-backdrop'));

  // O ponto central do desenho: o texto é gravado ANTES de a outra aba abrir,
  // porque lá o arquivoService nasce vazio.
  ok('conteúdo foi semeado para a outra aba', conteudos.tem(docTexto.id));
  ok('semeou o texto do arquivo, não vazio',
     conteudos.ler(docTexto.id).conteudo.includes('linha 2 do parecer'),
     conteudos.ler(docTexto.id).conteudo.slice(0, 30));

  conteudos.suportado = suportadoReal;

  // ---- A página do editor (aqui, no lugar da aba que o jsdom não abre) ----
  await irPara('#/documentos/' + docTexto.id + '/editar', 900);

  ok('página do editor renderizada', !!doc.querySelector('[data-editor-doc]'));
  ok('modo texto usa textarea', !!doc.querySelector('[data-editor-texto]'));
  ok('modo texto não traz barra de formatação', !doc.querySelector('.editor-doc__toolbar'));

  const area = doc.querySelector('[data-editor-texto]');
  ok('editor carregou o conteúdo gravado', area.value.includes('linha 2 do parecer'),
     area.value.slice(0, 30));
  ok('editor mostra o nome do documento',
     doc.querySelector('.editor-doc__titulo').textContent.includes('parecer-interno.txt'));

  // ---- Autosave ----
  const textoNovo = 'Parecer revisado na aba do editor.\nSegunda linha.';
  area.value = textoNovo;
  disparar(area, 'input');
  await esperar(200);
  ok('status indica edição em curso',
     doc.querySelector('[data-editor-status]').textContent.includes('Editando'),
     doc.querySelector('[data-editor-status]').textContent);

  await esperar(1800);   // debounce de 1,2s + gravação
  ok('autosave gravou o texto novo',
     conteudos.ler(docTexto.id).conteudo === textoNovo,
     conteudos.ler(docTexto.id).conteudo.slice(0, 30));
  ok('status confirma o salvamento',
     doc.querySelector('[data-editor-status]').textContent.startsWith('Salvo'),
     doc.querySelector('[data-editor-status]').textContent);
  ok('tamanho do documento acompanha o texto',
     App.services.db.find('documentos', docTexto.id).tamanhoBytes === textoNovo.length,
     String(App.services.db.find('documentos', docTexto.id).tamanhoBytes));
  ok('registro guarda quem editou',
     !!App.services.db.find('documentos', docTexto.id).editadoPorId);
  ok('rodapé conta palavras',
     doc.querySelector('[data-editor-rodape]').textContent.includes('palavras'),
     doc.querySelector('[data-editor-rodape]').textContent);

  // ---- Baixar como: entrega o texto editado, no formato escolhido ----
  ok('o editor oferece o menu de formatos', !!doc.querySelector('[data-menu-exportar]'));
  ok('o menu lista os cinco formatos',
     doc.querySelectorAll('[data-action="exportar"]').length === 5,
     String(doc.querySelectorAll('[data-action="exportar"]').length));
  ok('o menu explica a ausência do .docx',
     doc.querySelector('.editor-doc__menu-nota').textContent.includes('não são gerados'));

  downloads.length = 0;
  clicar(doc.querySelector('[data-action="exportar"][data-value="txt"]'));
  await esperar(500);
  ok('download do editor disparado', downloads.length === 1, String(downloads.length));
  ok('baixa o texto editado',
     downloads[0] && conteudoDoDownload(downloads[0].href).includes('revisado na aba do editor'),
     downloads[0] && conteudoDoDownload(downloads[0].href).slice(0, 40));

  downloads.length = 0;
  clicar(doc.querySelector('[data-action="exportar"][data-value="rtf"]'));
  await esperar(500);
  ok('exporta .rtf a partir de texto puro',
     downloads[0] && downloads[0].nome.endsWith('.rtf'), downloads[0] && downloads[0].nome);
  ok('o .rtf tem cabeçalho de RTF de verdade',
     downloads[0] && conteudoDoDownload(downloads[0].href).includes('{\\rtf1\\ansi'),
     downloads[0] && conteudoDoDownload(downloads[0].href).slice(0, 60));

  // ---- Nova versão: v2 encadeada, com o mesmo texto ----
  clicar(doc.querySelector('[data-action="salvar-versao"]'));
  await esperar(900);

  const versoes = App.services.db.get('documentos')
    .filter(d => d.documentoPaiId === docTexto.id);
  ok('nova versão criada', versoes.length === 1, String(versoes.length));
  ok('a nova versão é a v2', versoes[0] && versoes[0].versao === 2,
     versoes[0] && String(versoes[0].versao));
  ok('o texto acompanhou a nova versão',
     versoes[0] && conteudos.ler(versoes[0].id) &&
     conteudos.ler(versoes[0].id).conteudo === textoNovo);
  ok('o editor passou a editar a v2',
     window.location.hash.includes(versoes[0].id), window.location.hash);

  // ---- De volta ao processo: o visor mostra a versão editada ----
  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docTexto.id + '"] ' +
                           '[data-action="abrir-documento"]'));
  await esperar(500);

  const previaEditada = doc.querySelector('.doc-visor__texto');
  ok('o visor mostra o texto editado, não o arquivo original',
     !!previaEditada && previaEditada.textContent.includes('revisado na aba do editor'),
     previaEditada && previaEditada.textContent.slice(0, 40));
  ok('a ficha registra a edição',
     doc.querySelector('[data-doc-visor]').textContent.includes('Editado no sistema'));

  App.components.Modal.fechar();
  await esperar(200);

  // ---- .docx: editor rico e o aviso honesto ----
  const arqDocx = new window.File(['binario-que-ninguem-le'], 'peticao-inicial.docx',
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  await enviarPeloModal([arqDocx], null);

  const docDocx = App.services.db.get('documentos').find(d => d.nome === 'peticao-inicial.docx');
  ok('documento .docx enviado', !!docDocx);

  ok('a linha do .docx oferece Editar',
     !!doc.querySelector('.doc-row--documento[data-documento-id="' + docDocx.id + '"] ' +
                         '[data-action="editar-documento"]'));

  /* Degrade: sem localStorage (o caso do jsdom), abrir aba nova entregaria um
     editor em branco — o sistema edita na mesma aba em vez disso. */
  aberturasExternas = 0;
  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docDocx.id + '"] ' +
                           '[data-action="editar-documento"]'));
  await esperar(900);

  ok('sem storage, não abre aba nova', aberturasExternas === 0, String(aberturasExternas));
  ok('sem storage, o editor abre na mesma aba',
     window.location.hash === '#/documentos/' + docDocx.id + '/editar',
     window.location.hash);
  ok('modo rico usa contenteditable', !!doc.querySelector('[data-editor-rico]'));
  ok('modo rico traz a barra de formatação', !!doc.querySelector('.editor-doc__toolbar'));

  const avisoDocx = doc.querySelector('.editor-doc__aviso');
  ok('o editor avisa que não lê o binário do .docx',
     !!avisoDocx && avisoDocx.textContent.includes('não lê o conteúdo binário'),
     avisoDocx && avisoDocx.textContent.slice(0, 50));
  ok('e diz que o original continua disponível',
     !!avisoDocx && avisoDocx.textContent.includes('original'));

  const areaRica = doc.querySelector('[data-editor-rico]');
  areaRica.innerHTML = '<p>Excelentíssimo <b>Senhor</b> Doutor Juiz.</p>';
  disparar(areaRica, 'input');
  await esperar(1800);

  const salvoRico = conteudos.ler(docDocx.id);
  ok('modo rico salva HTML', !!salvoRico && salvoRico.modo === 'rico');
  ok('a formatação sobrevive à gravação',
     !!salvoRico && salvoRico.conteudo.includes('<b>Senhor</b>'), salvoRico && salvoRico.conteudo);

  // ---- Sanitização: o modo rico é a única exceção ao esc(), e é fechada ----
  const sujo = conteudos.sanitizarHtml(
    '<p>ok<script>alert(1)</script></p><img src=x onerror=alert(2)><b>negrito</b>');
  ok('script é removido', sujo.indexOf('script') === -1, sujo);
  ok('img é removida', sujo.indexOf('<img') === -1, sujo);
  ok('handler inline não passa', sujo.indexOf('onerror') === -1, sujo);
  ok('negrito continua valendo', sujo.includes('<b>negrito</b>'), sujo);
  ok('o texto de dentro da tag proibida é preservado', sujo.includes('ok'), sujo);

  // ---- pdf não oferece edição em lugar nenhum ----
  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  const idPdf = Array.from(doc.querySelectorAll('.doc-row--documento'))
    .map(l => l.dataset.documentoId)
    .find(id => {
      const d = App.services.db.find('documentos', id);
      return d && d.extensao === 'pdf';
    });
  ok('há um .pdf na pasta para o teste', !!idPdf);

  if (idPdf) {
    const linha = doc.querySelector('.doc-row--documento[data-documento-id="' + idPdf + '"]');
    ok('a linha do .pdf não oferece Editar',
       !linha.querySelector('[data-action="editar-documento"]'));

    clicar(linha.querySelector('[data-action="abrir-documento"]'));
    await esperar(400);
    ok('o visor do .pdf também não oferece Editar',
       !Array.from(doc.querySelectorAll('.modal__footer .btn'))
         .find(b => b.dataset.action === 'editar'));
    App.components.Modal.fechar();
    await esperar(200);
  }

  // ==================== NOVO DOCUMENTO (em branco, sem arquivo) ====================
  /* O caminho oposto ao envio: não existe binário nenhum, o documento nasce
     em branco e vai direto para o editor — o "documento em branco" do Docs. */
  console.log('\nDocumentos — criar em branco');

  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  ok('o explorador oferece Novo documento',
     !!doc.querySelector('[data-action="novo-documento"]'));

  clicar(doc.querySelector('[data-action="novo-documento"]'));
  await esperar(350);

  const formNovo = doc.querySelector('#form-novo-documento');
  ok('modal de novo documento aberto', !!formNovo);
  ok('oferece os formatos do Docs',
     formNovo.elements.formato.options.length === 6,
     String(formNovo.elements.formato.options.length));
  ok('o padrão é .docx', formNovo.elements.formato.value === 'docx',
     formNovo.elements.formato.value);
  ok('avisa que .docx não vira arquivo de verdade',
     doc.querySelector('#novo-documento-nota').textContent.includes('não monta o arquivo'),
     doc.querySelector('#novo-documento-nota').textContent.slice(0, 50));

  // Trocar para um formato que o sistema gera muda a nota.
  formNovo.elements.formato.value = 'txt';
  disparar(formNovo.elements.formato, 'change');
  await esperar(150);
  ok('em .txt a nota confirma que o arquivo é real',
     doc.querySelector('#novo-documento-nota').textContent.includes('de verdade'),
     doc.querySelector('#novo-documento-nota').textContent.slice(0, 50));

  // Nome sem extensão: quem manda é o campo de formato.
  formNovo.elements.nome.value = 'Minuta de acordo';
  formNovo.elements.formato.value = 'rtf';
  formNovo.elements.categoria.value = 'contrato';
  disparar(formNovo.elements.formato, 'change');

  aberturasExternas = 0;
  clicar(Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'salvar'));
  await esperar(1400);

  const docNovo = App.services.db.get('documentos')
    .find(d => d.nome === 'Minuta de acordo.rtf');
  ok('documento em branco criado', !!docNovo);
  ok('a extensão vem do formato escolhido', !!docNovo && docNovo.extensao === 'rtf',
     docNovo && docNovo.extensao);
  ok('nasce com zero byte', !!docNovo && docNovo.tamanhoBytes === 0,
     docNovo && String(docNovo.tamanhoBytes));
  ok('nasce marcado como criado no editor', !!docNovo && docNovo.criadoNoEditor === true);
  ok('guarda a categoria escolhida', !!docNovo && docNovo.categoria === 'contrato',
     docNovo && docNovo.categoria);
  ok('não tem binário nenhum na sessão',
     !!docNovo && !App.services.arquivoService.tem(docNovo.id));
  ok('o editor abre em seguida (mesma aba, sem storage)',
     window.location.hash === '#/documentos/' + docNovo.id + '/editar',
     window.location.hash);
  ok('.rtf abre no editor de texto formatado', !!doc.querySelector('[data-editor-rico]'));
  // .rtf o sistema gera de verdade — nada a avisar sobre o formato. (O banner
  // de "armazenamento indisponível" continua, porque o jsdom não tem storage.)
  ok('formato que o sistema gera não ganha aviso de formato',
     !doc.querySelector('.editor-doc__aviso') ||
     !doc.querySelector('.editor-doc__aviso').textContent.includes('Sobre o formato'));

  // ---- Documento em branco: o visor e o download dizem a verdade ----
  await irPara('#/processos/' + procComPasta.id, 900);
  clicar(Array.from(doc.querySelectorAll('[data-action="trocar-aba"]'))
    .find(b => b.dataset.value === 'documentos'));
  await esperar(300);

  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docNovo.id + '"] ' +
                           '[data-action="abrir-documento"]'));
  await esperar(400);
  ok('o visor diz que o documento está em branco',
     doc.querySelector('[data-doc-visor]').textContent.includes('Documento em branco'));
  ok('e não inventa um arquivo no backend',
     !doc.querySelector('[data-doc-visor]').textContent.includes('existiria no storage'));
  App.components.Modal.fechar();
  await esperar(200);

  downloads.length = 0;
  clicar(doc.querySelector('.doc-row--documento[data-documento-id="' + docNovo.id + '"] ' +
                           '[data-action="baixar-documento"]'));
  await esperar(400);
  ok('baixar documento em branco não gera arquivo nenhum', downloads.length === 0,
     String(downloads.length));

  await irPara('#/documentos/' + docNovo.id + '/editar', 900);

  // ---- Escrever no documento novo e exportar ----
  const areaNova = doc.querySelector('[data-editor-rico]');
  areaNova.innerHTML = '<h1>Minuta</h1><p>As partes <b>acordam</b>:</p>' +
                       '<ul><li>Primeiro item</li><li>Segundo item</li></ul>';
  disparar(areaNova, 'input');
  await esperar(1800);

  ok('o texto do documento novo foi salvo', conteudos.tem(docNovo.id));
  ok('o tamanho deixou de ser zero',
     App.services.db.find('documentos', docNovo.id).tamanhoBytes > 0,
     String(App.services.db.find('documentos', docNovo.id).tamanhoBytes));

  downloads.length = 0;
  clicar(doc.querySelector('[data-action="exportar"][data-value="rtf"]'));
  await esperar(600);

  const rtf = downloads[0] ? conteudoDoDownload(downloads[0].href) : '';
  ok('baixa .rtf com o nome do documento',
     downloads[0] && downloads[0].nome === 'Minuta de acordo.rtf',
     downloads[0] && downloads[0].nome);
  ok('o RTF preserva o negrito', rtf.includes('{\\b acordam}'), rtf.slice(-200));
  ok('o RTF traz o título em corpo maior', rtf.includes('\\fs36'), rtf.slice(0, 160));
  ok('o RTF traz os itens da lista', rtf.includes('Primeiro item') && rtf.includes('\\u8226?'));
  ok('o RTF escapa acento em vez de quebrar',
     rtf.indexOf('acordam') !== -1 && rtf.indexOf('\\u') !== -1);

  downloads.length = 0;
  clicar(doc.querySelector('[data-action="exportar"][data-value="md"]'));
  await esperar(600);
  const md = downloads[0] ? conteudoDoDownload(downloads[0].href) : '';
  ok('exporta .md', downloads[0] && downloads[0].nome.endsWith('.md'),
     downloads[0] && downloads[0].nome);
  ok('markdown converte o título', md.includes('# Minuta'), md.slice(0, 80));
  ok('markdown converte o negrito', md.includes('**acordam**'), md.slice(0, 120));
  ok('markdown converte a lista', md.includes('- Primeiro item'), md.slice(0, 160));

  downloads.length = 0;
  clicar(doc.querySelector('[data-action="exportar"][data-value="txt"]'));
  await esperar(600);
  const txt = downloads[0] ? conteudoDoDownload(downloads[0].href) : '';
  ok('exporta .txt sem tag nenhuma', txt.indexOf('<') === -1 || !txt.includes('<h1>'),
     txt.slice(0, 80));
  ok('o texto puro mantém o conteúdo', txt.includes('Minuta') && txt.includes('Primeiro item'));

  downloads.length = 0;
  clicar(doc.querySelector('[data-action="exportar"][data-value="html"]'));
  await esperar(600);
  const htmlExportado = downloads[0] ? conteudoDoDownload(downloads[0].href) : '';
  ok('exporta .html autossuficiente',
     htmlExportado.includes('<!DOCTYPE html>') && htmlExportado.includes('<style>'),
     htmlExportado.slice(0, 60));
  ok('o .html não referencia CSS externo', !htmlExportado.includes('<link'));

  // ---- Validação: documento sem nome não é criado ----
  const documentosAntes = App.services.db.get('documentos').length;
  let recusou = false;
  await App.services.documentoService.criarEmBranco({
    processoId: procComPasta.id, nome: '   ', formato: 'txt'
  }).catch(() => { recusou = true; });
  ok('documento sem nome é recusado', recusou);
  ok('e nada foi gravado', App.services.db.get('documentos').length === documentosAntes);

  let recusouFormato = false;
  await App.services.documentoService.criarEmBranco({
    processoId: procComPasta.id, nome: 'Sem formato', formato: 'xyz'
  }).catch(() => { recusouFormato = true; });
  ok('formato desconhecido é recusado', recusouFormato);

  // ---- Documento criado em .docx: o aviso é sobre a saída, não sobre "ler" ----
  const docxNovo = await App.services.documentoService.criarEmBranco({
    processoId: procComPasta.id, nome: 'Recurso de apelação', formato: 'docx',
    uploadPorId: App.store.getState().usuarioAtual.id
  });
  ok('a extensão é aplicada ao nome', docxNovo.nome === 'Recurso de apelação.docx',
     docxNovo.nome);

  await irPara('#/documentos/' + docxNovo.id + '/editar', 900);
  const avisoNovo = doc.querySelector('.editor-doc__aviso');
  ok('avisa sobre o formato de saída', !!avisoNovo &&
     avisoNovo.textContent.includes('não monta o arquivo'),
     avisoNovo && avisoNovo.textContent.slice(0, 60));
  ok('e NÃO fala em binário que não existe', !!avisoNovo &&
     !avisoNovo.textContent.includes('não lê o conteúdo binário'));
  ok('aponta o .rtf como saída para o Word', !!avisoNovo &&
     avisoNovo.textContent.includes('.rtf'));

  // ==================== MODAL — NOVO CLIENTE (validação de CPF) ====================
  console.log('\nModal — novo cliente com validação de documento');
  await irPara('#/clientes', 900);
  const clientesAntes = App.services.db.get('pessoas').filter(p => p.ehCliente).length;

  clicar(doc.querySelector('[data-action="novo-cliente"]'));
  await esperar(300);
  ok('modal de cliente aberto', !!doc.querySelector('#form-cliente'));

  const campoDoc = doc.querySelector('#form-cliente [name="documento"]');
  campoDoc.value = '52998224725';
  disparar(campoDoc, 'input');
  await esperar(150);
  ok('máscara de CPF aplicada', campoDoc.value === '529.982.247-25', campoDoc.value);

  const btnSalvarCliente = Array.from(doc.querySelectorAll('.modal__footer .btn'))
    .find(b => b.dataset.action === 'salvar');

  // CPF inválido deve barrar
  doc.querySelector('#form-cliente [name="nome"]').value = 'Cliente de Teste';
  campoDoc.value = '111.111.111-11';
  clicar(btnSalvarCliente);
  await esperar(400);
  ok('CPF inválido barra a criação',
     App.services.db.get('pessoas').filter(p => p.ehCliente).length === clientesAntes);

  campoDoc.value = '529.982.247-25';
  clicar(btnSalvarCliente);
  await esperar(900);
  ok('cliente com CPF válido é criado',
     App.services.db.get('pessoas').filter(p => p.ehCliente).length === clientesAntes + 1);

  // ==================== SOFT DELETE ====================
  console.log('\nSoft delete');
  const alvo = App.services.db.get('tarefas')[0];
  const totalAntes = App.services.db.get('tarefas').length;
  const totalComInativosAntes = App.services.db.getTodos('tarefas').length;
  App.services.db.remove('tarefas', alvo.id);
  ok('sai das consultas', App.services.db.get('tarefas').length === totalAntes - 1);
  ok('registro permanece no banco',
     App.services.db.getTodos('tarefas').length === totalComInativosAntes);
  ok('marcado como inativo',
     App.services.db.getTodos('tarefas').find(t => t.id === alvo.id).ativo === false);

  // ==================== PERSISTÊNCIA / RESET ====================
  console.log('\nRestauração de dados');
  App.services.db.reset();
  ok('reset regenera 40 processos', App.services.db.get('processos').length === 40,
     String(App.services.db.get('processos').length));
  ok('reset regenera 60 prazos', App.services.db.get('prazos').length === 60,
     String(App.services.db.get('prazos').length));
  ok('tarefa de teste some após reset',
     !App.services.db.get('tarefas').find(t => t.titulo === 'Tarefa criada pelo teste'));

  // ==================== ERROS ====================
  console.log('\nErros de JavaScript');
  if (erros.length) {
    [...new Set(erros)].slice(0, 10).forEach(e =>
      console.log('  ✕ ' + e.split('\n').slice(0, 5).join('\n     ')));
    falhas += erros.length; testes += erros.length;
  } else {
    console.log('  ✓ nenhum erro'); testes++;
  }

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`${testes - falhas}/${testes} verificações passaram`);
  dom.window.close();
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('FALHA:', e); process.exit(1); });
