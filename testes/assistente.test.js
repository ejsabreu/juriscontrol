/* Verificação de F2.8 — assistente.

   O ponto do módulo não é acertar sempre: é NÃO INVENTAR. As verificações
   mais importantes daqui são as que exigem que o sistema admita não saber —
   risco sem base histórica, pergunta fora do repertório, texto que não dá
   para classificar. Uma resposta convincente e errada é pior que nenhuma. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

const { App } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();

const ia = App.domain.assistente;

(async function () {

  // ===================== RESUMO =====================
  secao('Resumo do processo');

  const hoje = '2026-08-12';
  const processoBase = {
    id: 'P1', faseId: 'instrucao', areaId: 'civel', assunto: 'Cobrança',
    dataDistribuicao: '2025-03-10', status: 'ativo', valorCausa: 5000000,
    papelCliente: 'autor'
  };

  const resumo = ia.resumirProcesso({
    processo: processoBase,
    andamentos: [
      { data: '2025-03-12', tipo: 'movimentacao', titulo: 'Distribuído por sorteio' },
      { data: '2025-05-20', tipo: 'movimentacao', titulo: 'Citação cumprida' },
      { data: '2026-07-01', tipo: 'despacho', titulo: 'Designada perícia' }
    ],
    prazos: [
      { status: 'cumprido', titulo: 'Réplica', dataFatal: '2025-06-10' },
      { status: 'pendente', titulo: 'Alegações finais', dataFatal: '2026-09-01' }
    ],
    compromissos: [
      { status: 'agendado', titulo: 'Perícia', dataHora: '2026-08-25T14:00' }
    ],
    documentos: [{ id: 'D1', categoria: 'inicial' }],
    hoje: hoje
  });

  ok('conta os andamentos', resumo.totalAndamentos === 3);
  ok('separa prazos cumpridos e abertos',
     resumo.prazosCumpridos === 1 && resumo.prazosAbertos === 1);
  ok('acha o próximo prazo', resumo.proximoPrazo.titulo === 'Alegações finais');
  ok('acha o próximo compromisso', resumo.proximoCompromisso.titulo === 'Perícia');
  ok('mede o tempo sem movimentação', resumo.diasSemMovimento === 42,
     String(resumo.diasSemMovimento));
  ok('registra o marco da distribuição',
     resumo.marcos.some(m => m.chave === 'distribuicao'));
  ok('registra o marco da citação', resumo.marcos.some(m => m.chave === 'citacao'));
  ok('o texto é montado em frases', resumo.frases.length >= 4,
     String(resumo.frases.length));
  ok('o texto cita a fase', resumo.texto.indexOf('instrução') !== -1, resumo.texto);

  const semNada = ia.resumirProcesso({ processo: { faseId: 'distribuicao' } });
  ok('processo vazio não quebra', typeof semNada.texto === 'string');
  ok('sem andamento, dias sem movimento é nulo', semNada.diasSemMovimento === null);

  // ===================== PRÓXIMA AÇÃO =====================
  secao('Próxima ação');

  /* A ordem é a da urgência: prazo vencido vence tudo. Sugerir "acompanhar
     a instrução" a quem tem prazo perdido seria ruído no pior momento. */
  const comVencido = ia.proximaAcao({
    processo: processoBase,
    prazos: [{ status: 'pendente', titulo: 'Contestação', dataFatal: '2026-08-01' }],
    documentos: [], hoje: hoje
  });
  ok('prazo vencido vira ação crítica', comVencido[0].prioridade === 'critica');
  ok('a ação do vencido vem PRIMEIRO',
     comVencido[0].acao.indexOf('VENCIDO') !== -1, comVencido[0].acao);
  ok('toda ação explica o porquê', comVencido.every(a => !!a.porque && a.porque.length > 10));

  const semProcuracao = ia.proximaAcao({
    processo: processoBase, prazos: [], documentos: [{ categoria: 'inicial' }], hoje: hoje
  });
  ok('falta de procuração é apontada',
     semProcuracao.some(a => a.acao.indexOf('procuração') !== -1));

  const comProcuracao = ia.proximaAcao({
    processo: processoBase, prazos: [], documentos: [{ categoria: 'procuracao' }], hoje: hoje
  });
  ok('com procuração, não é apontada',
     !comProcuracao.some(a => a.acao.indexOf('procuração') !== -1));

  const semConferir = ia.proximaAcao({
    processo: processoBase, documentos: [{ categoria: 'procuracao' }],
    prazos: [{ status: 'cumprido', titulo: 'Réplica', conferidoEm: null }], hoje: hoje
  });
  ok('prazo cumprido sem conferência é apontado (F2.2)',
     semConferir.some(a => a.acao.indexOf('conferência') !== -1));

  const parado = ia.proximaAcao({
    processo: processoBase,
    andamentos: [{ data: '2025-01-01', tipo: 'movimentacao', titulo: 'x' }],
    prazos: [], documentos: [{ categoria: 'procuracao' }], hoje: hoje
  });
  ok('processo parado há meses é apontado',
     parado.some(a => a.acao.indexOf('tribunal') !== -1));

  ok('a fase sempre gera uma sugestão de contexto',
     ia.proximaAcao({ processo: { faseId: 'recurso' }, prazos: [],
                      documentos: [{ categoria: 'procuracao' }], hoje: hoje })
       .some(a => a.acao.indexOf('recursais') !== -1));

  ok('segredo de justiça é lembrado',
     ia.proximaAcao({ processo: { faseId: 'instrucao', segredoJustica: true },
                      prazos: [], documentos: [{ categoria: 'procuracao' }], hoje: hoje })
       .some(a => a.acao.indexOf('segredo') !== -1));

  // ===================== DUPLICIDADE =====================
  secao('Detecção de duplicidade');

  const existentes = [
    { id: 'A', nome: 'Maria da Silva Costa', cpfCnpj: '12345678901' },
    { id: 'B', nome: 'João Pereira', cpfCnpj: '98765432100' },
    { id: 'C', nome: 'Maria da Silva Cost', cpfCnpj: '' }
  ];

  const porDocumento = ia.detectarDuplicidadePessoa(
    { nome: 'Outra Pessoa', cpfCnpj: '123.456.789-01' }, existentes);
  ok('documento igual é CERTEZA', porDocumento[0].confianca === 'certeza');
  ok('e explica o porquê', porDocumento[0].porque === 'mesmo CPF/CNPJ');
  ok('a formatação do documento não atrapalha', porDocumento.length === 1);

  const porNome = ia.detectarDuplicidadePessoa(
    { nome: 'Maria da Silva Costa', cpfCnpj: '' }, existentes);
  ok('nome quase igual é SUSPEITA, não certeza',
     porNome.length > 0 && porNome[0].confianca !== 'certeza',
     JSON.stringify(porNome.map(p => p.confianca)));
  ok('a suspeita traz o grau de similaridade',
     porNome[0].similaridade >= 85, String(porNome[0].similaridade));

  ok('nome diferente não gera falso positivo',
     ia.detectarDuplicidadePessoa({ nome: 'Carlos Andrade' }, existentes).length === 0);
  ok('o próprio registro não conta como duplicata',
     ia.detectarDuplicidadePessoa(existentes[0], existentes)
       .every(r => r.registro.id !== 'A'));

  ok('similaridade de nomes idênticos é 100',
     ia.similaridade('Maria Silva', 'Maria Silva') === 100);
  ok('similaridade ignora acento e caixa',
     ia.similaridade('JOÃO', 'joao') === 100,
     String(ia.similaridade('JOÃO', 'joao')));
  ok('similaridade de nomes distintos é baixa',
     ia.similaridade('Maria Silva', 'Carlos Andrade') < 50);

  const cnjValido = App.domain.cnj.montar(1234, 2024, 8, 26, 100);
  ok('CNJ repetido é detectado',
     ia.detectarDuplicidadeProcesso(cnjValido, [{ numeroCnj: cnjValido }]).length === 1);
  ok('CNJ novo não gera alarme',
     ia.detectarDuplicidadeProcesso(cnjValido, [{ numeroCnj: '0000001-02.2020.8.26.0001' }])
       .length === 0);

  // ===================== RISCO =====================
  secao('Risco sugerido');

  /* A verificação mais importante do módulo: sem base, ADMITE que não sabe.
     Sugerir "provável" com dois processos seria pior que não sugerir. */
  const semBase = ia.sugerirRisco({
    processo: processoBase,
    historicoDaArea: [{ status: 'encerrado', risco: 'provavel' }]
  });
  ok('sem histórico suficiente, NÃO sugere risco', semBase.risco === null);
  ok('e diz por que não sugeriu', semBase.confianca === 'insuficiente');
  ok('a justificativa cita quantos processos há',
     semBase.porque.indexOf('1 processo') !== -1, semBase.porque);

  function historico(quantos, perdidos) {
    var lista = [];
    for (var i = 0; i < quantos; i++) {
      lista.push({ status: 'encerrado', risco: i < perdidos ? 'provavel' : 'remoto' });
    }
    return lista;
  }

  const riscoBaixo = ia.sugerirRisco({
    processo: { faseId: 'distribuicao' }, historicoDaArea: historico(20, 2), prazos: []
  });
  ok('área com pouca perda sugere risco remoto', riscoBaixo.risco === 'remoto',
     riscoBaixo.risco + ' (' + riscoBaixo.pontos + ' pontos)');

  const riscoAlto = ia.sugerirRisco({
    processo: { faseId: 'execucao' }, historicoDaArea: historico(20, 14), prazos: []
  });
  ok('área com muita perda em fase avançada sugere risco provável',
     riscoAlto.risco === 'provavel', riscoAlto.risco + ' (' + riscoAlto.pontos + ')');

  const comPerdido = ia.sugerirRisco({
    processo: { faseId: 'instrucao' }, historicoDaArea: historico(20, 6),
    prazos: [{ status: 'perdido' }]
  });
  ok('prazo perdido no processo aumenta o risco',
     comPerdido.pontos > ia.sugerirRisco({
       processo: { faseId: 'instrucao' }, historicoDaArea: historico(20, 6), prazos: []
     }).pontos);
  ok('e a razão aparece na justificativa',
     comPerdido.razoes.some(r => r.indexOf('perdido') !== -1),
     comPerdido.razoes.join(' | '));

  ok('a confiança cresce com a base',
     ia.sugerirRisco({ processo: {}, historicoDaArea: historico(20, 5) }).confianca === 'media' &&
     ia.sugerirRisco({ processo: {}, historicoDaArea: historico(6, 2) }).confianca === 'baixa');

  // ===================== REVISÃO DA PEÇA =====================
  secao('Revisão da peça');

  const contextoPeca = {
    processo: { numeroCnj: cnjValido, valorCausa: 5000000 },
    prazos: [{ status: 'pendente', quantidadeDias: 15 }],
    advogado: { nome: 'André Tavares' }
  };

  const comVariavel = ia.revisarPeca('Autor: {{cliente.nome}}, réu: X.', contextoPeca);
  ok('variável não substituída é CRÍTICA',
     comVariavel.some(a => a.tipo === 'variavel' && a.gravidade === 'critica'));

  const comLacuna = ia.revisarPeca(
    'Texto <span class="var-pendente">[parte.contraria]</span> final.', contextoPeca);
  ok('lacuna destacada é apontada',
     comLacuna.some(a => a.tipo === 'lacuna'));

  const comRascunho = ia.revisarPeca(
    'DOS FATOS [descrever os fatos] DO DIREITO [fundamentação]', contextoPeca);
  ok('marcador de rascunho esquecido é apontado',
     comRascunho.some(a => a.tipo === 'rascunho'), JSON.stringify(comRascunho));

  const cnjRuim = ia.revisarPeca('Processo n. 0001234-99.2024.8.26.0100', contextoPeca);
  ok('CNJ com dígito verificador errado é apontado',
     cnjRuim.some(a => a.tipo === 'cnj' && a.gravidade === 'critica'));

  const cnjOutro = ia.revisarPeca(
    'Processo n. ' + App.domain.cnj.montar(9999, 2023, 8, 26, 200), contextoPeca);
  ok('peça que cita OUTRO processo é apontada',
     cnjOutro.some(a => a.tipo === 'cnj' && a.gravidade === 'atencao'),
     JSON.stringify(cnjOutro));

  const prazoDivergente = ia.revisarPeca(
    'André Tavares. No prazo de 30 dias. Valor R$ 50.000,00. Processo ' + cnjValido,
    contextoPeca);
  ok('prazo citado diferente do cadastrado é apontado',
     prazoDivergente.some(a => a.tipo === 'prazo'), JSON.stringify(prazoDivergente));

  const valorDivergente = ia.revisarPeca(
    'André Tavares. Valor de R$ 999,00 apenas. Processo ' + cnjValido, contextoPeca);
  ok('valor que não bate com a causa é apontado',
     valorDivergente.some(a => a.tipo === 'valor'));

  const semAdvogado = ia.revisarPeca('Texto qualquer sem nome. Processo ' + cnjValido,
                                     contextoPeca);
  ok('peça sem o advogado responsável é apontada',
     semAdvogado.some(a => a.tipo === 'assinatura'));

  const limpa = ia.revisarPeca(
    'Peça completa assinada por André Tavares, processo ' + cnjValido +
    ', valor de R$ 50.000,00, prazo de 15 dias.', contextoPeca);
  ok('peça correta não gera achado', limpa.length === 0, JSON.stringify(limpa));

  // ===================== INTENÇÕES DA BUSCA =====================
  secao('Gramática de intenções');

  ok('reconhece "prazos vencendo"',
     ia.interpretarBusca('prazos vencendo esta semana').rota === '#/agenda');
  ok('reconhece "prazos vencidos"',
     ia.interpretarBusca('prazos vencidos').rota === '#/agenda');
  ok('reconhece publicações',
     ia.interpretarBusca('publicações do diário').rota === '#/publicacoes');
  ok('reconhece o funil', ia.interpretarBusca('leads em negociação').rota === '#/crm');
  ok('reconhece modelos', ia.interpretarBusca('modelo de contestação').rota === '#/modelos');
  ok('reconhece tarefas', ia.interpretarBusca('tarefas atrasadas').rota === '#/tarefas');

  const porArea = ia.interpretarBusca('processos de trabalhista');
  ok('reconhece processos por área', !!porArea && porArea.rota.indexOf('areaId=') !== -1,
     porArea && porArea.rota);
  ok('a intenção descreve o que vai fazer',
     porArea.descricao.indexOf('trabalhista') !== -1, porArea.descricao);

  /* Quando nenhum padrão casa, a busca precisa cair no índice de F2.7 —
     inventar uma intenção seria pior que não ter nenhuma. */
  ok('texto comum NÃO vira intenção forçada',
     ia.interpretarBusca('Maria da Silva') === null);
  ok('área inexistente não vira intenção',
     ia.interpretarBusca('processos de zebra') === null);
  ok('consulta curta demais é ignorada', ia.interpretarBusca('pra') === null);
  ok('consulta vazia é ignorada', ia.interpretarBusca('') === null);

  // ===================== SERVICE SIMULADO =====================
  secao('Camada simulada — assinatura da fase 3');

  const db = App.services.db;
  db.init(true);
  App.services.auditoriaService.iniciar();

  const usuarios = db.get('usuarios');
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  await App.services.sessaoService.entrar(advogado.id);

  const processo = db.get('processos').filter(p => !p.segredoJustica)[0];
  const iaService = App.services.iaService;

  const analise = await iaService.analisarProcesso(processo.id);
  ok('analisarProcesso devolve resumo, ações e risco',
     !!analise.resumo && Array.isArray(analise.acoes) && !!analise.risco);

  /* A declaração de ORIGEM é o que permite a tela dizer de onde veio o
     texto — informação que o usuário merece ter. */
  ok('a resposta declara a origem', analise.origem === 'regras-locais', analise.origem);

  let semProcesso = false;
  try { await iaService.analisarProcesso('PRO-INEXISTENTE'); }
  catch (e) { semProcesso = e.codigo === 404; }
  ok('processo inexistente é recusado', semProcesso);

  const peca = await iaService.gerarPeca({
    processoId: processo.id, tipo: 'peticao', instrucoes: 'Focar na prescrição'
  });
  ok('gerarPeca devolve HTML', peca.html.length > 50);
  ok('gerarPeca diz de qual MODELO saiu', !!peca.modelo && !!peca.modelo.nome);
  ok('o aviso deixa claro que não houve redação por modelo de linguagem',
     peca.aviso.indexOf('modelo de linguagem') !== -1, peca.aviso);
  /* As instruções viram NOTA, não texto redigido: fingir que foram
     "compreendidas" é exatamente a mentira que o módulo evita. */
  ok('as instruções viram anotação, não texto redigido',
     peca.html.indexOf('Anotação do autor') !== -1, peca.html.slice(0, 160));
  ok('a peça é preenchida com os dados do processo',
     peca.resolvidas.length > 0, String(peca.resolvidas.length));

  const explicacao = await iaService.resumirPublicacao({
    publicacaoId: db.get('publicacoes')[0].id
  });
  ok('resumirPublicacao devolve frases', explicacao.frases.length > 0);
  ok('a explicação declara o método',
     explicacao.aviso.indexOf('dicionário') !== -1, explicacao.aviso);
  ok('a explicação diz se o número está cadastrado',
     explicacao.texto.indexOf('escritório') !== -1 ||
     explicacao.texto.indexOf('cadastrado') !== -1, explicacao.texto);

  const desfecho = await iaService.sugerirDesfecho({ processoId: processo.id });
  ok('sugerirDesfecho devolve risco', !!desfecho.risco);
  ok('e nunca promete previsão estatística',
     desfecho.aviso.indexOf('não é previsão') !== -1 ||
     desfecho.aviso.indexOf('Não há histórico') !== -1, desfecho.aviso);

  // ===================== PERGUNTAR =====================
  secao('Perguntar — e admitir quando não sabe');

  const sobrePrazo = await iaService.perguntar({
    processoId: processo.id, pergunta: 'Qual o próximo prazo?'
  });
  ok('responde sobre prazo', sobrePrazo.respondeu === true);
  ok('a resposta menciona prazo',
     sobrePrazo.resposta.toLowerCase().indexOf('prazo') !== -1, sobrePrazo.resposta);

  const sobreValor = await iaService.perguntar({
    processoId: processo.id, pergunta: 'Qual o valor da causa?'
  });
  ok('responde sobre valor', sobreValor.resposta.indexOf('R$') !== -1, sobreValor.resposta);

  const sobreFase = await iaService.perguntar({
    processoId: processo.id, pergunta: 'Em que fase está?'
  });
  ok('responde sobre fase', sobreFase.respondeu === true);

  const sobreCliente = await iaService.perguntar({
    processoId: processo.id, pergunta: 'Quem é o cliente?'
  });
  ok('responde sobre o cliente', sobreCliente.respondeu === true);

  /* A VERIFICAÇÃO MAIS IMPORTANTE DO MÓDULO. Uma resposta inventada é
     indistinguível de uma correta para quem pergunta — e é justamente o
     risco que este assistente se recusa a correr. */
  const foraDoRepertorio = await iaService.perguntar({
    processoId: processo.id,
    pergunta: 'Qual a probabilidade de o STF mudar o entendimento sobre isso?'
  });
  ok('pergunta fora do repertório: ADMITE que não sabe',
     foraDoRepertorio.respondeu === false, foraDoRepertorio.resposta);
  ok('e diz sobre o que consegue falar',
     foraDoRepertorio.resposta.indexOf('Consigo falar') !== -1,
     foraDoRepertorio.resposta);
  ok('o aviso reforça que não há modelo de linguagem',
     foraDoRepertorio.aviso.indexOf('não há modelo') !== -1 ||
     foraDoRepertorio.aviso.indexOf('Não há modelo') !== -1, foraDoRepertorio.aviso);

  // ===================== REVISÃO PELO SERVICE =====================
  secao('Revisão de documento pelo service');

  const modelo = db.get('modelosPeca')[0];
  const gerado = await App.services.modeloPecaService.gerarDocumento({
    modeloId: modelo.id, processoId: processo.id, nome: 'Peça para revisar'
  });

  const revisao = await iaService.revisarDocumento(gerado.documento.id);
  ok('revisarDocumento devolve os achados', Array.isArray(revisao.achados));
  ok('e conta os críticos', typeof revisao.criticos === 'number');

  App.services.conteudoService.salvar(gerado.documento.id, {
    modo: 'rico', conteudo: '<p>Peça com {{cliente.nome}} e [descrever os fatos].</p>'
  });
  const comProblemas = await iaService.revisarDocumento(gerado.documento.id);
  ok('a revisão acha a variável não substituída',
     comProblemas.achados.some(a => a.tipo === 'variavel'));
  ok('a revisão acha o marcador de rascunho',
     comProblemas.achados.some(a => a.tipo === 'rascunho'));
  ok('e conta os críticos corretamente', comProblemas.criticos >= 2,
     String(comProblemas.criticos));

  const semTexto = db.insert('documentos', {
    processoId: processo.id, nome: 'so-metadado.pdf', categoria: 'outro',
    extensao: 'pdf', versao: 1
  }, 'DOC');
  const revisaoSemTexto = await iaService.revisarDocumento(semTexto.id);
  ok('documento sem texto avisa que não há o que revisar',
     revisaoSemTexto.semTexto === true);

  // ===================== TODA RESPOSTA DECLARA A ORIGEM =====================
  secao('Nenhuma resposta esconde de onde veio');

  const todas = [analise, peca, explicacao, desfecho, sobrePrazo,
                 foraDoRepertorio, revisao, comProblemas, revisaoSemTexto];
  ok('TODA resposta do assistente declara origem "regras-locais"',
     todas.every(r => r.origem === 'regras-locais'),
     todas.filter(r => r.origem !== 'regras-locais').length + ' sem origem');
  ok('as respostas de texto trazem aviso ao usuário',
     [peca, explicacao, desfecho, sobrePrazo, foraDoRepertorio].every(r => !!r.aviso));

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
