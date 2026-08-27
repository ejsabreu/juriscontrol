/* Verificação de F2.1 — permissões, segredo de justiça, sessão, auditoria e LGPD.

   Roda em Node, sem jsdom: tudo aqui é domínio puro ou service, e nenhuma
   dessas regras pode depender de tela para valer. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

/* O ambiente carrega o núcleo inteiro — utils, domínio, seed, store e
   services — na ordem de dependência. A lista mora em ambiente.js para
   que um módulo novo no seed não quebre seis suítes de uma vez. */
const { App, janela } = criarAmbiente({ extras: ['src/layout/Sidebar.js'] });
const { ok, secao, encerrar } = criarPlacar();

const perm = App.domain.permissoes;
const enums = App.domain.enums;

const ADMIN      = { id: 'U1', nome: 'Ada',   perfil: 'admin' };
const SOCIO      = { id: 'U2', nome: 'Bento', perfil: 'socio' };
const ADVOGADO   = { id: 'U3', nome: 'Célia', perfil: 'advogado' };
const ESTAGIARIO = { id: 'U4', nome: 'Davi',  perfil: 'estagiario' };
const FINANCEIRO = { id: 'U5', nome: 'Elis',  perfil: 'financeiro' };

(async function () {

  // ===================== MATRIZ =====================
  secao('Matriz de permissões');

  ok('admin tem o coringa', perm.recursosDe('admin').indexOf('*') !== -1);
  ok('admin pode tudo o que existe',
     enums.RECURSOS_PERMISSAO.every(r => perm.pode(ADMIN, r.id)));

  ok('sócio vê o financeiro', perm.pode(SOCIO, 'financeiro.ver'));
  ok('sócio NÃO lança no financeiro', !perm.pode(SOCIO, 'financeiro.lancar'));
  ok('advogado NÃO vê o financeiro do escritório', !perm.pode(ADVOGADO, 'financeiro.ver'));
  ok('financeiro NÃO edita processo', !perm.pode(FINANCEIRO, 'processos.editar'));
  ok('financeiro vê processo (para vincular honorário)', perm.pode(FINANCEIRO, 'processos.ver'));
  ok('estagiário NÃO baixa prazo', !perm.pode(ESTAGIARIO, 'prazos.baixar'));
  ok('estagiário NÃO compartilha com cliente', !perm.pode(ESTAGIARIO, 'portal.compartilhar'));
  ok('estagiário NÃO exclui documento', !perm.pode(ESTAGIARIO, 'documentos.excluir'));
  ok('estagiário edita documento (instrui o processo)', perm.pode(ESTAGIARIO, 'documentos.editar'));
  ok('só admin abre configurações',
     perm.pode(ADMIN, 'configuracoes') && !perm.pode(SOCIO, 'configuracoes') &&
     !perm.pode(ADVOGADO, 'configuracoes'));
  ok('só admin abre a auditoria',
     perm.pode(ADMIN, 'auditoria') && !perm.pode(SOCIO, 'auditoria'));

  // A visão do escritório é de quem coordena a carteira. Para o advogado a
  // tela inicial é o painel PESSOAL, e carteira total não muda o dia dele.
  ok('admin vê o painel do escritório', perm.pode(ADMIN, 'escritorio.ver'));
  ok('sócio vê o painel do escritório', perm.pode(SOCIO, 'escritorio.ver'));
  ok('advogado NÃO vê o painel do escritório', !perm.pode(ADVOGADO, 'escritorio.ver'));
  ok('estagiário NÃO vê o painel do escritório', !perm.pode(ESTAGIARIO, 'escritorio.ver'));
  ok('financeiro NÃO vê o painel do escritório', !perm.pode(FINANCEIRO, 'escritorio.ver'));

  ok('usuário nulo não pode nada', !perm.pode(null, 'processos.ver'));
  ok('usuário sem perfil não pode nada', !perm.pode({ id: 'X' }, 'processos.ver'));
  ok('recurso inexistente é negado', !perm.pode(SOCIO, 'recurso.que.nao.existe'));
  ok('recurso vazio é negado', !perm.pode(ADMIN, ''));

  ok('podeTudo exige todos', perm.podeTudo(SOCIO, ['processos.ver', 'financeiro.ver']) &&
     !perm.podeTudo(SOCIO, ['processos.ver', 'configuracoes']));
  ok('podeAlgum basta um', perm.podeAlgum(ADVOGADO, ['configuracoes', 'processos.ver']) &&
     !perm.podeAlgum(ADVOGADO, ['configuracoes', 'auditoria']));

  // A grade da tela de perfis lê da mesma matriz — se divergirem, a tela
  // mostraria menos (ou mais) do que o sistema aplica.
  const idsEnum = enums.RECURSOS_PERMISSAO.map(r => r.id);
  const idsMatriz = [];
  Object.keys(perm.MATRIZ).forEach(p => {
    perm.MATRIZ[p].forEach(r => { if (r !== '*' && idsMatriz.indexOf(r) === -1) idsMatriz.push(r); });
  });
  ok('todo recurso da matriz existe no enum',
     idsMatriz.every(id => idsEnum.indexOf(id) !== -1),
     idsMatriz.filter(id => idsEnum.indexOf(id) === -1).join(', '));
  ok('todo recurso do enum é usado por algum perfil (ou só pelo admin)',
     idsEnum.every(id => idsMatriz.indexOf(id) !== -1 || perm.pode(ADMIN, id)));

  // ===================== SEGREDO DE JUSTIÇA =====================
  secao('Segredo de justiça');

  const publico  = { id: 'P1', segredoJustica: false, responsavelId: 'U3', equipeIds: [], status: 'ativo' };
  const secreto  = { id: 'P2', segredoJustica: true,  responsavelId: 'U9', equipeIds: [], status: 'ativo' };
  const secretoMeu = { id: 'P3', segredoJustica: true, responsavelId: 'U3', equipeIds: [], status: 'ativo' };
  const secretoEquipe = { id: 'P4', segredoJustica: true, responsavelId: 'U9', equipeIds: ['U4'], status: 'ativo' };

  ok('processo público é visível a quem tem processos.ver',
     perm.podeVerProcesso(ADVOGADO, publico) && perm.podeVerProcesso(ESTAGIARIO, publico) &&
     perm.podeVerProcesso(FINANCEIRO, publico));
  ok('admin vê processo em segredo', perm.podeVerProcesso(ADMIN, secreto));
  ok('sócio vê processo em segredo', perm.podeVerProcesso(SOCIO, secreto));
  ok('advogado alheio NÃO vê processo em segredo', !perm.podeVerProcesso(ADVOGADO, secreto));
  ok('advogado RESPONSÁVEL vê o próprio processo em segredo',
     perm.podeVerProcesso(ADVOGADO, secretoMeu));
  ok('estagiário da EQUIPE vê o processo em segredo',
     perm.podeVerProcesso(ESTAGIARIO, secretoEquipe));
  ok('estagiário fora da equipe NÃO vê', !perm.podeVerProcesso(ESTAGIARIO, secreto));
  ok('financeiro NÃO vê processo em segredo', !perm.podeVerProcesso(FINANCEIRO, secreto));
  ok('usuário nulo não vê nada', !perm.podeVerProcesso(null, publico));
  ok('processo nulo não é visível', !perm.podeVerProcesso(ADMIN, null));

  ok('filtrarProcessos remove o que não pode ser visto',
     perm.filtrarProcessos(ADVOGADO, [publico, secreto, secretoMeu]).length === 2);
  ok('filtrarProcessos devolve tudo para o admin',
     perm.filtrarProcessos(ADMIN, [publico, secreto, secretoMeu]).length === 3);

  ok('advogado edita processo ativo que enxerga', perm.podeEditarProcesso(ADVOGADO, publico));
  ok('estagiário NÃO edita processo', !perm.podeEditarProcesso(ESTAGIARIO, publico));
  ok('processo arquivado só é editado por admin/sócio',
     !perm.podeEditarProcesso(ADVOGADO, { id: 'P9', status: 'arquivado', segredoJustica: false }) &&
     perm.podeEditarProcesso(SOCIO, { id: 'P9', status: 'arquivado', segredoJustica: false }));
  ok('ninguém edita o que não vê',
     !perm.podeEditarProcesso(ADVOGADO, secreto));

  // Dupla conferência: quem cumpre não confere o próprio prazo (F2.2).
  ok('advogado confere prazo de outro',
     perm.podeConferirPrazo(ADVOGADO, { responsavelId: 'U9' }));
  ok('advogado NÃO confere o próprio prazo',
     !perm.podeConferirPrazo(ADVOGADO, { responsavelId: 'U3' }));
  ok('estagiário não confere prazo nenhum',
     !perm.podeConferirPrazo(ESTAGIARIO, { responsavelId: 'U9' }));

  ok('escopo de relatório é global para o sócio', perm.escopoRelatorio(SOCIO) === null);
  ok('escopo de relatório é próprio para o advogado', perm.escopoRelatorio(ADVOGADO) === 'U3');
  ok('estagiário não vê relatório', perm.escopoRelatorio(ESTAGIARIO) === 'negado');

  ok('nivelDocumento dá edição a quem pode',
     perm.nivelDocumento(ADVOGADO, { id: 'D1' }) === 'editar');
  ok('nivelDocumento nega documento de processo invisível',
     perm.nivelDocumento(ADVOGADO, { id: 'D1' }, secreto) === 'negado');
  ok('nivelDocumento dá só leitura ao financeiro',
     perm.nivelDocumento(FINANCEIRO, { id: 'D1' }) === 'ver');

  // ===================== MENU =====================
  secao('Menu por permissão');
  const Sidebar = App.layout.Sidebar;

  function rotulos(usuario) {
    return Sidebar.itensVisiveis(usuario)
      .filter(i => !i.secao).map(i => i.rotulo);
  }

  ok('admin vê Configurações, Auditoria e Privacidade',
     ['Configurações', 'Auditoria', 'Privacidade'].every(r => rotulos(ADMIN).indexOf(r) !== -1));
  ok('advogado NÃO vê nenhum item de administração',
     ['Configurações', 'Auditoria', 'Privacidade'].every(r => rotulos(ADVOGADO).indexOf(r) === -1));
  ok('advogado continua vendo Processos', rotulos(ADVOGADO).indexOf('Processos') !== -1);

  ok('admin e sócio veem o item Escritório',
     rotulos(ADMIN).indexOf('Escritório') !== -1 &&
     rotulos(SOCIO).indexOf('Escritório') !== -1);
  ok('advogado, estagiário e financeiro NÃO veem o item Escritório',
     [ADVOGADO, ESTAGIARIO, FINANCEIRO].every(u => rotulos(u).indexOf('Escritório') === -1));
  ok('todos veem Meu painel — é a tela inicial de qualquer perfil',
     [ADMIN, SOCIO, ADVOGADO, ESTAGIARIO, FINANCEIRO]
       .every(u => rotulos(u).indexOf('Meu painel') !== -1));

  const secoesAdvogado = Sidebar.itensVisiveis(ADVOGADO).filter(i => i.secao).map(i => i.secao);
  ok('seção "Administração" some quando fica vazia',
     secoesAdvogado.indexOf('Administração') === -1, secoesAdvogado.join(', '));
  ok('seção "Administração" aparece para o admin',
     Sidebar.itensVisiveis(ADMIN).filter(i => i.secao).map(i => i.secao)
       .indexOf('Administração') !== -1);
  ok('nenhuma seção fica sem item, em nenhum perfil',
     [ADMIN, SOCIO, ADVOGADO, ESTAGIARIO, FINANCEIRO].every(u => {
       const itens = Sidebar.itensVisiveis(u);
       return itens.every((item, i) => !item.secao || (itens[i + 1] && !itens[i + 1].secao));
     }));
  ok('sem usuário, itens com permissão somem',
     rotulos(null).indexOf('Processos') === -1);

  // ===================== SESSÃO =====================
  secao('Sessão');
  const db = App.services.db;
  const sessao = App.services.sessaoService;

  db.init(true);
  const usuarios = db.get('usuarios');
  const umAdmin = usuarios.filter(u => u.perfil === 'admin')[0] || usuarios[0];
  const umEstagiario = usuarios.filter(u => u.perfil === 'estagiario')[0];

  ok('o seed traz usuários de vários perfis',
     new Set(usuarios.map(u => u.perfil)).size >= 4,
     String(new Set(usuarios.map(u => u.perfil)).size));
  ok('sem entrar, não há sessão ativa', !sessao.ativa());
  ok('sem entrar, atual() é nulo', sessao.atual() === null);

  const entrada = await sessao.entrar(umAdmin.id);
  ok('entrar devolve usuário e sessão', !!entrada.usuario && !!entrada.sessao);
  ok('sessão fica ativa', sessao.ativa());
  ok('atual() devolve quem entrou', sessao.atual().id === umAdmin.id);
  ok('store recebe o usuário', App.store.getState().usuarioAtual.id === umAdmin.id);
  ok('pode() usa a sessão corrente', sessao.pode('auditoria'));

  const listados = await sessao.listarUsuarios();
  ok('listarUsuarios ordena por perfil (admin primeiro)',
     listados[0].perfil === 'admin', listados[0].perfil);

  // A sessão sobrevive ao recarregamento.
  App.store.setState({ usuarioAtual: null, sessao: null });
  const restaurado = sessao.restaurar();
  ok('restaurar recupera a sessão gravada', !!restaurado && restaurado.id === umAdmin.id);

  // Sessão expirada não é restaurada.
  janela.localStorage.setItem('jurisctrl.sessao.v1', JSON.stringify({
    usuarioId: umAdmin.id,
    perfil: 'admin',
    iniciadaEm: '2020-01-01T00:00:00.000Z',
    expiraEm: '2020-01-01T12:00:00.000Z'
  }));
  App.store.setState({ usuarioAtual: null, sessao: null });
  ok('sessão expirada NÃO é restaurada', sessao.restaurar() === null);
  ok('sessão expirada é apagada do storage',
     janela.localStorage.getItem('jurisctrl.sessao.v1') === null);

  await sessao.entrar(umAdmin.id);
  await sessao.sair();
  ok('sair encerra a sessão', !sessao.ativa() && sessao.atual() === null);

  let recusou = false;
  try { await sessao.entrar('USUARIO-INEXISTENTE'); } catch (e) { recusou = e.codigo === 404; }
  ok('entrar com id inexistente é recusado', recusou);

  // ===================== SEGREDO NO SERVICE =====================
  secao('Segredo de justiça aplicado na camada de dados');
  const processoService = App.services.processoService;

  // Marca um processo como secreto, de um responsável específico.
  const todos = db.get('processos');
  const alvo = todos[0];
  const outroDono = usuarios.filter(u => u.id !== alvo.responsavelId)[0];
  db.update('processos', alvo.id, {
    segredoJustica: true,
    responsavelId: outroDono.id,
    equipeIds: []
  });

  await sessao.entrar(umAdmin.id);
  const comoAdmin = await processoService.listar({});
  ok('admin enxerga o processo em segredo na lista',
     comoAdmin.itens.some(p => p.id === alvo.id));

  const outroEstagiario = umEstagiario || usuarios.filter(u => u.perfil !== 'admin')[0];
  await sessao.entrar(outroEstagiario.id);
  const comoOutro = await processoService.listar({});
  ok('quem não participa NÃO vê o processo em segredo na lista',
     !comoOutro.itens.some(p => p.id === alvo.id));
  ok('a lista dele é menor que a do admin',
     comoOutro.total < comoAdmin.total,
     comoOutro.total + ' vs ' + comoAdmin.total);

  let erro404 = null;
  try {
    await processoService.obter(alvo.id);
  } catch (e) {
    erro404 = e;
  }
  ok('obter() recusa o processo em segredo', !!erro404);
  ok('a recusa é 404, não 403 — não revela que o processo existe',
     erro404 && erro404.codigo === 404, erro404 && String(erro404.codigo));

  const statsOutro = await processoService.estatisticas();
  await sessao.entrar(umAdmin.id);
  const statsAdmin = await processoService.estatisticas();
  ok('os indicadores também respeitam o segredo',
     statsOutro.total < statsAdmin.total,
     statsOutro.total + ' vs ' + statsAdmin.total);

  // Devolve o processo ao estado original para não contaminar o resto.
  db.update('processos', alvo.id, {
    segredoJustica: alvo.segredoJustica,
    responsavelId: alvo.responsavelId,
    equipeIds: alvo.equipeIds
  });

  // ============ SIGILO HERDADO POR PRAZO, TAREFA E COMPROMISSO ============
  /* O que o CPC protege é o PROCESSO. Prazo, tarefa e compromisso só expõem
     o que já está lá — número CNJ, cliente, assunto, vara — e por isso
     herdam a visibilidade dele. Antes disso, os três serviços liam a coleção
     direto e o cartão do dashboard contava (e a agenda MOSTRAVA) caso
     sigiloso para quem não podia abrir o processo. */
  secao('Sigilo herdado — prazo, tarefa e compromisso');

  const prazoService  = App.services.prazoService;
  const tarefaService = App.services.tarefaService;
  const agendaService = App.services.agendaService;

  // Um processo que tenha os três pendurados, senão o teste não mede nada.
  const comTudo = db.get('processos').filter(p =>
    db.get('prazos').some(x => x.processoId === p.id) &&
    db.get('tarefas').some(x => x.processoId === p.id) &&
    db.get('compromissos').some(x => x.processoId === p.id))[0];

  ok('há processo com prazo, tarefa e compromisso para medir', !!comTudo);

  const donoAlheio = usuarios.filter(u =>
    u.id !== comTudo.responsavelId && u.perfil === 'advogado')[0];
  const forasteiro = usuarios.filter(u =>
    u.perfil === 'advogado' && u.id !== donoAlheio.id && u.id !== comTudo.responsavelId)[0];

  const estadoOriginal = {
    segredoJustica: comTudo.segredoJustica,
    responsavelId: comTudo.responsavelId,
    equipeIds: comTudo.equipeIds,
    diasAcessoUrgencia: comTudo.diasAcessoUrgencia
  };

  db.update('processos', comTudo.id, {
    segredoJustica: true, responsavelId: donoAlheio.id, equipeIds: []
  });

  const idsPrazo = db.get('prazos').filter(x => x.processoId === comTudo.id).map(x => x.id);
  const idsTarefa = db.get('tarefas').filter(x => x.processoId === comTudo.id).map(x => x.id);
  const idsComp = db.get('compromissos').filter(x => x.processoId === comTudo.id).map(x => x.id);

  await sessao.entrar(forasteiro.id);

  const prazosForasteiro = await prazoService.listar({});
  ok('prazo de processo sigiloso some para quem não atua',
     !prazosForasteiro.itens.some(x => idsPrazo.indexOf(x.id) !== -1));

  const tarefasForasteiro = await tarefaService.listar({});
  ok('tarefa de processo sigiloso some para quem não atua',
     !tarefasForasteiro.itens.some(x => idsTarefa.indexOf(x.id) !== -1));

  /* A agenda é o vazamento mais grave dos três: o título do compromisso
     carrega o assunto do processo, e o item mostra vara e comarca. Aqui não
     era contagem errada — era conteúdo sigiloso na tela. */
  const proximosForasteiro = await agendaService.proximos(200);
  ok('compromisso de processo sigiloso some da agenda de quem não atua',
     !proximosForasteiro.some(x => idsComp.indexOf(x.id) !== -1));

  const eventosForasteiro = await agendaService.eventos('1900-01-01', '2999-12-31', {});
  ok('e some também do calendário, que é a outra porta do mesmo dado',
     !eventosForasteiro.itens.some(ev => idsComp.indexOf(ev.id) !== -1 ||
                                         idsPrazo.indexOf(ev.id) !== -1));

  ok('o resumo do painel não LISTA prazo crítico de caso sigiloso',
     !(await prazoService.resumo()).criticos.some(x => idsPrazo.indexOf(x.id) !== -1));

  await sessao.entrar(donoAlheio.id);
  const prazosDono = await prazoService.listar({});
  ok('quem é o responsável continua vendo os prazos do próprio caso',
     idsPrazo.every(id => prazosDono.itens.some(x => x.id === id)));

  /* A equipe é o que torna o sigilo praticável — sem ela, dar acesso a
     alguém exigiria trocar o responsável do processo.

     A entrada e a saída da equipe também são a régua para medir a CONTAGEM:
     o mesmo usuário, o mesmo instante, um processo de diferença. Verificar
     só a lista deixaria passar o defeito que importa — recortar depois de
     contar, que produz um total que não bate com o que está logo abaixo
     dele na tela. */
  const abertosDoCaso = db.get('prazos').filter(x =>
    x.processoId === comTudo.id &&
    (x.status === 'pendente' || x.status === 'em_andamento'));

  ok('o caso tem prazo em aberto para a contagem enxergar', abertosDoCaso.length > 0);

  db.update('processos', comTudo.id, { equipeIds: [forasteiro.id] });
  await sessao.entrar(forasteiro.id);
  const prazosNaEquipe = await prazoService.listar({});
  ok('entrar na EQUIPE devolve o acesso ao prazo, sem trocar o responsável',
     idsPrazo.every(id => prazosNaEquipe.itens.some(x => x.id === id)));
  const resumoComAcesso = await prazoService.resumo();

  db.update('processos', comTudo.id, { equipeIds: [] });
  const resumoSemAcesso = await prazoService.resumo();

  ok('a CONTAGEM do resumo cai exatamente os prazos que a pessoa deixou de ver',
     resumoComAcesso.totalAbertos - resumoSemAcesso.totalAbertos === abertosDoCaso.length,
     resumoComAcesso.totalAbertos + ' → ' + resumoSemAcesso.totalAbertos +
     ' (esperado -' + abertosDoCaso.length + ')');

  // ===================== ACESSO DE URGÊNCIA =====================
  /* A válvula do sigilo. Escritório tem plantão: prazo vence hoje e o
     responsável está em audiência. Em vez de barrar, REGISTRA. */
  secao('Acesso de urgência');

  const acesso = App.services.acessoService;
  const motivoBom = 'Prazo de contestacao vence hoje e a responsavel esta em audiencia.';

  await sessao.entrar(forasteiro.id);

  let e400 = null;
  try { await acesso.liberar({ numero: comTudo.numeroInterno, motivo: 'urgente' }); }
  catch (e) { e400 = e; }
  ok('motivo curto é recusado — clique não é justificativa',
     e400 && e400.codigo === 400, e400 && String(e400.codigo));

  /* Não pode virar detector de processo sigiloso: número inexistente e
     número que a pessoa JÁ podia ver têm de responder igual, senão a
     diferença entre as mensagens confirma a existência do caso. */
  let msgInexistente = null, msgJaVisivel = null;
  try { await acesso.liberar({ numero: 'ZZZ-0000-0000', motivo: motivoBom }); }
  catch (e) { msgInexistente = e.codigo + '|' + e.message; }

  const jaVisivel = db.get('processos').filter(p => !p.segredoJustica)[0];
  try { await acesso.liberar({ numero: jaVisivel.numeroInterno, motivo: motivoBom }); }
  catch (e) { msgJaVisivel = e.codigo + '|' + e.message; }

  ok('número inexistente e número já visível respondem IGUAL — sem vazar existência',
     !!msgInexistente && msgInexistente === msgJaVisivel,
     msgInexistente + '  ≠  ' + msgJaVisivel);

  const liberacao = await acesso.liberar({ numero: comTudo.numeroInterno, motivo: motivoBom });
  ok('a liberação devolve o processo pedido', liberacao.processo.id === comTudo.id);

  const abriu = await processoService.obter(comTudo.id);
  ok('depois de liberar, o processo abre', abriu.id === comTudo.id);

  const prazosLiberado = await prazoService.listar({});
  ok('e os prazos dele vêm junto — sem isso a liberação não serviria para nada',
     idsPrazo.every(id => prazosLiberado.itens.some(x => x.id === id)));

  /* Quem chega pela válvula LÊ. A lista de liberados não é passada para
     editar, vincular nem compartilhar. */
  ok('acesso de urgência NÃO dá poder de escrita',
     !perm.podeEditarProcesso(forasteiro, db.get('processos')
       .filter(p => p.id === comTudo.id)[0]));

  const trilha = db.get('logsAuditoria').filter(l => l.acao === 'consultar');
  ok('a consulta vira linha na trilha de auditoria', trilha.length > 0);
  ok('e a linha guarda o motivo escrito pela pessoa',
     trilha.some(l => String(l.resumo).indexOf('audiencia') !== -1));

  ok('a liberação é de quem abriu, e não do escritório',
     acesso.liberados(forasteiro.id).indexOf(comTudo.id) !== -1 &&
     acesso.liberados(donoAlheio.id).indexOf(comTudo.id) === -1);

  // --- validade ---------------------------------------------------------
  ok('a validade padrão sai do processo', acesso.diasDe(comTudo) === acesso.DIAS_PADRAO);
  ok('e o processo pode encurtá-la',
     acesso.diasDe({ diasAcessoUrgencia: 2 }) === 2);

  const motor = App.domain.prazos;
  const oitoDiasAtras = motor.paraISO(motor.addDias(new Date(), -8));
  db.update('liberacoesAcesso', liberacao.id, { quando: oitoDiasAtras + 'T09:00:00.000Z' });

  ok('liberação além da validade deixa de valer',
     acesso.liberados(forasteiro.id).indexOf(comTudo.id) === -1);

  let voltou404 = null;
  try { await processoService.obter(comTudo.id); } catch (e) { voltou404 = e; }
  ok('e o processo volta a responder 404',
     voltou404 && voltou404.codigo === 404, voltou404 && String(voltou404.codigo));

  /* Vencida não se reaproveita: a trilha precisa mostrar que a pessoa
     voltou, e com que motivo desta vez. */
  const segunda = await acesso.liberar({ numero: comTudo.numeroInterno, motivo: motivoBom });
  ok('liberação vencida gera registro NOVO, não reaproveita o antigo',
     segunda.id !== liberacao.id, segunda.id + ' vs ' + liberacao.id);

  await acesso.encerrar(segunda.id);
  ok('encerrar devolve o acesso na hora',
     acesso.liberados(forasteiro.id).indexOf(comTudo.id) === -1);
  ok('e o registro continua na coleção — encerrar não apaga a trilha',
     db.get('liberacoesAcesso').some(l => l.id === segunda.id));

  await sessao.entrar(donoAlheio.id);
  let e403 = null;
  try { await acesso.encerrar(segunda.id); } catch (e) { e403 = e; }
  ok('só quem abriu o acesso pode encerrá-lo',
     e403 && e403.codigo === 403, e403 && String(e403.codigo));

  // --- válvula fechada --------------------------------------------------
  db.update('processos', comTudo.id, { diasAcessoUrgencia: 0 });
  await sessao.entrar(forasteiro.id);
  let eFechada = null;
  try { await acesso.liberar({ numero: comTudo.numeroInterno, motivo: motivoBom }); }
  catch (e) { eFechada = e; }
  ok('processo com zero dia recusa acesso de urgência',
     eFechada && eFechada.codigo === 404, eFechada && String(eFechada.codigo));
  ok('e recusa com a MESMA mensagem — nem a válvula fechada confirma existência',
     eFechada && (eFechada.codigo + '|' + eFechada.message) === msgInexistente);

  // Devolve o processo ao estado original para não contaminar o resto.
  db.update('processos', comTudo.id, estadoOriginal);
  db.get('liberacoesAcesso')
    .filter(l => l.processoId === comTudo.id)
    .forEach(l => db.remove('liberacoesAcesso', l.id));
  await sessao.entrar(umAdmin.id);

  // ===================== AUDITORIA =====================
  secao('Trilha de auditoria');
  const auditoria = App.services.auditoriaService;

  const d1 = auditoria.diferencas({ a: 1, b: 'x' }, { a: 2, b: 'x' });
  ok('diferencas acha só o campo que mudou',
     d1.length === 1 && d1[0].campo === 'a' && d1[0].de === 1 && d1[0].para === 2,
     JSON.stringify(d1));
  ok('diferencas ignora carimbos de tempo',
     auditoria.diferencas({ a: 1, atualizadoEm: 'x' }, { a: 1, atualizadoEm: 'y' }).length === 0);
  ok('diferencas resume array em vez de despejar o conteúdo',
     auditoria.diferencas({ t: [] }, { t: [1, 2, 3] })[0].para === '[3 item(ns)]');
  ok('diferencas resume objeto',
     auditoria.diferencas({ o: null }, { o: { x: 1 } })[0].para === '{…}');
  ok('diferencas trunca texto longo',
     auditoria.diferencas({ s: '' }, { s: 'x'.repeat(300) })[0].para.length === 118);
  ok('diferencas detecta campo novo',
     auditoria.diferencas({ a: 1 }, { a: 1, b: 2 }).length === 1);

  auditoria.iniciar();
  ok('auditoria fica ligada', auditoria.estaLigada());

  const antesDoTeste = db.get('logsAuditoria').length;
  const tarefa = db.insert('tarefas', { titulo: 'Tarefa auditada', status: 'a_fazer' }, 'TAR');
  db.update('tarefas', tarefa.id, { status: 'em_andamento' });
  db.remove('tarefas', tarefa.id);

  const logs = db.get('logsAuditoria').slice(antesDoTeste);
  ok('as três escritas viraram três eventos', logs.length === 3, String(logs.length));
  ok('a criação foi registrada', logs[0].acao === 'criar');
  ok('a alteração guardou o diff',
     logs[1].acao === 'atualizar' && logs[1].alteracoes.length === 1 &&
     logs[1].alteracoes[0].campo === 'status', JSON.stringify(logs[1].alteracoes));
  ok('a exclusão é distinguida da alteração', logs[2].acao === 'remover');
  ok('o evento identifica quem fez', logs[0].usuarioId === umAdmin.id);
  ok('o evento traz um resumo legível', logs[0].resumo === 'Tarefa auditada', logs[0].resumo);

  // A armadilha do módulo: gravar o log é uma escrita.
  const antesRecursao = db.get('logsAuditoria').length;
  db.insert('tarefas', { titulo: 'Outra' }, 'TAR');
  ok('gravar o log NÃO dispara outro log (sem recursão)',
     db.get('logsAuditoria').length === antesRecursao + 1,
     String(db.get('logsAuditoria').length - antesRecursao));

  const antesNoop = db.get('logsAuditoria').length;
  const t2 = db.insert('tarefas', { titulo: 'Sem mudança', status: 'a_fazer' }, 'TAR');
  db.update('tarefas', t2.id, { status: 'a_fazer' });   // grava o mesmo valor
  ok('alteração que não muda nada não vira linha na trilha',
     db.get('logsAuditoria').length === antesNoop + 1,
     String(db.get('logsAuditoria').length - antesNoop));

  const filtrado = await auditoria.listar({ acao: 'remover' });
  ok('listar filtra por ação', filtrado.itens.every(l => l.acao === 'remover'));
  const porColecao = await auditoria.listar({ colecao: 'tarefas' });
  ok('listar filtra por coleção', porColecao.itens.every(l => l.colecao === 'tarefas'));
  ok('listar traz o nome do usuário resolvido',
     porColecao.itens[0] && porColecao.itens[0].usuarioNome === umAdmin.nome);
  ok('listar ordena do mais recente para o mais antigo',
     porColecao.itens.length < 2 || porColecao.itens[0].quando >= porColecao.itens[1].quando);
  ok('colecoesRegistradas lista o que foi tocado',
     auditoria.colecoesRegistradas().indexOf('tarefas') !== -1);
  ok('a trilha não audita a si mesma',
     auditoria.colecoesRegistradas().indexOf('logsAuditoria') === -1);

  const historico = await auditoria.historicoDe('tarefas', tarefa.id);
  ok('historicoDe traz os eventos de um registro só',
     historico.itens.length === 3 && historico.itens.every(l => l.entidadeId === tarefa.id),
     String(historico.itens.length));

  // ===================== LGPD =====================
  secao('LGPD — titulares, prazos e anonimização');
  const privacidade = App.services.privacidadeService;

  const pessoa = db.get('pessoas')[0];

  const sol = await privacidade.criarSolicitacao({
    pessoaId: pessoa.id, tipo: 'acesso', solicitadoEm: '2026-03-02'
  });
  ok('solicitação nasce aberta', sol.status === 'aberta');
  ok('prazo do art. 18 é de 15 dias CORRIDOS (não úteis)',
     sol.prazoAtendimento === '2026-03-17', sol.prazoAtendimento);

  let tipoInvalido = false;
  try {
    await privacidade.criarSolicitacao({ pessoaId: pessoa.id, tipo: 'inventado' });
  } catch (e) { tipoInvalido = e.codigo === 400; }
  ok('tipo de solicitação inválido é recusado', tipoInvalido);

  const listaSol = await privacidade.solicitacoes();
  const minha = listaSol.filter(s => s.id === sol.id)[0];
  ok('solicitação resolve o nome do titular', minha.pessoaNome === pessoa.nome);
  ok('solicitação de 2026-03 já consta como atrasada', minha.atrasada === true);

  await privacidade.atenderSolicitacao(sol.id, 'Dossiê enviado.');
  const depois = (await privacidade.solicitacoes()).filter(s => s.id === sol.id)[0];
  ok('atender fecha a solicitação', depois.status === 'atendida' && !!depois.respondidoEm);
  ok('solicitação atendida não conta como atrasada', depois.atrasada === false);

  const cons = await privacidade.registrarConsentimento({
    pessoaId: pessoa.id, finalidade: 'Representação processual', base: 'contrato'
  });
  ok('consentimento nasce sem revogação', cons.revogadoEm === null);
  await privacidade.revogarConsentimento(cons.id);
  const consRevogado = (await privacidade.consentimentos(pessoa.id))
    .filter(c => c.id === cons.id)[0];
  ok('revogar carimba a data', !!consRevogado.revogadoEm);

  const dossie = await privacidade.dossie(pessoa.id);
  ok('dossiê traz o titular', dossie.titular.id === pessoa.id);
  ok('dossiê lista processos, documentos e consentimentos',
     Array.isArray(dossie.processosComoCliente) &&
     Array.isArray(dossie.documentosVinculados) &&
     Array.isArray(dossie.consentimentos));
  ok('dossiê inclui a trilha de auditoria (direito de acesso)',
     Array.isArray(dossie.trilhaAuditoria));
  ok('dossiê NÃO expõe binário de documento',
     dossie.documentosVinculados.every(d => d.conteudo === undefined && d.arquivo === undefined));
  ok('gerar o dossiê fica registrado na trilha',
     db.get('logsAuditoria').some(l => l.acao === 'exportar' && l.entidadeId === pessoa.id));

  const nomeOriginal = pessoa.nome;
  const anonima = await privacidade.anonimizarTitular(pessoa.id, false);
  ok('anonimizar mascara o nome', anonima.nome !== nomeOriginal && anonima.nome.indexOf('*') !== -1,
     anonima.nome);
  ok('anonimizar mascara o documento', anonima.documento.indexOf('*') !== -1,
     anonima.documento);
  ok('anonimizar carimba a data', !!anonima.anonimizadoEm);
  ok('o REGISTRO permanece (não é delete)', !!db.find('pessoas', pessoa.id));

  const processosDoTitular = db.where('processos', p => p.clienteId === pessoa.id);
  ok('os processos do titular continuam vinculados',
     processosDoTitular.length === dossie.processosComoCliente.length);

  let jaAnonimo = false;
  try { await privacidade.anonimizarTitular(pessoa.id, false); } catch (e) { jaAnonimo = e.codigo === 409; }
  ok('anonimizar duas vezes é recusado', jaAnonimo);

  // ===================== BACKUP =====================
  secao('Backup e restauração');

  const copia = db.getTodosOsDados();
  ok('backup traz todas as coleções da fase 2',
     db.COLECOES_FASE2.every(c => Array.isArray(copia[c])));
  ok('backup inclui os soft-deletados',
     copia.tarefas.some(t => t.ativo === false));

  const textoBackup = JSON.stringify({
    geradoEm: new Date().toISOString(), versao: db.CHAVE, dados: copia
  });

  const quantosAntes = db.get('processos').length;
  db.insert('processos', { numeroCnj: '000', assunto: 'Depois do backup' }, 'PRO');
  ok('processo novo entrou depois do backup', db.get('processos').length === quantosAntes + 1);

  const r = await privacidade.restaurarBackup(textoBackup);
  ok('restaurar devolve o resumo', r.processos === copia.processos.length);
  ok('restaurar desfaz o que veio depois', db.get('processos').length === quantosAntes,
     String(db.get('processos').length));
  ok('backup da mesma versão não é sinalizado como incompatível', r.incompativel === false);

  let jsonRuim = false;
  try { await privacidade.restaurarBackup('{isto não é json'); } catch (e) { jsonRuim = e.codigo === 400; }
  ok('arquivo que não é JSON é recusado', jsonRuim);

  let semEstrutura = false;
  try {
    await privacidade.restaurarBackup('{"dados":{"outra":[]}}');
  } catch (e) { semEstrutura = e.codigo === 400; }
  ok('JSON válido mas que não é backup é recusado', semEstrutura);

  const outraVersao = await privacidade.restaurarBackup(JSON.stringify({
    geradoEm: '2020-01-01T00:00:00.000Z', versao: 'jurisctrl.db.v1', dados: copia
  }));
  ok('backup de outra versão é aceito COM aviso', outraVersao.incompativel === true);

  // Restauração de um backup antigo não pode deixar coleção nova faltando.
  const semColecoes = JSON.parse(JSON.stringify(copia));
  delete semColecoes.lancamentos;
  delete semColecoes.publicacoes;
  await privacidade.restaurarBackup(JSON.stringify({
    geradoEm: '2020-01-01T00:00:00.000Z', versao: db.CHAVE, dados: semColecoes
  }));
  ok('restaurar recria as coleções ausentes',
     db.COLECOES_FASE2.every(c => Array.isArray(db.getTodosOsDados()[c])));

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
