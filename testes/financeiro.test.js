/* Verificação de F2.5 — aritmética do dinheiro, boleto FEBRABAN, contratos,
   títulos, repasses e timesheet.

   O teste-âncora do módulo é a linha digitável: se os dígitos verificadores
   estiverem errados, o boleto é papel bonito que o caixa recusa. */

const { criarAmbiente, criarPlacar } = require('./ambiente');

/* O ambiente carrega o núcleo inteiro — utils, domínio, seed, store e
   services — na ordem de dependência. A lista mora em ambiente.js para
   que um módulo novo no seed não quebre seis suítes de uma vez. */
const { App, janela } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();

const fin = App.domain.financeiro;
const bol = App.domain.boleto;
const moeda = App.moeda;

(async function () {

  // ===================== BOLETO =====================
  secao('Boleto — FEBRABAN');

  /* Caso documentado da FEBRABAN: no boleto que começa por "34191.09008",
     o primeiro campo é 341910900 e seu DV é 8. Conferido dígito a dígito:
     0,0,9,0,2,9,2,4,6 = 32 → (10 − 32 % 10) % 10 = 8. */
  ok('módulo 10 confere com caso documentado da FEBRABAN',
     bol.modulo10('341910900') === 8, String(bol.modulo10('341910900')));
  ok('módulo 10 de 0019 é 0 (soma 10, resto 0)',
     bol.modulo10('0019') === 0, String(bol.modulo10('0019')));
  ok('módulo 10 nunca passa de 9',
     [0, 1, 12, 123, 9999, 12345678].every(n => bol.modulo10(n) >= 0 && bol.modulo10(n) <= 9));
  ok('módulo 11 fica entre 1 e 9 (0, 10 e 11 viram 1)',
     [1, 22, 333, 4444, 999999999].every(n => bol.modulo11(n) >= 1 && bol.modulo11(n) <= 9));

  ok('fator de vencimento é de 4 dígitos',
     /^\d{4}$/.test(bol.fatorVencimento('2026-08-12')), bol.fatorVencimento('2026-08-12'));
  ok('vencimento maior tem fator maior',
     Number(bol.fatorVencimento('2026-08-13')) > Number(bol.fatorVencimento('2026-08-12')));
  ok('data inválida devolve fator zerado', bol.fatorVencimento('') === '0000');

  ok('nosso número tem 12 posições (11 + DV)',
     bol.nossoNumero(1).length === 12, bol.nossoNumero(1));

  const codigo = bol.codigoBarras({
    valorCentavos: 123456, dataVencimento: '2026-09-15', campoLivre: '1234567890123456789012345'
  });
  ok('código de barras tem 44 posições', codigo.length === 44, String(codigo.length));
  ok('código começa pelo banco fictício', codigo.slice(0, 3) === '999', codigo.slice(0, 3));
  ok('a moeda é o real (9)', codigo.slice(3, 4) === '9');
  ok('o valor ocupa 10 posições e bate',
     parseInt(codigo.slice(9, 19), 10) === 123456, codigo.slice(9, 19));

  const linha = bol.linhaDigitavel(codigo);
  ok('linha digitável tem 47 posições', linha.length === 47, String(linha.length));

  /* O teste-âncora: a validação confere os três DVs de campo (módulo 10) e o
     DV geral (módulo 11). Se passar, a linha é aceita por qualquer validador. */
  const conferencia = bol.validarLinha(linha);
  ok('a linha gerada é VÁLIDA', conferencia.valida === true, conferencia.motivo);
  ok('reconstruir a linha devolve o código de barras original',
     conferencia.codigoBarras === codigo,
     conferencia.codigoBarras + ' vs ' + codigo);

  // Qualquer dígito trocado precisa ser detectado — é para isso que o DV existe.
  let detectou = 0;
  for (let i = 0; i < 20; i++) {
    const pos = i * 2;
    const original = linha[pos];
    const trocado = linha.slice(0, pos) + ((parseInt(original, 10) + 1) % 10) + linha.slice(pos + 1);
    if (!bol.validarLinha(trocado).valida) detectou++;
  }
  ok('dígito trocado é detectado em 20 posições diferentes', detectou === 20,
     detectou + ' de 20');

  ok('linha curta é rejeitada', bol.validarLinha('123').valida === false);
  ok('linha vazia é rejeitada', bol.validarLinha('').valida === false);

  const formatada = bol.formatarLinha(linha);
  ok('a linha formatada tem a máscara do boleto',
     /^\d{5}\.\d{5} \d{5}\.\d{6} \d{5}\.\d{6} \d \d{14}$/.test(formatada), formatada);
  ok('a máscara não altera os dígitos',
     formatada.replace(/\D/g, '') === linha);

  const emitido = bol.emitir({ sequencial: 42, valorCentavos: 250000,
                               dataVencimento: '2026-10-01' });
  ok('emitir devolve linha válida', bol.validarLinha(emitido.linhaDigitavel).valida);
  ok('emitir devolve o valor pedido', emitido.valorCentavos === 250000);
  ok('emitir devolve nosso número', !!emitido.nossoNumero);

  // ===================== PARCELAS =====================
  secao('Parcelas do contrato');

  const parcelas = fin.gerarParcelas({
    valorFixoCentavos: 1000000, numParcelas: 3, dataInicio: '2026-01-10', diaVencimento: 10
  });
  ok('gera o número de parcelas pedido', parcelas.length === 3);
  ok('a soma das parcelas é EXATAMENTE o valor do contrato',
     parcelas.reduce((s, p) => s + p.valorCentavos, 0) === 1000000,
     String(parcelas.reduce((s, p) => s + p.valorCentavos, 0)));
  ok('as parcelas avançam um mês por vez',
     parcelas[0].dataCompetencia === '2026-01' &&
     parcelas[1].dataCompetencia === '2026-02' &&
     parcelas[2].dataCompetencia === '2026-03',
     parcelas.map(p => p.dataCompetencia).join(' '));

  // Vencimento em fim de semana é o erro que gera multa indevida.
  const todosUteis = parcelas.every(p => {
    const d = App.format.parseISO(p.dataVencimento);
    return d.getDay() !== 0 && d.getDay() !== 6;
  });
  ok('todo vencimento cai em dia útil', todosUteis,
     parcelas.map(p => p.dataVencimento).join(' '));

  const quebrado = fin.gerarParcelas({
    valorFixoCentavos: 10000, numParcelas: 3, dataInicio: '2026-01-05'
  });
  ok('valor que não divide exato ainda fecha',
     quebrado.reduce((s, p) => s + p.valorCentavos, 0) === 10000,
     JSON.stringify(quebrado.map(p => p.valorCentavos)));
  ok('o resto vai para as primeiras parcelas',
     quebrado[0].valorCentavos > quebrado[2].valorCentavos);

  // Dia 31 em mês de 30 não pode transbordar para o mês seguinte.
  const dia31 = fin.gerarParcelas({
    valorFixoCentavos: 300000, numParcelas: 3, dataInicio: '2026-01-31', diaVencimento: 31
  });
  ok('dia 31 em mês de 30 cai no último dia, sem pular de mês',
     dia31[1].dataCompetencia === '2026-02', dia31[1].dataCompetencia);

  ok('contrato sem valor não gera parcela',
     fin.gerarParcelas({ valorFixoCentavos: 0, numParcelas: 3 }).length === 0);
  ok('sem numParcelas gera uma só',
     fin.gerarParcelas({ valorFixoCentavos: 5000 }).length === 1);

  ok('somarMeses respeita o último dia do mês',
     fin.somarMeses('2026-01-31', 1) === '2026-02-28', fin.somarMeses('2026-01-31', 1));
  ok('somarMeses acerta fevereiro bissexto',
     fin.somarMeses('2028-01-31', 1) === '2028-02-29', fin.somarMeses('2028-01-31', 1));

  // ===================== ÊXITO E HORA =====================
  secao('Êxito e valor-hora');

  ok('êxito de 20% sobre R$ 100.000',
     fin.calcularExito({ percentualExito: 20 }, 10000000) === 2000000,
     String(fin.calcularExito({ percentualExito: 20 }, 10000000)));
  ok('contrato sem êxito devolve zero',
     fin.calcularExito({ percentualExito: 0 }, 10000000) === 0);
  ok('proveito negativo não vira honorário',
     fin.calcularExito({ percentualExito: 20 }, -500) === 0);

  const porHora = fin.calcularPorHora({ valorHoraCentavos: 30000 }, [
    { minutos: 60, faturavel: true }, { minutos: 30, faturavel: true },
    { minutos: 120, faturavel: false }
  ]);
  ok('soma só as horas faturáveis', porHora.minutos === 90, String(porHora.minutos));
  ok('cobra a fração de hora proporcionalmente',
     porHora.valorCentavos === 45000, String(porHora.valorCentavos));
  ok('apontamento já faturado não entra de novo',
     fin.calcularPorHora({ valorHoraCentavos: 30000 },
       [{ minutos: 60, faturavel: true, lancamentoId: 'LAN-1' }]).valorCentavos === 0);

  // ===================== MORA =====================
  secao('Multa e juros');

  const mora = fin.jurosMulta(
    { valorCentavos: 100000, dataVencimento: '2026-08-01', status: 'em_aberto' },
    '2026-08-31');
  ok('conta os dias de atraso', mora.diasAtraso === 30, String(mora.diasAtraso));
  ok('multa de 2% sobre o principal', mora.multaCentavos === 2000,
     String(mora.multaCentavos));
  ok('juros de 1% ao mês em 30 dias', mora.jurosCentavos === 1000,
     String(mora.jurosCentavos));
  ok('o total soma principal, multa e juros', mora.totalCentavos === 103000,
     String(mora.totalCentavos));

  /* Pro rata die: cobrar o mês cheio por poucos dias não se sustenta. */
  const meioMes = fin.jurosMulta(
    { valorCentavos: 100000, dataVencimento: '2026-08-01', status: 'em_aberto' },
    '2026-08-16');
  ok('juros são pro rata die, não mês cheio',
     meioMes.jurosCentavos === 500, String(meioMes.jurosCentavos));
  ok('a multa NÃO é proporcional (incide uma vez)',
     meioMes.multaCentavos === mora.multaCentavos);

  ok('título no prazo não tem mora',
     fin.jurosMulta({ valorCentavos: 100000, dataVencimento: '2026-09-01',
                      status: 'em_aberto' }, '2026-08-12').diasAtraso === 0);
  ok('título pago não acumula mora',
     fin.jurosMulta({ valorCentavos: 100000, dataVencimento: '2026-01-01',
                      status: 'pago' }, '2026-08-12').jurosCentavos === 0);
  ok('encargos configuráveis são respeitados',
     fin.jurosMulta({ valorCentavos: 100000, dataVencimento: '2026-08-01',
                      status: 'em_aberto' }, '2026-08-31',
                    { multaPct: 10, jurosMes: 2 }).multaCentavos === 10000);

  // ===================== AGING =====================
  secao('Aging de recebíveis');

  const hojeTeste = '2026-08-12';
  const carteira = [
    { tipo: 'receita', status: 'em_aberto', valorCentavos: 10000, dataVencimento: '2026-09-01' },
    { tipo: 'receita', status: 'em_aberto', valorCentavos: 20000, dataVencimento: '2026-08-01' },
    { tipo: 'receita', status: 'em_aberto', valorCentavos: 30000, dataVencimento: '2026-07-01' },
    { tipo: 'receita', status: 'em_aberto', valorCentavos: 40000, dataVencimento: '2026-06-01' },
    { tipo: 'receita', status: 'em_aberto', valorCentavos: 50000, dataVencimento: '2026-01-01' },
    { tipo: 'receita', status: 'pago',      valorCentavos: 99999, dataVencimento: '2026-01-01' },
    { tipo: 'despesa', status: 'em_aberto', valorCentavos: 88888, dataVencimento: '2026-01-01' }
  ];
  const faixas = fin.aging(carteira, hojeTeste);
  function faixa(id) { return faixas.filter(f => f.id === id)[0]; }

  ok('a vencer entra na faixa certa', faixa('a_vencer').valorCentavos === 10000);
  ok('11 dias de atraso caem em 1 a 30', faixa('ate30').valorCentavos === 20000);
  ok('42 dias caem em 31 a 60', faixa('ate60').valorCentavos === 30000);
  ok('72 dias caem em 61 a 90', faixa('ate90').valorCentavos === 40000);
  ok('mais de 90 dias na última faixa', faixa('acima90').valorCentavos === 50000);
  ok('título PAGO não entra no aging',
     faixas.reduce((s, f) => s + f.valorCentavos, 0) === 150000,
     String(faixas.reduce((s, f) => s + f.valorCentavos, 0)));
  ok('DESPESA não entra no aging de recebíveis',
     faixas.every(f => f.valorCentavos !== 88888));

  // ===================== FLUXO DE CAIXA =====================
  secao('Fluxo de caixa');

  const movimentos = [
    { tipo: 'receita', status: 'pago', valorCentavos: 100000, valorPagoCentavos: 100000,
      dataCompetencia: '2026-06', dataPagamento: '2026-07-05', dataVencimento: '2026-06-30' },
    { tipo: 'despesa', status: 'pago', valorCentavos: 40000, valorPagoCentavos: 40000,
      dataCompetencia: '2026-07', dataPagamento: '2026-07-10', dataVencimento: '2026-07-10' },
    { tipo: 'receita', status: 'em_aberto', valorCentavos: 70000,
      dataCompetencia: '2026-07', dataVencimento: '2026-07-20' }
  ];

  const caixa = fin.fluxoCaixa(movimentos, '2026-06-01', '2026-08-01', 'caixa');
  ok('a série cobre os meses do período', caixa.meses.length === 3,
     caixa.meses.join(' '));
  ok('regime de caixa lança pela data de PAGAMENTO',
     caixa.entradas[1] === 100000 && caixa.entradas[0] === 0,
     JSON.stringify(caixa.entradas));
  ok('regime de caixa IGNORA o que não foi pago',
     caixa.totais.entradas === 100000, String(caixa.totais.entradas));

  const competencia = fin.fluxoCaixa(movimentos, '2026-06-01', '2026-08-01', 'competencia');
  ok('regime de competência lança pelo período a que pertence',
     competencia.entradas[0] === 100000, JSON.stringify(competencia.entradas));
  ok('regime de competência inclui o que ainda não foi pago',
     competencia.totais.entradas === 170000, String(competencia.totais.entradas));

  ok('o saldo é entradas menos saídas',
     caixa.saldo[1] === caixa.entradas[1] - caixa.saidas[1]);
  ok('o acumulado soma os saldos',
     caixa.acumulado[2] === caixa.saldo[0] + caixa.saldo[1] + caixa.saldo[2]);
  ok('lançamento cancelado fica fora do fluxo',
     fin.fluxoCaixa([{ tipo: 'receita', status: 'cancelado', valorCentavos: 99999,
                       dataPagamento: '2026-07-01' }],
                    '2026-07-01', '2026-07-01', 'caixa').totais.entradas === 0);

  // ===================== RENTABILIDADE =====================
  secao('Rentabilidade');

  const rent = fin.rentabilidade({
    lancamentos: [
      { tipo: 'receita', status: 'pago', valorCentavos: 500000, valorPagoCentavos: 500000 },
      { tipo: 'despesa', status: 'pago', valorCentavos: 50000, valorPagoCentavos: 50000 }
    ],
    apontamentos: [{ minutos: 600 }],
    valorHoraCentavos: 20000
  });
  ok('soma a receita', rent.receitaCentavos === 500000);
  ok('soma a despesa', rent.despesaCentavos === 50000);
  ok('converte horas em custo', rent.custoHorasCentavos === 200000,
     String(rent.custoHorasCentavos));
  ok('resultado = receita − despesa − horas', rent.resultadoCentavos === 250000,
     String(rent.resultadoCentavos));
  ok('a margem é percentual sobre a receita', rent.margemPct === 50, String(rent.margemPct));
  ok('sem receita a margem é zero, não infinito',
     fin.rentabilidade({ lancamentos: [], apontamentos: [] }).margemPct === 0);

  /* Sem custo de hora, todo processo pareceria lucrativo — e o relatório
     serviria para nada. */
  const semHoras = fin.rentabilidade({
    lancamentos: [{ tipo: 'receita', status: 'pago', valorCentavos: 100000 }],
    apontamentos: [{ minutos: 6000 }], valorHoraCentavos: 0
  });
  ok('valor-hora zero produz lucro irreal (por isso o service usa referência)',
     semHoras.resultadoCentavos === 100000);

  // ===================== SITUAÇÃO =====================
  secao('Situação que envelhece sozinha');

  ok('em aberto vencido vira atrasado',
     fin.situacao({ status: 'em_aberto', dataVencimento: '2026-01-01' }, '2026-08-12') === 'atrasado');
  ok('pago continua pago',
     fin.situacao({ status: 'pago', dataVencimento: '2026-01-01' }, '2026-08-12') === 'pago');
  ok('pagamento parcial é reconhecido',
     fin.situacao({ status: 'em_aberto', valorCentavos: 1000, valorPagoCentavos: 400,
                    dataVencimento: '2026-12-01' }, '2026-08-12') === 'parcial');
  ok('previsto no futuro continua previsto',
     fin.situacao({ status: 'previsto', dataVencimento: '2026-12-01' }, '2026-08-12') === 'previsto');

  // ===================== SEED E SERVICES =====================
  secao('Seed financeiro');

  const db = App.services.db;
  db.init(true);
  App.services.auditoriaService.iniciar();

  const usuarios = db.get('usuarios');
  const admin = usuarios.filter(u => u.perfil === 'admin')[0];
  await App.services.sessaoService.entrar(admin.id);

  ok('o seed traz contratos', db.get('contratos').length > 0,
     String(db.get('contratos').length));
  ok('o seed traz lançamentos', db.get('lancamentos').length > 50,
     String(db.get('lancamentos').length));
  ok('o seed traz apontamentos de hora', db.get('apontamentos').length > 0);
  ok('o seed traz repasses', db.get('repasses').length > 0);

  const todosLancamentos = db.get('lancamentos');
  ok('há receitas e despesas',
     todosLancamentos.some(l => l.tipo === 'receita') &&
     todosLancamentos.some(l => l.tipo === 'despesa'));
  ok('há títulos pagos e em aberto',
     todosLancamentos.some(l => l.status === 'pago') &&
     todosLancamentos.some(l => l.status !== 'pago'));

  const resumo = await App.services.lancamentoService.resumo({});
  ok('há inadimplência para o aging mostrar', resumo.atrasadoCentavos > 0,
     App.format.moeda(resumo.atrasadoCentavos));
  ok('o indicador de inadimplência é calculado', resumo.inadimplenciaPct > 0,
     resumo.inadimplenciaPct + '%');
  ok('o aging tem mais de uma faixa povoada',
     resumo.aging.filter(f => f.valorCentavos > 0).length >= 2,
     String(resumo.aging.filter(f => f.valorCentavos > 0).length));
  ok('o fluxo de caixa cobre 12 meses', resumo.fluxo.meses.length === 12,
     String(resumo.fluxo.meses.length));
  ok('há entradas e saídas no fluxo',
     resumo.fluxo.totais.entradas > 0 && resumo.fluxo.totais.saidas > 0);

  // ===================== CONTRATO =====================
  secao('Contratos');

  const cliente = db.get('pessoas').filter(p => p.ehCliente)[0];
  const antesLanc = db.get('lancamentos').length;

  const contrato = await App.services.contratoService.criar({
    clienteId: cliente.id, modalidade: 'fixo',
    valorFixoCentavos: 600000, numParcelas: 6, diaVencimento: 10,
    descricao: 'Contrato de teste'
  });
  ok('criar contrato gera as parcelas', contrato.parcelasGeradas === 6,
     String(contrato.parcelasGeradas));
  ok('as parcelas entraram no contas a receber',
     db.get('lancamentos').length === antesLanc + 6);

  const detalhe = await App.services.contratoService.obter(contrato.id);
  ok('as parcelas somam o valor do contrato',
     detalhe.parcelas.reduce((s, p) => s + p.valorCentavos, 0) === 600000);
  ok('as parcelas nascem previstas',
     detalhe.parcelas.every(p => p.status === 'previsto'));
  ok('o contrato calcula o previsto', detalhe.previstoCentavos === 600000);
  ok('o contrato começa sem nada recebido', detalhe.recebidoCentavos === 0);

  let semCliente = false;
  try { await App.services.contratoService.criar({ modalidade: 'fixo' }); }
  catch (e) { semCliente = e.codigo === 400; }
  ok('contrato sem cliente é recusado', semCliente);

  let modalidadeRuim = false;
  try {
    await App.services.contratoService.criar({ clienteId: cliente.id, modalidade: 'inventada' });
  } catch (e) { modalidadeRuim = e.codigo === 400; }
  ok('modalidade inválida é recusada', modalidadeRuim);

  const contratoExito = await App.services.contratoService.criar({
    clienteId: cliente.id, modalidade: 'exito', percentualExito: 20
  });
  ok('contrato de êxito NÃO gera parcela prevista', contratoExito.parcelasGeradas === 0);

  const exito = await App.services.contratoService.lancarExito(contratoExito.id, 5000000);
  ok('lançar êxito calcula 20% do proveito', exito.valorCentavos === 1000000,
     String(exito.valorCentavos));
  ok('o êxito entra como receita em aberto',
     exito.tipo === 'receita' && exito.origem === 'exito' && exito.status === 'em_aberto');

  let semExito = false;
  try { await App.services.contratoService.lancarExito(contrato.id, 100000); }
  catch (e) { semExito = e.codigo === 409; }
  ok('contrato sem cláusula de êxito recusa o lançamento', semExito);

  // ===================== TÍTULOS =====================
  secao('Contas a receber e a pagar');

  const svcLan = App.services.lancamentoService;
  const parcela = detalhe.parcelas[0];

  const baixado = await svcLan.baixar(parcela.id, {});
  ok('baixar quita o título', baixado.situacao === 'pago');
  ok('baixar grava o valor pago', baixado.valorPagoCentavos === parcela.valorCentavos);
  ok('baixar grava a data', !!baixado.dataPagamento);

  let jaBaixado = false;
  try { await svcLan.baixar(parcela.id, {}); } catch (e) { jaBaixado = e.codigo === 409; }
  ok('baixar duas vezes é recusado', jaBaixado);

  /* Estornar devolve o título ao estado natural — que NÃO é "em aberto" e
     sim o que a data mandar. Uma parcela cujo vencimento já passou volta
     como ATRASADA, e é assim que tem de ser: o estorno desfaz o pagamento,
     não o calendário. */
  const estornado = await svcLan.estornar(parcela.id);
  ok('estornar zera o valor pago', estornado.valorPagoCentavos === 0);
  ok('estornar limpa a data de pagamento', !estornado.dataPagamento);
  ok('o título deixa de estar pago', estornado.situacao !== 'pago', estornado.situacao);
  ok('a situação volta a ser ditada pela data, não pelo estorno',
     estornado.situacao === (estornado.dataVencimento < App.domain.prazos.hojeISO()
       ? 'atrasado' : 'em_aberto'),
     estornado.situacao + ' (vence ' + estornado.dataVencimento + ')');

  // Pagamento parcial: na vida real acontece.
  const parcial = await svcLan.baixar(detalhe.parcelas[1].id, { valorPagoCentavos: 10000 });
  ok('pagamento parcial é aceito', parcial.situacao === 'parcial', parcial.situacao);
  ok('o parcial guarda quanto foi pago', parcial.valorPagoCentavos === 10000);
  ok('o parcial não carimba data de quitação', !parcial.dataPagamento);

  const restante = detalhe.parcelas[1].valorCentavos - 10000;
  const quitado = await svcLan.baixar(detalhe.parcelas[1].id, { valorPagoCentavos: restante });
  ok('completar o parcial quita o título', quitado.situacao === 'pago');

  const despesa = await svcLan.criar({
    descricao: 'Custas de teste', origem: 'custa', valorCentavos: 15000
  });
  ok('o tipo vem do enum, não do formulário', despesa.tipo === 'despesa', despesa.tipo);

  let valorZero = false;
  try { await svcLan.criar({ descricao: 'x', origem: 'custa', valorCentavos: 0 }); }
  catch (e) { valorZero = e.codigo === 400; }
  ok('lançamento com valor zero é recusado', valorZero);

  let pagoNaoExclui = false;
  try { await svcLan.remover(quitado.id); } catch (e) { pagoNaoExclui = e.codigo === 409; }
  ok('título pago não é excluído — precisa estornar antes', pagoNaoExclui);

  const listados = await svcLan.listar({ tipo: 'receita', apenasAtrasados: true });
  ok('listar filtra os atrasados', listados.itens.every(l => l.atrasado));
  ok('o atrasado traz o cálculo da mora',
     listados.itens.length === 0 || listados.itens[0].moraCentavos > 0);

  // ===================== BOLETO (SERVICE) =====================
  secao('Emissão de boleto');

  const paraBoleto = detalhe.parcelas[2];
  const boleto = await App.services.boletoService.emitir(paraBoleto.id);
  ok('o boleto é emitido', !!boleto.linhaDigitavel);
  ok('a linha emitida pelo service é VÁLIDA',
     bol.validarLinha(boleto.linhaDigitavel).valida, boleto.linhaDigitavel);
  ok('o boleto guarda o principal', boleto.principalCentavos === paraBoleto.valorCentavos);
  ok('o lançamento passa a apontar para o boleto',
     db.find('lancamentos', paraBoleto.id).boletoId === boleto.id);

  let boletoRepetido = false;
  try { await App.services.boletoService.emitir(paraBoleto.id); }
  catch (e) { boletoRepetido = e.codigo === 409; }
  ok('emitir dois boletos do mesmo título é recusado', boletoRepetido);

  let boletoDeDespesa = false;
  try { await App.services.boletoService.emitir(despesa.id); }
  catch (e) { boletoDeDespesa = e.codigo === 409; }
  ok('despesa não gera boleto', boletoDeDespesa);

  // Baixar o título quita o boleto junto.
  await svcLan.baixar(paraBoleto.id, {});
  ok('baixar o título marca o boleto como pago',
     db.find('boletos', boleto.id).status === 'pago');

  const impressao = App.services.boletoService.montarImpressao(boleto);
  ok('a impressão traz a linha digitável', impressao.indexOf(boleto.linhaFormatada) !== -1);
  ok('a impressão declara que o título não vale',
     impressao.indexOf('DOCUMENTO SEM VALOR') !== -1);

  // ===================== REPASSES =====================
  secao('Repasses');

  const receitaParaRepasse = detalhe.parcelas[3];
  const repasse = await App.services.repasseService.criar({
    lancamentoOrigemId: receitaParaRepasse.id,
    beneficiarioId: usuarios[1].id, tipo: 'correspondente', percentual: 20
  });
  ok('o repasse calcula o percentual da receita',
     repasse.valorCentavos === Math.round(receitaParaRepasse.valorCentavos * 0.2),
     String(repasse.valorCentavos));
  ok('o repasse cria a despesa correspondente', !!repasse.lancamentoId);
  ok('a despesa do repasse é do tipo despesa',
     db.find('lancamentos', repasse.lancamentoId).tipo === 'despesa');

  let repasseExcessivo = false;
  try {
    await App.services.repasseService.criar({
      lancamentoOrigemId: receitaParaRepasse.id, percentual: 90
    });
  } catch (e) { repasseExcessivo = e.codigo === 409; }
  ok('a soma dos repasses não pode passar da receita', repasseExcessivo);

  let repasseDeDespesa = false;
  try {
    await App.services.repasseService.criar({ lancamentoOrigemId: despesa.id, percentual: 10 });
  } catch (e) { repasseDeDespesa = e.codigo === 409; }
  ok('repasse sai de receita, não de despesa', repasseDeDespesa);

  await App.services.repasseService.pagar(repasse.id);
  ok('pagar o repasse baixa a despesa vinculada',
     db.find('lancamentos', repasse.lancamentoId).status === 'pago');

  // ===================== TIMESHEET =====================
  secao('Timesheet');

  const svcTime = App.services.timesheetService;
  const processo = db.get('processos')[0];

  ok('formata a duração', svcTime.formatarDuracao(135) === '2h15',
     svcTime.formatarDuracao(135));
  ok('formata menos de uma hora', svcTime.formatarDuracao(45) === '45min');
  ok('formata hora cheia', svcTime.formatarDuracao(120) === '2h');

  const apontamento = await svcTime.criar({
    processoId: processo.id, minutos: 90, descricao: 'Elaboração de peça'
  });
  ok('cria o apontamento', apontamento.minutos === 90);
  ok('calcula o valor da hora apontada', apontamento.valorCentavos > 0);
  ok('o apontamento nasce não faturado', apontamento.faturado === false);

  let semMinutos = false;
  try { await svcTime.criar({ processoId: processo.id, minutos: 0 }); }
  catch (e) { semMinutos = e.codigo === 400; }
  ok('apontamento sem tempo é recusado', semMinutos);

  const faturamento = await svcTime.faturar(processo.id, {});
  ok('faturar cria UM lançamento para várias horas',
     faturamento.apontamentos > 1 || faturamento.apontamentos === 1,
     String(faturamento.apontamentos));
  ok('o lançamento do faturamento é receita',
     faturamento.lancamento.tipo === 'receita');
  ok('as horas faturadas ficam marcadas',
     db.find('apontamentos', apontamento.id).lancamentoId === faturamento.lancamento.id);

  let jaFaturado = false;
  try { await svcTime.atualizar(apontamento.id, { minutos: 30 }); }
  catch (e) { jaFaturado = e.codigo === 409; }
  ok('apontamento faturado não pode ser alterado', jaFaturado);

  let semPendente = false;
  try { await svcTime.faturar(processo.id, {}); } catch (e) { semPendente = e.codigo === 409; }
  ok('faturar sem horas pendentes é recusado', semPendente);

  const equipe = await svcTime.porUsuario();
  ok('agrupa horas por pessoa', equipe.length > 0);
  ok('a lista vem do maior para o menor',
     equipe.length < 2 || equipe[0].minutos >= equipe[1].minutos);

  const rentabilidade = await svcLan.rentabilidadeDoProcesso(processo.id);
  ok('a rentabilidade do processo é calculada',
     typeof rentabilidade.resultadoCentavos === 'number');
  ok('a rentabilidade considera as horas', rentabilidade.custoHorasCentavos > 0);

  // ===================== PERMISSÕES =====================
  secao('Permissões do financeiro');

  const perm = App.domain.permissoes;
  const socio = usuarios.filter(u => u.perfil === 'socio')[0];
  const advogado = usuarios.filter(u => u.perfil === 'advogado')[0];
  const financeiro = usuarios.filter(u => u.perfil === 'financeiro')[0];

  ok('sócio VÊ o financeiro', perm.pode(socio, 'financeiro.ver'));
  ok('sócio NÃO lança', !perm.pode(socio, 'financeiro.lancar'));
  ok('advogado NÃO vê o financeiro do escritório', !perm.pode(advogado, 'financeiro.ver'));
  ok('financeiro vê e lança',
     perm.pode(financeiro, 'financeiro.ver') && perm.pode(financeiro, 'financeiro.lancar'));
  ok('admin faz tudo',
     perm.pode(admin, 'financeiro.ver') && perm.pode(admin, 'financeiro.lancar'));

  encerrar();
})().catch(function (erro) {
  console.error('\n✕ ERRO NÃO TRATADO NA SUÍTE:', erro && (erro.stack || erro.message));
  process.exit(1);
});
