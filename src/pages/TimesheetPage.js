/* ==========================================================================
   pages/TimesheetPage.js — apontamento de horas

   Cronômetro em cima, apontamentos embaixo. O cronômetro existe porque
   ninguém preenche timesheet no fim do dia com honestidade: ou se marca na
   hora, ou se inventa depois.

   Hora não faturável também é apontada — é ela que explica por que um
   contrato de valor fixo deu prejuízo.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var resultado = null;
  var porUsuario = [];
  var filtros = {};
  var cronometro = null;      // { processoId, inicio, descricao }
  var intervalo = null;

  function esc(v) { return App.dom.esc(v); }
  function duracao(min) { return App.services.timesheetService.formatarDuracao(min); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    filtros = {
      de: App.domain.financeiro.somarMeses(App.domain.prazos.hojeISO(), -1),
      ate: App.domain.prazos.hojeISO()
    };
    ligarEventos();
    carregar();
  }

  function destroy() {
    if (intervalo) { clearInterval(intervalo); intervalo = null; }
  }

  function carregar() {
    Promise.all([
      App.services.timesheetService.listar(filtros),
      App.services.timesheetService.porUsuario(filtros.de, filtros.ate)
    ]).then(function (r) {
      resultado = r[0];
      porUsuario = r[1];
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar o timesheet', texto: erro.message
      });
    });
  }

  function minutosDecorridos() {
    if (!cronometro) return 0;
    return Math.max(0, Math.round((Date.now() - cronometro.inicio) / 60000));
  }

  function cardCronometro() {
    var ui = App.components.ui;
    var processos = App.services.db.get('processos')
      .filter(function (p) { return p.status === 'ativo'; })
      .map(function (p) { return { id: p.id, label: p.numeroInterno + ' — ' + p.assunto }; });

    if (cronometro) {
      var proc = App.services.db.find('processos', cronometro.processoId);
      return ui.Card({
        classe: 'crono crono--ativo',
        conteudo:
          '<div class="crono__linha">' +
            '<div>' +
              '<div class="crono__tempo">' + esc(duracao(minutosDecorridos())) + '</div>' +
              '<div class="u-sm u-muted">' +
                esc(proc ? proc.numeroInterno + ' — ' + proc.assunto : '') + '</div>' +
              (cronometro.descricao
                ? '<div class="u-xs u-subtle">' + esc(cronometro.descricao) + '</div>' : '') +
            '</div>' +
            '<div class="u-row" style="gap:var(--space-2)">' +
              ui.Button({ rotulo: 'Descartar', variante: 'ghost', acao: 'descartar-crono' }) +
              ui.Button({ rotulo: 'Parar e apontar', variante: 'primary', acao: 'parar-crono' }) +
            '</div>' +
          '</div>'
      });
    }

    return ui.Card({
      classe: 'crono',
      conteudo:
        '<form id="form-crono" class="crono__form">' +
          '<div class="form-grid">' +
            ui.Field({ nome: 'processoId', rotulo: 'Processo', tipo: 'select', largura: 6,
                       opcoes: App.domain.enums.opcoes(processos, '', 'Selecione…') }) +
            ui.Field({ nome: 'descricao', rotulo: 'O que está fazendo', largura: 6,
                       placeholder: 'Elaboração de peça, audiência…' }) +
          '</div>' +
        '</form>' +
        '<div class="u-row" style="gap:var(--space-2);justify-content:flex-end">' +
          ui.Button({ rotulo: 'Apontar manualmente', acao: 'apontar-manual' }) +
          ui.Button({ rotulo: 'Iniciar cronômetro', variante: 'primary', icone: '⏱',
                      acao: 'iniciar-crono' }) +
        '</div>'
    });
  }

  function linha(a) {
    var ui = App.components.ui;

    return '<tr>' +
      '<td class="u-sm">' + esc(App.format.data(a.data)) + '</td>' +
      '<td>' +
        '<div class="u-sm">' + esc(a.descricao || '—') + '</div>' +
        '<div class="u-xs u-subtle">' + esc(a.processoNumero) + '</div>' +
      '</td>' +
      '<td class="u-sm">' + esc(a.usuarioNome) + '</td>' +
      '<td class="u-right u-tabular u-bold">' + esc(duracao(a.minutos)) + '</td>' +
      '<td>' +
        (a.faturavel
          ? ui.Badge({ rotulo: a.faturado ? 'Faturado' : 'Faturável',
                       variante: a.faturado ? 'success' : 'primary' })
          : ui.Badge({ rotulo: 'Não faturável', variante: 'neutral' })) +
      '</td>' +
      '<td class="u-right u-tabular">' +
        (a.faturavel ? esc(App.format.moeda(a.valorCentavos)) : '—') +
      '</td>' +
      '<td class="u-right">' +
        (a.faturado ? '' : ui.Button({ rotulo: 'Excluir', tamanho: 'sm', variante: 'ghost',
                                       acao: 'excluir-apontamento', valor: a.id })) +
      '</td>' +
    '</tr>';
  }

  function cardEquipe() {
    if (!porUsuario.length) return '';

    return App.components.ui.Card({
      titulo: 'Horas por pessoa no período',
      conteudo: App.components.Chart.Barras({
        categorias: porUsuario.map(function (u) { return u.usuarioNome; }),
        series: [{ id: 'h', label: 'Horas',
                   valores: porUsuario.map(function (u) {
                     return Math.round(u.minutos / 60 * 10) / 10;
                   }) }],
        orientacao: 'barra',
        formatarValor: function (v) { return v + 'h'; },
        altura: Math.max(160, porUsuario.length * 34 + 40)
      })
    });
  }

  function desenhar() {
    var ui = App.components.ui;

    var tabela = resultado.itens.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Data</th><th>Atividade</th><th>Quem</th><th class="u-right">Tempo</th>' +
          '<th>Situação</th><th class="u-right">Valor</th><th></th>' +
        '</tr></thead><tbody>' + resultado.itens.map(linha).join('') + '</tbody></table></div>'
      : ui.EmptyState({
          icone: '⏱', titulo: 'Nenhuma hora apontada no período',
          texto: 'Use o cronômetro acima ou aponte manualmente.'
        });

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Timesheet</h1>' +
          '<p class="page-header__subtitle">' +
            duracao(resultado.minutos) + ' no período · ' +
            duracao(resultado.minutosFaturaveis) + ' faturáveis · ' +
            App.format.moeda(resultado.valorCentavos) +
          '</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          ui.Button({ rotulo: 'Financeiro', href: '#/financeiro' }) +
        '</div>' +
      '</div>' +

      cardCronometro() +

      '<div class="filter-bar page-section">' +
        '<label class="daterange__field"><span>De</span>' +
          '<input class="input input--sm" type="date" data-filtro="de" value="' +
            esc(filtros.de) + '"></label>' +
        '<label class="daterange__field"><span>Até</span>' +
          '<input class="input input--sm" type="date" data-filtro="ate" value="' +
            esc(filtros.ate) + '"></label>' +
      '</div>' +

      '<div class="grid grid--main-aside">' +
        ui.Card({ titulo: 'Apontamentos', conteudo: tabela, semPadding: true }) +
        cardEquipe() +
      '</div>';
  }

  // --- Ações --------------------------------------------------------------------

  function abrirApontamento(minutosSugeridos, processoId, descricao) {
    var ui = App.components.ui;
    var processos = App.services.db.get('processos')
      .filter(function (p) { return p.status === 'ativo'; })
      .map(function (p) { return { id: p.id, label: p.numeroInterno + ' — ' + p.assunto }; });

    App.components.Modal.abrir({
      titulo: 'Apontar horas',
      conteudo:
        '<form id="form-apontamento">' +
          ui.Field({ nome: 'processoId', rotulo: 'Processo', tipo: 'select', obrigatorio: true,
                     opcoes: App.domain.enums.opcoes(processos, processoId || '') }) +
          ui.Field({ nome: 'descricao', rotulo: 'Atividade', valor: descricao || '' }) +
          '<div class="form-grid">' +
            ui.Field({ nome: 'minutos', rotulo: 'Minutos', tipo: 'number', largura: 6,
                       valor: minutosSugeridos || 60 }) +
            ui.Field({ nome: 'data', rotulo: 'Data', tipo: 'date', largura: 6,
                       valor: App.domain.prazos.hojeISO() }) +
          '</div>' +
          ui.Field({ nome: 'faturavel', tipo: 'checkbox', rotulo: 'Faturável ao cliente',
                     valor: true,
                     dica: 'Hora não faturável continua sendo apontada — é ela que explica ' +
                           'por que um contrato de valor fixo deu prejuízo.' }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Apontar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-apontamento', corpo));

        App.services.timesheetService.criar({
          processoId: d.processoId,
          descricao: d.descricao,
          minutos: parseInt(d.minutos, 10),
          data: d.data,
          faturavel: d.faturavel
        }).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Horas apontadas');
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível apontar', erro.message);
        });
      }
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="iniciar-crono"]', function () {
      var form = App.dom.qs('#form-crono', container);
      var d = App.dom.formToObject(form);
      if (!d.processoId) {
        App.components.Toast.aviso('Escolha o processo antes de iniciar');
        return;
      }

      cronometro = { processoId: d.processoId, descricao: d.descricao, inicio: Date.now() };
      desenhar();

      // Redesenha a cada 30s: o mostrador é em minutos, e atualizar a cada
      // segundo custaria re-render sem mudar o que está escrito.
      if (intervalo) clearInterval(intervalo);
      intervalo = setInterval(function () {
        if (!cronometro) return;
        var alvo = App.dom.qs('.crono__tempo', container);
        if (alvo) alvo.textContent = duracao(minutosDecorridos());
      }, 30000);
    });

    App.dom.delegate(container, 'click', '[data-action="parar-crono"]', function () {
      var minutos = Math.max(1, minutosDecorridos());
      var processoId = cronometro.processoId;
      var descricao = cronometro.descricao;

      cronometro = null;
      if (intervalo) { clearInterval(intervalo); intervalo = null; }
      desenhar();
      abrirApontamento(minutos, processoId, descricao);
    });

    App.dom.delegate(container, 'click', '[data-action="descartar-crono"]', function () {
      cronometro = null;
      if (intervalo) { clearInterval(intervalo); intervalo = null; }
      desenhar();
    });

    App.dom.delegate(container, 'click', '[data-action="apontar-manual"]', function () {
      abrirApontamento();
    });

    App.dom.delegate(container, 'click', '[data-action="excluir-apontamento"]',
      function (evento, alvo) {
        App.services.timesheetService.remover(alvo.getAttribute('data-value'))
          .then(function () {
            App.components.Toast.sucesso('Apontamento excluído');
            carregar();
          })
          .catch(function (erro) {
            App.components.Toast.erro('Não foi possível excluir', erro.message);
          });
      });

    App.dom.delegate(container, 'change', 'input[data-filtro]', function (evento, campo) {
      filtros[campo.getAttribute('data-filtro')] = campo.value;
      carregar();
    });
  }

  App.pages.TimesheetPage = { render: render, destroy: destroy };
})(window.App = window.App || {});
