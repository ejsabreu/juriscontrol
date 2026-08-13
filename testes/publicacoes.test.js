/* Verificação de F2.4 — classificador, fila de triagem e o ciclo
   publicação → prazo → notificação.

   O classificador é testado com textos no formato do diário, não com frases
   soltas: é assim que ele erra na vida real. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

/* O ambiente carrega o núcleo inteiro — utils, domínio, seed, store e
   services — na ordem de dependência. A lista mora em ambiente.js para
   que um módulo novo no seed não quebre seis suítes de uma vez. */
const { App, janela } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();

const cl = App.domain.classificador;

(async function () {

  // ===================== CLASSIFICADOR =====================
  secao('Classificador — que ato a publicação exige');

  const contestacao = cl.classificar(
    'Fica a parte requerida CITADA para, querendo, apresentar contestação no prazo de ' +
    '15 (quinze) dias úteis, sob pena de revelia, nos termos do art. 344 do CPC.');
  ok('reconhece contestação', contestacao.tipoPrazoId === 'contestacao', contestacao.tipoPrazoId);
  ok('acerta o prazo da contestação', contestacao.dias === 15);
  ok('tem confiança alta com termo decisivo', contestacao.confianca === 'alta',
     contestacao.confianca);
  ok('mostra os termos que sustentaram a sugestão', contestacao.termos.length > 0,
     contestacao.termos.join(', '));

  const embargos = cl.classificar(
    'Intimadas as partes do acórdão, com prazo de 5 (cinco) dias para embargos de ' +
    'declaração, caso haja omissão, contradição ou obscuridade.');
  ok('reconhece embargos de declaração', embargos.tipoPrazoId === 'embargos', embargos.tipoPrazoId);
  ok('acerta o prazo de 5 dias dos embargos', embargos.dias === 5, String(embargos.dias));

  const apelacao = cl.classificar(
    'Publicada a sentença. Intimadas as partes, fluindo o prazo de 15 (quinze) dias ' +
    'úteis para interposição de recurso de apelação.');
  ok('reconhece apelação e não confunde com sentença',
     apelacao.tipoPrazoId === 'recurso_ape', apelacao.tipoPrazoId);

  const contrarrazoes = cl.classificar(
    'Intimada a parte apelada para apresentar contrarrazões ao recurso de apelação no ' +
    'prazo de 15 (quinze) dias úteis.');
  ok('distingue contrarrazões de apelação',
     contrarrazoes.tipoPrazoId === 'contrarrazoes', contrarrazoes.tipoPrazoId);

  const cumprimento = cl.classificar(
    'Intimado o executado para cumprimento voluntário no prazo de 15 (quinze) dias, ' +
    'sob pena de multa de 10%, nos termos do art. 523 do CPC.');
  ok('reconhece cumprimento voluntário',
     cumprimento.tipoPrazoId === 'cumprimento', cumprimento.tipoPrazoId);

  const manifestacao = cl.classificar(
    'Manifeste-se a parte autora, no prazo de 5 (cinco) dias, sobre o laudo pericial.');
  ok('reconhece manifestação sobre laudo',
     manifestacao.tipoPrazoId === 'manifestacao', manifestacao.tipoPrazoId);

  const replica = cl.classificar(
    'Intime-se a parte autora para apresentar réplica à contestação no prazo de ' +
    '15 (quinze) dias úteis.');
  ok('distingue réplica de contestação, apesar da palavra "contestação"',
     replica.tipoPrazoId === 'reptreplica', replica.tipoPrazoId);

  /* Reconhecer o que NÃO abre prazo importa tanto quanto o resto: sugerir
     prazo em mero expediente enche a agenda de prazo fantasma. */
  const semPrazo = cl.classificar(
    'Ciência às partes do desarquivamento. Cumpra-se, publique-se. Trata-se de ' +
    'despacho de mero expediente, sem prazo a ser observado.');
  ok('reconhece despacho que NÃO abre prazo', semPrazo.abrePrazo === false);
  ok('informa por que concluiu que não abre prazo', !!semPrazo.motivoSemPrazo,
     semPrazo.motivoSemPrazo);

  const homologacao = cl.classificar(
    'Homologo por sentença o acordo. Transitado em julgado, arquivem-se os autos.');
  ok('acordo homologado não abre prazo', homologacao.abrePrazo === false);

  const vazio = cl.classificar('');
  ok('texto vazio não inventa tipo', vazio.tipoPrazoId === null);
  ok('texto vazio tem confiança nenhuma', vazio.confianca === 'nenhuma');

  const generico = cl.classificar('Aos autos. Nada mais.');
  ok('texto irreconhecível não inventa tipo', generico.tipoPrazoId === null,
     generico.tipoPrazoId);

  ok('acento e caixa não atrapalham',
     cl.classificar('APRESENTAR CONTESTACAO NO PRAZO DE 15 DIAS').tipoPrazoId === 'contestacao');

  // ===================== EXTRAÇÃO =====================
  secao('Extração de dados do texto');

  const cnjValido = App.domain.cnj.montar(1234, 2024, 8, 26, 100);
  ok('extrai CNJ formatado do texto',
     cl.extrairCnj('Processo n. ' + cnjValido + ' — Procedimento Comum') === cnjValido);
  ok('extrai CNJ sem pontuação',
     cl.extrairCnj('Autos ' + cnjValido.replace(/\D/g, '')) === cnjValido);
  ok('IGNORA número com dígito verificador errado',
     cl.extrairCnj('Processo n. 0001234-99.2024.8.26.0100') === null);
  ok('devolve null quando não há número', cl.extrairCnj('Sem número aqui') === null);

  ok('lê o prazo dito em dígitos',
     cl.extrairPrazoTexto('no prazo de 15 (quinze) dias').dias === 15);
  ok('lê o prazo dito por extenso',
     cl.extrairPrazoTexto('no prazo de cinco dias').dias === 5,
     JSON.stringify(cl.extrairPrazoTexto('no prazo de cinco dias')));
  ok('lê "em 05 dias"', cl.extrairPrazoTexto('manifeste-se em 05 dias').dias === 5);
  ok('detecta prazo em dobro',
     cl.extrairPrazoTexto('prazo de 15 dias, em dobro por serem litisconsortes').emDobro === true);
  ok('sem prazo no texto devolve null', cl.extrairPrazoTexto('Aos autos.') === null);

  /* O texto manda sobre a tabela: o juiz pode fixar prazo diferente do legal,
     e é o que ele escreveu que vale. */
  const prazoAtipico = cl.classificar(
    'Apresente contestação no prazo de 30 (trinta) dias, por se tratar da Fazenda Pública.');
  ok('o prazo dito no texto vence a tabela', prazoAtipico.dias === 30, String(prazoAtipico.dias));
  ok('mas o tipo continua sendo reconhecido', prazoAtipico.tipoPrazoId === 'contestacao');

  const comAdvogado = cl.extrairAdvogados(
    'Advogado: André Tavares Pinto - OAB/SP 284917\nAdv: Maria Souza - OAB/RJ 112233');
  ok('extrai advogados com OAB', comAdvogado.length === 2, JSON.stringify(comAdvogado));
  ok('separa número e UF da OAB',
     comAdvogado[0].oab === '284917' && comAdvogado[0].uf === 'SP',
     JSON.stringify(comAdvogado[0]));

  const analise = cl.analisar(
    '1ª Vara Cível da Comarca de São Paulo\nProcesso n. ' + cnjValido + '\n' +
    'Advogado: André Tavares Pinto - OAB/SP 284917\n\n' +
    'Fica a parte requerida citada para apresentar contestação no prazo de 15 dias.');
  ok('analisar devolve o CNJ', analise.numeroCnj === cnjValido);
  ok('analisar devolve os advogados', analise.advogados.length === 1);
  ok('analisar devolve a sugestão', analise.sugestao.tipoPrazoId === 'contestacao');

  // ===================== SEED =====================
  secao('Fila de triagem vinda do seed');

  const db = App.services.db;
  const pubService = App.services.publicacaoService;
  db.init(true);
  App.services.auditoriaService.iniciar();

  const usuarios = db.get('usuarios');
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  const estagiario = usuarios.filter(u => u.perfil === 'estagiario')[0];
  await App.services.sessaoService.entrar(advogado.id);

  ok('o seed traz publicações', db.get('publicacoes').length > 0,
     String(db.get('publicacoes').length));
  ok('o seed traz monitoramentos por OAB',
     db.get('monitoramentos').length > 0 &&
     db.get('monitoramentos').every(m => m.tipo === 'oab'));

  const resumo = pubService.resumo();
  ok('há publicações novas na fila', resumo.novas > 0, String(resumo.novas));
  ok('há publicações já triadas e descartadas',
     resumo.triadas > 0 && resumo.descartadas > 0,
     resumo.triadas + ' triadas, ' + resumo.descartadas + ' descartadas');
  ok('o badge conta só o que exige ação',
     resumo.pendentes === resumo.novas + resumo.vinculadas + resumo.semVinculo);

  const listaTodas = await pubService.listar({});
  ok('toda publicação do seed traz um CNJ detectável',
     listaTodas.itens.every(p => !!p.analise.numeroCnj),
     listaTodas.itens.filter(p => !p.analise.numeroCnj).length + ' sem CNJ');
  ok('a fila vem da mais recente para a mais antiga',
     listaTodas.itens.length < 2 ||
     listaTodas.itens[0].dataDisponibilizacao >= listaTodas.itens[1].dataDisponibilizacao);
  ok('o classificador reconhece a maioria dos textos do seed',
     listaTodas.itens.filter(p => p.sugestao.tipoPrazoId).length >=
     listaTodas.itens.length * 0.7,
     listaTodas.itens.filter(p => p.sugestao.tipoPrazoId).length + ' de ' +
     listaTodas.itens.length);
  ok('o seed inclui publicação que NÃO abre prazo',
     listaTodas.itens.some(p => p.sugestao.abrePrazo === false));

  const soNovas = await pubService.listar({ status: 'nova' });
  ok('listar filtra por status', soNovas.itens.every(p => p.status === 'nova'));

  const porTexto = await pubService.listar({ busca: 'contestação' });
  ok('listar busca no texto integral', porTexto.itens.length > 0, String(porTexto.itens.length));

  // ===================== VÍNCULO =====================
  secao('Vínculo por número CNJ');

  const antesVinculo = pubService.resumo();
  const r = await pubService.vincularAutomaticamente();
  ok('o vínculo automático processa a fila', r.vinculadas + r.semVinculo === antesVinculo.novas,
     JSON.stringify(r));
  ok('as publicações do seed casam com processos do escritório', r.vinculadas > 0,
     String(r.vinculadas));
  ok('nenhuma publicação nova sobrou sem decisão',
     pubService.resumo().novas === 0, String(pubService.resumo().novas));

  const vinculada = (await pubService.listar({ status: 'vinculada' })).itens[0];
  ok('a publicação vinculada aponta para o processo', !!vinculada.processoId);
  ok('o número detectado bate com o do processo',
     vinculada.processoNumero === vinculada.numeroCnjDetectado,
     vinculada.processoNumero + ' vs ' + vinculada.numeroCnjDetectado);

  ok('processoPorCnj acha pelo número com pontuação',
     pubService.processoPorCnj(vinculada.numeroCnjDetectado).id === vinculada.processoId);
  ok('processoPorCnj acha pelo número sem pontuação',
     pubService.processoPorCnj(
       vinculada.numeroCnjDetectado.replace(/\D/g, '')).id === vinculada.processoId);
  ok('processoPorCnj devolve null para número desconhecido',
     pubService.processoPorCnj('0000000-00.2000.8.26.0000') === null);

  // ===================== GERAR PRAZO =====================
  secao('Publicação vira prazo');

  const prazosAntes = db.get('prazos').length;
  const andamentosAntes = db.get('andamentos').length;

  const gerado = await pubService.gerarPrazo(vinculada.id, {});
  ok('o prazo foi criado', db.get('prazos').length === prazosAntes + 1);
  ok('o andamento foi criado', db.get('andamentos').length === andamentosAntes + 1);
  ok('o andamento é do tipo publicação', gerado.andamento.tipo === 'publicacao');
  ok('o andamento guarda o texto integral',
     gerado.andamento.descricao === vinculada.textoIntegral);

  /* A rastreabilidade que o modelo da fase 1 previa e ninguém usava. */
  ok('o prazo aponta para o andamento que o originou',
     gerado.prazo.andamentoOrigemId === gerado.andamento.id);
  ok('o prazo herda a data de disponibilização da publicação',
     gerado.prazo.dataDisponibilizacao === vinculada.dataDisponibilizacao,
     gerado.prazo.dataDisponibilizacao + ' vs ' + vinculada.dataDisponibilizacao);

  // O motor da fase 1 é quem conta — aqui só se confere que foi ele mesmo.
  const conferencia = App.domain.prazos.calcular({
    dataDisponibilizacao: vinculada.dataDisponibilizacao,
    dias: gerado.prazo.quantidadeDias,
    tipoContagem: gerado.prazo.tipoContagem,
    diasAntecedencia: 3
  });
  ok('a data fatal é a que o motor do CPC calcula',
     gerado.prazo.dataFatal === conferencia.dataFatal,
     gerado.prazo.dataFatal + ' vs ' + conferencia.dataFatal);
  ok('a publicação no DJe é o 1º dia útil seguinte (art. 224 §2º)',
     gerado.prazo.dataPublicacao > gerado.prazo.dataDisponibilizacao);
  ok('o prazo interno vem antes da data fatal',
     gerado.prazo.dataInterna < gerado.prazo.dataFatal);
  ok('o prazo nasce pendente', gerado.prazo.status === 'pendente');
  ok('o prazo NÃO nasce visível ao cliente', gerado.prazo.visivelCliente === false);

  ok('a publicação ficou triada', gerado.publicacao.status === 'triada');
  ok('a publicação guarda o prazo gerado', gerado.publicacao.prazoGeradoId === gerado.prazo.id);
  ok('a publicação registra quem triou', gerado.publicacao.triadaPorId === advogado.id);

  let jaGerou = false;
  try { await pubService.gerarPrazo(vinculada.id, {}); } catch (e) { jaGerou = e.codigo === 409; }
  ok('gerar prazo duas vezes da mesma publicação é recusado', jaGerou);

  const semProcesso = (await pubService.listar({ status: 'sem_vinculo' })).itens[0];
  if (semProcesso) {
    let semVinculo = false;
    try { await pubService.gerarPrazo(semProcesso.id, {}); }
    catch (e) { semVinculo = e.codigo === 409; }
    ok('não gera prazo de publicação sem processo vinculado', semVinculo);
  } else {
    ok('não gera prazo de publicação sem processo vinculado', true, 'nenhuma sem vínculo');
  }

  // Ajustes manuais vencem a sugestão — a triagem é do advogado.
  const outra = (await pubService.listar({ status: 'vinculada' })).itens[0];
  if (outra) {
    const ajustado = await pubService.gerarPrazo(outra.id, {
      tipoPrazoId: 'embargos', dias: 5, tipoContagem: 'uteis', diasAntecedencia: 2
    });
    ok('o ajuste manual vence a sugestão do classificador',
       ajustado.prazo.tipoPrazoId === 'embargos' && ajustado.prazo.quantidadeDias === 5,
       ajustado.prazo.tipoPrazoId + '/' + ajustado.prazo.quantidadeDias);
  }

  // O responsável precisa ficar sabendo — é a razão de o módulo existir.
  const notificacoes = db.get('notificacoes');
  ok('gerar prazo aciona o avaliador de alertas', notificacoes.length > 0,
     String(notificacoes.length));

  // ===================== DESCARTE =====================
  secao('Descarte e triagem manual');

  const paraDescartar = (await pubService.listar({ status: 'vinculada' })).itens[0] ||
                        (await pubService.listar({ status: 'sem_vinculo' })).itens[0];
  if (paraDescartar) {
    const descartada = await pubService.descartar(paraDescartar.id, 'Não é do escritório.');
    ok('descartar muda o status', descartada.status === 'descartada');
    ok('descartar guarda o motivo', descartada.motivoDescarte === 'Não é do escritório.');
    ok('descartar registra quem triou', descartada.triadaPorId === advogado.id);
  }

  // ===================== SINCRONIZAÇÃO =====================
  secao('Sincronização simulada');

  const sinc = App.services.sincronizacaoService;
  const antesSinc = db.get('publicacoes').length;

  const s1 = await sinc.sincronizar();
  ok('a sincronização conclui', s1.status === 'concluida', s1.status);
  ok('traz publicações novas', s1.novas > 0, JSON.stringify(s1));
  ok('as novas entraram no banco', db.get('publicacoes').length === antesSinc + s1.novas);
  ok('as novas nascem com status "nova"',
     db.get('publicacoes').slice(-s1.novas).every(p => p.status === 'nova'));
  ok('as novas trazem hash de conteúdo',
     db.get('publicacoes').slice(-s1.novas).every(p => !!p.hashConteudo));
  ok('as novas apontam para o monitoramento que as trouxe',
     db.get('publicacoes').slice(-s1.novas).every(p => !!p.monitoramentoId));
  ok('a sincronização carimba os monitoramentos',
     db.get('monitoramentos').every(m => !!m.ultimaSincronizacaoEm));

  /* Deduplicação: é o problema prático nº 1 de quem integra recorte. */
  const texto = db.get('publicacoes')[0].textoIntegral;
  const hashRepetido = App.token.hashLongo(texto);
  ok('o hash é determinístico', App.token.hashLongo(texto) === hashRepetido);
  ok('duas publicações idênticas teriam o mesmo hash',
     App.token.hashLongo(texto) === App.token.hashLongo(texto));

  const antesDedupe = db.get('publicacoes').length;
  const s2 = await sinc.sincronizar();
  ok('a segunda sincronização também roda', s2.status === 'concluida');
  ok('o total cresce só pelo que era realmente novo',
     db.get('publicacoes').length === antesDedupe + s2.novas,
     s2.encontradas + ' encontradas, ' + s2.novas + ' novas, ' +
     s2.duplicadas + ' duplicadas');
  ok('encontradas = novas + duplicadas', s2.encontradas === s2.novas + s2.duplicadas);

  let falhou = false;
  try { await sinc.sincronizar({ forcarErro: true }); } catch (e) { falhou = e.codigo === 504; }
  ok('falha de rede é propagada para a tela', falhou);
  ok('a falha fica registrada no histórico',
     (await sinc.historico()).some(h => h.status === 'erro'));

  const historico = await sinc.historico();
  ok('o histórico vem do mais recente para o mais antigo',
     historico.length < 2 || historico[0].iniciadaEm >= historico[1].iniciadaEm);
  ok('ultima() devolve a mais recente', sinc.ultima().id === historico[0].id);

  // ===================== MONITORAMENTOS =====================
  secao('Monitoramentos');

  const monService = App.services.monitoramentoService;
  const criado = await monService.criar({
    tipo: 'nome', valor: 'Construtora Horizonte', uf: 'SP', tribunais: ['tjsp']
  });
  ok('cria monitoramento por nome', criado.tipo === 'nome');
  ok('o monitoramento resolve o rótulo do tipo', criado.rotuloTipo === 'Nome da parte');
  ok('resolve os rótulos dos tribunais', criado.tribunaisRotulos[0] === 'TJSP');

  let duplicado = false;
  try {
    await monService.criar({ tipo: 'nome', valor: 'Construtora Horizonte', uf: 'SP' });
  } catch (e) { duplicado = e.codigo === 409; }
  ok('termo repetido é recusado (duplicaria toda publicação dele)', duplicado);

  let vazio2 = false;
  try { await monService.criar({ tipo: 'oab', valor: '   ' }); }
  catch (e) { vazio2 = e.codigo === 400; }
  ok('termo vazio é recusado', vazio2);

  let tipoRuim = false;
  try { await monService.criar({ tipo: 'inventado', valor: 'x' }); }
  catch (e) { tipoRuim = e.codigo === 400; }
  ok('tipo inválido é recusado', tipoRuim);

  await monService.remover(criado.id);
  ok('remover tira da lista',
     !(await monService.listar()).some(m => m.id === criado.id));

  // Sem monitoramento não há o que sincronizar.
  const todos = db.get('monitoramentos');
  todos.forEach(m => db.remove('monitoramentos', m.id));
  let semMonitoramento = false;
  try { await sinc.sincronizar(); } catch (e) { semMonitoramento = e.codigo === 409; }
  ok('sincronizar sem monitoramento é recusado', semMonitoramento);

  // ===================== PERMISSÃO =====================
  secao('Permissão de triagem');

  await App.services.sessaoService.entrar(estagiario.id);
  ok('estagiário PODE triar publicação (instrui o processo)',
     App.services.sessaoService.pode('publicacoes.triar'));

  const financeiro = usuarios.filter(u => u.perfil === 'financeiro')[0];
  await App.services.sessaoService.entrar(financeiro.id);
  ok('financeiro NÃO tria publicação',
     !App.services.sessaoService.pode('publicacoes.triar'));

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
