/* ==========================================================================
   pages/TarefasPage.js — quadro kanban de tarefas

   Reaproveita o MESMO componente KanbanBoard da tela de processos, apenas
   com outra configuração de colunas e outro renderizador de card.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var tarefas = [];
  var usuarios = [];

  function esc(v) { return App.dom.esc(v); }
  function filtros() { return App.store.getState().tarefasFiltros; }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });

    App.services.db.init();
    usuarios = App.services.db.get('usuarios').filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    ligarEventos();   // delegação no container: uma vez por rota
    carregar(true);
  }

  function carregar(completo) {
    App.services.tarefaService.listar(filtros()).then(function (resultado) {
      tarefas = resultado.itens;
      if (completo || !atualizarMiolo()) desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar tarefas', texto: erro.message
      });
    });
  }

  function cabecalho() {
    var atrasadas = tarefas.filter(function (t) { return t.atrasada; }).length;
    var abertas = tarefas.filter(function (t) { return t.status !== 'concluida'; }).length;

    return '<div class="page-header">' +
             '<div>' +
               '<h1 class="page-header__title">Tarefas</h1>' +
               '<p class="page-header__subtitle">' +
                 abertas + ' em aberto' +
                 (atrasadas ? ' · <strong style="color:var(--color-danger)">' + atrasadas +
                              ' atrasada(s)</strong>' : '') +
               '</p>' +
             '</div>' +
             '<div class="page-header__actions">' +
               App.components.ui.Button({
                 rotulo: 'Nova tarefa', variante: 'primary', icone: '+', acao: 'nova-tarefa'
               }) +
             '</div>' +
           '</div>';
  }

  function barraFiltros() {
    var enums = App.domain.enums;
    var f = filtros();

    return App.components.FilterBar({
      campos: [
        { tipo: 'busca', nome: 'busca', valor: f.busca,
          placeholder: 'Buscar tarefa, processo ou cliente…' },
        { tipo: 'select', nome: 'responsavelId', rotulo: 'Responsável',
          opcoes: enums.opcoes(
            usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
            f.responsavelId, 'Todos os responsáveis') },
        { tipo: 'select', nome: 'prioridade', rotulo: 'Prioridade',
          opcoes: enums.opcoes(enums.PRIORIDADES, f.prioridade, 'Todas as prioridades') }
      ],
      totalAtivos: App.selectors.filtrosAtivos(f)
    });
  }

  /* Só o miolo muda a cada busca. Cabeçalho e barra de filtros ficam de pé,
     e com eles o campo, o cursor e o foco de quem está digitando — sem isso
     a tela pisca a cada tecla e o `<input>` é destruído debaixo dos dedos. */
  function miolo() {
    var colunas = App.selectors.colunasKanbanTarefas(tarefas);

    colunas.forEach(function (coluna) {
      coluna.rodape = coluna.atrasadas
        ? '<span style="color:var(--color-danger)">' + coluna.atrasadas + ' atrasada(s)</span>'
        : '';
    });

    return '<p class="u-xs u-subtle" style="margin-bottom:var(--space-3)">' +
        'Arraste um card entre as colunas para alterar o status da tarefa.' +
      '</p>' +
      App.components.KanbanBoard({
        colunas: colunas,
        renderCard: App.components.TarefaCard,
        arrastavel: true,
        vazio: 'Nenhuma tarefa'
      });
  }

  function desenhar() {
    container.innerHTML =
      cabecalho() + barraFiltros() + '<div data-miolo>' + miolo() + '</div>';
  }

  function atualizarMiolo() {
    return App.components.FilterBar.trocarMiolo(container, miolo(), {
      totalAtivos: App.selectors.filtrosAtivos(filtros())
    });
  }

  function ligarEventos() {
    App.components.FilterBar.mount(container, {
      aoMudar: function (nome, valor) {
        var alteracoes = {};
        alteracoes[nome] = valor;
        App.store.setState({ tarefasFiltros: Object.assign({}, filtros(), alteracoes) });
        carregar();
      },
      aoLimpar: function () {
        App.store.setState({ tarefasFiltros: { busca: '', responsavelId: '', prioridade: '' } });
        /* Completo: os campos da barra ficam FORA do miolo — trocar só o
           miolo limpava o filtro e deixava escrito o que estava neles. */
        carregar(true);
      }
    });

    App.components.KanbanBoard.mount(container, {
      aoMover: function (tarefaId, destino) {
        App.services.tarefaService.mudarStatus(tarefaId, destino).then(function (tarefa) {
          App.components.Toast.sucesso('Tarefa movida',
            tarefa.titulo + ' → ' +
            App.domain.enums.rotulo(App.domain.enums.STATUS_TAREFA, destino));
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível mover a tarefa', erro.message);
          carregar();
        });
      },
      aoClicarCard: function (id) {
        abrirDetalhe(id);
      }
    });

    App.dom.delegate(container, 'click', '[data-action="nova-tarefa"]', abrirNovaTarefa);
  }

  function abrirDetalhe(id) {
    var tarefa = tarefas.filter(function (t) { return t.id === id; })[0];
    if (!tarefa) return;

    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;

    var checklist = (tarefa.checklist || []).length
      ? '<div class="divider"></div><div class="fieldset__legend">Checklist</div>' +
        tarefa.checklist.map(function (item) {
          return '<div class="u-row u-sm" style="padding:var(--space-1) 0">' +
                   '<span>' + (item.feito ? '☑' : '☐') + '</span>' +
                   '<span' + (item.feito ? ' class="u-subtle" style="text-decoration:line-through"' : '') + '>' +
                     esc(item.texto) + '</span>' +
                 '</div>';
        }).join('')
      : '';

    App.components.Modal.abrir({
      titulo: tarefa.titulo,
      conteudo:
        '<div class="def-list">' +
          campo('Responsável', esc(tarefa.responsavelNome)) +
          campo('Vencimento', esc(fmt.data(tarefa.dataVencimento)) +
                ' <span class="u-xs u-subtle">(' + esc(fmt.dataRelativa(tarefa.dataVencimento)) + ')</span>') +
          campo('Prioridade', ui.BadgeEnum(enums.PRIORIDADES, tarefa.prioridade)) +
          campo('Status', ui.BadgeEnum(enums.STATUS_TAREFA, tarefa.status)) +
          campo('Processo', tarefa.processo
            ? '<a href="#/processos/' + esc(tarefa.processo.id) + '">' +
              esc(tarefa.processoNumero) + '</a>'
            : '<span class="u-subtle">—</span>') +
          campo('Cliente', esc(tarefa.clienteNome)) +
        '</div>' +
        (tarefa.descricao ? '<div class="divider"></div><p class="u-sm">' +
                            esc(tarefa.descricao) + '</p>' : '') +
        checklist,
      acoes: tarefa.status === 'concluida'
        ? [{ rotulo: 'Fechar', variante: 'secondary', acao: 'cancelar', fechar: true }]
        : [
            { rotulo: 'Fechar', variante: 'secondary', acao: 'cancelar', fechar: true },
            { rotulo: 'Concluir tarefa', variante: 'primary', acao: 'concluir' }
          ],
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'concluir') return;
        App.services.tarefaService.mudarStatus(tarefa.id, 'concluida').then(function () {
          fechar();
          App.components.Toast.sucesso('Tarefa concluída', tarefa.titulo);
          carregar();
        });
      }
    });

    function campo(termo, valor) {
      return '<div><div class="def-list__term">' + esc(termo) + '</div>' +
             '<div class="def-list__desc">' + valor + '</div></div>';
    }
  }

  function abrirNovaTarefa() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    var processos = App.services.db.get('processos')
      .filter(function (p) { return p.status === 'ativo'; });
    var pessoas = App.services.db.get('pessoas');

    var opcoesProcesso = processos.map(function (p) {
      var cliente = pessoas.filter(function (x) { return x.id === p.clienteId; })[0];
      return { id: p.id, label: p.numeroInterno + ' — ' + (cliente ? cliente.nome : '') };
    });

    App.components.Modal.abrir({
      titulo: 'Nova tarefa',
      conteudo: '<form id="form-tarefa" class="form-grid">' +
        ui.Field({ nome: 'titulo', rotulo: 'Título', obrigatorio: true,
                   placeholder: 'Ex.: Elaborar minuta de contestação' }) +
        ui.Field({ nome: 'processoId', rotulo: 'Processo vinculado', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(opcoesProcesso, '', 'Sem processo') }) +
        ui.Field({ nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(
                     usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
                     App.store.getState().usuarioAtual.id) }) +
        ui.Field({ nome: 'dataVencimento', rotulo: 'Vencimento', tipo: 'date', largura: 6,
                   valor: App.domain.prazos.paraISO(
                     App.domain.prazos.somarDiasUteis(App.domain.prazos.hojeISO(), 5)) }) +
        ui.Field({ nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.PRIORIDADES, 'media') }) +
        ui.Field({ nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', linhas: 3 }) +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Criar tarefa', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-tarefa', corpo));
        if (!dados.titulo || !dados.titulo.trim()) {
          App.components.Toast.aviso('Informe o título da tarefa.');
          return;
        }

        var processoEscolhido = processos.filter(function (p) { return p.id === dados.processoId; })[0];

        App.services.tarefaService.criar({
          titulo: dados.titulo.trim(),
          descricao: dados.descricao,
          processoId: dados.processoId || null,
          clienteId: processoEscolhido ? processoEscolhido.clienteId : null,
          responsavelId: dados.responsavelId,
          criadorId: App.store.getState().usuarioAtual.id,
          dataVencimento: dados.dataVencimento,
          prioridade: dados.prioridade
        }).then(function () {
          fechar();
          App.components.Toast.sucesso('Tarefa criada');
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Erro ao criar a tarefa', erro.message);
        });
      }
    });
  }

  App.pages.TarefasPage = { render: render };
})(window.App = window.App || {});
