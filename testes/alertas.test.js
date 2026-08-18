/* Verificação de F2.2 — avaliador de alertas, notificações, e-mail simulado,
   dupla conferência e registro de prazo perdido.

   Roda em Node, sem jsdom. O avaliador recebe a data como parâmetro, então
   nenhuma verificação aqui depende do relógio da máquina. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

/* O ambiente carrega o núcleo inteiro — utils, domínio, seed, store e
   services — na ordem de dependência. A lista mora em ambiente.js para
   que um módulo novo no seed não quebre seis suítes de uma vez. */
/* `icones.js` e `Sidebar.js` entram como extras para conferir que o ícone de
   cada aviso é o mesmo do item de menu daquele assunto. Os dois são string e
   dado puros, sem DOM em tempo de definição, então carregam sob Node como o
   resto do núcleo. */
const { App, janela } = criarAmbiente({
  extras: ['src/components/icones.js', 'src/layout/Sidebar.js']
});
const { ok, secao, encerrar } = criarPlacar();

const alertas = App.domain.alertas;
const motor = App.domain.prazos;

/* Data de referência fixa: 2026-08-12 é uma quarta-feira comum, sem feriado
   e fora do recesso — o avaliador se comporta de forma previsível nela. */
const HOJE = '2026-08-12';

/* A data fatal é DERIVADA do próprio motor, não calculada à mão.
   Atenção a duas assinaturas que enganam:
     · somarDiasUteis() devolve Date, não string ISO;
     · ela conta o dia inicial como o 1º, então somarDiasUteis(x, n+1) é que
       equivale a "x mais n dias úteis" — que é o que diasUteisEntre() mede. */
function avancar(iso, diasUteis) {
  return App.format.toISO(motor.somarDiasUteis(iso, diasUteis + 1));
}

function dataFatalCom(diasRestantes, referencia) {
  var de = referencia || HOJE;
  var data = avancar(de, diasRestantes);
  var conferido = motor.diasUteisEntre(de, data);
  if (conferido !== diasRestantes) {
    throw new Error('data fatal errada: pedi ' + diasRestantes + ', deu ' + conferido);
  }
  return data;
}

function prazoEm(diasUteis, extras) {
  var fatal = dataFatalCom(diasUteis);
  return Object.assign({
    id: 'PRZ-' + diasUteis,
    processoId: 'PRO-1',
    titulo: 'Contestação',
    status: 'pendente',
    responsavelId: 'USR-1',
    dataFatal: fatal,
    dataInterna: App.format.toISO(motor.subtrairDiasUteis(fatal, 3)),
    ativo: true
  }, extras || {});
}

