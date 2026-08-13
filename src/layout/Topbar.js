/* ==========================================================================
   layout/Topbar.js — busca global, tema e usuário
   ========================================================================== */

(function (App) {
  'use strict';

  App.layout = App.layout || {};

  function esc(v) { return App.dom.esc(v); }

  function Topbar(props) {
    var p = props || {};
    var usuario = p.usuario || {};
    var ui = App.components.ui;

    return '<header class="topbar">' +

      ui.Button({
        icone: '☰', variante: 'ghost', apenasIcone: true,
        acao: 'alternar-sidebar', titulo: 'Menu', classe: 'topbar__menu-btn'
      }) +

      '<div class="topbar__search">' +
        '<span class="topbar__search-icon" aria-hidden="true">⌕</span>' +
        '<input type="search" id="busca-global" autocomplete="off"' +
          ' placeholder="Buscar processo, cliente ou número CNJ…"' +
          ' aria-label="Busca global">' +
        '<div class="global-results u-hidden" id="resultados-globais"></div>' +
      '</div>' +

      '<div class="topbar__actions">' +

        // F2.2: o sino deixou de ser um atalho para a agenda e virou a
        // central de notificações de verdade.
        App.components.NotificationCenter({
          notificacoes: p.notificacoes,
          naoLidas: p.naoLidas,
          aberto: p.notificacoesAbertas
        }) +

        '<button class="topbar__icon-btn" data-action="ir-prazos"' +
          ' data-count="' + (p.prazosCriticos || 0) + '"' +
          ' title="' + (p.prazosCriticos || 0) + ' prazo(s) crítico(s) ou vencido(s)">⏱</button>' +

        '<button class="topbar__icon-btn" data-action="alternar-tema"' +
          ' title="Alternar tema claro/escuro">' + (p.tema === 'dark' ? '☀' : '☾') + '</button>' +

        '<button class="topbar__icon-btn" data-action="restaurar-dados"' +
          ' title="Restaurar os dados fictícios originais">↺</button>' +

        '<div class="topbar__user" title="' + esc(usuario.nome || '') + '">' +
          ui.Avatar({ usuario: usuario }) +
          '<div class="u-stack u-hidden-sm">' +
            '<span class="u-sm u-bold">' + esc(usuario.nome || '—') + '</span>' +
            '<span class="u-xs u-subtle">' +
              esc(App.domain.enums.rotulo(App.domain.enums.PERFIS, usuario.perfil, '')) +
              (usuario.oab ? ' · OAB/' + esc(usuario.oab.uf) + ' ' + esc(usuario.oab.numero) : '') +
            '</span>' +
          '</div>' +
          // Trocar de usuário é a forma de conferir a matriz de permissões
          // sem abrir o código — por isso o botão fica à mão.
          '<button class="topbar__icon-btn" data-action="sair"' +
            ' title="Sair e trocar de usuário">⏻</button>' +
        '</div>' +

      '</div>' +
    '</header>';
  }

  // A topbar é re-renderizada a cada mudança de rota, tema ou contador.
  // Os listeners do próprio campo morrem junto com o nó antigo, mas o
  // listener global de clique não — por isso é registrado uma única vez.
  var listenerGlobalRegistrado = false;

  /** Busca global: consulta processos e clientes em paralelo. */
  Topbar.mount = function (root) {
    var campo = App.dom.qs('#busca-global', root);
    var painel = App.dom.qs('#resultados-globais', root);
    if (!campo || !painel) return;

    function esconder() {
      painel.classList.add('u-hidden');
      painel.innerHTML = '';
    }

    var buscar = App.dom.debounce(function (termo) {
      if (!termo || termo.trim().length < 2) return esconder();

      Promise.all([
        App.services.processoService.listar({ busca: termo, porPagina: 5 }),
        App.services.clienteService.listar({ busca: termo, porPagina: 4 })
      ]).then(function (resultados) {
        var processos = resultados[0].itens;
        var clientes = resultados[1].itens;

        if (!processos.length && !clientes.length) {
          painel.innerHTML = '<div class="global-results__group-label">Nenhum resultado</div>';
          painel.classList.remove('u-hidden');
          return;
        }

        var html = '';

        if (processos.length) {
          html += '<div class="global-results__group-label">Processos</div>';
          processos.forEach(function (proc) {
            html += '<a class="global-results__item" href="#/processos/' + proc.id + '">' +
                      '<div class="u-sm u-bold">' + esc(proc.numeroInterno) + ' · ' +
                        esc(proc.clienteNome) + '</div>' +
                      '<div class="u-xs u-subtle u-mono">' + esc(proc.numeroCnj) + '</div>' +
                    '</a>';
          });
        }

        if (clientes.length) {
          html += '<div class="global-results__group-label">Clientes</div>';
          clientes.forEach(function (cliente) {
            html += '<a class="global-results__item" href="#/clientes/' + cliente.id + '">' +
                      '<div class="u-sm u-bold">' + esc(cliente.nome) + '</div>' +
                      '<div class="u-xs u-subtle">' + esc(App.format.documento(cliente.documento)) +
                        ' · ' + cliente.totalProcessos + ' processo(s)</div>' +
                    '</a>';
          });
        }

        painel.innerHTML = html;
        painel.classList.remove('u-hidden');
      }).catch(function () { esconder(); });
    }, 260);

    campo.addEventListener('input', function () { buscar(campo.value); });
    campo.addEventListener('focus', function () {
      if (campo.value.trim().length >= 2) buscar(campo.value);
    });

    campo.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') { campo.blur(); esconder(); }
    });

    // Clique fora fecha o painel; clique num resultado navega e limpa.
    if (!listenerGlobalRegistrado) {
      listenerGlobalRegistrado = true;
      document.addEventListener('click', function (evento) {
        // Resolve os nós no momento do clique — a topbar pode ter sido
        // re-renderizada desde o registro deste listener.
        var campoAtual = document.getElementById('busca-global');
        var painelAtual = document.getElementById('resultados-globais');
        if (!campoAtual || !painelAtual) return;

        if (!evento.target.closest('.topbar__search')) {
          painelAtual.classList.add('u-hidden');
          painelAtual.innerHTML = '';
          return;
        }

        if (evento.target.closest('.global-results__item')) {
          campoAtual.value = '';
          painelAtual.classList.add('u-hidden');
          painelAtual.innerHTML = '';
        }
      });
    }
  };

  App.layout.Topbar = Topbar;
})(window.App = window.App || {});
