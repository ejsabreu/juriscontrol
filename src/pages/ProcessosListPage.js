/* ==========================================================================
   pages/ProcessosListPage.js — lista de processos em TABELA ou KANBAN

   As duas visões compartilham a mesma barra de filtros e o mesmo estado no
   store: trocar de visão nunca perde o filtro aplicado. A diferença é só
   de paginação — a tabela pagina, o kanban carrega a carteira inteira,
   porque um quadro paginado não mostra distribuição nenhuma.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var usuarios = [];
  var resultado = null;
  var carregando = false;

  function esc(v) { return App.dom.esc(v); }
  function filtros() { return App.store.getState().processosFiltros; }
  function visao() { return App.store.getState().processosVisao; }
  function agruparPor() { return App.store.getState().processosAgruparPor; }

  function render(elemento, params, query) {
    container = elemento;

    // Query string permite links diretos vindos do dashboard.
    var alteracoes = {};
    var novosFiltros = null;

    if (query) {
      if (query.visao === 'kanban' || query.visao === 'tabela') {
        alteracoes.processosVisao = query.visao;
      }
      ['faseId', 'areaId', 'responsavelId', 'status', 'risco'].forEach(function (campo) {
        if (query[campo]) {
          novosFiltros = novosFiltros || Object.assign({}, filtros());
          novosFiltros[campo] = query[campo];
          novosFiltros.pagina = 1;
        }
      });
      if (novosFiltros) alteracoes.processosFiltros = novosFiltros;
    }

    if (Object.keys(alteracoes).length) App.store.setState(alteracoes);

    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });

    App.services.db.init();
    usuarios = App.services.db.get('usuarios').filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    // Delegação no container: liga UMA vez por rota. Os handlers de tabela e
    // de kanban convivem — os seletores simplesmente não casam na outra visão.
    ligarEventos();
    carregar();
  }

  function carregar() {
    carregando = true;

    // No kanban não há paginação: o quadro precisa da carteira inteira.
    var consulta = Object.assign({}, filtros());
    if (visao() === 'kanban') delete consulta.porPagina;

    App.services.processoService.listar(consulta).then(function (r) {
      resultado = r;
      carregando = false;
      desenhar();
    }).catch(function (erro) {
      carregando = false;
      container.innerHTML = cabecalho() + App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar processos', texto: erro.message
      });
    });
  }

  function cabecalho() {
    var ui = App.components.ui;
    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Processos</h1>' +
               '<p class="page-header__subtitle">' +
                 (resultado ? resultado.total + ' ' + App.format.plural(resultado.total, 'processo') +
                              ' · acompanhamento da carteira' : 'Carregando…') +
               '</p>' +
             '</div>' +
             '<div class="page-header__actions">' +
               ui.ViewToggle({
                 ativa: visao(),
                 acao: 'trocar-visao',
                 opcoes: [
                   { id: 'tabela', label: 'Tabela', icone: '▤', titulo: 'Visão em tabela — comparar e ordenar' },
                   { id: 'kanban', label: 'Kanban', icone: '▩', titulo: 'Visão em quadro — acompanhar o andamento' }
                 ]
               }) +
               ui.Button({ rotulo: 'Novo processo', variante: 'primary', icone: '+', href: '#/processos/novo' }) +
             '</div>' +
           '</div>';
  }

  function barraFiltros() {
    var enums = App.domain.enums;
    var f = filtros();
    var ui = App.components.ui;

    var campos = [
      { tipo: 'busca', nome: 'busca', valor: f.busca,
        placeholder: 'Buscar por número, cliente, assunto…', rotulo: 'Buscar processos' },
      { tipo: 'select', nome: 'faseId', rotulo: 'Fase',
        opcoes: enums.opcoes(enums.FASES, f.faseId, 'Todas as fases') },
      { tipo: 'select', nome: 'areaId', rotulo: 'Área',
        opcoes: enums.opcoes(enums.AREAS, f.areaId, 'Todas as áreas') },
      { tipo: 'select', nome: 'responsavelId', rotulo: 'Responsável',
        opcoes: enums.opcoes(
          usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
          f.responsavelId, 'Todos os responsáveis') },
      { tipo: 'select', nome: 'status', rotulo: 'Situação',
        opcoes: enums.opcoes(enums.STATUS_PROCESSO, f.status, 'Todas as situações') },
      { tipo: 'select', nome: 'risco', rotulo: 'Risco',
        opcoes: enums.opcoes(enums.RISCOS, f.risco, 'Todos os riscos') }
    ];

    // O agrupamento só faz sentido no kanban — é ele que define as colunas.
    var direita = '';
    if (visao() === 'kanban') {
      direita = '<span class="filter-bar__divider"></span>' +
                '<label class="u-xs u-subtle u-nowrap" for="agrupar-por">Agrupar por</label>' +
                '<select class="select" id="agrupar-por" data-action="agrupar-por" aria-label="Agrupar colunas por">' +
                  enums.opcoes([
                    { id: 'faseId', label: 'Fase processual' },
                    { id: 'responsavelId', label: 'Responsável' },
                    { id: 'areaId', label: 'Área do direito' }
                  ], agruparPor()) +
                '</select>';
    }

    return App.components.FilterBar({
      campos: campos,
      totalAtivos: App.selectors.filtrosAtivos(f),
      direita: direita
    });
  }

  // --- Visão tabela ---------------------------------------------------------

  function colunasTabela() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;

    return [
      {
        chave: 'numeroInterno', titulo: 'Processo', largura: '20%',
        render: function (p) {
          return '<div class="table__cell-strong">' + esc(p.numeroInterno) +
                   (p.segredoJustica ? ' <span title="Segredo de justiça">🔒</span>' : '') + '</div>' +
                 '<div class="u-xs u-subtle u-mono">' + esc(p.numeroCnj) + '</div>';
        }
      },
      {
        chave: 'clienteNome', titulo: 'Cliente',
        render: function (p) {
          var papel = enums.achar(enums.PAPEIS_CLIENTE, p.papelCliente);
          return '<div class="u-truncate">' + esc(p.clienteNome) + '</div>' +
                 '<div class="u-xs u-subtle">' + esc(papel ? papel.label : '') + ' · ' +
                   esc(fmt.truncar(p.assunto, 34)) + '</div>';
        }
      },
      {
        chave: 'areaId', titulo: 'Área', ordenavel: false,
        render: function (p) {
          var area = enums.achar(enums.AREAS, p.areaId);
          return ui.Badge({ rotulo: area ? area.label : p.areaId, cor: area ? area.cor : null });
        }
      },
      {
        chave: 'faseId', titulo: 'Fase', ordenavel: false,
        render: function (p) {
          var fase = enums.achar(enums.FASES, p.faseId);
          return ui.Badge({ rotulo: fase ? fase.label : p.faseId, cor: fase ? fase.cor : null, ponto: true });
        }
      },
      {
        chave: 'prazo', titulo: 'Próximo prazo',
        render: function (p) {
          if (!p.prazoProximo) return '<span class="u-xs u-subtle">—</span>';
          return ui.PrazoChip({
            semaforo: p.prazoProximo.semaforo,
            diasRestantes: p.prazoProximo.diasRestantes,
            titulo: p.prazoProximo.titulo
          }) +
          '<div class="u-xs u-subtle">' + esc(fmt.data(p.prazoProximo.dataFatal)) + '</div>';
        }
      },
      {
        chave: 'responsavelNome', titulo: 'Responsável',
        render: function (p) {
          return '<span class="u-row">' + ui.Avatar({ usuario: p.responsavel, tamanho: 'sm' }) +
                 '<span class="u-sm u-truncate">' + esc(String(p.responsavelNome).split(' ')[0]) + '</span></span>';
        }
      },
      {
        chave: 'valorCausa', titulo: 'Valor da causa', alinhamento: 'right',
        render: function (p) {
          return '<span class="u-nowrap">' + esc(fmt.moeda(p.valorCausa)) + '</span>';
        }
      }
    ];
  }

  function conteudoTabela() {
    var f = filtros();
    var ui = App.components.ui;

    var tabela = App.components.DataTable({
      colunas: colunasTabela(),
      itens: resultado.itens,
      ordenarPor: f.ordenarPor,
      direcao: f.direcao,
      hrefDe: function (p) { return '#/processos/' + p.id; },
      vazio: ui.EmptyState({
        icone: '⚖',
        titulo: 'Nenhum processo encontrado',
        texto: 'Nenhum processo corresponde aos filtros aplicados.',
        acao: ui.Button({ rotulo: 'Limpar filtros', variante: 'secondary', acao: 'limpar-filtros' })
      })
    });

    var inicio = (resultado.pagina - 1) * resultado.porPagina + 1;
    var fim = Math.min(resultado.pagina * resultado.porPagina, resultado.total);

    return ui.Card({
      semPadding: true,
      conteudo: tabela,
      rodape: ui.Pagination({
        pagina: resultado.pagina,
        totalPaginas: resultado.totalPaginas,
        total: resultado.total,
        info: resultado.total
          ? 'Exibindo ' + inicio + '–' + fim + ' de ' + resultado.total
          : 'Nenhum registro'
      })
    });
  }

  // --- Visão kanban ---------------------------------------------------------

  function conteudoKanban() {
    var colunas = App.selectors.colunasKanbanProcessos(resultado.itens, agruparPor(), usuarios);

    // Rodapé da coluna com a soma do valor da causa — dá noção de exposição
    // financeira por fase, não só de quantidade.
    colunas.forEach(function (coluna) {
      coluna.rodape = App.format.moedaCompacta(coluna.somaValor) + ' em causa';
    });

    return App.components.KanbanBoard({
      colunas: colunas,
      renderCard: App.components.ProcessoCard,
      arrastavel: true,
      vazio: 'Nenhum processo'
    });
  }

  function dicaKanban() {
    var rotulos = {
      faseId: 'a fase processual',
      responsavelId: 'o responsável',
      areaId: 'a área do direito'
    };
    return '<p class="u-xs u-subtle" style="margin-bottom:var(--space-3)">' +
             'Arraste um card entre as colunas para alterar ' + rotulos[agruparPor()] +
             '. A mudança é registrada como andamento no processo.' +
           '</p>';
  }

  // --- Render ---------------------------------------------------------------

  function desenhar() {
    var emKanban = visao() === 'kanban';

    container.innerHTML =
      cabecalho() +
      barraFiltros() +
      (emKanban ? dicaKanban() + conteudoKanban() : conteudoTabela());
  }

  function atualizarFiltros(alteracoes) {
    App.store.setState({
      processosFiltros: Object.assign({}, filtros(), alteracoes, { pagina: alteracoes.pagina || 1 })
    });
    carregar();
  }

  function ligarEventos() {
    var Toast = App.components.Toast;

    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) {
        var alteracoes = {};
        alteracoes[nome] = valor;
        atualizarFiltros(alteracoes);
      },
      aoLimpar: function () {
        App.store.setState({
          processosFiltros: Object.assign({}, filtros(), {
            busca: '', status: '', faseId: '', areaId: '', responsavelId: '', risco: '', pagina: 1
          })
        });
        carregar();
      }
    });

    // Alternar tabela ⇄ kanban
    App.dom.delegate(container, 'click', '[data-action="trocar-visao"]', function (evento, botao) {
      var nova = botao.dataset.value;
      if (nova === visao()) return;
      App.store.setState({ processosVisao: nova });
      App.preferencias.salvar();
      carregar();
    });

    // Agrupamento das colunas do kanban
    App.dom.delegate(container, 'change', '[data-action="agrupar-por"]', function (evento, campo) {
      App.store.setState({ processosAgruparPor: campo.value });
      App.preferencias.salvar();
      desenhar();
    });

    // Ambos os conjuntos de handlers ficam ligados o tempo todo: os seletores
    // (`th[data-sort]`, `.kanban-card`) só existem na visão correspondente.
    App.components.DataTable.mount(container, {
      aoOrdenar: function (chave) {
        var f = filtros();
        var direcao = f.ordenarPor === chave && f.direcao === 'asc' ? 'desc' : 'asc';
        atualizarFiltros({ ordenarPor: chave, direcao: direcao });
      }
    });

    App.dom.delegate(container, 'click', '[data-action="pagina"]', function (evento, botao) {
      var pagina = Number(botao.dataset.value);
      if (pagina < 1 || pagina > resultado.totalPaginas) return;
      App.store.setState({ processosFiltros: Object.assign({}, filtros(), { pagina: pagina }) });
      carregar();
    });

    App.components.KanbanBoard.mount(container, {
      aoMover: function (processoId, destinoId) {
        var campo = agruparPor();

        App.services.processoService.mudarCampoKanban(processoId, campo, destinoId)
          .then(function (processo) {
            var rotulo = {
              faseId: App.domain.enums.rotulo(App.domain.enums.FASES, destinoId),
              areaId: App.domain.enums.rotulo(App.domain.enums.AREAS, destinoId),
              responsavelId: processo.responsavelNome
            }[campo];

            Toast.sucesso('Processo movido', processo.numeroInterno + ' → ' + rotulo);
            carregar();
          })
          .catch(function (erro) {
            Toast.erro('Não foi possível mover o processo', erro.message);
            carregar();   // devolve o card ao lugar de origem
          });
      }
    });
  }

  App.pages.ProcessosListPage = { render: render };
})(window.App = window.App || {});