(async function () {

  // ===================== AVALIADOR =====================
  secao('Avaliador — quais avisos deveriam existir hoje');

  const base = { usuarios: [{ id: 'USR-1', perfil: 'advogado' }] };

  const so5 = alertas.avaliar(Object.assign({ prazos: [prazoEm(5)] }, base), HOJE);
  ok('prazo a 5 dias úteis dispara (está na régua padrão)',
     so5.some(n => n.tipo === 'prazo_proximo'), JSON.stringify(so5.map(n => n.tipo)));

  const so4 = alertas.avaliar(Object.assign({ prazos: [prazoEm(4)] }, base), HOJE);
  ok('prazo a 4 dias NÃO dispara (não está na régua)',
     !so4.some(n => n.tipo === 'prazo_proximo'), JSON.stringify(so4.map(n => n.tipo)));

  const hoje0 = alertas.avaliar(Object.assign({ prazos: [prazoEm(0)] }, base), HOJE);
  ok('prazo que vence hoje vira aviso crítico',
     hoje0.some(n => n.tipo === 'prazo_hoje' && n.gravidade === 'critica'));

  const vencido = alertas.avaliar(Object.assign({
    prazos: [prazoEm(0, { id: 'PRZ-V', dataFatal: '2026-08-05' })]
  }, base), HOJE);
  ok('prazo vencido vira aviso crítico',
     vencido.some(n => n.tipo === 'prazo_vencido' && n.gravidade === 'critica'));

  /* O vão da régua padrão. 2 dias úteis não está em [5,3,1,0], mas o semáforo
     já pinta esse prazo de vermelho — e era o que o contador do menu contava.
     Sem esta regra, o aviso mais caro do sistema ficava calado por um dia. */
  const doisDias = alertas.avaliar(Object.assign({ prazos: [prazoEm(2)] }, base), HOJE);
  ok('prazo crítico fora da régua avisa mesmo assim',
     doisDias.some(n => n.tipo === 'prazo_proximo'),
     JSON.stringify(doisDias.map(n => n.tipo)));
  ok('e avisa como crítico, igual ao semáforo',
     doisDias.filter(n => n.tipo === 'prazo_proximo').every(n => n.gravidade === 'critica'));
  ok('o piso do vermelho é o de domain/prazos.js, não um número solto aqui',
     motor.semaforo(2) === 'critico' && motor.semaforo(4) === 'atencao');

  ok('fora do vermelho, quem manda continua sendo a régua',
     !alertas.avaliar(Object.assign({ prazos: [prazoEm(4)] }, base), HOJE)
       .some(n => n.tipo === 'prazo_proximo'));

  ok('desligar a regra silencia até o crítico (é a única forma)',
     !alertas.avaliar(Object.assign({ prazos: [prazoEm(2)],
       regrasAlerta: [{ gatilho: 'prazo', antecedenciaDias: [5], ativo: false }] }, base),
       HOJE).some(n => n.tipo.indexOf('prazo') === 0));

  ok('prazo cumprido não gera aviso',
     !alertas.avaliar(Object.assign({
       prazos: [prazoEm(1, { status: 'cumprido' })]
     }, base), HOJE).some(n => n.tipo.indexOf('prazo') === 0));

  ok('prazo cancelado não gera aviso',
     !alertas.avaliar(Object.assign({
       prazos: [prazoEm(1, { status: 'cancelado' })]
     }, base), HOJE).some(n => n.tipo.indexOf('prazo') === 0));

  ok('prazo sem responsável não gera aviso (não há para quem avisar)',
     alertas.avaliar(Object.assign({
       prazos: [prazoEm(1, { responsavelId: null })]
     }, base), HOJE).length === 0);

  // A contagem do prazo é em dias ÚTEIS — é o mesmo motor do art. 219.
  const sexta = '2026-08-14';
  const tresUteisDepois = avancar(sexta, 3);
  ok('a régua do prazo usa dias ÚTEIS, não corridos',
     motor.diasCorridosEntre(sexta, tresUteisDepois) > 3,
     sexta + ' + 3 úteis = ' + tresUteisDepois + ' (' +
     motor.diasCorridosEntre(sexta, tresUteisDepois) + ' corridos)');

  // ===================== IDEMPOTÊNCIA =====================
  secao('Idempotência — rodar de novo não duplica');

  const estadoPrazos = Object.assign({ prazos: [prazoEm(5), prazoEm(1), prazoEm(0)] }, base);
  const rodada1 = alertas.avaliar(estadoPrazos, HOJE);
  const rodada2 = alertas.avaliar(estadoPrazos, HOJE);

  ok('duas avaliações no mesmo dia produzem a mesma lista',
     JSON.stringify(rodada1.map(n => n.chave)) === JSON.stringify(rodada2.map(n => n.chave)));
  ok('as chaves são únicas dentro de uma rodada',
     new Set(rodada1.map(n => n.chave)).size === rodada1.length,
     rodada1.length + ' avisos, ' + new Set(rodada1.map(n => n.chave)).size + ' chaves');
  ok('novidades() contra o que já existe devolve vazio',
     alertas.novidades(rodada2, rodada1).length === 0);
  ok('novidades() contra lista vazia devolve tudo',
     alertas.novidades(rodada1, []).length === rodada1.length);

  /* O MARCO é o que distingue dois avisos do mesmo prazo. Avaliado hoje, o
     prazo abaixo está a 5 dias úteis; dois dias úteis depois, a 3 — e ambos
     estão na régua, então os dois avisos existem e precisam ter chaves
     diferentes, senão o segundo nunca seria criado. */
  const p5 = prazoEm(5);
  const doisDiasDepois = avancar(HOJE, 2);
  const avisoHoje = alertas.avaliar({ prazos: [p5], usuarios: base.usuarios }, HOJE)
    .filter(n => n.tipo === 'prazo_proximo')[0];
  const avisoDepois = alertas.avaliar({ prazos: [p5], usuarios: base.usuarios },
                                      doisDiasDepois)
    .filter(n => n.tipo === 'prazo_proximo')[0];
  ok('o prazo volta a avisar no marco seguinte da régua', !!avisoDepois,
     'restam ' + motor.diasUteisEntre(doisDiasDepois, p5.dataFatal) + ' dias úteis');
  ok('o mesmo prazo em outro marco tem chave diferente',
     !!avisoDepois && avisoHoje.chave !== avisoDepois.chave,
     avisoHoje.chave + ' vs ' + (avisoDepois && avisoDepois.chave));
  ok('o aviso do marco seguinte é novidade em relação ao de hoje',
     alertas.novidades([avisoDepois], [avisoHoje]).length === 1);

  // Prazo vencido repete todo dia, e isso é intencional.
  const amanha = '2026-08-13';
  const pv = prazoEm(0, { id: 'PRZ-V2', dataFatal: '2026-08-05' });
  const v1 = alertas.avaliar({ prazos: [pv], usuarios: base.usuarios }, HOJE)[0];
  const v2 = alertas.avaliar({ prazos: [pv], usuarios: base.usuarios }, amanha)[0];
  ok('prazo vencido tem chave nova a cada dia (repetição intencional)',
     v1.chave !== v2.chave, v1.chave + ' vs ' + v2.chave);

  // ===================== OUTROS GATILHOS =====================
  secao('Compromissos, tarefas e follow-up');

  const comp = alertas.avaliar({
    compromissos: [{ id: 'CMP-1', status: 'agendado', responsavelId: 'USR-1',
                     titulo: 'Audiência de instrução', dataHora: HOJE + 'T14:30',
                     local: 'Fórum', processoId: 'PRO-1', ativo: true }],
    usuarios: base.usuarios
  }, HOJE);
  ok('audiência de hoje vira aviso crítico',
     comp.some(n => n.tipo === 'compromisso' && n.gravidade === 'critica'));

  ok('audiência realizada não gera aviso',
     !alertas.avaliar({
       compromissos: [{ id: 'C2', status: 'realizado', responsavelId: 'USR-1',
                        dataHora: HOJE + 'T10:00', titulo: 'x', ativo: true }],
       usuarios: base.usuarios
     }, HOJE).some(n => n.tipo === 'compromisso'));

  ok('audiência de ontem não gera aviso',
     !alertas.avaliar({
       compromissos: [{ id: 'C3', status: 'agendado', responsavelId: 'USR-1',
                        dataHora: '2026-08-11T10:00', titulo: 'x', ativo: true }],
       usuarios: base.usuarios
     }, HOJE).some(n => n.tipo === 'compromisso'));

  // Compromisso conta em dias CORRIDOS — audiência não adia por ser sábado.
  const sabado = '2026-08-15';
  ok('compromisso a 3 dias CORRIDOS dispara',
     alertas.avaliar({
       compromissos: [{ id: 'C4', status: 'agendado', responsavelId: 'USR-1',
                        dataHora: sabado + 'T10:00', titulo: 'Perícia', ativo: true }],
       usuarios: base.usuarios
     }, HOJE).some(n => n.tipo === 'compromisso'),
     'de ' + HOJE + ' a ' + sabado);

  const tarefa = alertas.avaliar({
    tarefas: [{ id: 'TRF-1', status: 'a_fazer', responsavelId: 'USR-1',
                titulo: 'Reunir documentos', dataVencimento: '2026-08-01', ativo: true }],
    usuarios: base.usuarios
  }, HOJE);
  ok('tarefa atrasada vira aviso', tarefa.some(n => n.tipo === 'tarefa_atrasada'));
  ok('tarefa concluída não gera aviso',
     !alertas.avaliar({
       tarefas: [{ id: 'T2', status: 'concluida', responsavelId: 'USR-1',
                   dataVencimento: '2026-08-01', titulo: 'x', ativo: true }],
       usuarios: base.usuarios
     }, HOJE).some(n => n.tipo === 'tarefa_atrasada'));
  ok('tarefa sem vencimento não gera aviso',
     !alertas.avaliar({
       tarefas: [{ id: 'T3', status: 'a_fazer', responsavelId: 'USR-1', titulo: 'x', ativo: true }],
       usuarios: base.usuarios
     }, HOJE).some(n => n.tipo === 'tarefa_atrasada'));

  // Os gatilhos dos módulos futuros existem e ficam quietos até haver dados.
  ok('gatilhos de F2.4/F2.5/F2.6 não produzem nada com coleções vazias',
     alertas.avaliar({ publicacoes: [], lancamentos: [], leads: [],
                       usuarios: base.usuarios }, HOJE).length === 0);

  /* A fila de publicações inteira, e não só as recém-chegadas: a vinculada
     ainda espera o prazo, a sem vínculo espera alguém achar o processo. É a
     mesma conta que o contador do menu fazia. */
  function pub(id, status) {
    return { id: id, status: status, ativo: true };
  }
  const filaPub = alertas.avaliar({
    publicacoes: [pub('P1', 'nova'), pub('P2', 'vinculada'), pub('P3', 'sem_vinculo'),
                  pub('P4', 'triada'), pub('P5', 'descartada')],
    usuarios: base.usuarios
  }, HOJE).filter(n => n.tipo === 'publicacao_nova');

  ok('publicação vinculada e sem vínculo entram na conta',
     filaPub.length === 1 && filaPub[0].titulo.indexOf('3 publicações') === 0,
     filaPub[0] && filaPub[0].titulo);
  ok('triada e descartada ficam de fora — já foram resolvidas',
     filaPub[0].titulo.indexOf('5 ') !== 0);
  ok('a mensagem separa o que fazer com cada uma',
     /1 aguardando triagem/.test(filaPub[0].mensagem) &&
     /1 sem prazo gerado/.test(filaPub[0].mensagem) &&
     /1 sem processo vinculado/.test(filaPub[0].mensagem), filaPub[0].mensagem);
  ok('quem decide o que é pendente é o catálogo de status',
     App.domain.enums.statusPendentesPublicacao().join(',') === 'nova,vinculada,sem_vinculo');

  const followUp = alertas.avaliar({
    leads: [{ id: 'LED-1', nome: 'Construtora Alfa', etapa: 'proposta',
              responsavelId: 'USR-1', proximoContatoEm: '2026-08-10', ativo: true }],
    usuarios: base.usuarios
  }, HOJE);
  ok('follow-up vencido de lead vira aviso (F2.6 já encontra pronto)',
     followUp.some(n => n.tipo === 'follow_up'));
  ok('lead ganho não gera follow-up',
     !alertas.avaliar({
       leads: [{ id: 'L2', nome: 'x', etapa: 'ganho', responsavelId: 'USR-1',
                 proximoContatoEm: '2026-08-01', ativo: true }],
       usuarios: base.usuarios
     }, HOJE).some(n => n.tipo === 'follow_up'));

  /* O resumo do dia foi removido: ele contava o que já estava logo abaixo dele
     no painel, e com o número congelado na primeira geração do dia. Fica a
     trava para ele não voltar por descuido — todo aviso hoje aponta para uma
     entidade concreta, e é isso que o torna clicável para algum lugar útil. */
  ok('nenhum aviso é um resumo de outros avisos',
     alertas.avaliar(estadoPrazos, HOJE).every(n => n.tipo !== 'digest'));
  ok('todo aviso aponta para uma entidade',
     alertas.avaliar(estadoPrazos, HOJE).every(n => !!n.entidadeColecao));

  // ===================== CATEGORIAS =====================
  secao('Categorias do sino');

  ok('cada tipo do catálogo cai em alguma categoria',
     App.domain.enums.TIPOS_NOTIFICACAO
       .every(t => alertas.categoriaDe(t.id) !== 'outros'),
     App.domain.enums.TIPOS_NOTIFICACAO
       .filter(t => alertas.categoriaDe(t.id) === 'outros').map(t => t.id).join(', '));

  ok('nenhum tipo cai em duas categorias',
     App.domain.enums.CATEGORIAS_NOTIFICACAO
       .reduce((todos, c) => todos.concat(c.tipos), [])
       .every((t, i, lista) => lista.indexOf(t) === i));

  ok('tipo desconhecido não some — vai para Outros',
     alertas.categoriaDe('tipo_que_nao_existe') === 'outros');

  /* O caso que motivou a separação: um lote de publicações e um único prazo
     vencido. Numa lista só das mais recentes, o prazo cairia fora. */
  const lote = [];
  for (let i = 0; i < 30; i++) {
    lote.push({ id: 'NTF-P' + i, tipo: 'publicacao_nova', lidaEm: null });
  }
  lote.push({ id: 'NTF-V', tipo: 'prazo_vencido', lidaEm: null });

  const gavetas = alertas.agruparPorCategoria(lote);
  const prazosGaveta = gavetas.find(g => g.id === 'prazos');
  ok('o prazo vencido não se perde num lote de 30 publicações',
     !!prazosGaveta && prazosGaveta.itens.some(n => n.id === 'NTF-V'));
  ok('a categoria vem antes da que tem mais itens (ordem é urgência)',
     gavetas.findIndex(g => g.id === 'prazos') <
     gavetas.findIndex(g => g.id === 'publicacoes'));
  ok('nada é cortado — o painel é o único lugar onde os avisos existem',
     gavetas.find(g => g.id === 'publicacoes').itens.length === 30);
  ok('categoria vazia não aparece', !gavetas.some(g => g.id === 'financeiro'));
  ok('a gaveta devolve só o que a tela desenha',
     JSON.stringify(Object.keys(gavetas[0]).sort()) === '["id","itens","label"]',
     Object.keys(gavetas[0]).join(', '));

  const misturadas = [
    { id: 'NTF-L1', tipo: 'tarefa_atrasada', lidaEm: '2026-08-12T10:00:00Z' },
    { id: 'NTF-L2', tipo: 'tarefa_atrasada', lidaEm: '2026-08-12T10:00:00Z' },
    { id: 'NTF-L3', tipo: 'tarefa_atrasada', lidaEm: '2026-08-12T10:00:00Z' },
    { id: 'NTF-N',  tipo: 'tarefa_atrasada', lidaEm: null }
  ];
  const tarefas = alertas.agruparPorCategoria(misturadas)[0];
  ok('não lida passa na frente da lida',
     tarefas.itens[0].id === 'NTF-N', tarefas.itens.map(n => n.id).join(', '));
  ok('entre as lidas, a ordem de entrada se mantém (sort estável)',
     tarefas.itens.slice(1).map(n => n.id).join(',') === 'NTF-L1,NTF-L2,NTF-L3');

  ok('lista vazia devolve nenhuma gaveta', alertas.agruparPorCategoria([]).length === 0);

  // ===================== REGRAS =====================
  secao('Regras configuráveis');

  ok('regraDe acha o gatilho', alertas.regraDe([], 'prazo').gatilho === 'prazo');
  ok('regra desativada some', alertas.regraDe(
     [{ gatilho: 'prazo', antecedenciaDias: [5], ativo: false }], 'prazo') === null);
  ok('dispara respeita a régua',
     alertas.dispara({ antecedenciaDias: [5, 3] }, 5) &&
     !alertas.dispara({ antecedenciaDias: [5, 3] }, 4));
  ok('dispara sempre quando já passou da data',
     alertas.dispara({ antecedenciaDias: [5] }, -2));

  const regraApertada = [{ gatilho: 'prazo', antecedenciaDias: [1], canais: ['app'], ativo: true }];
  ok('régua personalizada substitui a padrão',
     !alertas.avaliar({ prazos: [prazoEm(5)], usuarios: base.usuarios,
                        regrasAlerta: regraApertada }, HOJE)
       .some(n => n.tipo === 'prazo_proximo'));
  ok('régua personalizada continua disparando no dia que ela define',
     alertas.avaliar({ prazos: [prazoEm(1)], usuarios: base.usuarios,
                       regrasAlerta: regraApertada }, HOJE)
       .some(n => n.tipo === 'prazo_proximo'));

  // ===================== SERVICE =====================
  secao('Notificações persistidas');

  const db = App.services.db;
  const notif = App.services.notificacaoService;
  db.init(true);

  const usuarios = db.get('usuarios');
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  const admin = usuarios.filter(u => u.perfil === 'admin')[0];
  await App.services.sessaoService.entrar(admin.id);

  const r1 = notif.sincronizar();
  ok('sincronizar grava as notificações do seed', r1.geradas > 0, JSON.stringify(r1));
  const totalDepois = db.get('notificacoes').length;

  const r2 = notif.sincronizar();
  ok('sincronizar de novo não gera nada', r2.geradas === 0, JSON.stringify(r2));
  ok('o total no banco não mudou', db.get('notificacoes').length === totalDepois);

  const doAdvogado = await notif.listar({ usuarioId: advogado.id });
  ok('listar filtra por usuário',
     doAdvogado.itens.every(n => n.usuarioId === advogado.id));
  ok('cada notificação traz a chave do ícone e o destino',
     doAdvogado.itens.every(n => !!n.iconeChave && !!n.destino));

  /* O ícone do aviso é o MESMO do item de menu daquele assunto — é o que faz
     alguém reconhecer para onde o aviso leva antes de ler a linha. Duas
     armadilhas cobertas aqui: chave que não existe no registro (o painel cairia
     no ponto genérico, calado) e chave que existe no registro mas não é usada
     por menu nenhum (aí não é "o mesmo do menu", é um desenho paralelo). */
  const doMenu = {};
  App.layout.Sidebar.ITENS.forEach(i => { if (i.icone) doMenu[i.icone] = i.rotulo; });

  ok('toda chave de ícone de aviso existe no registro de desenhos',
     App.domain.enums.TIPOS_NOTIFICACAO
       .every(t => App.icones.de(t.iconeChave) !== App.icones.REGISTRO.ponto),
     App.domain.enums.TIPOS_NOTIFICACAO
       .filter(t => App.icones.de(t.iconeChave) === App.icones.REGISTRO.ponto)
       .map(t => t.id + '→' + t.iconeChave).join(', '));

  ok('e é a mesma que algum item de menu usa',
     App.domain.enums.TIPOS_NOTIFICACAO.every(t => !!doMenu[t.iconeChave]),
     App.domain.enums.TIPOS_NOTIFICACAO
       .filter(t => !doMenu[t.iconeChave])
       .map(t => t.id + '→' + t.iconeChave).join(', '));

  ok('prazo e compromisso apontam para a Agenda, que é onde eles vivem',
     doMenu[App.domain.enums.achar(App.domain.enums.TIPOS_NOTIFICACAO, 'prazo_vencido').iconeChave] === 'Agenda' &&
     doMenu[App.domain.enums.achar(App.domain.enums.TIPOS_NOTIFICACAO, 'compromisso').iconeChave] === 'Agenda');
  ok('notificação de prazo leva ao processo',
     doAdvogado.itens.filter(n => n.entidadeColecao === 'prazos')
       .every(n => n.destino.indexOf('#/processos/') === 0));
  ok('listar ordena da mais recente para a mais antiga',
     doAdvogado.itens.length < 2 || doAdvogado.itens[0].quando >= doAdvogado.itens[1].quando);

  ok('contarNaoLidas bate com a lista',
     notif.contarNaoLidas(advogado.id) === doAdvogado.naoLidas,
     notif.contarNaoLidas(advogado.id) + ' vs ' + doAdvogado.naoLidas);

  if (doAdvogado.itens.length) {
    const alvo = doAdvogado.itens[0];
    const antes = notif.contarNaoLidas(advogado.id);
    await notif.marcarLida(alvo.id);
    ok('marcar lida reduz o contador', notif.contarNaoLidas(advogado.id) === antes - 1);
    ok('a notificação lida continua na lista',
       (await notif.listar({ usuarioId: advogado.id })).itens.some(n => n.id === alvo.id));
    ok('filtro apenasNaoLidas esconde a lida',
       !(await notif.listar({ usuarioId: advogado.id, apenasNaoLidas: true }))
         .itens.some(n => n.id === alvo.id));

    await notif.arquivar(alvo.id);
    ok('arquivada some da lista padrão',
       !(await notif.listar({ usuarioId: advogado.id })).itens.some(n => n.id === alvo.id));
    ok('arquivada aparece com incluirArquivadas',
       (await notif.listar({ usuarioId: advogado.id, incluirArquivadas: true }))
         .itens.some(n => n.id === alvo.id));
  }

  const marcadas = await notif.marcarTodasLidas(advogado.id);
  ok('marcar todas zera o contador',
     notif.contarNaoLidas(advogado.id) === 0, String(notif.contarNaoLidas(advogado.id)));
  ok('marcar todas informa quantas foram', marcadas.marcadas >= 0);

  // ===================== E-MAIL SIMULADO =====================
  secao('Caixa de saída (e-mail simulado)');

  const caixa = await App.services.emailService.listar();
  ok('o canal e-mail enfileirou mensagens', caixa.length > 0, String(caixa.length));
  ok('toda mensagem tem destinatário, assunto e corpo',
     caixa.every(m => !!m.para && !!m.assunto && !!m.corpoHtml));
  ok('o status declara a simulação', caixa.every(m => m.status === 'simulada'));
  ok('mensagem crítica leva prefixo no assunto',
     caixa.filter(m => m.gravidade === 'critica').every(m => m.assunto.indexOf('[URGENTE]') === 0));
  ok('o corpo cita o destinatário pelo nome',
     caixa[0].corpoHtml.indexOf(caixa[0].paraNome.split(' ')[0]) !== -1);
  ok('nenhuma mensagem sai sem remetente do sistema',
     caixa.every(m => m.de === App.services.emailService.REMETENTE));

  const enviada = await App.services.emailService.enviar({
    para: 'teste@exemplo.com', assunto: 'Assinatura da fase 3', corpoHtml: '<p>oi</p>'
  });
  ok('enviar() tem a assinatura da fase 3 e grava', !!enviada.id);

  await App.services.emailService.limpar();
  ok('limpar esvazia a caixa', (await App.services.emailService.listar()).length === 0);

  // ===================== REGRAS PERSISTIDAS =====================
  secao('Regras do escritório');

  const regraServ = App.services.regraAlertaService;
  ok('sem gravação, valem os padrões', regraServ.vigentes().every(r => r.padrao === true));
  ok('há uma regra por gatilho',
     regraServ.vigentes().length === alertas.REGRAS_PADRAO.length);

  await regraServ.salvar('prazo', { antecedenciaDias: [7, 1] });
  const vigentes = regraServ.vigentes();
  ok('salvar materializa TODAS as regras, não só a alterada',
     vigentes.length === alertas.REGRAS_PADRAO.length && vigentes.every(r => !r.padrao),
     String(vigentes.length));
  ok('a regra alterada guardou a nova régua',
     JSON.stringify(vigentes.filter(r => r.gatilho === 'prazo')[0].antecedenciaDias) === '[7,1]');
  ok('as demais mantiveram o padrão',
     JSON.stringify(vigentes.filter(r => r.gatilho === 'compromisso')[0].antecedenciaDias) ===
     JSON.stringify(alertas.REGRAS_PADRAO.filter(r => r.gatilho === 'compromisso')[0].antecedenciaDias));

  let gatilhoRuim = false;
  try { await regraServ.salvar('inexistente', {}); } catch (e) { gatilhoRuim = e.codigo === 400; }
  ok('gatilho desconhecido é recusado', gatilhoRuim);

  await regraServ.restaurarPadrao();
  ok('restaurar volta aos padrões', regraServ.vigentes().every(r => r.padrao === true));

  ok('dupla conferência vem LIGADA por padrão', regraServ.exigeDuplaConferencia() === true);
  await regraServ.definirDuplaConferencia(false);
  ok('dupla conferência pode ser desligada', regraServ.exigeDuplaConferencia() === false);
  await regraServ.definirDuplaConferencia(true);
  ok('e religada', regraServ.exigeDuplaConferencia() === true);

  // ===================== DUPLA CONFERÊNCIA =====================
  secao('Dupla conferência e prazo perdido');

  const prazoService = App.services.prazoService;
  const abertos = db.get('prazos').filter(p => p.status === 'pendente');
  const prazoTeste = abertos[0];
  const responsavel = usuarios.filter(u => u.id === prazoTeste.responsavelId)[0] || advogado;
  const outro = usuarios.filter(u => u.id !== responsavel.id && u.perfil === 'advogado')[0]
             || usuarios.filter(u => u.id !== responsavel.id && u.perfil === 'socio')[0];

  await App.services.sessaoService.entrar(responsavel.id);
  const cumprido = await prazoService.cumprir(prazoTeste.id);
  ok('cumprir registra quem executou', cumprido.cumpridoPorId === responsavel.id);
  ok('cumprido ainda NÃO está conferido', !cumprido.conferidoEm);

  let mesmaPessoa = false;
  try { await prazoService.conferir(prazoTeste.id); } catch (e) { mesmaPessoa = e.codigo === 409; }
  ok('quem cumpriu NÃO pode conferir o próprio prazo', mesmaPessoa);

  const estagiario = usuarios.filter(u => u.perfil === 'estagiario')[0];
  await App.services.sessaoService.entrar(estagiario.id);
  let semPermissao = false;
  try { await prazoService.conferir(prazoTeste.id); } catch (e) { semPermissao = e.codigo === 403; }
  ok('estagiário não confere prazo (perfil sem o recurso)', semPermissao);

  await App.services.sessaoService.entrar(outro.id);
  const andamentosAntes = db.get('andamentos').length;
  const conferido = await prazoService.conferir(prazoTeste.id);
  ok('outra pessoa consegue conferir', !!conferido.conferidoEm);
  ok('a conferência registra quem conferiu', conferido.conferidoPorId === outro.id);
  ok('a conferência vira andamento no processo',
     db.get('andamentos').length === andamentosAntes + 1);

  let jaConferido = false;
  try { await prazoService.conferir(prazoTeste.id); } catch (e) { jaConferido = e.codigo === 409; }
  ok('conferir duas vezes é recusado', jaConferido);

  const aberto2 = db.get('prazos').filter(p => p.status === 'pendente')[0];
  let naoCumprido = false;
  try { await prazoService.conferir(aberto2.id); } catch (e) { naoCumprido = e.codigo === 409; }
  ok('prazo não cumprido não pode ser conferido', naoCumprido);

  const fila = await prazoService.pendentesDeConferencia();
  ok('a fila de conferência não inclui o já conferido',
     !fila.some(p => p.id === prazoTeste.id));

  // Motivo obrigatório ao registrar perda.
  let semMotivo = false;
  try { await prazoService.marcarPerdido(aberto2.id, ''); } catch (e) { semMotivo = e.codigo === 400; }
  ok('perda sem motivo é recusada', semMotivo);

  let motivoCurto = false;
  try { await prazoService.marcarPerdido(aberto2.id, 'esqueci'); }
  catch (e) { motivoCurto = e.codigo === 400; }
  ok('motivo curto demais é recusado', motivoCurto);

  const antesPerda = db.get('andamentos').length;
  const perdido = await prazoService.marcarPerdido(aberto2.id,
    'Publicação não foi triada a tempo; petição protocolada intempestivamente.');
  ok('perda com motivo é aceita', perdido.status === 'perdido');
  ok('o motivo fica gravado no prazo', perdido.motivoPerda.length > 10);
  ok('a perda registra quem informou', !!perdido.perdidoRegistradoPorId);
  ok('a perda vira andamento na timeline', db.get('andamentos').length === antesPerda + 1);
  ok('o andamento da perda não é visível ao cliente',
     db.get('andamentos').filter(a => a.titulo.indexOf('PRAZO PERDIDO') === 0)
       .every(a => a.visivelCliente === false));

  const reaberto = await prazoService.reabrir(prazoTeste.id);
  ok('reabrir limpa a conferência',
     !reaberto.conferidoEm && !reaberto.conferidoPorId && !reaberto.cumpridoPorId);

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
