/* ==========================================================================
   pages/AuditoriaPage.js — trilha de auditoria

   Quem fez, o quê, quando e o que exatamente mudou. O diff campo a campo é o
   ponto da tela: "processo alterado" não defende ninguém; "valorCausa: de
   R$ 50.000,00 para R$ 5.000,00, por Fulano, às 14h32" defende.

   Só o perfil `admin` chega aqui — o guard do roteador barra antes.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var resultado = null;
  var filtros = { pagina: 1, porPagina: 30 };
  var expandidos = {};

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });
    ligarEventos();
    carregar(true);
  }

  function carregar(completo) {
    App.services.auditoriaService.listar(filtros).then(function (r) {
      resultado = r;
      if (completo || !atualizarMiolo()) desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar a trilha', texto: erro.message
      });
    });
  }

  function cabecalho() {
    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Trilha de auditoria</h1>' +
               '<p class="page-header__subtitle">' +
                 App.format.numero(resultado.total) + ' ' +
                 App.format.plural(resultado.total, 'evento') + ' registrado(s) · ' +
                 'toda escrita no banco passa por aqui' +
               '</p>' +
             '</div>' +
             '<div class="page-header__actions">' +
               App.components.ui.Button({
                 rotulo: 'Exportar CSV', icone: '↓', acao: 'exportar-auditoria'
               }) +
             '</div>' +
           '</div>';
  }

  function barraFiltros() {
    var enums = App.domain.enums;
    var usuarios = App.services.db.get('usuarios').map(function (u) {
      return { id: u.id, label: u.nome };
    });
    var colecoes = App.services.auditoriaService.colecoesRegistradas().map(function (c) {
      return { id: c, label: c };
    });

    return App.components.FilterBar({
      campos: [
        { tipo: 'busca', nome: 'busca', valor: filtros.busca || '',
          placeholder: 'Buscar por registro, coleção ou usuário…' },
        { tipo: 'select', nome: 'usuarioId', rotulo: 'Usuário',
          opcoes: enums.opcoes(usuarios, filtros.usuarioId, 'Todos os usuários') },
        { tipo: 'select', nome: 'acao', rotulo: 'Ação',
          opcoes: enums.opcoes(enums.ACOES_AUDITORIA, filtros.acao, 'Todas as ações') },
        { tipo: 'select', nome: 'colecao', rotulo: 'Registro',
          opcoes: enums.opcoes(colecoes, filtros.colecao, 'Todos os registros') }
      ],
      totalAtivos: App.selectors.filtrosAtivos(filtros, ['pagina', 'porPagina'])
    });
  }

  function linhaDiff(alteracao) {
    function valor(v) {
      if (v === null || v === undefined || v === '') return '<em class="u-subtle">vazio</em>';
      if (v === true) return 'sim';
      if (v === false) return 'não';
      return esc(v);
    }

    return '<div class="audit__diff-row">' +
             '<span class="audit__diff-field">' + esc(alteracao.campo) + '</span>' +
             '<span class="audit__diff-from">' + valor(alteracao.de) + '</span>' +
             '<span class="audit__diff-arrow" aria-hidden="true">→</span>' +
             '<span class="audit__diff-to">' + valor(alteracao.para) + '</span>' +
           '</div>';
  }

  function evento(log) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var aberto = !!expandidos[log.id];
    var temDiff = (log.alteracoes || []).length > 0;

    return '<li class="audit__item">' +
      '<div class="audit__head">' +
        '<span class="audit__when">' +
          '<strong>' + esc(App.format.dataHora(log.quando)) + '</strong>' +
        '</span>' +
        ui.BadgeEnum(enums.ACOES_AUDITORIA, log.acao) +
        '<span class="audit__who">' +
          (log.usuario ? ui.Avatar({ usuario: log.usuario, tamanho: 'sm' }) : '') +
          esc(log.usuarioNome) +
        '</span>' +
        '<span class="audit__what u-truncate">' +
          (log.colecao ? '<code class="audit__collection">' + esc(log.colecao) + '</code> ' : '') +
          esc(log.resumo || log.entidadeId || '—') +
        '</span>' +
        (temDiff
          ? '<button class="audit__toggle" data-action="alternar-diff" data-value="' + esc(log.id) + '"' +
            ' aria-expanded="' + aberto + '">' +
              (aberto ? 'ocultar' : log.alteracoes.length + ' ' +
                App.format.plural(log.alteracoes.length, 'campo')) +
            '</button>'
          : '<span class="audit__toggle audit__toggle--empty">—</span>') +
      '</div>' +
      (aberto
        ? '<div class="audit__diff">' + log.alteracoes.map(linhaDiff).join('') + '</div>'
        : '') +
      '</li>';
  }

  function miolo() {
    var ui = App.components.ui;

    var lista = resultado.itens.length
      ? '<ul class="audit">' + resultado.itens.map(evento).join('') + '</ul>'
      : ui.EmptyState({
          icone: '🗂',
          titulo: 'Nenhum evento no filtro',
          texto: 'A trilha registra a partir do momento em que a auditoria foi ligada — ' +
                 'os dados do seed não geram eventos.'
        });

    return ui.Card({ conteudo: lista, semPadding: true }) +
      ui.Pagination({
        pagina: resultado.pagina,
        totalPaginas: resultado.totalPaginas,
        total: resultado.total,
        info: resultado.total + ' ' + App.format.plural(resultado.total, 'evento')
      });
  }

  /* Só o miolo muda a cada busca. Cabeçalho e barra de filtros ficam de pé,
     e com eles o campo, o cursor e o foco de quem está digitando — sem isso
     a tela pisca a cada tecla e o `<input>` é destruído debaixo dos dedos. */
  function desenhar() {
    container.innerHTML =
      cabecalho() +
      App.components.SeloSimulado({
        forma: 'linha',
        oque: 'a trilha é gravada no mesmo banco que audita.',
        naFase3: 'tabela de auditoria separada, somente-inserção, fora do alcance da aplicação.'
      }) +
      barraFiltros() +
      '<div data-miolo>' + miolo() + '</div>';
  }

  function atualizarMiolo() {
    return App.components.FilterBar.trocarMiolo(container, miolo(), {
      totalAtivos: App.selectors.filtrosAtivos(filtros, ['pagina', 'porPagina'])
    });
  }

  function exportar() {
    App.services.auditoriaService.listar(
      Object.assign({}, filtros, { pagina: 1, porPagina: 100000 })
    ).then(function (r) {
      App.csv.baixar('trilha-auditoria', r.itens, [
        { campo: 'quando', titulo: 'Quando', formatar: App.format.dataHora },
        { campo: 'usuarioNome', titulo: 'Usuário' },
        { campo: 'acao', titulo: 'Ação',
          formatar: function (v) {
            return App.domain.enums.rotulo(App.domain.enums.ACOES_AUDITORIA, v);
          } },
        { campo: 'colecao', titulo: 'Registro' },
        { campo: 'entidadeId', titulo: 'ID' },
        { campo: 'resumo', titulo: 'Descrição' },
        { campo: 'alteracoes', titulo: 'Campos alterados',
          formatar: function (lista) {
            return (lista || []).map(function (a) {
              return a.campo + ': ' + a.de + ' → ' + a.para;
            }).join(' | ');
          } }
      ]);

      App.services.auditoriaService.registrar({
        acao: 'exportar',
        colecao: 'logsAuditoria',
        resumo: 'Trilha exportada em CSV (' + r.total + ' eventos)'
      });
      App.components.Toast.sucesso('Trilha exportada', r.total + ' evento(s) em CSV.');
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="alternar-diff"]',
      function (evento, alvo) {
        var id = alvo.getAttribute('data-value');
        expandidos[id] = !expandidos[id];
        desenhar();
      });

    App.dom.delegate(container, 'click', '[data-action="exportar-auditoria"]', exportar);

    App.dom.delegate(container, 'click', '[data-action="pagina"]', function (evento, alvo) {
      filtros.pagina = parseInt(alvo.getAttribute('data-value'), 10);
      carregar();
    });

    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) {
        filtros[nome] = valor;
        filtros.pagina = 1;
        carregar();
      },
      aoLimpar: function () {
        filtros = { pagina: 1, porPagina: 30 };
        carregar();
      }
    });
  }

  App.pages.AuditoriaPage = { render: render };
})(window.App = window.App || {});
