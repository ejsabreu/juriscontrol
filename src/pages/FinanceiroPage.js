/* ==========================================================================
   pages/FinanceiroPage.js — o dinheiro do escritório

   Cinco abas: painel, a receber, a pagar, contratos e repasses.

   O painel lidera com o FLUXO DE CAIXA e não com o total faturado, porque a
   pergunta que o sócio faz toda segunda-feira é "dá para pagar a folha este
   mês?", e não "quanto vendemos". Faturamento sem caixa é o que quebra
   escritório.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var aba = 'painel';
  var resumo = null;
  var lista = null;
  var contratos = [];
  var repasses = [];
  var regime = 'caixa';
  var filtros = { tipo: 'receita', status: '', busca: '' };
  var desmontarGrafico = null;

  function esc(v) { return App.dom.esc(v); }
  function moeda(c) { return App.format.moeda(c); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });
    ligarEventos();
    carregar();
  }

  function destroy() {
    if (desmontarGrafico) { desmontarGrafico(); desmontarGrafico = null; }
  }

  function carregar() {
    var pedidos = [App.services.lancamentoService.resumo({ regime: regime })];

    if (aba === 'receber' || aba === 'pagar') {
      pedidos.push(App.services.lancamentoService.listar(
        Object.assign({}, filtros, { tipo: aba === 'receber' ? 'receita' : 'despesa' })));
    } else if (aba === 'contratos') {
      pedidos.push(App.services.contratoService.listar({ busca: filtros.busca }));
    } else if (aba === 'repasses') {
      pedidos.push(App.services.repasseService.listar({}));
    }

    Promise.all(pedidos).then(function (r) {
      resumo = r[0];
      if (aba === 'receber' || aba === 'pagar') lista = r[1];
      if (aba === 'contratos') contratos = r[1];
      if (aba === 'repasses') repasses = r[1];
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar o financeiro', texto: erro.message
      });
    });
  }

  // --- Painel ------------------------------------------------------------------

  function kpis() {
    var ui = App.components.ui;

    return '<div class="grid grid--kpi">' +
      ui.Kpi({ rotulo: 'A receber', valor: moeda(resumo.aReceberCentavos), icone: '↓',
               cor: 'var(--color-success)' }) +
      ui.Kpi({ rotulo: 'A pagar', valor: moeda(resumo.aPagarCentavos), icone: '↑',
               cor: 'var(--color-warning)' }) +
      ui.Kpi({ rotulo: 'Em atraso', valor: moeda(resumo.atrasadoCentavos), icone: '⚠',
               cor: 'var(--color-danger)',
               dica: resumo.titulosAtrasados + ' título(s) · ' +
                     resumo.inadimplenciaPct + '% de inadimplência' }) +
      ui.Kpi({ rotulo: 'Saldo previsto', valor: moeda(resumo.saldoPrevistoCentavos), icone: '=',
               cor: resumo.saldoPrevistoCentavos >= 0
                 ? 'var(--color-primary-400)' : 'var(--color-danger)' }) +
    '</div>';
  }

  function graficoFluxo() {
    var fluxo = resumo.fluxo;
    var Chart = App.components.Chart;

    function rotuloMes(competencia) {
      var partes = String(competencia).split('-');
      return App.format.MESES_ABREV[parseInt(partes[1], 10) - 1] + '/' + partes[0].slice(2);
    }

    var categorias = fluxo.meses.map(rotuloMes);

    return App.components.ui.Card({
      titulo: 'Fluxo de caixa',
      subtitulo: regime === 'caixa' ? 'regime de caixa' : 'regime de competência',
      acoes: App.components.ui.ViewToggle({
        ativa: regime,
        acao: 'trocar-regime',
        opcoes: [
          { id: 'caixa', label: 'Caixa', titulo: 'Pelo que entrou e saiu de fato' },
          { id: 'competencia', label: 'Competência', titulo: 'Pelo resultado do período' }
        ]
      }),
      conteudo:
        Chart.Barras({
          categorias: categorias,
          series: [
            { id: 'entradas', label: 'Entradas', valores: fluxo.entradas },
            { id: 'saidas', label: 'Saídas', valores: fluxo.saidas }
          ],
          formatarValor: App.format.moedaCompacta,
          altura: 240,
          id: 'gr-fluxo'
        }) +
        '<p class="u-xs u-subtle" style="margin-top:var(--space-2)">' +
          (regime === 'caixa'
            ? 'Regime de caixa: só o que foi efetivamente pago. Responde "dá para pagar a folha?".'
            : 'Regime de competência: pelo período a que o valor pertence. Responde "o escritório deu lucro?".') +
        '</p>'
    });
  }

  function graficoSaldo() {
    var fluxo = resumo.fluxo;

    function rotuloMes(competencia) {
      var partes = String(competencia).split('-');
      return App.format.MESES_ABREV[parseInt(partes[1], 10) - 1] + '/' + partes[0].slice(2);
    }

    return App.components.ui.Card({
      titulo: 'Saldo acumulado',
      conteudo: App.components.Chart.Linha({
        categorias: fluxo.meses.map(rotuloMes),
        series: [{ id: 'acumulado', label: 'Acumulado', valores: fluxo.acumulado }],
        formatarValor: App.format.moedaCompacta,
        area: true,
        altura: 200
      })
    });
  }

  function cardAging() {
    var faixas = resumo.aging;
    var total = faixas.reduce(function (s, f) { return s + f.valorCentavos; }, 0);

    if (!total) {
      return App.components.ui.Card({
        titulo: 'Aging de recebíveis',
        conteudo: '<p class="u-sm u-muted">Nenhum recebível em aberto.</p>'
      });
    }

    return App.components.ui.Card({
      titulo: 'Aging de recebíveis',
      subtitulo: 'quanto tempo o dinheiro está parado',
      conteudo:
        /* Faixa de aging é ORDINAL: a ordem é o significado, então a rampa de
           um matiz só mostra a gravidade crescendo na própria cor. */
        App.components.Chart.Barras({
          categorias: faixas.map(function (f) { return f.label; }),
          series: [{ id: 'valor', label: 'Em aberto',
                     valores: faixas.map(function (f) { return f.valorCentavos; }) }],
          paleta: 'ordinal',
          orientacao: 'barra',
          formatarValor: App.format.moedaCompacta,
          altura: 200
        })
    });
  }

  function painel() {
    return kpis() +
      '<div class="page-section">' + graficoFluxo() + '</div>' +
      '<div class="grid grid--2col page-section">' +
        graficoSaldo() + cardAging() +
      '</div>';
  }

  // --- Listas -------------------------------------------------------------------

  function linhaLancamento(l) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var receita = l.tipo === 'receita';
    var quitado = l.situacao === 'pago';

    return '<tr' + (l.atrasado ? ' class="fin__atrasado"' : '') + '>' +
      '<td>' +
        '<div class="u-bold">' + esc(l.descricao) + '</div>' +
        '<div class="u-xs u-subtle">' + esc(l.rotuloOrigem) +
          (l.clienteNome !== '—' ? ' · ' + esc(l.clienteNome) : '') +
          (l.processoNumero ? ' · ' + esc(l.processoNumero) : '') + '</div>' +
      '</td>' +
      '<td class="u-sm">' + esc(App.format.data(l.dataVencimento)) +
        (l.atrasado ? '<div class="u-xs" style="color:var(--color-danger)">' +
          l.diasAtraso + ' dia(s) em atraso</div>' : '') +
      '</td>' +
      '<td class="u-right u-tabular u-bold">' + esc(moeda(l.valorCentavos)) +
        (l.moraCentavos ? '<div class="u-xs u-subtle">+ ' + esc(moeda(l.moraCentavos)) +
          ' de mora</div>' : '') +
      '</td>' +
      '<td>' + ui.BadgeEnum(enums.STATUS_LANCAMENTO, l.situacao) + '</td>' +
      '<td class="u-right">' +
        (quitado
          ? ui.Button({ rotulo: 'Estornar', tamanho: 'sm', variante: 'ghost',
                        acao: 'estornar', valor: l.id })
          : ui.Button({ rotulo: 'Baixar', tamanho: 'sm', variante: 'primary',
                        acao: 'baixar', valor: l.id })) +
        (receita && !quitado
          ? ' ' + ui.Button({ rotulo: l.boletoId ? 'Ver boleto' : 'Boleto', tamanho: 'sm',
                              acao: 'boleto', valor: l.id })
          : '') +
      '</td>' +
    '</tr>';
  }

  function abaLista() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var receita = aba === 'receber';

    var tabela = lista.itens.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Descrição</th><th>Vencimento</th><th class="u-right">Valor</th>' +
          '<th>Situação</th><th></th>' +
        '</tr></thead><tbody>' + lista.itens.map(linhaLancamento).join('') +
        '</tbody></table></div>'
      : ui.EmptyState({ icone: '💰', titulo: 'Nenhum título neste filtro' });

    return App.components.FilterBar({
      campos: [
        { tipo: 'busca', nome: 'busca', valor: filtros.busca,
          placeholder: 'Buscar por descrição, cliente ou processo…' },
        { tipo: 'select', nome: 'status', rotulo: 'Situação',
          opcoes: enums.opcoes(enums.STATUS_LANCAMENTO, filtros.status, 'Todas') },
        { tipo: 'select', nome: 'origem', rotulo: 'Origem',
          opcoes: enums.opcoes(
            enums.ORIGENS_LANCAMENTO.filter(function (o) {
              return o.tipo === (receita ? 'receita' : 'despesa');
            }), filtros.origem, 'Todas as origens') }
      ],
      totalAtivos: App.selectors.filtrosAtivos(filtros, ['tipo'])
    }) +
    ui.Card({
      titulo: receita ? 'Contas a receber' : 'Contas a pagar',
      subtitulo: lista.total + ' título(s) · ' + moeda(lista.somaCentavos),
      acoes: ui.Button({ rotulo: 'Novo lançamento', tamanho: 'sm', variante: 'primary',
                         acao: 'novo-lancamento' }),
      conteudo: tabela,
      semPadding: true
    });
  }

  function abaContratos() {
    var ui = App.components.ui;

    var linhas = contratos.map(function (c) {
      return '<tr>' +
        '<td>' +
          '<div class="u-bold">' + esc(c.clienteNome) + '</div>' +
          '<div class="u-xs u-subtle">' + esc(c.descricao || '') +
            (c.processoNumero ? ' · ' + esc(c.processoNumero) : '') + '</div>' +
        '</td>' +
        '<td class="u-sm">' + esc(c.rotuloModalidade) +
          (c.percentualExito ? '<div class="u-xs u-subtle">' + c.percentualExito +
            '% de êxito</div>' : '') + '</td>' +
        '<td class="u-right u-tabular">' + esc(moeda(c.previstoCentavos)) + '</td>' +
        '<td class="u-right u-tabular">' + esc(moeda(c.recebidoCentavos)) +
          '<div class="u-xs u-subtle">' + c.percentualRecebido + '%</div></td>' +
        '<td style="min-width:110px">' +
          ui.Progress({ percentual: c.percentualRecebido,
                        cor: c.atrasadoCentavos ? 'var(--color-danger)' : 'var(--color-success)' }) +
          (c.atrasadoCentavos
            ? '<div class="u-xs" style="color:var(--color-danger)">' +
              esc(moeda(c.atrasadoCentavos)) + ' em atraso</div>' : '') +
        '</td>' +
      '</tr>';
    }).join('');

    return ui.Card({
      titulo: 'Contratos de honorários',
      subtitulo: contratos.length + ' contrato(s)',
      acoes: ui.Button({ rotulo: 'Novo contrato', tamanho: 'sm', variante: 'primary',
                         href: '#/financeiro/contratos/novo' }),
      conteudo: contratos.length
        ? '<div class="table-wrap"><table class="table"><thead><tr>' +
            '<th>Cliente</th><th>Modalidade</th><th class="u-right">Previsto</th>' +
            '<th class="u-right">Recebido</th><th>Andamento</th>' +
          '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : ui.EmptyState({ icone: '📄', titulo: 'Nenhum contrato cadastrado' }),
      semPadding: true
    });
  }

  function abaRepasses() {
    var ui = App.components.ui;

    var linhas = repasses.map(function (r) {
      return '<tr>' +
        '<td class="u-bold">' + esc(r.beneficiarioNome) + '</td>' +
        '<td class="u-sm">' + esc(r.tipo) + '</td>' +
        '<td class="u-sm">' + esc(r.origemDescricao) + '</td>' +
        '<td class="u-right u-tabular">' + esc(moeda(r.valorCentavos)) +
          (r.percentual ? '<div class="u-xs u-subtle">' + r.percentual + '%</div>' : '') + '</td>' +
        '<td class="u-sm">' + esc(App.format.data(r.dataPrevista)) + '</td>' +
        '<td>' + (r.status === 'pago'
          ? ui.Badge({ rotulo: 'Pago', variante: 'success' })
          : ui.Badge({ rotulo: 'Previsto', variante: 'primary' })) + '</td>' +
        '<td class="u-right">' +
          (r.status === 'pago' ? '' : ui.Button({ rotulo: 'Pagar', tamanho: 'sm',
                                                  acao: 'pagar-repasse', valor: r.id })) +
        '</td>' +
      '</tr>';
    }).join('');

    return ui.Card({
      titulo: 'Repasses',
      subtitulo: 'parte do honorário que pertence a correspondentes, parceiros e sócios',
      conteudo: repasses.length
        ? '<div class="table-wrap"><table class="table"><thead><tr>' +
            '<th>Beneficiário</th><th>Tipo</th><th>Origem</th><th class="u-right">Valor</th>' +
            '<th>Previsto para</th><th>Situação</th><th></th>' +
          '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : ui.EmptyState({ icone: '🤝', titulo: 'Nenhum repasse registrado' }),
      semPadding: true
    });
  }

  function desenhar() {
    var ui = App.components.ui;
    if (desmontarGrafico) { desmontarGrafico(); desmontarGrafico = null; }

    var corpo = aba === 'painel' ? painel()
              : aba === 'contratos' ? abaContratos()
              : aba === 'repasses' ? abaRepasses()
              : abaLista();

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Financeiro</h1>' +
          '<p class="page-header__subtitle">Honorários, custas, repasses e fluxo de caixa</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          ui.Button({ rotulo: 'Timesheet', href: '#/timesheet', icone: '⏱' }) +
        '</div>' +
      '</div>' +
      ui.Tabs({
        ativa: aba,
        abas: [
          { id: 'painel', label: 'Painel' },
          { id: 'receber', label: 'A receber' },
          { id: 'pagar', label: 'A pagar' },
          { id: 'contratos', label: 'Contratos' },
          { id: 'repasses', label: 'Repasses' }
        ]
      }) +
      '<div class="page-section">' + corpo + '</div>';

    if (aba === 'painel') desmontarGrafico = App.components.Chart.mount(container);
  }

  // --- Ações --------------------------------------------------------------------

  function abrirBaixa(id) {
    var l = (lista.itens || []).filter(function (x) { return x.id === id; })[0];
    if (!l) return;

    var ui = App.components.ui;

    App.components.Modal.abrir({
      titulo: 'Baixar título',
      conteudo:
        '<p class="u-sm u-muted">' + esc(l.descricao) + '</p>' +
        '<form id="form-baixa">' +
          '<div class="form-grid">' +
            ui.Field({ nome: 'valorPago', rotulo: 'Valor recebido', largura: 6,
                       valor: App.format.moeda(l.totalComMoraCentavos),
                       dica: l.moraCentavos
                         ? 'Inclui ' + App.format.moeda(l.moraCentavos) + ' de multa e juros.'
                         : '' }) +
            ui.Field({ nome: 'dataPagamento', rotulo: 'Data', tipo: 'date', largura: 6,
                       valor: App.domain.prazos.hojeISO() }) +
          '</div>' +
          ui.Field({ nome: 'formaPagamento', rotulo: 'Forma', tipo: 'select',
                     opcoes: App.domain.enums.opcoes([
                       { id: 'pix', label: 'PIX' },
                       { id: 'boleto', label: 'Boleto' },
                       { id: 'transferencia', label: 'Transferência' },
                       { id: 'dinheiro', label: 'Dinheiro' },
                       { id: 'cartao', label: 'Cartão' }
                     ], 'pix') }) +
        '</form>' +
        '<p class="u-xs u-subtle">Valor menor que o total registra baixa parcial.</p>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Confirmar baixa', variante: 'primary', acao: 'confirmar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'confirmar') return;
        var dados = App.dom.formToObject(App.dom.qs('#form-baixa', corpo));

        App.services.lancamentoService.baixar(id, {
          valorPagoCentavos: App.moeda.deReais(dados.valorPago),
          dataPagamento: dados.dataPagamento,
          formaPagamento: dados.formaPagamento
        }).then(function (r) {
          fecharModal();
          App.components.Toast.sucesso(
            r.situacao === 'pago' ? 'Título baixado' : 'Baixa parcial registrada',
            moeda(r.valorPagoCentavos) + ' de ' + moeda(r.valorCentavos));
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível baixar', erro.message);
        });
      }
    });
  }

  function abrirBoleto(lancamentoId) {
    var l = (lista.itens || []).filter(function (x) { return x.id === lancamentoId; })[0];

    function mostrar(boleto) {
      App.components.Modal.abrir({
        titulo: 'Boleto emitido',
        conteudo:
          App.components.SeloSimulado({
            oque: 'o título NÃO está registrado em banco nenhum — o código 999 não ' +
                  'corresponde a instituição real.',
            detalhe: 'A linha digitável abaixo é matematicamente válida no padrão FEBRABAN: ' +
                     'os três dígitos de campo por módulo 10 e o verificador geral por ' +
                     'módulo 11 conferem em qualquer validador.',
            naFase3: 'registro no banco por API ou CNAB, com a mesma linha digitável.'
          }) +
          '<div class="bol">' +
            '<div class="bol__linha">' + esc(boleto.linhaFormatada) + '</div>' +
            '<dl class="def-list">' +
              '<div><dt class="def-list__term">Nosso número</dt>' +
                '<dd class="def-list__desc u-mono">' + esc(boleto.nossoNumero) + '</dd></div>' +
              '<div><dt class="def-list__term">Vencimento</dt>' +
                '<dd class="def-list__desc">' + esc(App.format.data(boleto.dataVencimento)) +
                '</dd></div>' +
              '<div><dt class="def-list__term">Valor</dt>' +
                '<dd class="def-list__desc">' + esc(moeda(boleto.valorCentavos)) + '</dd></div>' +
            '</dl>' +
          '</div>',
        acoes: [
          { rotulo: 'Fechar', variante: 'secondary', acao: 'fechar', fechar: true },
          { rotulo: 'Imprimir', variante: 'primary', acao: 'imprimir' }
        ],
        aoAcao: function (acao) {
          /* Mesma decisão da fase 1: quem sabe fazer PDF é o navegador.
             `modo: 'rico'` porque o boleto é HTML montado pelo sistema, não
             texto puro do usuário. */
          if (acao === 'imprimir') {
            App.exportar.imprimir({
              nome: 'boleto-' + boleto.nossoNumero,
              modo: 'rico',
              conteudo: App.services.boletoService.montarImpressao(boleto)
            });
          }
        }
      });
    }

    if (l && l.boletoId) {
      App.services.boletoService.obter(l.boletoId).then(mostrar);
      return;
    }

    App.services.boletoService.emitir(lancamentoId).then(function (b) {
      mostrar(b);
      carregar();
    }).catch(function (erro) {
      App.components.Toast.erro('Não foi possível emitir o boleto', erro.message);
    });
  }

  function abrirNovoLancamento() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var receita = aba !== 'pagar';

    var origens = enums.ORIGENS_LANCAMENTO.filter(function (o) {
      return o.tipo === (receita ? 'receita' : 'despesa');
    });
    var clientes = App.services.db.get('pessoas')
      .filter(function (p) { return p.ehCliente; })
      .map(function (p) { return { id: p.id, label: p.nome }; });

    App.components.Modal.abrir({
      titulo: receita ? 'Novo título a receber' : 'Nova despesa',
      conteudo:
        '<form id="form-lancamento">' +
          ui.Field({ nome: 'descricao', rotulo: 'Descrição', obrigatorio: true }) +
          '<div class="form-grid">' +
            ui.Field({ nome: 'origem', rotulo: 'Origem', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(origens, origens[0].id) }) +
            ui.Field({ nome: 'valor', rotulo: 'Valor', largura: 6, obrigatorio: true,
                       placeholder: 'R$ 0,00' }) +
            ui.Field({ nome: 'dataVencimento', rotulo: 'Vencimento', tipo: 'date', largura: 6,
                       valor: App.domain.prazos.hojeISO() }) +
            ui.Field({ nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(clientes, '', 'Não vincular') }) +
          '</div>' +
          ui.Field({ nome: 'reembolsavel', tipo: 'checkbox',
                     rotulo: 'Despesa reembolsável pelo cliente', valor: false }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Lançar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var dados = App.dom.formToObject(App.dom.qs('#form-lancamento', corpo));

        App.services.lancamentoService.criar({
          descricao: dados.descricao,
          origem: dados.origem,
          valorCentavos: App.moeda.deReais(dados.valor),
          dataVencimento: dados.dataVencimento,
          clienteId: dados.clienteId || null,
          reembolsavel: dados.reembolsavel
        }).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Lançamento criado');
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível lançar', erro.message);
        });
      }
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="trocar-aba"]', function (evento, alvo) {
      aba = alvo.getAttribute('data-value');
      filtros = { tipo: 'receita', status: '', busca: '' };
      carregar();
    });

    App.dom.delegate(container, 'click', '[data-action="trocar-regime"]',
      function (evento, alvo) {
        regime = alvo.getAttribute('data-value');
        carregar();
      });

    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) { filtros[nome] = valor; carregar(); },
      aoLimpar: function () { filtros = { tipo: 'receita', status: '', busca: '' }; carregar(); }
    });

    App.dom.delegate(container, 'click', '[data-action="baixar"]', function (evento, alvo) {
      abrirBaixa(alvo.getAttribute('data-value'));
    });

    App.dom.delegate(container, 'click', '[data-action="estornar"]', function (evento, alvo) {
      App.services.lancamentoService.estornar(alvo.getAttribute('data-value')).then(function () {
        App.components.Toast.sucesso('Baixa estornada');
        carregar();
      });
    });

    App.dom.delegate(container, 'click', '[data-action="boleto"]', function (evento, alvo) {
      abrirBoleto(alvo.getAttribute('data-value'));
    });

    App.dom.delegate(container, 'click', '[data-action="novo-lancamento"]', abrirNovoLancamento);

    App.dom.delegate(container, 'click', '[data-action="pagar-repasse"]', function (evento, alvo) {
      App.services.repasseService.pagar(alvo.getAttribute('data-value')).then(function () {
        App.components.Toast.sucesso('Repasse pago');
        carregar();
      });
    });
  }

  App.pages.FinanceiroPage = { render: render, destroy: destroy };
})(window.App = window.App || {});
