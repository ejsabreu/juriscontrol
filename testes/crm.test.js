/* Verificação de F2.6 — funil de prospecção, interações, propostas e a
   conversão de lead em cliente + contrato + processo.

   O teste que mais importa é o da conversão: é onde a informação do funil
   vira cadastro, contrato e dinheiro previsto — e onde perder um dado
   significa o contrato não bater com o que foi oferecido. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

const { App } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();

(async function () {
  const db = App.services.db;
  const leadService = App.services.leadService;
  const interacaoService = App.services.interacaoService;
  const propostaService = App.services.propostaService;

  db.init(true);
  App.services.auditoriaService.iniciar();

  const usuarios = db.get('usuarios');
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  const financeiro = usuarios.filter(u => u.perfil === 'financeiro')[0];
  await App.services.sessaoService.entrar(advogado.id);

  // ===================== SEED =====================
  secao('Funil vindo do seed');

  ok('o seed traz leads', db.get('leads').length === 30, String(db.get('leads').length));
  ok('o seed traz interações', db.get('interacoes').length > 0,
     String(db.get('interacoes').length));
  ok('o seed traz propostas', db.get('propostas').length > 0,
     String(db.get('propostas').length));

  const resumo = leadService.resumo();
  ok('todas as etapas do funil existem no resumo',
     App.domain.enums.ETAPAS_FUNIL.every(e => resumo.porEtapa[e.id] !== undefined));

  /* O funil precisa AFUNILAR: mais gente entrando do que negociando. Um
     quadro retangular não teria taxa de conversão com sentido. */
  ok('há mais leads em "novo" do que em "negociação"',
     resumo.porEtapa.novo.quantidade > resumo.porEtapa.negociacao.quantidade,
     resumo.porEtapa.novo.quantidade + ' vs ' + resumo.porEtapa.negociacao.quantidade);
  ok('há ganhos e perdidos para a taxa fazer sentido',
     resumo.ganhos > 0 && resumo.perdidos > 0,
     resumo.ganhos + ' ganhos, ' + resumo.perdidos + ' perdidos');
  ok('a taxa de conversão é calculada', resumo.taxaConversaoPct > 0,
     resumo.taxaConversaoPct + '%');
  ok('há follow-up vencido para o alerta disparar', resumo.followUpAtrasado > 0,
     String(resumo.followUpAtrasado));
  ok('todo lead perdido tem motivo registrado',
     db.get('leads').filter(l => l.etapa === 'perdido').every(l => !!l.motivoPerda));

  // ===================== PONDERAÇÃO =====================
  secao('Pipeline ponderado');

  const lista = await leadService.listar({});
  const emNovo = lista.filter(l => l.etapa === 'novo')[0];
  ok('o lead herda a probabilidade da etapa', emNovo.probabilidade === 10,
     String(emNovo.probabilidade));
  ok('o valor ponderado é valor × probabilidade',
     emNovo.valorPonderadoCentavos ===
     Math.round(emNovo.valorEstimadoCentavos * 0.1),
     emNovo.valorPonderadoCentavos + ' vs ' +
     Math.round(emNovo.valorEstimadoCentavos * 0.1));

  const somaCheia = lista
    .filter(l => l.etapa !== 'ganho' && l.etapa !== 'perdido')
    .reduce((s, l) => s + l.valorEstimadoCentavos, 0);
  ok('o pipeline ponderado é MENOR que a soma cheia (senão seria fantasia)',
     resumo.pipelinePonderadoCentavos < somaCheia,
     App.format.moeda(resumo.pipelinePonderadoCentavos) + ' vs ' +
     App.format.moeda(somaCheia));

  ok('ganho e perdido ficam fora do pipeline em andamento',
     resumo.pipelinePonderadoCentavos ===
     App.domain.enums.ETAPAS_FUNIL
       .filter(e => e.id !== 'ganho' && e.id !== 'perdido')
       .reduce((s, e) => s + resumo.porEtapa[e.id].ponderadoCentavos, 0));

  // A probabilidade do LEAD manda sobre a da etapa.
  const comProb = await leadService.criar({
    nome: 'Teste probabilidade', valorEstimadoCentavos: 100000, probabilidade: 90
  });
  ok('a probabilidade do lead vence a da etapa', comProb.probabilidade === 90);
  ok('e o ponderado usa a do lead', comProb.valorPonderadoCentavos === 90000,
     String(comProb.valorPonderadoCentavos));

  // ===================== CRUD =====================
  secao('Cadastro de interessado');

  const novo = await leadService.criar({
    nome: 'Construtora Teste Ltda',
    email: 'contato@teste.com', telefone: '11999998888',
    origem: 'indicacao', areaId: 'civel',
    resumoCaso: 'Rescisão de contrato de empreitada',
    valorEstimadoCentavos: 5000000
  });
  ok('o lead nasce na primeira etapa', novo.etapa === 'novo');
  ok('o lead guarda o contato',
     novo.contato.email === 'contato@teste.com' && !!novo.contato.telefone);
  ok('o lead nasce sem cliente vinculado', novo.pessoaId === null);
  ok('o responsável padrão é quem cadastrou', novo.responsavelId === advogado.id);

  let semNome = false;
  try { await leadService.criar({ nome: '   ' }); } catch (e) { semNome = e.codigo === 400; }
  ok('lead sem nome é recusado', semNome);

  // ===================== ETAPAS =====================
  secao('Movimentação no funil');

  const movido = await leadService.mudarEtapa(novo.id, 'contato', {});
  ok('mudar de etapa funciona', movido.etapa === 'contato');
  ok('a probabilidade acompanha a etapa', movido.probabilidade === 25,
     String(movido.probabilidade));
  ok('mudar de etapa registra uma interação',
     (await interacaoService.listar({ leadId: novo.id }))
       .some(i => i.resumo.indexOf('Etapa alterada') === 0));

  let etapaRuim = false;
  try { await leadService.mudarEtapa(novo.id, 'inventada', {}); }
  catch (e) { etapaRuim = e.codigo === 400; }
  ok('etapa inexistente é recusada', etapaRuim);

  /* Perder sem dizer por quê é o que faz o funil não ensinar nada. */
  let semMotivo = false;
  try { await leadService.mudarEtapa(novo.id, 'perdido', {}); }
  catch (e) { semMotivo = e.codigo === 400; }
  ok('marcar como perdido SEM motivo é recusado', semMotivo);

  let motivoCurto = false;
  try { await leadService.mudarEtapa(novo.id, 'perdido', { motivoPerda: 'não' }); }
  catch (e) { motivoCurto = e.codigo === 400; }
  ok('motivo curto demais é recusado', motivoCurto);

  /* Ganhar sem converter deixaria um cliente que não existe em lugar nenhum. */
  let ganhoDireto = false;
  try { await leadService.mudarEtapa(novo.id, 'ganho', {}); }
  catch (e) { ganhoDireto = e.codigo === 409; }
  ok('marcar como ganho sem converter é recusado', ganhoDireto);

  // ===================== INTERAÇÕES =====================
  secao('Histórico de contato');

  const interacao = await interacaoService.criar({
    leadId: novo.id, tipo: 'ligacao', duracaoMin: 20,
    resumo: 'Cliente explicou o caso e ficou de enviar o contrato.',
    proximoPasso: 'Analisar o contrato', proximoContatoEm: '2026-12-01'
  });
  ok('a interação é registrada', interacao.tipo === 'ligacao');
  ok('a interação resolve o ícone e o rótulo', !!interacao.icone && !!interacao.rotuloTipo);

  /* Registrar contato reagenda o follow-up: sem isso o lead continuaria
     marcado como atrasado logo depois de ser atendido. */
  ok('registrar contato reagenda o follow-up',
     db.find('leads', novo.id).proximoContatoEm === '2026-12-01');

  let semVinculo = false;
  try { await interacaoService.criar({ tipo: 'ligacao', resumo: 'x' }); }
  catch (e) { semVinculo = e.codigo === 400; }
  ok('interação sem lead, cliente ou processo é recusada', semVinculo);

  let tipoRuim = false;
  try { await interacaoService.criar({ leadId: novo.id, tipo: 'telepatia' }); }
  catch (e) { tipoRuim = e.codigo === 400; }
  ok('tipo de interação inválido é recusado', tipoRuim);

  const doLead = await interacaoService.listar({ leadId: novo.id });
  ok('listar por lead traz o histórico', doLead.length >= 2, String(doLead.length));
  ok('o histórico vem do mais recente para o mais antigo',
     doLead.length < 2 || doLead[0].quando >= doLead[1].quando);

  // ===================== PROPOSTAS =====================
  secao('Propostas');

  const proposta = await propostaService.criar({
    leadId: novo.id,
    escopo: 'Ação de rescisão contratual',
    validadeDias: 15,
    honorarios: { modalidade: 'misto', valorFixoCentavos: 800000,
                  percentualExito: 20, numParcelas: 4 }
  });
  ok('a proposta nasce em rascunho', proposta.status === 'rascunho');
  ok('a proposta ganha número sequencial do ano',
     /^\d{3}\/\d{4}$/.test(proposta.numero), proposta.numero);
  ok('a proposta guarda os honorários combinados',
     proposta.honorarios.valorFixoCentavos === 800000 &&
     proposta.honorarios.percentualExito === 20);

  let modalidadeRuim = false;
  try {
    await propostaService.criar({ leadId: novo.id, honorarios: { modalidade: 'x' } });
  } catch (e) { modalidadeRuim = e.codigo === 400; }
  ok('modalidade inválida é recusada', modalidadeRuim);

  const enviada = await propostaService.enviar(proposta.id);
  ok('enviar muda o status', enviada.status === 'enviada');
  ok('enviar carimba a data', !!enviada.dataEnvio);
  /* Enviar a proposta É o fato que muda a etapa — obrigar a arrastar o card
     depois só cria a chance de esquecer. */
  ok('enviar move o lead para a etapa de proposta',
     db.find('leads', novo.id).etapa === 'proposta',
     db.find('leads', novo.id).etapa);
  ok('enviar registra a interação',
     (await interacaoService.listar({ leadId: novo.id }))
       .some(i => i.resumo.indexOf('Proposta') === 0));

  let jaEnviada = false;
  try { await propostaService.enviar(proposta.id); } catch (e) { jaEnviada = e.codigo === 409; }
  ok('enviar duas vezes é recusado', jaEnviada);

  // Expiração calculada na LEITURA, não por job noturno.
  ok('proposta com validade futura não está expirada',
     propostaService.situacao({ status: 'enviada', validadeAte: '2030-01-01' }) === 'enviada');
  ok('proposta vencida é lida como expirada',
     propostaService.situacao({ status: 'enviada', validadeAte: '2020-01-01' }) === 'expirada');
  ok('proposta aceita não expira',
     propostaService.situacao({ status: 'aceita', validadeAte: '2020-01-01' }) === 'aceita');
  ok('rascunho não expira',
     propostaService.situacao({ status: 'rascunho', validadeAte: '2020-01-01' }) === 'rascunho');

  const texto = await propostaService.gerarTexto(proposta.id);
  ok('o texto da proposta traz o número', texto.html.indexOf(proposta.numero) !== -1);
  ok('o texto traz o valor por extenso',
     texto.html.indexOf('oito mil reais') !== -1, texto.html.slice(0, 200));
  ok('o texto traz o percentual de êxito', texto.html.indexOf('20%') !== -1);

  // ===================== CONVERSÃO =====================
  secao('Conversão em cliente');

  const pessoasAntes = db.get('pessoas').length;
  const contratosAntes = db.get('contratos').length;
  const processosAntes = db.get('processos').length;
  const lancamentosAntes = db.get('lancamentos').length;

  const conversao = await leadService.converter(novo.id, {
    pessoa: {
      nome: 'Construtora Teste Ltda', tipo: 'PJ',
      documento: '11222333000181', email: 'contato@teste.com'
    },
    contrato: {
      modalidade: 'misto', valorFixoCentavos: 800000,
      percentualExito: 20, numParcelas: 4, diaVencimento: 10
    },
    processo: { criar: true, assunto: 'Rescisão contratual', tribunalId: 'tjsp' }
  });

  ok('a conversão cria o cliente', db.get('pessoas').length === pessoasAntes + 1);
  ok('a conversão cria o contrato', db.get('contratos').length === contratosAntes + 1);
  ok('a conversão cria o processo', db.get('processos').length === processosAntes + 1);
  ok('a conversão gera as parcelas',
     db.get('lancamentos').length === lancamentosAntes + 4,
     String(db.get('lancamentos').length - lancamentosAntes));

  ok('o lead fica marcado como ganho', conversao.lead.etapa === 'ganho');
  ok('o lead aponta para a pessoa criada', conversao.lead.pessoaId === conversao.pessoaId);
  ok('o lead carimba a data da conversão', !!conversao.lead.convertidoEm);

  const clienteNovo = db.find('pessoas', conversao.pessoaId);
  ok('a pessoa nasce marcada como cliente', clienteNovo.ehCliente === true);

  const contratoNovo = db.find('contratos', conversao.contratoId);
  ok('o contrato aponta para o cliente e o processo',
     contratoNovo.clienteId === conversao.pessoaId &&
     contratoNovo.processoId === conversao.processoId);
  /* O contrato precisa bater com o que foi OFERECIDO — é aqui que o
     desconto some quando se redigita. */
  ok('o contrato bate com a proposta aceita',
     contratoNovo.valorFixoCentavos === proposta.honorarios.valorFixoCentavos &&
     contratoNovo.percentualExito === proposta.honorarios.percentualExito);

  const processoNovo = db.find('processos', conversao.processoId);
  ok('o processo aponta para o cliente', processoNovo.clienteId === conversao.pessoaId);
  ok('o processo nasce na distribuição', processoNovo.faseId === 'distribuicao');
  ok('o processo herda a área do lead', processoNovo.areaId === 'civel');

  ok('a proposta enviada é fechada como aceita',
     db.find('propostas', proposta.id).status === 'aceita');

  const parcelas = db.get('lancamentos').filter(l => l.contratoId === conversao.contratoId);
  ok('as parcelas somam o valor do contrato',
     parcelas.reduce((s, p) => s + p.valorCentavos, 0) === 800000,
     String(parcelas.reduce((s, p) => s + p.valorCentavos, 0)));
  ok('as parcelas nascem previstas', parcelas.every(p => p.status === 'previsto'));

  ok('a conversão fica na trilha de auditoria',
     db.get('logsAuditoria').some(l => l.resumo &&
       l.resumo.indexOf('Lead convertido') === 0));

  let jaConvertido = false;
  try { await leadService.converter(novo.id, { contrato: {} }); }
  catch (e) { jaConvertido = e.codigo === 409; }
  ok('converter duas vezes é recusado', jaConvertido);

  // CPF/CNPJ inválido não passa.
  const outroLead = await leadService.criar({ nome: 'Fulano de Tal' });
  let documentoRuim = false;
  try {
    await leadService.converter(outroLead.id, {
      pessoa: { nome: 'Fulano', documento: '11111111111' }, contrato: {}
    });
  } catch (e) { documentoRuim = e.codigo === 400; }
  ok('CPF inválido barra a conversão', documentoRuim);

  /* Cliente já cadastrado com o mesmo documento é REAPROVEITADO — converter
     duas vezes o mesmo CNPJ não pode criar duas fichas. */
  const maisUm = await leadService.criar({ nome: 'Construtora Teste Ltda (2º caso)' });
  const pessoasAntesDup = db.get('pessoas').length;
  const semDuplicar = await leadService.converter(maisUm.id, {
    pessoa: { nome: 'Construtora Teste Ltda', tipo: 'PJ', documento: '11222333000181' },
    contrato: { modalidade: 'fixo', valorFixoCentavos: 100000, numParcelas: 1 }
  });
  ok('cliente com o mesmo CNPJ é reaproveitado, não duplicado',
     db.get('pessoas').length === pessoasAntesDup,
     String(db.get('pessoas').length - pessoasAntesDup));
  ok('e o novo contrato aponta para a ficha existente',
     semDuplicar.pessoaId === conversao.pessoaId);

  // Conversão sem processo — a ação nem sempre foi distribuída ainda.
  const semProcesso = await leadService.criar({ nome: 'Cliente consultivo' });
  const processosAntes2 = db.get('processos').length;
  const rSemProcesso = await leadService.converter(semProcesso.id, {
    pessoa: { nome: 'Cliente consultivo', tipo: 'PF' },
    contrato: { modalidade: 'mensal', valorFixoCentavos: 0, numParcelas: 1 },
    processo: { criar: false }
  });
  ok('conversão sem processo é permitida', rSemProcesso.processoId === null);
  ok('nenhum processo foi criado', db.get('processos').length === processosAntes2);
  ok('mas o cliente e o contrato existem',
     !!rSemProcesso.pessoaId && !!rSemProcesso.contratoId);

  // ===================== ALERTA DE FOLLOW-UP =====================
  secao('Follow-up e alertas (integração com F2.2)');

  const atrasado = await leadService.criar({
    nome: 'Lead esquecido', responsavelId: advogado.id,
    proximoContatoEm: '2020-01-01'
  });
  ok('o lead com data passada é marcado como atrasado',
     (await leadService.obter(atrasado.id)).followUpAtrasado === true);

  /* O gatilho foi escrito em F2.2 e ficava quieto sem dados. Agora dispara. */
  const avisos = App.domain.alertas.avaliar({
    leads: db.get('leads'), usuarios: usuarios
  }, App.domain.prazos.hojeISO(), new Date(2026, 7, 12, 9, 0, 0));
  ok('o avaliador de F2.2 gera aviso de follow-up',
     avisos.some(n => n.tipo === 'follow_up'),
     avisos.filter(n => n.tipo === 'follow_up').length + ' aviso(s)');
  ok('o aviso aponta para o lead',
     avisos.filter(n => n.tipo === 'follow_up')
       .every(n => n.entidadeColecao === 'leads' && !!n.entidadeId));
  ok('lead ganho não gera follow-up',
     !avisos.some(n => n.tipo === 'follow_up' && n.entidadeId === conversao.lead.id));

  // ===================== HISTÓRICO UNIFICADO =====================
  secao('O histórico do cliente começa antes de ele ser cliente');

  const daPessoa = await interacaoService.listar({ pessoaId: conversao.pessoaId });
  ok('as interações do LEAD aparecem na ficha do cliente',
     daPessoa.length > 0, String(daPessoa.length));
  ok('e continuam marcadas como vindas do lead',
     daPessoa.some(i => i.leadId === novo.id));

  const direta = await interacaoService.criar({
    pessoaId: conversao.pessoaId, tipo: 'reuniao',
    resumo: 'Reunião de alinhamento já como cliente.'
  });
  ok('interação registrada direto no cliente funciona', !!direta.id);
  ok('e o histórico soma as duas fases',
     (await interacaoService.listar({ pessoaId: conversao.pessoaId })).length ===
     daPessoa.length + 1);

  // ===================== PERMISSÕES =====================
  secao('Permissões do CRM');

  const perm = App.domain.permissoes;
  ok('advogado vê o CRM', perm.pode(advogado, 'crm.ver'));
  ok('sócio vê o CRM',
     perm.pode(usuarios.filter(u => u.perfil === 'socio')[0], 'crm.ver'));
  ok('financeiro NÃO vê o CRM', !perm.pode(financeiro, 'crm.ver'));
  ok('estagiário NÃO vê o CRM',
     !perm.pode(usuarios.filter(u => u.perfil === 'estagiario')[0], 'crm.ver'));

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
