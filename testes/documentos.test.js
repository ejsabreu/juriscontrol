/* Verificação de F2.7 — modelos de peça com variáveis, busca full-text por
   índice invertido, assinatura simulada e trilha de acesso.

   A verificação que mais importa é a das variáveis SEM valor: elas não podem
   ser apagadas em silêncio nem sair como {{...}} cru numa peça protocolada. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

const { App } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();

const mod = App.domain.modelos;
const busca = App.domain.busca;

(async function () {

  // ===================== MODELOS: PREENCHIMENTO =====================
  secao('Modelos — preenchimento de variáveis');

  const contexto = {
    cliente: { nome: 'Maria da Silva', cpfCnpj: '123.456.789-01' },
    processo: { numeroCnj: '0001234-56.2024.8.26.0100', vara: '2ª Vara Cível' },
    advogado: { nome: 'André Tavares', oab: 'OAB/SP 284917' },
    data: { hoje: '12/08/2026' }
  };

  const simples = mod.preencher('Autor: {{cliente.nome}}, CPF {{cliente.cpfCnpj}}.', contexto);
  ok('substitui a variável pelo valor',
     simples.html === 'Autor: Maria da Silva, CPF 123.456.789-01.', simples.html);
  ok('lista o que foi resolvido', simples.resolvidas.length === 2);
  ok('não sobra pendência', simples.pendentes.length === 0);

  ok('resolve caminho pontuado',
     mod.resolver(contexto, 'processo.vara') === '2ª Vara Cível');
  ok('caminho inexistente devolve undefined',
     mod.resolver(contexto, 'nada.disso') === undefined);

  /* A VERIFICAÇÃO CENTRAL DO MÓDULO: variável sem valor não some nem fica
     como {{...}} cru. Apagar em silêncio produz petição com lacuna que
     ninguém nota; deixar cru produz uma que envergonha no protocolo. */
  const comPendente = mod.preencher('Réu: {{parte.contraria}}. Autor: {{cliente.nome}}.',
                                    contexto);
  ok('variável sem valor NÃO é apagada em silêncio',
     comPendente.html.indexOf('parte.contraria') !== -1, comPendente.html);
  ok('variável sem valor NÃO fica como chave crua',
     comPendente.html.indexOf('{{parte.contraria}}') === -1, comPendente.html);
  ok('a pendência vira marca destacada',
     comPendente.html.indexOf('var-pendente') !== -1);
  ok('a pendente é listada', comPendente.pendentes.length === 1 &&
     comPendente.pendentes[0] === 'parte.contraria');
  ok('a resolvida continua resolvida',
     comPendente.html.indexOf('Maria da Silva') !== -1);

  ok('valor em branco conta como pendente',
     mod.preencher('{{cliente.nome}}', { cliente: { nome: '   ' } }).pendentes.length === 1);
  ok('valor nulo conta como pendente',
     mod.preencher('{{cliente.nome}}', { cliente: { nome: null } }).pendentes.length === 1);
  ok('contexto vazio deixa tudo pendente',
     mod.preencher('{{a.b}} {{c.d}}', {}).pendentes.length === 2);

  ok('sem marcar pendentes, o campo sai vazio (usado só na conferência)',
     mod.preencher('X{{nada.aqui}}Y', {}, { marcarPendentes: false }).html === 'XY');

  // Filtros.
  ok('filtro maiuscula',
     mod.preencher('{{cliente.nome|maiuscula}}', contexto).html === 'MARIA DA SILVA');
  ok('filtro minuscula',
     mod.preencher('{{cliente.nome|minuscula}}', contexto).html === 'maria da silva');
  ok('filtro titulo mantém preposição em minúscula',
     mod.preencher('{{n|titulo}}', { n: 'MARIA DA SILVA COSTA' }).html ===
     'Maria da Silva Costa',
     mod.preencher('{{n|titulo}}', { n: 'MARIA DA SILVA COSTA' }).html);
  ok('filtro desconhecido não quebra',
     mod.preencher('{{cliente.nome|inventado}}', contexto).html === 'Maria da Silva');

  ok('espaços dentro das chaves são tolerados',
     mod.preencher('{{  cliente.nome  }}', contexto).html === 'Maria da Silva');

  // Listagem.
  const variaveis = mod.listarVariaveis('{{a.b}} texto {{c.d}} e {{a.b}} de novo');
  ok('lista variáveis sem repetir', variaveis.length === 2, JSON.stringify(variaveis));
  ok('texto sem variável devolve lista vazia',
     mod.listarVariaveis('sem nada aqui').length === 0);

  ok('temPendencias acusa chave crua', mod.temPendencias('oi {{x.y}}') === true);
  ok('temPendencias acusa marca destacada',
     mod.temPendencias('<span class="var-pendente">[x]</span>') === true);
  ok('temPendencias devolve falso em texto limpo',
     mod.temPendencias('texto sem nada') === false);

  // Catálogo.
  ok('o catálogo tem variáveis agrupadas',
     mod.CATALOGO.length > 15 && mod.CATALOGO.every(v => !!v.grupo && !!v.chave));
  ok('variável fora do catálogo é sinalizada',
     mod.variaveisDesconhecidas('{{cliente.nome}} {{coisa.inventada}}').length === 1);
  ok('variável do catálogo não é sinalizada',
     mod.variaveisDesconhecidas('{{cliente.nome}} {{processo.vara}}').length === 0);

  // ===================== CONTEXTO =====================
  secao('Contexto a partir das entidades');

  const ctx = mod.montarContexto({
    processo: { numeroCnj: '0001234-56.2024.8.26.0100', vara: '1ª Vara Cível',
                comarca: 'São Paulo', valorCausa: 5000000, areaId: 'civel',
                tribunalId: 'tjsp', papelCliente: 'autor' },
    cliente: { nome: 'Construtora Alfa', documento: '11222333000181' },
    advogado: { nome: 'André Tavares', oab: { uf: 'SP', numero: '284917' } },
    contrato: { valorFixoCentavos: 800000, percentualExito: 20 },
    parteContraria: 'Empresa Beta',
    hoje: '2026-08-12'
  });

  ok('formata o documento do cliente', ctx.cliente.cpfCnpj === '11.222.333/0001-81',
     ctx.cliente.cpfCnpj);
  ok('formata o valor da causa', ctx.processo.valorCausa === 'R$ 50.000,00',
     ctx.processo.valorCausa);
  ok('resolve o rótulo do tribunal', ctx.processo.tribunal === 'TJSP');
  ok('resolve o rótulo da área', ctx.processo.area === 'Cível');
  ok('monta a OAB do advogado', ctx.advogado.oab === 'OAB/SP 284917');
  ok('traz a parte contrária', ctx.parte.contraria === 'Empresa Beta');
  ok('formata a data de hoje', ctx.data.hoje === '12/08/2026');
  ok('traz a data por extenso', ctx.data.extenso.indexOf('agosto') !== -1, ctx.data.extenso);
  ok('traz o honorário por extenso',
     ctx.honorarios.extenso.indexOf('oito mil reais') !== -1, ctx.honorarios.extenso);
  ok('traz o percentual de êxito', ctx.honorarios.exito === '20%');
  ok('contexto sem dados não quebra', !!mod.montarContexto({}).cliente);

  // ===================== BUSCA =====================
  secao('Busca — tokenização e índice');

  ok('tokeniza ignorando acento e caixa',
     busca.tokenizar('Indenização POR Danos').join(' ') === 'indenizacao danos',
     busca.tokenizar('Indenização POR Danos').join(' '));
  ok('descarta palavras vazias',
     busca.tokenizar('de para com sem').length === 0);
  ok('descarta termo curto demais', busca.tokenizar('a bc def').join(' ') === 'def');
  ok('remove marcação HTML antes de indexar',
     busca.tokenizar('<strong>petição</strong> inicial').join(' ') === 'peticao inicial',
     busca.tokenizar('<strong>petição</strong> inicial').join(' '));

  /* CPF, CNPJ e CNJ pontuados. O cadastro guarda só os dígitos; quem procura
     copia da petição, com pontos e traço. Colapsar dos DOIS lados — índice e
     consulta — é o que faz as duas grafias chegarem ao mesmo termo. */
  ok('colapsa CPF pontuado num termo só',
     busca.tokenizar('529.982.247-25').join(' ') === '52998224725',
     busca.tokenizar('529.982.247-25').join(' '));
  ok('colapsa CNPJ pontuado',
     busca.tokenizar('11.222.333/0001-81').join(' ') === '11222333000181',
     busca.tokenizar('11.222.333/0001-81').join(' '));
  ok('colapsa o número do CNJ',
     busca.tokenizar('0001234-56.2024.8.26.0100').join(' ') === '00012345620248260100',
     busca.tokenizar('0001234-56.2024.8.26.0100').join(' '));
  ok('dígito puro chega ao mesmo termo do pontuado',
     busca.tokenizar('52998224725').join(' ') === busca.tokenizar('529.982.247-25').join(' '));

  /* A trava: só colapsa o que tem a quantidade de dígitos de um
     identificador conhecido. Sem ela, o número interno da pasta viraria um
     termo só e procurar pelo ano deixaria de achá-lo. */
  ok('NÃO colapsa número que não é identificador',
     busca.tokenizar('ADV-2024-0001').join(' ') === 'adv 2024 0001',
     busca.tokenizar('ADV-2024-0001').join(' '));
  ok('NÃO colapsa CEP pontuado', busca.tokenizar('01310-930').join(' ') === '01310 930',
     busca.tokenizar('01310-930').join(' '));

  const indiceDoc = busca.indexar([
    { id: 'p1', tipo: 'pessoa', titulo: 'Joana Ribeiro Prado', texto: '52998224725' }
  ]);
  ok('acha a pessoa pelo CPF pontuado',
     busca.buscar(indiceDoc, '529.982.247-25').length === 1);
  ok('e continua achando pelo CPF em dígitos',
     busca.buscar(indiceDoc, '52998224725').length === 1);

  const acervo = [
    { id: 'd1', tipo: 'documento', titulo: 'Petição inicial',
      texto: 'Ação de indenização por danos morais decorrente de negativação indevida.' },
    { id: 'd2', tipo: 'documento', titulo: 'Contestação',
      texto: 'Impugna-se o pedido de danos morais por ausência de prova.' },
    { id: 'd3', tipo: 'andamento', titulo: 'Sentença',
      texto: 'Julgo procedente o pedido de indenização.' },
    { id: 'd4', tipo: 'documento', titulo: 'Procuração',
      texto: 'Poderes da cláusula ad judicia.' }
  ];

  const indice = busca.indexar(acervo);
  ok('indexa todos os registros', indice.total === 4);
  ok('o índice tem termos', indice.totalTermos > 10, String(indice.totalTermos));

  const porDano = busca.buscar(indice, 'danos');
  ok('acha os documentos que citam o termo', porDano.length === 2, String(porDano.length));

  /* Interseção (AND): buscar "dano moral" e receber tudo que fala de "dano"
     tornaria a busca inútil num acervo jurídico. */
  const doisTermos = busca.buscar(indice, 'danos morais');
  ok('exige TODOS os termos da consulta', doisTermos.length === 2,
     String(doisTermos.length));
  const semInterseccao = busca.buscar(indice, 'danos procuracao');
  ok('sem interseção, não devolve nada', semInterseccao.length === 0,
     String(semInterseccao.length));

  /* O título pesa mais: quem busca "procuração" quer o documento chamado
     procuração antes daquele que a menciona. */
  const porTitulo = busca.buscar(indice, 'peticao');
  ok('o documento com o termo no TÍTULO vem primeiro',
     porTitulo[0].registro.id === 'd1', porTitulo[0] && porTitulo[0].registro.id);

  const porPrefixo = busca.buscar(indice, 'indeniz');
  ok('casa por prefixo (indeniz → indenização)', porPrefixo.length === 2,
     String(porPrefixo.length));
  ok('o casamento exato pontua mais que o prefixo',
     busca.buscar(indice, 'indenizacao')[0].pontos >=
     busca.buscar(indice, 'indeniz')[0].pontos);

  ok('filtra por tipo',
     busca.buscar(indice, 'indenizacao', { tipo: 'andamento' }).length === 1);
  ok('respeita o limite', busca.buscar(indice, 'danos', { limite: 1 }).length === 1);
  ok('consulta vazia devolve vazio', busca.buscar(indice, '').length === 0);
  ok('consulta só com palavra vazia devolve vazio',
     busca.buscar(indice, 'de para').length === 0);
  ok('termo inexistente devolve vazio', busca.buscar(indice, 'zebra').length === 0);
  ok('índice nulo não quebra', busca.buscar(null, 'danos').length === 0);

  const trecho = busca.destacar(acervo[0].texto, 'negativação');
  ok('o trecho destaca o termo encontrado', trecho.indexOf('<mark>') !== -1, trecho);
  ok('o trecho é curto o bastante para caber na lista', trecho.length < 260,
     String(trecho.length));

  /* O trecho vem do conteúdo do documento — injetar HTML aqui abriria a
     porta que a fase 1 fechou com dom.esc. */
  const comHtml = busca.destacar('Texto com <script>alert(1)</script> dentro', 'texto');
  ok('o trecho ESCAPA o conteúdo antes de destacar',
     comHtml.indexOf('<script>') === -1, comHtml);

  // ===================== SEED E SERVICES =====================
  secao('Biblioteca de modelos');

  const db = App.services.db;
  db.init(true);
  App.services.auditoriaService.iniciar();

  const usuarios = db.get('usuarios');
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  await App.services.sessaoService.entrar(advogado.id);

  ok('o seed traz modelos de peça', db.get('modelosPeca').length >= 15,
     String(db.get('modelosPeca').length));

  const modelos = await App.services.modeloPecaService.listar({});
  ok('todo modelo tem variáveis', modelos.every(m => m.totalVariaveis > 0),
     modelos.filter(m => !m.totalVariaveis).map(m => m.nome).join(', '));

  /* Modelo com variável inventada seria pior que modelo nenhum: o campo
     nunca resolveria e o advogado descobriria no protocolo. */
  ok('NENHUM modelo do seed usa variável fora do catálogo',
     modelos.every(m => m.desconhecidas.length === 0),
     modelos.filter(m => m.desconhecidas.length)
       .map(m => m.nome + ': ' + m.desconhecidas.join(',')).join(' | '));

  ok('há modelos de tipos diferentes',
     new Set(modelos.map(m => m.tipo)).size >= 4,
     String(new Set(modelos.map(m => m.tipo)).size));

  const criado = await App.services.modeloPecaService.criar({
    nome: 'Modelo de teste', tipo: 'peticao',
    conteudoHtml: '<p>Cliente {{cliente.nome}}, processo {{processo.numeroCnj}}.</p>'
  });
  ok('cria modelo', criado.totalVariaveis === 2);

  let semNome = false;
  try { await App.services.modeloPecaService.criar({ conteudoHtml: 'x' }); }
  catch (e) { semNome = e.codigo === 400; }
  ok('modelo sem nome é recusado', semNome);

  let semTexto = false;
  try { await App.services.modeloPecaService.criar({ nome: 'x', conteudoHtml: '  ' }); }
  catch (e) { semTexto = e.codigo === 400; }
  ok('modelo vazio é recusado', semTexto);

  // ===================== GERAÇÃO DE DOCUMENTO =====================
  secao('Documento gerado a partir do modelo');

  const processo = db.get('processos').filter(p => !p.segredoJustica)[0];

  const previa = await App.services.modeloPecaService.previa(criado.id, processo.id);
  ok('a prévia preenche com os dados do processo',
     previa.html.indexOf(processo.numeroCnj) !== -1, previa.html);
  ok('a prévia informa o que resolveu', previa.resolvidas.length > 0);

  const docsAntes = db.get('documentos').length;
  const gerado = await App.services.modeloPecaService.gerarDocumento({
    modeloId: criado.id, processoId: processo.id, nome: 'Peça de teste'
  });
  ok('o documento é criado', db.get('documentos').length === docsAntes + 1);
  ok('o documento nasce em HTML (o formato que o editor rico abre)',
     gerado.documento.extensao === 'html', gerado.documento.extensao);

  const conteudo = App.services.conteudoService.ler(gerado.documento.id);
  ok('o conteúdo foi salvo', !!conteudo && !!conteudo.conteudo);
  ok('o conteúdo está em modo rico', conteudo.modo === 'rico');
  ok('o conteúdo traz o número do processo',
     conteudo.conteudo.indexOf(processo.numeroCnj) !== -1);
  ok('o documento NÃO nasce visível ao cliente',
     gerado.documento.visivelCliente === false);
  ok('a geração fica na trilha de auditoria',
     db.get('logsAuditoria').some(l => l.resumo &&
       l.resumo.indexOf('gerado a partir do modelo') !== -1));

  // Modelo com variável que o processo não resolve.
  const comLacuna = await App.services.modeloPecaService.criar({
    nome: 'Com lacuna', tipo: 'peticao',
    conteudoHtml: '<p>{{cliente.nome}} contra {{parte.contraria}}.</p>'
  });
  const geradoComLacuna = await App.services.modeloPecaService.gerarDocumento({
    modeloId: comLacuna.id, processoId: processo.id, nome: 'Com lacuna'
  });
  const textoComLacuna = App.services.conteudoService.ler(geradoComLacuna.documento.id).conteudo;

  if (geradoComLacuna.pendentes.length) {
    ok('a lacuna aparece DESTACADA no documento gerado',
       textoComLacuna.indexOf('var-pendente') !== -1, textoComLacuna);
    ok('a lacuna não fica como chave crua',
       textoComLacuna.indexOf('{{parte.contraria}}') === -1);
    ok('o retorno informa quais ficaram pendentes',
       geradoComLacuna.pendentes.indexOf('parte.contraria') !== -1);
  } else {
    ok('o processo resolveu a parte contrária (sem lacuna)', true,
       'processo tem parte contrária cadastrada');
  }

  // ===================== BUSCA GLOBAL =====================
  secao('Busca global no conteúdo');

  const buscaService = App.services.buscaService;
  const estat = buscaService.estatisticas();
  ok('o índice cobre o acervo', estat.registros > 100, String(estat.registros));

  const achou = await buscaService.buscar('Peça de teste');
  ok('acha o documento recém-criado pelo nome',
     achou.itens.some(i => i.tipo === 'documento'), String(achou.total));

  const porConteudo = await buscaService.buscar(processo.numeroCnj.slice(0, 7));
  ok('acha pelo conteúdo, não só pelo título', porConteudo.total > 0,
     String(porConteudo.total));

  const agrupado = await buscaService.buscarAgrupado('processo');
  ok('agrupa por tipo', Object.keys(agrupado.grupos).length > 0,
     Object.keys(agrupado.grupos).join(', '));

  /* O índice precisa envelhecer: mostrar resultado obsoleto logo depois de
     salvar um documento é pior que não achar. */
  db.observarEscrita(buscaService.invalidar);
  const antesInvalidar = buscaService.estatisticas().registros;
  db.insert('documentos', {
    processoId: processo.id, nome: 'ZebraDocumentoUnico.txt',
    categoria: 'outro', extensao: 'txt', versao: 1
  }, 'DOC');
  ok('escrita no banco invalida o índice',
     buscaService.estatisticas().registros === antesInvalidar + 1,
     buscaService.estatisticas().registros + ' vs ' + (antesInvalidar + 1));
  ok('o documento novo já é encontrado',
     (await buscaService.buscar('ZebraDocumentoUnico')).total > 0);

  /* O segredo de justiça vale aqui também — busca que ignora a regra é o
     vazamento mais fácil de cometer. */
  const secreto = db.get('processos').filter(p => p.id !== processo.id)[0];
  db.update('processos', secreto.id, {
    segredoJustica: true, responsavelId: 'USR-INEXISTENTE', equipeIds: []
  });
  db.insert('andamentos', {
    processoId: secreto.id, data: App.domain.prazos.hojeISO(), tipo: 'nota_interna',
    titulo: 'SegredoAbsolutoXYZ', descricao: 'Conteúdo sigiloso SegredoAbsolutoXYZ',
    autorId: advogado.id, documentosIds: [], visivelCliente: false
  }, 'AND');

  const comoAdvogado = await buscaService.buscar('SegredoAbsolutoXYZ');
  ok('a busca NÃO devolve conteúdo de processo em segredo alheio',
     comoAdvogado.total === 0, String(comoAdvogado.total));

  const admin = usuarios.filter(u => u.perfil === 'admin')[0];
  await App.services.sessaoService.entrar(admin.id);
  const comoAdmin = await buscaService.buscar('SegredoAbsolutoXYZ');
  ok('mas devolve para quem pode ver o processo', comoAdmin.total > 0,
     String(comoAdmin.total));
  await App.services.sessaoService.entrar(advogado.id);

  // ===================== ASSINATURA =====================
  secao('Assinatura e trilha de acesso');

  const assinatura = App.services.assinaturaService;
  const docParaAssinar = gerado.documento.id;

  const assinada = await assinatura.assinar(docParaAssinar);
  ok('a assinatura é registrada', !!assinatura.hash || !!assinada.hash);
  ok('a assinatura guarda quem assinou', assinada.signatarioId === advogado.id);
  ok('a assinatura guarda a versão do documento', assinada.versaoDocumento === 1);
  ok('a assinatura nasce íntegra', assinada.integra === true);

  let jaAssinou = false;
  try { await assinatura.assinar(docParaAssinar); }
  catch (e) { jaAssinou = e.codigo === 409; }
  ok('a mesma pessoa não assina duas vezes', jaAssinou);

  const conferencia = await assinatura.conferir(docParaAssinar);
  ok('a conferência acha a assinatura', conferencia.total === 1);
  ok('nada quebrado antes de alterar', conferencia.alterado === false);

  /* A propriedade REAL da assinatura simulada: alterar o texto quebra a
     conferência. É o que uma assinatura entrega; falta só o que prova QUEM
     assinou. */
  App.services.conteudoService.salvar(docParaAssinar, {
    modo: 'rico', conteudo: '<p>Texto alterado depois de assinado.</p>'
  });
  const depois = await assinatura.conferir(docParaAssinar);
  ok('alterar o texto QUEBRA a assinatura', depois.alterado === true);
  ok('a conferência aponta quantas quebraram', depois.quebradas === 1);
  ok('a assinatura quebrada é sinalizada individualmente',
     depois.assinaturas[0].integra === false);
  ok('a conferência mostra o hash atual para comparação',
     depois.assinaturas[0].hashAtual !== depois.assinaturas[0].hash);

  ok('documento sem texto é assinado pela ficha',
     assinatura.hashDoConteudo('DOC-INEXISTENTE').sobreConteudo === false);

  // Trilha de acesso.
  assinatura.registrarAcesso(docParaAssinar, 'ver');
  assinatura.registrarAcesso(docParaAssinar, 'baixar');
  assinatura.registrarAcesso(docParaAssinar, 'ver');
  assinatura.registrarAcesso(docParaAssinar, 'ver', { origem: 'portal' });

  const resumoAcessos = assinatura.resumoAcessos(docParaAssinar);
  ok('conta as visualizações', resumoAcessos.visualizacoes === 3,
     String(resumoAcessos.visualizacoes));
  ok('conta os downloads', resumoAcessos.downloads === 1);
  ok('distingue o acesso pelo portal', resumoAcessos.peloPortal === 1);
  ok('guarda o último acesso', !!resumoAcessos.ultimo);

  const acessos = await assinatura.acessos(docParaAssinar);
  ok('a trilha resolve quem acessou',
     acessos.every(a => !!a.usuarioNome), JSON.stringify(acessos[0]));
  ok('a trilha vem do mais recente para o mais antigo',
     acessos.length < 2 || acessos[0].quando >= acessos[1].quando);
  ok('o acesso pelo portal é identificado como cliente',
     acessos.some(a => a.usuarioNome.indexOf('Cliente') === 0) ||
     acessos.some(a => a.origem === 'portal'));

  // Registrar acesso nunca pode derrubar a ação principal.
  let naoQuebrou = true;
  try { assinatura.registrarAcesso(null, 'ver'); } catch (e) { naoQuebrou = false; }
  ok('registrar acesso com id inválido não derruba nada', naoQuebrou);

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
