/* ==========================================================================
   pages/AgendaPage.js — calendário forense + lista de prazos e compromissos
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var mesAtual = null;
  var eventos = null;
  var usuarios = [];

  function esc(v) { return App.dom.esc(v); }
  function filtros() { return App.store.getState().agendaFiltros; }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });

    App.services.db.init();
    usuarios = App.services.db.get('usuarios').filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    if (!mesAtual) mesAtual = primeiroDiaDoMes(App.domain.prazos.hojeISO());
    ligarEventos();   // delegação no container: uma vez por rota
    carregar();
  }

  function primeiroDiaDoMes(iso) {
    return iso.slice(0, 8) + '01';
  }

  function limitesDoMes() {
    var prazos = App.domain.prazos;
    var referencia = prazos.paraDate(mesAtual);

    // A grade do calendário mostra dias vizinhos ao mês — o intervalo
    // precisa cobri-los, senão eventos das bordas somem.
    var inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
    inicio = prazos.addDias(inicio, -inicio.getDay() - 1);
    var fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
    fim = prazos.addDias(fim, 14);

    return { de: prazos.paraISO(inicio), ate: prazos.paraISO(fim) };
  }

  function carregar() {
    var limites = limitesDoMes();

    App.services.agendaService.porDia(limites.de, limites.ate, filtros())
      .then(function (resultado) {
        eventos = resultado;
        desenhar();
      })
      .catch(function (erro) {
        container.innerHTML = App.components.ui.EmptyState({
          icone: '⚠', titulo: 'Erro ao carregar a agenda', texto: erro.message
        });
      });
  }

  function cabecalho() {
    var totalPrazos = eventos.itens.filter(function (e) { return e.categoria === 'prazo'; }).length;
    var totalCompromissos = eventos.total - totalPrazos;

    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Agenda</h1>' +
               '<p class="page-header__subtitle">' +
                 totalPrazos + ' ' + App.format.plural(totalPrazos, 'prazo') + ' e ' +
                 totalCompromissos + ' ' + App.format.plural(totalCompromissos, 'compromisso') +
                 ' no período exibido' +
               '</p>' +
             '</div>' +
             '<div class="page-header__actions">' +
               App.components.ui.Button({
                 rotulo: 'Simulador de prazo', variante: 'secondary',
                 icone: '🗓', href: '#/simulador'
               }) +
             '</div>' +
           '</div>';
  }

  function barraFiltros() {
    var enums = App.domain.enums;
    var f = filtros();

    return App.components.FilterBar({
      campos: [
        { tipo: 'select', nome: 'responsavelId', rotulo: 'Responsável',
          opcoes: enums.opcoes(
            usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
            f.responsavelId, 'Todos os responsáveis') },
        { tipo: 'select', nome: 'tipo', rotulo: 'Tipo de evento',
          opcoes: enums.opcoes([
            { id: 'prazo', label: 'Somente prazos' },
            { id: 'compromisso', label: 'Somente compromissos' }
          ], f.tipo, 'Prazos e compromissos') },
        { tipo: 'toggle', nome: 'apenasAbertos', rotulo: 'Somente prazos em aberto',
          valor: f.apenasAbertos }
      ],
      totalAtivos: App.selectors.filtrosAtivos(f, ['apenasAbertos'])
    });
  }

  /** Lista lateral: o que exige ação nos próximos dias. */
  function painelLateral() {
    var ui = App.components.ui;
    var hoje = App.domain.prazos.hojeISO();

    var prazosAbertos = eventos.itens.filter(function (ev) {
      return ev.categoria === 'prazo' &&
             (ev.status === 'pendente' || ev.status === 'em_andamento');
    });

    var vencidos = prazosAbertos.filter(function (ev) { return ev.data < hoje; });
    var proximos = prazosAbertos.filter(function (ev) { return ev.data >= hoje; }).slice(0, 12);

    function paraPrazoCard(ev) {
      return App.services.prazoService.enriquecer(ev.registro);
    }

    var html = '';

    if (vencidos.length) {
      html += ui.Card({
        titulo: 'Vencidos sem baixa',
        subtitulo: vencidos.length + ' item(ns)',
        semPadding: true,
        classe: 'agenda-vencidos',
        conteudo: App.components.PrazoList({
          prazos: vencidos.map(paraPrazoCard),
          acoes: true
        })
      });
    }

    html += '<div style="margin-top:' + (vencidos.length ? 'var(--space-4)' : '0') + '">' +
      ui.Card({
        titulo: 'Próximos prazos',
        semPadding: true,
        conteudo: App.components.PrazoList({
          prazos: proximos.map(paraPrazoCard),
          acoes: true,
          icone: '✓',
          tituloVazio: 'Nenhum prazo à frente',
          textoVazio: 'Não há prazos em aberto no período exibido.'
        })
      }) + '</div>';

    return html;
  }

  function desenhar() {
    container.innerHTML =
      cabecalho() +
      barraFiltros() +
      '<div class="agenda-layout">' +
        '<div class="card">' +
          App.components.Calendar({ mes: mesAtual, eventosPorDia: eventos.mapa }) +
        '</div>' +
        '<div>' + painelLateral() + '</div>' +
      '</div>';
  }

  function mudarMes(delta) {
    var prazos = App.domain.prazos;
    var referencia = prazos.paraDate(mesAtual);
    mesAtual = prazos.paraISO(new Date(referencia.getFullYear(), referencia.getMonth() + delta, 1));
    carregar();
  }

  function ligarEventos() {
    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) {
        var alteracoes = {};
        alteracoes[nome] = valor;
        App.store.setState({ agendaFiltros: Object.assign({}, filtros(), alteracoes) });
        carregar();
      },
      aoLimpar: function () {
        App.store.setState({
          agendaFiltros: { responsavelId: '', tipo: '', apenasAbertos: true }
        });
        carregar();
      }
    });

    App.dom.delegate(container, 'click', '[data-action="mes-anterior"]', function () { mudarMes(-1); });
    App.dom.delegate(container, 'click', '[data-action="mes-proximo"]', function () { mudarMes(1); });
    App.dom.delegate(container, 'click', '[data-action="mes-hoje"]', function () {
      mesAtual = primeiroDiaDoMes(App.domain.prazos.hojeISO());
      carregar();
    });

    App.dom.delegate(container, 'click', '[data-action="cumprir-prazo"]', function (evento, botao) {
      App.services.prazoService.cumprir(botao.dataset.value).then(function (prazo) {
        App.components.Toast.sucesso('Prazo baixado', prazo.titulo);
        App.layout.AppShell.atualizarBadges();
        carregar();
      }).catch(function (erro) {
        App.components.Toast.erro('Não foi possível baixar o prazo', erro.message);
      });
    });
  }

  App.pages.AgendaPage = { render: render };
})(window.App = window.App || {});
