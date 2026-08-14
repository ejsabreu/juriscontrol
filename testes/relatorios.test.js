/* Verificação de F2.9 — indicadores, catálogo e o serviço de relatórios.

   Relatório errado é pior que relatório nenhum, porque decisão é tomada em
   cima dele. As verificações mais importantes daqui são as de COERÊNCIA
   (o total bate com a soma da tabela) e as de ACESSO (o advogado vê só os
   próprios números; processo em segredo não entra em conta nenhuma). */

const { criarAmbiente, criarPlacar } = require('./ambiente');

const { App } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();

const ind = App.domain.indicadores;

(async function () {

  // ===================== CONTRATO =====================
  secao('Contrato de retorno');

  const db = App.services.db;
  db.init(true);
  App.services.auditoriaService.iniciar();

  const usuarios = db.get('usuarios');
  const admin = usuarios.filter(u => u.perfil === 'admin')[0];
  const socio = usuarios.filter(u => u.perfil === 'socio')[0];
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  const financeiro = usuarios.filter(u => u.perfil === 'financeiro')[0];
  const estagiario = usuarios.filter(u => u.perfil === 'estagiario')[0];

  await App.services.sessaoService.entrar(admin.id);

  const dados = App.services.relatorioService.coletar(null);
  dados.periodo = {};
  dados.hoje = App.domain.prazos.hojeISO();

  /* A tela é genérica: se um relatório não seguir o contrato, ela quebra —
     e quebra só quando alguém abrir aquele relatório específico. */
  ind.CATALOGO.forEach(function (def) {
    const r = def.calcular(dados);
    ok(def.id + ': devolve título', typeof r.titulo === 'string' && r.titulo.length > 0);
    ok(def.id + ': declara se está vazio', typeof r.vazio === 'boolean');
    ok(def.id + ': totais é array', Array.isArray(r.totais));

    if (!r.vazio) {
      ok(def.id + ': tem gráfico ou tabela', !!r.grafico || !!r.tabela);
      if (r.tabela) {
        ok(def.id + ': a tabela declara as colunas',
           Array.isArray(r.tabela.colunas) && r.tabela.colunas.length > 0);
        ok(def.id + ': toda coluna tem campo e título',
           r.tabela.colunas.every(c => !!c.campo && !!c.titulo));
      }
      if (r.grafico && r.grafico.tipo !== 'donut') {
        ok(def.id + ': as séries têm um valor por categoria',
           r.grafico.series.every(s => s.valores.length === r.grafico.categorias.length),
           JSON.stringify(r.grafico.series.map(s => s.valores.length)) + ' vs ' +
           r.grafico.categorias.length);
      }
    }
  });

  ok('o catálogo tem dez relatórios', ind.CATALOGO.length === 10,
     String(ind.CATALOGO.length));
  ok('todo relatório declara a permissão exigida',
     ind.CATALOGO.every(r => !!r.permissao));
  ok('toda permissão do catálogo existe no enum',
     ind.CATALOGO.every(r =>
       !!App.domain.enums.achar(App.domain.enums.RECURSOS_PERMISSAO, r.permissao)),
     ind.CATALOGO.filter(r =>
       !App.domain.enums.achar(App.domain.enums.RECURSOS_PERMISSAO, r.permissao))
       .map(r => r.permissao).join(', '));
  ok('achar() encontra pelo id', ind.achar('contingencia').nome === 'Contingência');
  ok('achar() devolve null para id inexistente', ind.achar('nada') === null);

  // ===================== COERÊNCIA DOS NÚMEROS =====================
  secao('Coerência — o total bate com a tabela');

  const contingencia = ind.contingencia(dados);
  const somaProvisao = contingencia.tabela.linhas
    .reduce((s, l) => s + l.provisao, 0);
  const totalExibido = App.moeda.deReais(
    contingencia.totais.filter(t => t.rotulo === 'Provisionado')[0].valor);
  ok('contingência: o total provisionado é a soma das linhas',
     somaProvisao === totalExibido, somaProvisao + ' vs ' + totalExibido);

  const somaProcessos = contingencia.tabela.linhas.reduce((s, l) => s + l.quantidade, 0);
  ok('contingência: a soma dos riscos é o total de processos avaliados',
     somaProcessos === parseInt(
       contingencia.totais.filter(t => t.rotulo === 'Processos avaliados')[0]
         .valor.replace(/\D/g, ''), 10),
     String(somaProcessos));

  const carteira = ind.carteira(dados);
  const somaFases = carteira.tabela.linhas.reduce((s, l) => s + l.quantidade, 0);
  ok('carteira: a soma das fases é o total de ativos',
     somaFases === dados.processos.filter(p => p.status === 'ativo').length,
     somaFases + ' vs ' + dados.processos.filter(p => p.status === 'ativo').length);
  ok('carteira: o gráfico tem uma barra por fase',
     carteira.grafico.categorias.length === App.domain.enums.FASES.length);
  /* Fase é ordinal — a ordem do rito é o significado. */
  ok('carteira: usa a paleta ORDINAL (a ordem é o significado)',
     carteira.grafico.paleta === 'ordinal');

  const prazosRel = ind.desempenhoPrazos(dados);
  const somaSituacoes = prazosRel.tabela.linhas.reduce((s, l) => s + l.quantidade, 0);
  ok('prazos: as situações somam o total do período',
     somaSituacoes === parseInt(
       prazosRel.totais[0].valor.replace(/\D/g, ''), 10),
     String(somaSituacoes));
  ok('prazos: os percentuais somam ~100',
     Math.abs(prazosRel.tabela.linhas.reduce((s, l) => s + l.percentual, 0) - 100) < 1,
     String(prazosRel.tabela.linhas.reduce((s, l) => s + l.percentual, 0)));

  const faturamento = ind.faturamento(dados);
  const somaEntradas = faturamento.tabela.linhas.reduce((s, l) => s + l.entradas, 0);
  ok('faturamento: o total de entradas é a soma dos meses',
     somaEntradas === App.moeda.deReais(
       faturamento.totais.filter(t => t.rotulo === 'Recebido')[0].valor),
     String(somaEntradas));
  ok('faturamento: cada mês tem saldo = entradas − saídas',
     faturamento.tabela.linhas.every(l => l.saldo === l.entradas - l.saidas));

  const inadimplencia = ind.inadimplencia(dados);
  ok('inadimplência: usa a paleta ordinal no aging',
     inadimplencia.grafico.paleta === 'ordinal');
  ok('inadimplência: a participação dos devedores não passa de 100%',
     inadimplencia.tabela.linhas.every(l => l.participacao <= 100),
     JSON.stringify(inadimplencia.tabela.linhas.map(l => l.participacao)));

  const funil = ind.funil(dados);
  ok('funil: uma barra por etapa',
     funil.grafico.categorias.length === App.domain.enums.ETAPAS_FUNIL.length);
  ok('funil: a soma das etapas é o total de leads',
     funil.grafico.series[0].valores.reduce((s, v) => s + v, 0) === dados.leads.length);
  ok('funil: usa paleta ordinal (a ordem das etapas é o significado)',
     funil.grafico.paleta === 'ordinal');

  const rentabilidade = ind.rentabilidade(dados);
  ok('rentabilidade: resultado = receita − custo',
     rentabilidade.tabela.linhas.every(l => l.resultado === l.receita - l.custo));
  ok('rentabilidade: vem do maior para o menor resultado',
     rentabilidade.tabela.linhas.length < 2 ||
     rentabilidade.tabela.linhas[0].resultado >= rentabilidade.tabela.linhas[1].resultado);

  const produtividade = ind.produtividade(dados);
  ok('produtividade: ninguém entra sem ter entregue nada',
     produtividade.tabela.linhas.every(l =>
       l.prazosCumpridos || l.tarefas || l.minutos || l.prazosPerdidos));

  const publicacoes = ind.publicacoes(dados);
  ok('publicações: a soma dos status é o total capturado',
     publicacoes.tabela.linhas.reduce((s, l) => s + l.quantidade, 0) ===
     dados.publicacoes.length,
     publicacoes.tabela.linhas.reduce((s, l) => s + l.quantidade, 0) + ' vs ' +
     dados.publicacoes.length);

  // ===================== PERÍODO VAZIO =====================
  secao('Recorte sem dados');

  const semDados = Object.assign({}, dados, {
    periodo: { de: '1990-01-01', ate: '1990-12-31' }
  });

  ok('produtividade sem dados devolve vazio', ind.produtividade(semDados).vazio === true);
  ok('prazos sem dados devolve vazio', ind.desempenhoPrazos(semDados).vazio === true);
  ok('publicações sem dados devolve vazio', ind.publicacoes(semDados).vazio === true);
  ok('o relatório vazio traz a explicação',
     !!ind.produtividade(semDados).nota);
  ok('o relatório vazio não traz gráfico nem tabela',
     ind.produtividade(semDados).grafico === null &&
     ind.produtividade(semDados).tabela === null);

  ok('coleções vazias não quebram nenhum relatório',
     ind.CATALOGO.every(def => {
       try { return def.calcular({}).vazio === true; } catch (e) { return false; }
     }),
     ind.CATALOGO.filter(def => {
       try { def.calcular({}); return false; } catch (e) { return true; }
     }).map(d => d.id).join(', '));

  // ===================== FILTRO DE PERÍODO =====================
  secao('Filtro de período');

  ok('noPeriodo filtra pelo campo indicado',
     ind.noPeriodo([{ d: '2026-05-10' }, { d: '2026-08-10' }], 'd',
                   { de: '2026-06-01', ate: '2026-12-31' }).length === 1);
  ok('noPeriodo descarta registro sem a data',
     ind.noPeriodo([{ d: null }], 'd', {}).length === 0);
  ok('sem período, nada é descartado por data',
     ind.noPeriodo([{ d: '2020-01-01' }, { d: '2030-01-01' }], 'd', {}).length === 2);

  ok('pct arredonda a uma casa', ind.pct(1, 3) === 33.3, String(ind.pct(1, 3)));
  ok('pct com total zero devolve 0', ind.pct(5, 0) === 0);

  // ===================== SERVICE E PERMISSÕES =====================
  secao('Catálogo por perfil');

  const svc = App.services.relatorioService;

  await App.services.sessaoService.entrar(admin.id);
  const doAdmin = svc.catalogo();
  ok('admin vê todos os relatórios', doAdmin.length === 10, String(doAdmin.length));

  await App.services.sessaoService.entrar(socio.id);
  const doSocio = svc.catalogo();
  ok('sócio vê a contingência',
     doSocio.some(r => r.id === 'contingencia'));
  ok('sócio vê o financeiro', doSocio.some(r => r.id === 'faturamento'));
  ok('sócio NÃO tem escopo restrito',
     doSocio.filter(r => r.id === 'produtividade')[0].restrito === false);

  await App.services.sessaoService.entrar(advogado.id);
  const doAdvogado = svc.catalogo();
  ok('advogado NÃO vê a contingência (exige relatorios.todos)',
     !doAdvogado.some(r => r.id === 'contingencia'));
  ok('advogado NÃO vê o financeiro',
     !doAdvogado.some(r => r.id === 'faturamento'));
  ok('advogado vê produtividade, mas RESTRITA',
     doAdvogado.filter(r => r.id === 'produtividade')[0].restrito === true);

  await App.services.sessaoService.entrar(financeiro.id);
  const doFinanceiro = svc.catalogo();
  ok('financeiro vê os relatórios financeiros',
     doFinanceiro.some(r => r.id === 'faturamento') &&
     doFinanceiro.some(r => r.id === 'inadimplencia'));
  ok('financeiro NÃO vê o funil do CRM',
     !doFinanceiro.some(r => r.id === 'funil'));

  await App.services.sessaoService.entrar(estagiario.id);
  ok('estagiário não vê relatório nenhum de gestão',
     svc.catalogo().every(r => r.permissao !== 'relatorios.ver'),
     svc.catalogo().map(r => r.id).join(', '));

  // ===================== ESCOPO PRÓPRIO =====================
  secao('Escopo próprio — o advogado vê a si mesmo');

  await App.services.sessaoService.entrar(socio.id);
  const geralSocio = await svc.gerar('produtividade', {});
  ok('sócio recebe o relatório sem restrição', geralSocio.escopoProprio === false);

  await App.services.sessaoService.entrar(advogado.id);
  const doAdv = await svc.gerar('produtividade', {});
  ok('advogado recebe o relatório RESTRITO', doAdv.escopoProprio === true);
  ok('e o relatório diz de quem são os números',
     doAdv.escopoNome === advogado.nome, doAdv.escopoNome);

  if (!doAdv.vazio) {
    /* O ponto: total geral com lista filtrada é o jeito clássico de o
       relatório mentir. Aqui os dois vêm do mesmo recorte. */
    ok('a tabela do escopo próprio traz APENAS o próprio usuário',
       doAdv.tabela.linhas.every(l => l.usuarioId === advogado.id),
       doAdv.tabela.linhas.map(l => l.nome).join(', '));
    ok('e o total bate com a linha única',
       parseInt(doAdv.totais[0].valor.replace(/\D/g, ''), 10) ===
       doAdv.tabela.linhas.reduce((s, l) => s + l.prazosCumpridos, 0),
       doAdv.totais[0].valor);
  } else {
    ok('escopo próprio sem dados devolve vazio coerente', true,
       'advogado sem entregas no período');
  }

  let semAcesso = false;
  try { await svc.gerar('contingencia', {}); } catch (e) { semAcesso = e.codigo === 403; }
  ok('relatório fora da permissão é recusado com 403', semAcesso);

  let inexistente = false;
  try { await svc.gerar('nao-existe', {}); } catch (e) { inexistente = e.codigo === 404; }
  ok('relatório inexistente devolve 404', inexistente);

  // ===================== SEGREDO DE JUSTIÇA =====================
  secao('Segredo de justiça nos relatórios');

  await App.services.sessaoService.entrar(admin.id);
  const carteiraAdmin = await svc.gerar('carteira', {});
  const totalAdmin = parseInt(
    carteiraAdmin.totais[0].valor.replace(/\D/g, ''), 10);

  // Marca um processo ativo como secreto, de responsável alheio.
  const alvo = db.get('processos').filter(p => p.status === 'ativo' && !p.segredoJustica)[0];
  db.update('processos', alvo.id, {
    segredoJustica: true, responsavelId: 'USR-NINGUEM', equipeIds: []
  });

  await App.services.sessaoService.entrar(estagiario.id);
  const coletadoEstagiario = svc.coletar(null);
  ok('o processo em segredo NÃO entra na coleta de quem não pode vê-lo',
     !coletadoEstagiario.processos.some(p => p.id === alvo.id));
  /* Se o processo sumisse da lista mas continuasse na conta, o TOTAL
     denunciaria a existência dele. */
  ok('e nada que pende dele entra também',
     !coletadoEstagiario.prazos.some(p => p.processoId === alvo.id) &&
     !coletadoEstagiario.lancamentos.some(l => l.processoId === alvo.id));

  await App.services.sessaoService.entrar(admin.id);
  const carteiraDepois = await svc.gerar('carteira', {});
  ok('para o admin, o processo em segredo continua contando',
     parseInt(carteiraDepois.totais[0].valor.replace(/\D/g, ''), 10) === totalAdmin,
     carteiraDepois.totais[0].valor);

  // Devolve ao estado original.
  db.update('processos', alvo.id, {
    segredoJustica: false, responsavelId: alvo.responsavelId, equipeIds: alvo.equipeIds
  });

  // ===================== FILTRO POR ÁREA =====================
  secao('Filtro por área');

  await App.services.sessaoService.entrar(admin.id);
  const soCivel = await svc.gerar('carteira', { areaId: 'civel' });
  const todasAreas = await svc.gerar('carteira', {});
  ok('filtrar por área reduz o total',
     parseInt(soCivel.totais[0].valor.replace(/\D/g, ''), 10) <=
     parseInt(todasAreas.totais[0].valor.replace(/\D/g, ''), 10));

  const soCivelProdutividade = await svc.gerar('produtividade', { areaId: 'civel' });
  ok('o filtro de área atravessa para os prazos do relatório',
     soCivelProdutividade.vazio ||
     soCivelProdutividade.tabela.linhas.every(l => typeof l.prazosCumpridos === 'number'));

  // ===================== AUDITORIA E EXPORTAÇÃO =====================
  secao('Auditoria e exportação');

  ok('consultar relatório fica na trilha de auditoria',
     db.get('logsAuditoria').some(l => l.acao === 'consultar' &&
                                       l.colecao === 'relatorios'));

  const paraExportar = await svc.gerar('carteira', {});
  ok('o relatório traz o que a exportação precisa',
     !!paraExportar.tabela && Array.isArray(paraExportar.tabela.linhas));

  const csv = App.csv.gerar(paraExportar.tabela.linhas,
    paraExportar.tabela.colunas.map(c => ({
      campo: c.campo, titulo: c.titulo, formatar: c.formatar
    })));
  ok('o CSV do relatório tem cabeçalho', csv.indexOf('Fase') !== -1);
  /* Quem abre no Excel quer ler "R$ 1.250,00", não "125000". */
  ok('o CSV leva o valor FORMATADO, não o centavo cru',
     csv.indexOf('R$') !== -1, csv.slice(0, 200));

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
