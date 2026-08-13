/* ==========================================================================
   pages/ContratoFormPage.js — contrato de honorários

   O formulário muda conforme a modalidade: contrato de êxito não tem
   parcela, contrato por hora não tem valor fechado. Mostrar todos os campos
   sempre convidaria a preencher o que não se aplica.

   A PRÉVIA DAS PARCELAS é o ponto da tela. Ela usa a mesma função pura que o
   service vai usar ao salvar, então o que se vê é exatamente o que será
   gravado — não uma estimativa parecida.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var dados = null;
  var clientes = [];
  var processos = [];
  var salvando = false;

  function esc(v) { return App.dom.esc(v); }

  function padrao() {
    return {
      clienteId: '', processoId: '', modalidade: 'fixo', descricao: '',
      valorFixo: '', percentualExito: '', valorHora: '', valorMensal: '',
      numParcelas: 1, diaVencimento: 10,
      dataInicio: App.domain.prazos.hojeISO()
    };
  }

  function render(elemento, params, query) {
    container = elemento;
    salvando = false;
    dados = Object.assign(padrao(), query || {});

    clientes = App.services.db.get('pessoas')
      .filter(function (p) { return p.ehCliente; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    processos = App.services.db.get('processos');

    if (query && query.processoId) {
      var proc = App.services.db.find('processos', query.processoId);
      if (proc) dados.clienteId = proc.clienteId;
    }
    if (!dados.clienteId && clientes.length) dados.clienteId = clientes[0].id;

    ligarEventos();
    desenhar();
  }

  /** Contrato no formato que `domain/financeiro` espera. */
  function paraContrato() {
    return {
      valorFixoCentavos: App.moeda.deReais(dados.valorFixo),
      numParcelas: Math.max(1, parseInt(dados.numParcelas, 10) || 1),
      diaVencimento: parseInt(dados.diaVencimento, 10) || null,
      dataInicio: dados.dataInicio
    };
  }

  function previaParcelas() {
    var ui = App.components.ui;
    var semParcelas = dados.modalidade === 'exito' || dados.modalidade === 'hora';

    if (semParcelas) {
      return ui.Card({
        titulo: 'Parcelas',
        conteudo: '<p class="u-sm u-muted">' +
          (dados.modalidade === 'exito'
            ? 'Contrato de êxito não gera parcela prevista: o honorário depende do ' +
              'desfecho, e lançar previsão de dinheiro que talvez nunca entre poluiria ' +
              'o fluxo de caixa. O lançamento é feito quando o proveito econômico existir.'
            : 'Contrato por hora não gera parcela prevista: o valor sai do timesheet, ' +
              'e as horas são faturadas em bloco pelo período.') +
          '</p>'
      });
    }

    var parcelas = App.domain.financeiro.gerarParcelas(paraContrato());
    if (!parcelas.length) {
      return ui.Card({
        titulo: 'Parcelas',
        conteudo: '<p class="u-sm u-muted">Informe o valor para ver as parcelas.</p>'
      });
    }

    var total = parcelas.reduce(function (s, p) { return s + p.valorCentavos; }, 0);

    var linhas = parcelas.map(function (p) {
      return '<tr>' +
        '<td class="u-sm">' + p.numero + '/' + p.de + '</td>' +
        '<td class="u-sm">' + esc(App.format.data(p.dataVencimento)) + '</td>' +
        '<td class="u-right u-tabular">' + esc(App.format.moeda(p.valorCentavos)) + '</td>' +
      '</tr>';
    }).join('');

    return ui.Card({
      titulo: 'Parcelas que serão criadas',
      subtitulo: parcelas.length + ' parcela(s)',
      conteudo:
        '<div class="table-wrap"><table class="table table--compact"><thead><tr>' +
          '<th>Parcela</th><th>Vencimento</th><th class="u-right">Valor</th>' +
        '</tr></thead><tbody>' + linhas + '</tbody>' +
        '<tfoot><tr><th colspan="2">Total</th>' +
          '<th class="u-right u-tabular">' + esc(App.format.moeda(total)) + '</th>' +
        '</tr></tfoot></table></div>' +
        '<p class="u-xs u-subtle" style="margin-top:var(--space-2)">' +
          'Todo vencimento cai em dia útil, e a soma das parcelas é exatamente o valor ' +
          'do contrato — o resto dos centavos vai para as primeiras.' +
        '</p>',
      semPadding: false
    });
  }

  function campos() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    var opcoesClientes = clientes.map(function (c) { return { id: c.id, label: c.nome }; });
    var opcoesProcessos = processos
      .filter(function (p) { return !dados.clienteId || p.clienteId === dados.clienteId; })
      .map(function (p) { return { id: p.id, label: p.numeroInterno + ' — ' + p.assunto }; });

    var m = dados.modalidade;
    var temFixo = m === 'fixo' || m === 'misto';
    var temExito = m === 'exito' || m === 'misto';
    var temHora = m === 'hora';
    var temMensal = m === 'mensal';

    return '<form id="form-contrato">' +
      '<div class="form-grid">' +
        ui.Field({ nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', largura: 6,
                   obrigatorio: true, opcoes: enums.opcoes(opcoesClientes, dados.clienteId) }) +
        ui.Field({ nome: 'processoId', rotulo: 'Processo', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(opcoesProcessos, dados.processoId,
                                        'Contrato guarda-chuva (sem processo)') }) +
        ui.Field({ nome: 'descricao', rotulo: 'Descrição', largura: 12,
                   valor: dados.descricao, placeholder: 'Ex.: honorários da ação trabalhista' }) +
        ui.Field({ nome: 'modalidade', rotulo: 'Modalidade', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.MODALIDADES_HONORARIO, m),
                   dica: (enums.achar(enums.MODALIDADES_HONORARIO, m) || {}).descricao }) +
        ui.Field({ nome: 'dataInicio', rotulo: 'Início', tipo: 'date', largura: 6,
                   valor: dados.dataInicio }) +

        (temFixo
          ? ui.Field({ nome: 'valorFixo', rotulo: 'Valor fixo', largura: 4,
                       valor: dados.valorFixo, placeholder: 'R$ 0,00' }) : '') +
        (temFixo
          ? ui.Field({ nome: 'numParcelas', rotulo: 'Parcelas', tipo: 'number', largura: 4,
                       valor: dados.numParcelas }) : '') +
        (temFixo
          ? ui.Field({ nome: 'diaVencimento', rotulo: 'Dia do vencimento', tipo: 'number',
                       largura: 4, valor: dados.diaVencimento }) : '') +

        (temExito
          ? ui.Field({ nome: 'percentualExito', rotulo: 'Percentual de êxito (%)',
                       tipo: 'number', largura: 6, valor: dados.percentualExito,
                       dica: 'Incide sobre o proveito econômico, não sobre o valor da causa.' })
          : '') +
        (temHora
          ? ui.Field({ nome: 'valorHora', rotulo: 'Valor da hora', largura: 6,
                       valor: dados.valorHora, placeholder: 'R$ 0,00' }) : '') +
        (temMensal
          ? ui.Field({ nome: 'valorMensal', rotulo: 'Valor mensal', largura: 6,
                       valor: dados.valorMensal, placeholder: 'R$ 0,00' }) : '') +
      '</div>' +
    '</form>';
  }

  function desenhar() {
    var ui = App.components.ui;

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Novo contrato de honorários</h1>' +
          '<p class="page-header__subtitle">Salvar cria as parcelas previstas no contas a receber</p>' +
        '</div>' +
      '</div>' +
      '<div class="grid grid--main-aside">' +
        ui.Card({ conteudo: campos() }) +
        previaParcelas() +
      '</div>' +
      '<div class="form-actions">' +
        ui.Button({ rotulo: 'Cancelar', href: '#/financeiro' }) +
        ui.Button({ rotulo: salvando ? 'Salvando…' : 'Criar contrato', variante: 'primary',
                    acao: 'salvar', desabilitado: salvando }) +
      '</div>';
  }

  function salvar() {
    if (salvando) return;
    if (!dados.clienteId) {
      App.components.Toast.aviso('Escolha o cliente');
      return;
    }

    salvando = true;
    desenhar();

    App.services.contratoService.criar({
      clienteId: dados.clienteId,
      processoId: dados.processoId || null,
      modalidade: dados.modalidade,
      descricao: dados.descricao,
      valorFixoCentavos: App.moeda.deReais(dados.valorFixo),
      percentualExito: Number(dados.percentualExito) || 0,
      valorHoraCentavos: App.moeda.deReais(dados.valorHora),
      valorMensalCentavos: App.moeda.deReais(dados.valorMensal),
      numParcelas: parseInt(dados.numParcelas, 10) || 1,
      diaVencimento: parseInt(dados.diaVencimento, 10) || null,
      dataInicio: dados.dataInicio
    }).then(function (c) {
      App.components.Toast.sucesso('Contrato criado',
        c.parcelasGeradas
          ? c.parcelasGeradas + ' parcela(s) lançada(s) no contas a receber.'
          : 'Sem parcelas previstas nesta modalidade.');
      App.router.ir('#/financeiro');
    }).catch(function (erro) {
      salvando = false;
      desenhar();
      App.components.Toast.erro('Não foi possível criar', erro.message);
    });
  }

  function ligarEventos() {
    // Redesenha a cada alteração: os campos e a prévia dependem do que foi
    // digitado, e a prévia só serve se acompanhar a digitação.
    App.dom.delegate(container, 'input', '#form-contrato input', function (evento, campo) {
      dados[campo.name] = campo.value;
      if (campo.name === 'valorFixo' || campo.name === 'numParcelas' ||
          campo.name === 'diaVencimento' || campo.name === 'dataInicio') {
        var previa = App.dom.qs('.grid--main-aside > .card:last-child', container);
        if (previa) previa.outerHTML = previaParcelas();
      }
    });

    App.dom.delegate(container, 'change', '#form-contrato select', function (evento, campo) {
      dados[campo.name] = campo.value;
      desenhar();
    });

    App.dom.delegate(container, 'click', '[data-action="salvar"]', salvar);
  }

  App.pages.ContratoFormPage = { render: render };
})(window.App = window.App || {});
