/* ==========================================================================
   pages/DashboardPage.js

   Responde a três perguntas, nesta ordem de prioridade:
     1. O que vence agora?         (prazos críticos e vencidos)
     2. Onde eu preciso estar?     (audiências e perícias)
     3. Como está a carteira?      (distribuição por fase, área e risco)
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var dados = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = renderCarregando();
    // Delegação no container: liga UMA vez por rota. O container é novo a
    // cada navegação, então não há acúmulo nem vazamento entre telas.
    ligarEventos();
    carregar();
  }

  function renderCarregando() {
    var ui = App.components.ui;
    return cabecalho() + ui.SkeletonCards(5) +
      '<div class="grid grid--main-aside" style="margin-top:var(--space-4)">' +
        '<div class="card"><div class="card__body">' + ui.Skeleton({ linhas: 6 }) + '</div></div>' +
        '<div class="card"><div class="card__body">' + ui.Skeleton({ linhas: 4 }) + '</div></div>' +
      '</div>';
  }

  function cabecalho() {
    var agora = new Date();
    var saudacao = agora.getHours() < 12 ? 'Bom dia'
                 : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
    var usuario = App.store.getState().usuarioAtual || {};
    var primeiroNome = String(usuario.nome || '').split(' ')[0];

    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">' + esc(saudacao + (primeiroNome ? ', ' + primeiroNome : '')) + '</h1>' +
               '<p class="page-header__subtitle">' +
                 esc(App.format.diaSemana(App.domain.prazos.hojeISO()) + ', ' +
                     App.format.dataExtenso(App.domain.prazos.hojeISO())) +
               '</p>' +
             '</div>' +
             '<div class="page-header__actions">' +
               App.components.ui.Button({
                 rotulo: 'Novo processo', variante: 'primary',
                 icone: '+', href: '#/processos/novo'
               }) +
             '</div>' +
           '</div>';
  }

  function carregar() {
    Promise.all([
      App.services.processoService.estatisticas(),
      App.services.prazoService.resumo(),
      App.services.agendaService.proximos(6),
      App.services.tarefaService.resumo()
    ]).then(function (resultados) {
      dados = {
        processos: resultados[0],
        prazos: resultados[1],
        compromissos: resultados[2],
        tarefas: resultados[3]
      };
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = cabecalho() + App.components.ui.EmptyState({
        icone: '⚠',
        titulo: 'Não foi possível carregar o painel',
        texto: erro.message
      });
    });
  }

  function desenhar() {
    var ui = App.components.ui;
    var fmt = App.format;
    var enums = App.domain.enums;

    var criticos = dados.prazos.contagem.critico + dados.prazos.contagem.vencido;

    // --- KPIs ---
    var kpis = '<div class="grid grid--kpi">' +
      ui.Kpi({
        rotulo: 'Processos ativos', icone: '⚖',
        valor: dados.processos.ativos,
        dica: dados.processos.suspensos + ' suspensos · ' + dados.processos.arquivados + ' arquivados',
        cor: 'var(--color-primary-500)',
        href: '#/processos'
      }) +
      ui.Kpi({
        rotulo: 'Prazos críticos', icone: '⏱',
        valor: criticos,
        dica: dados.prazos.vencendoHoje + ' vencendo hoje · ' +
              dados.prazos.contagem.vencido + ' vencidos',
        cor: criticos ? 'var(--color-prazo-critico)' : 'var(--color-prazo-ok)',
        href: '#/agenda'
      }) +
      ui.Kpi({
        rotulo: 'Prazos em aberto', icone: '▤',
        valor: dados.prazos.totalAbertos,
        dica: dados.prazos.contagem.atencao + ' exigindo atenção',
        cor: 'var(--color-prazo-atencao)',
        href: '#/agenda'
      }) +
      ui.Kpi({
        rotulo: 'Tarefas atrasadas', icone: '☑',
        valor: dados.tarefas.atrasadas,
        dica: dados.tarefas.abertas + ' tarefas abertas',
        cor: dados.tarefas.atrasadas ? 'var(--color-prazo-critico)' : 'var(--color-prazo-ok)',
        href: '#/tarefas'
      }) +
      ui.Kpi({
        rotulo: 'Provisão de risco', icone: '⚠',
        valor: fmt.moedaCompacta(dados.processos.provisaoTotal),
        dica: 'de ' + fmt.moedaCompacta(dados.processos.valorTotal) + ' em causa',
        cor: 'var(--color-accent-500)'
      }) +
    '</div>';

    // --- Prazos críticos ---
    var listaCriticos = dados.prazos.criticos.slice(0, 8);
    var cardPrazos = ui.Card({
      titulo: 'Prazos que exigem ação',
      subtitulo: listaCriticos.length ? listaCriticos.length + ' em risco' : '',
      acoes: ui.Button({ rotulo: 'Ver agenda', variante: 'ghost', tamanho: 'sm', href: '#/agenda' }),
      semPadding: true,
      classe: 'dash-prazos',
      conteudo: '<div class="dash-list">' +
        App.components.PrazoList({
          prazos: listaCriticos,
          acoes: true,
          icone: '✓',
          tituloVazio: 'Nenhum prazo em risco',
          textoVazio: 'Todos os prazos em aberto estão com folga confortável.'
        }) +
      '</div>'
    });

    // --- Compromissos ---
    var htmlCompromissos = dados.compromissos.length
      ? dados.compromissos.map(function (cp) {
          var tipo = enums.achar(enums.TIPOS_COMPROMISSO, cp.tipo);
          var dataCp = String(cp.dataHora).slice(0, 10);
          var d = App.domain.prazos.paraDate(dataCp);

          return '<a class="compromisso-item" href="' +
                   (cp.processo ? '#/processos/' + cp.processo.id : '#/agenda') + '">' +
                   '<div class="compromisso-item__date">' +
                     '<div class="compromisso-item__day">' + d.getDate() + '</div>' +
                     '<div class="compromisso-item__month">' + fmt.MESES_ABREV[d.getMonth()] + '</div>' +
                   '</div>' +
                   '<div style="flex:1;min-width:0">' +
                     '<div class="u-sm u-bold u-truncate">' + esc(cp.titulo) + '</div>' +
                     '<div class="u-xs u-muted u-truncate">' +
                       esc(fmt.hora(cp.dataHora) + ' · ' + cp.local) +
                     '</div>' +
                   '</div>' +
                   (tipo ? ui.Badge({ rotulo: tipo.label, cor: tipo.cor }) : '') +
                 '</a>';
        }).join('')
      : ui.EmptyState({
          icone: '📅', titulo: 'Agenda livre',
          texto: 'Nenhum compromisso agendado para os próximos dias.'
        });

    var cardCompromissos = ui.Card({
      titulo: 'Próximos compromissos',
      acoes: ui.Button({ rotulo: 'Agenda', variante: 'ghost', tamanho: 'sm', href: '#/agenda' }),
      semPadding: true,
      conteudo: '<div class="dash-list">' + htmlCompromissos + '</div>'
    });

    // --- Distribuição por fase ---
    var maiorFase = Math.max.apply(null, enums.FASES.map(function (fase) {
      return dados.processos.porFase[fase.id] || 0;
    }).concat([1]));

    var htmlFases = enums.FASES.map(function (fase) {
      var valor = dados.processos.porFase[fase.id] || 0;
      return '<a class="fase-row" href="#/processos?faseId=' + fase.id + '"' +
               ' title="' + esc(fase.descricao) + '" style="color:inherit;text-decoration:none">' +
               '<span class="fase-row__label">' + esc(fase.label) + '</span>' +
               '<span class="fase-row__bar">' +
                 ui.Progress({ percentual: (valor / maiorFase) * 100, cor: fase.cor }) +
               '</span>' +
               '<span class="fase-row__value">' + valor + '</span>' +
             '</a>';
    }).join('');

    var cardFases = ui.Card({
      titulo: 'Processos por fase',
      subtitulo: 'somente ativos',
      // F2.9: o dashboard mostra o retrato; o relatório mostra o recorte.
      acoes: ui.Button({ rotulo: 'Relatório completo', variante: 'ghost', tamanho: 'sm',
                         href: '#/relatorios/carteira' }),
      conteudo: htmlFases
    });

    // --- Área e risco ---
    var distArea = App.selectors.distribuicao(dados.processos.porArea, enums.AREAS);
    var distRisco = App.selectors.distribuicao(dados.processos.porRisco, [
      { id: 'provavel', label: 'Provável', cor: 'var(--color-prazo-critico)' },
      { id: 'possivel', label: 'Possível', cor: 'var(--color-prazo-atencao)' },
      { id: 'remoto',   label: 'Remoto',   cor: 'var(--color-prazo-ok)' }
    ]);

    var cardArea = ui.Card({
      titulo: 'Composição da carteira',
      acoes: App.services.sessaoService.pode('relatorios.todos')
        ? ui.Button({ rotulo: 'Contingência', variante: 'ghost', tamanho: 'sm',
                      href: '#/relatorios/contingencia' })
        : '',
      conteudo:
        '<div class="u-sm u-muted" style="margin-bottom:var(--space-2)">Por área do direito</div>' +
        ui.StackedBar({ segmentos: distArea }) +
        '<div class="divider"></div>' +
        '<div class="u-sm u-muted" style="margin-bottom:var(--space-2)">Por classificação de risco</div>' +
        ui.StackedBar({ segmentos: distRisco }) +
        '<p class="u-xs u-subtle" style="margin-top:var(--space-3)">' +
          'Provisão contábil de ' + esc(fmt.moeda(dados.processos.provisaoTotal)) +
          ' sobre ' + esc(fmt.moeda(dados.processos.valorTotal)) + ' em valor de causa.' +
        '</p>'
    });

    container.innerHTML =
      cabecalho() +
      kpis +
      '<div class="grid grid--main-aside dashboard__section">' +
        cardPrazos +
        cardCompromissos +
      '</div>' +
      '<div class="grid grid--2col dashboard__section">' +
        cardFases +
        cardArea +
      '</div>';
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="cumprir-prazo"]', function (evento, botao) {
      evento.preventDefault();
      var id = botao.dataset.value;

      App.services.prazoService.cumprir(id).then(function (prazo) {
        App.components.Toast.sucesso('Prazo baixado', prazo.titulo + ' marcado como cumprido.');
        App.layout.AppShell.atualizarBadges();
        carregar();
      }).catch(function (erro) {
        App.components.Toast.erro('Não foi possível baixar o prazo', erro.message);
      });
    });
  }

  App.pages.DashboardPage = { render: render };
})(window.App = window.App || {});
