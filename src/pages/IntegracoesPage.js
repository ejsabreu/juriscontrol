/* ==========================================================================
   pages/IntegracoesPage.js — monitoramentos e estado da captura

   Duas coisas: o que o escritório monitora no diário e o histórico das
   sincronizações. Mais a lista das integrações previstas para a fase 3 —
   que está aqui justamente para ninguém confundir o que existe com o que
   está planejado.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var monitoramentos = [];
  var historico = [];

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar();
  }

  function carregar() {
    Promise.all([
      App.services.monitoramentoService.listar(),
      App.services.sincronizacaoService.historico(10)
    ]).then(function (r) {
      monitoramentos = r[0];
      historico = r[1];
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar', texto: erro.message
      });
    });
  }

  function linhaMonitoramento(m) {
    var ui = App.components.ui;

    return '<tr>' +
      '<td>' +
        '<div class="u-bold">' + esc(m.valor) + (m.uf ? ' / ' + esc(m.uf) : '') + '</div>' +
        '<div class="u-xs u-subtle">' + esc(m.rotuloTipo) +
          (m.usuario ? ' · ' + esc(m.usuario.nome) : '') + '</div>' +
      '</td>' +
      '<td class="u-sm">' + esc((m.tribunaisRotulos || []).join(', ') || '—') + '</td>' +
      '<td class="u-sm">' +
        (m.ultimaSincronizacaoEm
          ? esc(App.format.dataHora(m.ultimaSincronizacaoEm))
          : '<span class="u-subtle">nunca</span>') +
      '</td>' +
      '<td class="u-right">' +
        ui.Button({ rotulo: 'Remover', tamanho: 'sm', variante: 'ghost',
                    acao: 'remover-monitoramento', valor: m.id }) +
      '</td>' +
    '</tr>';
  }

  function cardMonitoramentos() {
    var ui = App.components.ui;

    var tabela = monitoramentos.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Termo monitorado</th><th>Tribunais</th><th>Última captura</th><th></th>' +
        '</tr></thead><tbody>' + monitoramentos.map(linhaMonitoramento).join('') +
        '</tbody></table></div>'
      : ui.EmptyState({
          icone: '👁',
          titulo: 'Nenhum monitoramento',
          texto: 'Sem termo monitorado, a sincronização não tem o que buscar.',
          acao: ui.Button({ rotulo: 'Cadastrar', variante: 'primary', acao: 'novo-monitoramento' })
        });

    return ui.Card({
      titulo: 'Monitoramentos',
      subtitulo: monitoramentos.length + ' cadastrado(s)',
      acoes: ui.Button({ rotulo: 'Cadastrar', tamanho: 'sm', variante: 'primary',
                         acao: 'novo-monitoramento' }),
      conteudo:
        '<p class="u-sm u-muted">Serviço de recorte funciona pela OAB de quem assina as ' +
        'peças, ou pelo nome/CNPJ do cliente. Tudo o que sair no diário com esses termos ' +
        'cai na fila de triagem.</p>' + tabela,
      semPadding: false
    });
  }

  function cardHistorico() {
    var ui = App.components.ui;

    if (!historico.length) {
      return ui.Card({
        titulo: 'Sincronizações',
        conteudo: '<p class="u-sm u-muted">Nenhuma sincronização executada ainda.</p>'
      });
    }

    var linhas = historico.map(function (s) {
      var falhou = s.status === 'erro';
      return '<tr>' +
        '<td class="u-sm">' + esc(App.format.dataHora(s.iniciadaEm)) + '</td>' +
        '<td>' + (falhou
          ? ui.Badge({ rotulo: 'Erro', variante: 'danger' })
          : ui.Badge({ rotulo: 'Concluída', variante: 'success' })) + '</td>' +
        '<td class="u-sm u-tabular">' + (s.encontradas || 0) + '</td>' +
        '<td class="u-sm u-tabular">' + (s.novas || 0) + '</td>' +
        '<td class="u-sm u-tabular">' + (s.duplicadas || 0) + '</td>' +
        '<td class="u-xs u-subtle">' + esc(s.mensagemErro || '') + '</td>' +
      '</tr>';
    }).join('');

    return ui.Card({
      titulo: 'Últimas sincronizações',
      conteudo:
        '<div class="table-wrap"><table class="table table--compact"><thead><tr>' +
          '<th>Quando</th><th>Situação</th><th>Encontradas</th><th>Novas</th>' +
          '<th>Duplicadas</th><th>Observação</th>' +
        '</tr></thead><tbody>' + linhas + '</tbody></table></div>' +
        '<p class="u-xs u-subtle" style="margin-top:var(--space-3)">' +
          'Publicação repetida é descartada pelo hash do conteúdo — o mesmo ato costuma ' +
          'sair em mais de um caderno, e a consulta de hoje se sobrepõe à de ontem.' +
        '</p>',
      semPadding: false
    });
  }

  function cardIntegracoes() {
    var ui = App.components.ui;
    var previstas = App.services.sincronizacaoService.INTEGRACOES_PREVISTAS;

    var linhas = previstas.map(function (i) {
      return '<tr>' +
        '<td class="u-bold">' + esc(i.nome) + '</td>' +
        '<td class="u-sm">' + esc(i.descricao) + '</td>' +
        '<td class="u-sm u-subtle">' + esc(i.cobertura) + '</td>' +
        '<td>' + ui.Badge({ rotulo: 'Fase 3', variante: 'neutral' }) + '</td>' +
      '</tr>';
    }).join('');

    return ui.Card({
      titulo: 'Integrações',
      conteudo:
        App.components.SeloSimulado({
          oque: 'nenhum tribunal é consultado. "Sincronizar agora" fabrica publicações ' +
                'sobre processos reais do escritório para a fila funcionar de ponta a ponta.',
          detalhe: 'O que é real: a classificação do texto, a deduplicação por hash, o ' +
                   'vínculo por número CNJ, o cálculo do prazo e a notificação do responsável.',
          naFase3: 'consulta autenticada às APIs abaixo, no servidor.'
        }) +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Serviço</th><th>O que é</th><th>Cobertura</th><th>Situação</th>' +
        '</tr></thead><tbody>' + linhas + '</tbody></table></div>',
      semPadding: false
    });
  }

  function desenhar() {
    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Integrações e captura</h1>' +
          '<p class="page-header__subtitle">Monitoramentos do diário e estado da sincronização</p>' +
        '</div>' +
        '<div class="page-header__actions">' +
          App.components.ui.Button({ rotulo: 'Ir para a fila', href: '#/publicacoes' }) +
        '</div>' +
      '</div>' +
      '<div class="page-section">' + cardMonitoramentos() + '</div>' +
      '<div class="page-section">' + cardHistorico() + '</div>' +
      '<div class="page-section">' + cardIntegracoes() + '</div>';
  }

  function abrirNovoMonitoramento() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var usuarios = App.services.db.get('usuarios').map(function (u) {
      return { id: u.id, label: u.nome };
    });

    App.components.Modal.abrir({
      titulo: 'Novo monitoramento',
      conteudo:
        '<form id="form-monitoramento">' +
          ui.Field({ nome: 'tipo', rotulo: 'Monitorar por', tipo: 'select',
                     opcoes: enums.opcoes(enums.TIPOS_MONITORAMENTO, 'oab') }) +
          ui.Field({ nome: 'valor', rotulo: 'Termo', obrigatorio: true,
                     placeholder: 'Número da OAB, nome da parte ou CNPJ' }) +
          ui.Field({ nome: 'uf', rotulo: 'UF', placeholder: 'SP' }) +
          ui.Field({ nome: 'usuarioId', rotulo: 'Advogado', tipo: 'select',
                     opcoes: enums.opcoes(usuarios, '', 'Não vincular') }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Cadastrar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var dados = App.dom.formToObject(App.dom.qs('#form-monitoramento', corpo));
        dados.tribunais = ['tjsp', 'trt2', 'trf3'];

        App.services.monitoramentoService.criar(dados).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Monitoramento cadastrado');
          carregar();
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível cadastrar', erro.message);
        });
      }
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="novo-monitoramento"]',
                     abrirNovoMonitoramento);

    App.dom.delegate(container, 'click', '[data-action="remover-monitoramento"]',
      function (evento, alvo) {
        App.services.monitoramentoService.remover(alvo.getAttribute('data-value'))
          .then(function () {
            App.components.Toast.sucesso('Monitoramento removido');
            carregar();
          });
      });
  }

  App.pages.IntegracoesPage = { render: render };
})(window.App = window.App || {});
