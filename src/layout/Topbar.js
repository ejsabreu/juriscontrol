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

      /* Sem ☰ aqui: o botão do menu mora no menu, nos dois degraus. Ele pôde
         sair porque o menu recolhido não some mais da tela — vira uma tira de
         ícones que continua visível, e é de dentro dela que o botão o traz de
         volta. Enquanto a versão pequena escondia o menu por completo, este
         botão era a única forma de reabri-lo. */

      '<div class="topbar__search">' +
        '<span class="topbar__search-icon" aria-hidden="true">' +
          App.icones.de('lupa') + '</span>' +
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

        /* Sem atalho de prazos vencidos aqui. Ele era um segundo contador
           vermelho ao lado do sino, contando o mesmo tipo de urgência com
           outro número — e prazo crítico já vira notificação pelas regras de
           alerta. Dois avisos para o mesmo fato treinam a pessoa a ignorar os
           dois. Quem vai à Agenda vai pelo menu. */

        '<button class="topbar__icon-btn" data-action="alternar-tema"' +
          ' title="Alternar tema claro/escuro">' + (p.tema === 'dark' ? '☀' : '☾') + '</button>' +

        '<button class="topbar__icon-btn" data-action="restaurar-dados"' +
          ' title="Restaurar os dados fictícios originais">↺</button>' +

        '<div class="topbar__user" title="' + esc(usuario.nome || '') + '">' +
          ui.Avatar({ usuario: usuario }) +
          /* No telefone fica só o círculo com as iniciais: ele já responde de
             quem é a sessão, e o nome por extenso com o cargo embaixo comia a
             largura da busca, que é o que se usa de fato com o celular na mão.
             Quem quiser conferir tem o nome no `title` do bloco. */
          '<div class="u-stack u-hidden-sm">' +
            '<span class="u-sm u-bold">' + esc(usuario.nome || '—') + '</span>' +
            '<span class="u-xs u-subtle">' +
              esc(App.domain.enums.rotulo(App.domain.enums.PERFIS, usuario.perfil, '')) +
              (usuario.oab ? ' · OAB/' + esc(usuario.oab.uf) + ' ' + esc(usuario.oab.numero) : '') +
            '</span>' +
          '</div>' +
          // Trocar de usuário é a forma de conferir a matriz de permissões
          // sem abrir o código — por isso o botão fica à mão.
          // Porta, e não o botão de energia que estava aqui: ⏻ promete
          // desligar alguma coisa, e o que este botão faz é sair da sessão.
          '<button class="topbar__icon-btn" data-action="sair"' +
            ' title="Sair e trocar de usuário" aria-label="Sair e trocar de usuário">' +
            App.icones.de('porta-saida') + '</button>' +
        '</div>' +

      '</div>' +
    '</header>';
  }

  // A topbar é re-renderizada a cada mudança de rota, tema ou contador.
  // Os listeners do próprio campo morrem junto com o nó antigo, mas o
  // listener global de clique não — por isso é registrado uma única vez.
  var listenerGlobalRegistrado = false;

  /* Rótulo de cada tipo no painel de resultados. A ordem define a ordem dos
     grupos: processo antes de andamento, porque quem digita normalmente
     quer o processo, e o andamento é onde ele estava escondido. */
  var GRUPOS = [
    { tipo: 'processo',   label: 'Processos' },
    { tipo: 'pessoa',     label: 'Pessoas' },
    { tipo: 'documento',  label: 'Documentos' },
    { tipo: 'andamento',  label: 'Andamentos' },
    { tipo: 'publicacao', label: 'Publicações' },
    { tipo: 'prazo',      label: 'Prazos' },
    { tipo: 'lead',       label: 'Prospecção' },
    { tipo: 'modelo',     label: 'Modelos' }
  ];

  /**
   * Busca global no CONTEÚDO (F2.7).
   *
   * Antes alcançava processos e clientes pelo nome. Agora vai ao texto do
   * documento, à descrição do andamento e ao corpo da publicação — pelo
   * índice invertido de `domain/busca.js`, que é o que permite consultar a
   * cada tecla sem varrer o acervo inteiro.
   */
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

      App.services.buscaService.buscarAgrupado(termo, 24).then(function (r) {
        /* F2.8: antes dos resultados, a INTENÇÃO. "prazos vencendo" não é
           uma busca por documentos que contenham essas palavras — é um
           pedido de navegação, e tratá-lo como texto devolveria lixo.
           É gramática, não modelo: cada padrão é uma expressão regular. */
        var intencao = App.domain.assistente.interpretarBusca(termo);

        var atalho = intencao
          ? '<a class="global-results__atalho" href="' + esc(intencao.rota) + '">' +
              '<span class="global-results__atalho-icone" aria-hidden="true">↗</span>' +
              '<span>Ir para <strong>' + esc(intencao.descricao) + '</strong></span>' +
            '</a>'
          : '';

        if (!r.total) {
          painel.innerHTML = atalho ||
            '<div class="global-results__group-label">Nenhum resultado</div>';
          painel.classList.remove('u-hidden');
          return;
        }

        var html = atalho;

        GRUPOS.forEach(function (grupo) {
          var itens = r.grupos[grupo.tipo];
          if (!itens || !itens.length) return;

          html += '<div class="global-results__group-label">' + esc(grupo.label) + '</div>';

          itens.forEach(function (item) {
            var destino = item.destino || '#/';
            html += '<a class="global-results__item" href="' + esc(destino) + '">' +
                      '<div class="u-sm u-bold">' + esc(item.rotulo) + '</div>' +
                      (item.sublinha
                        ? '<div class="u-xs u-subtle">' + esc(item.sublinha) + '</div>' : '') +
                      // O trecho já vem escapado e com <mark> pelo domínio.
                      (item.trecho
                        ? '<div class="global-results__trecho">' + item.trecho + '</div>' : '') +
                    '</a>';
          });
        });

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
