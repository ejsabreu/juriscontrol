/* ==========================================================================
   components/FilterBar.js — barra de busca e filtros

   props.campos: [{ tipo:'busca'|'select'|'toggle', nome, rotulo, opcoes, valor }]
   Emite tudo por callback — a barra não conhece o store nem os services.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  /* O combo saiu daqui para `components/Combo.js` quando o formulário de
     cliente virou o terceiro a precisar dele. `FilterBar.Combo` continua
     existindo porque a paginação, em `ui.js`, chama por este nome. */
  var Combo = function (campo) { return App.components.Combo(campo); };

  function FilterBar(props) {
    var p = props || {};
    var campos = p.campos || [];
    var ui = App.components.ui;

    var html = '<div class="filter-bar">';

    campos.forEach(function (campo) {
      if (campo.tipo === 'busca') {
        html += '<div class="filter-bar__search">' +
                  '<span class="filter-bar__search-icon" aria-hidden="true">' +
                    App.icones.de('lupa') + '</span>' +
                  '<input class="input" type="search" data-filtro="' + esc(campo.nome) + '"' +
                    ' placeholder="' + esc(campo.placeholder || 'Buscar...') + '"' +
                    ' value="' + esc(campo.valor || '') + '"' +
                    ' aria-label="' + esc(campo.rotulo || 'Buscar') + '">' +
                '</div>';

      } else if (campo.tipo === 'select') {
        html += Combo(campo);

      } else if (campo.tipo === 'toggle') {
        html += '<label class="checkbox u-sm">' +
                  '<input type="checkbox" data-filtro="' + esc(campo.nome) + '"' +
                    (campo.valor ? ' checked' : '') + '>' +
                  '<span>' + esc(campo.rotulo) + '</span>' +
                '</label>';

      } else if (campo.tipo === 'divisor') {
        html += '<span class="filter-bar__divider"></span>';

      } else if (campo.tipo === 'html') {
        html += campo.conteudo;
      }
    });

    if (p.totalAtivos) {
      html += '<span class="u-spacer"></span>' +
              ui.Button({
                rotulo: 'Limpar filtros (' + p.totalAtivos + ')',
                variante: 'ghost',
                tamanho: 'sm',
                acao: 'limpar-filtros'
              });
    }

    if (p.direita) {
      html += (p.totalAtivos ? '' : '<span class="u-spacer"></span>') + p.direita;
    }

    return html + '</div>';
  }

  /**
   * @param {Element}  root
   * @param {Object}   handlers  { aoMudar(nome, valor), aoLimpar() }
   * @param {number}   [atrasoBusca]  debounce do campo de busca
   */
  FilterBar.mount = function (root, handlers, atrasoBusca) {
    var h = handlers || {};
    if (!h.aoMudar) return;

    /* Quem digita não pode perder o campo debaixo dos dedos.

       A página inteira é redesenhada por `innerHTML` quando o resultado da
       busca chega — é assim que este protótipo funciona, e é o que faz o
       roteador poder descartar listeners junto com o nó. O efeito colateral é
       que o `<input>` em que a pessoa está escrevendo é DESTRUÍDO e recriado:
       o foco vai para o `<body>` e o cursor volta ao começo.

       Então guardamos onde o cursor estava no momento da busca e devolvemos
       o foco quando o campo reaparece. Não dá para fazer isso na página, uma
       a uma: quem sabe que existe um campo de busca é esta barra. */
    var aRestaurar = null;

    var buscarComAtraso = App.dom.debounce(function (nome, valor, posicao) {
      aRestaurar = { nome: nome, posicao: posicao };
      h.aoMudar(nome, valor);
    }, atrasoBusca || 280);

    App.dom.delegate(root, 'input', 'input[type="search"][data-filtro]', function (evento, campo) {
      buscarComAtraso(campo.dataset.filtro, campo.value, campo.selectionStart);
    });

    /* O observador é a única forma de saber que a página se redesenhou: quem
       redesenha é a tela, e ela não avisa ninguém. Fica preso ao `root`, que
       o roteador troca a cada rota — nó descartado, observador junto. */
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function () {
        if (!aRestaurar) return;

        /* Se o foco foi parar em outro lugar DENTRO da tela, foi a pessoa que
           o levou — clicou num combo, num botão. Devolver o foco à busca aí
           seria arrancá-lo da mão dela. Só restauramos quando o foco se
           perdeu, que é o que o `innerHTML` provoca. */
        var ativo = document.activeElement;
        if (ativo && ativo !== document.body && root.contains(ativo)) {
          aRestaurar = null;
          return;
        }

        var campo = root.querySelector(
          'input[type="search"][data-filtro="' + aRestaurar.nome + '"]');
        if (!campo) return;

        var posicao = aRestaurar.posicao;
        aRestaurar = null;
        campo.focus();
        // Sem isto o cursor cai no início do texto já digitado.
        if (posicao !== null && posicao !== undefined) {
          try { campo.setSelectionRange(posicao, posicao); } catch (e) { /* nada */ }
        }
      }).observe(root, { childList: true, subtree: true });
    }

    /* Continua valendo para os selects que NÃO viraram combo — os de
       formulário, fora da barra. */
    App.dom.delegate(root, 'change', 'select[data-filtro]', function (evento, campo) {
      h.aoMudar(campo.dataset.filtro, campo.value);
    });

    /* Abrir, escolher, teclado e clique-fora são do combo; a barra só diz o
       que fazer com o valor que sair de lá. */
    App.components.Combo.mount(root, { aoMudar: h.aoMudar });

    App.dom.delegate(root, 'change', 'input[type="checkbox"][data-filtro]', function (evento, campo) {
      h.aoMudar(campo.dataset.filtro, campo.checked);
    });

    if (h.aoLimpar) {
      App.dom.delegate(root, 'click', '[data-action="limpar-filtros"]', function () {
        h.aoLimpar();
      });
    }
  };

  /**
   * Troca só o MIOLO da tela — a parte que depende do que foi carregado.
   *
   * O protótipo desenha cada tela com um `innerHTML` só. Simples, e é o que
   * permite ao roteador descartar listeners junto com o nó. Mas numa busca,
   * que dispara a cada tecla, refazer a tela inteira custa duas coisas que a
   * pessoa vê: o campo em que ela está escrevendo é DESTRUÍDO — foco e
   * cursor vão embora — e a tela pisca, porque cabeçalho, barra e lista
   * somem e voltam juntos.
   *
   * Aqui só o miolo é trocado. Cabeçalho e barra de filtros ficam de pé, e
   * com eles o campo, o cursor e o foco.
   *
   * Devolve `false` quando não há miolo marcado — é o caso da primeira
   * pintura, e o chamador então desenha a tela inteira.
   *
   * @param {Element} root
   * @param {string}  html
   * @param {Object}  [op]  { contagem, totalAtivos }
   */
  FilterBar.trocarMiolo = function (root, html, op) {
    var alvo = App.dom.qs('[data-miolo]', root);
    if (!alvo) return false;

    alvo.innerHTML = html;

    var o = op || {};

    /* A contagem vive no subtítulo do cabeçalho, que também não é
       redesenhado — então é atualizada no lugar. `textContent` e não
       `innerHTML`: é texto, e texto não precisa de parser. */
    if (o.contagem !== undefined && o.contagem !== null) {
      var subtitulo = App.dom.qs('.page-header__subtitle', root);
      if (subtitulo) subtitulo.textContent = o.contagem;
    }

    FilterBar.atualizarLimpar(root, o.totalAtivos || 0);
    return true;
  };

  /**
   * Acerta o botão "Limpar filtros" sem redesenhar a barra.
   *
   * Existe por causa de quem redesenha só a lista: a barra fica de pé — é o
   * que mantém o campo de busca vivo e o foco onde estava —, mas este botão
   * nasce e morre conforme haja filtro ativo, e ninguém mais o atualizaria.
   *
   * @param {Element} root
   * @param {number}  totalAtivos
   */
  FilterBar.atualizarLimpar = function (root, totalAtivos) {
    var barra = App.dom.qs('.filter-bar', root);
    if (!barra) return;

    var botao = App.dom.qs('[data-action="limpar-filtros"]', barra);
    var espacador = App.dom.qs('.u-spacer', barra);

    if (!totalAtivos) {
      if (botao) botao.remove();
      /* O espaçador some junto — mas só se for o ÚLTIMO da barra. Ele existe
         para empurrar o que vem depois para a direita; quando o botão sai e
         não há mais nada atrás, ele fica comendo folga à toa. Se ainda houver
         algo (o "Agrupar por" do kanban, por exemplo), ele continua tendo
         serviço. */
      if (espacador && espacador === barra.lastElementChild) espacador.remove();
      return;
    }

    var rotulo = 'Limpar filtros (' + totalAtivos + ')';

    if (botao) {
      var texto = botao.querySelector('span') || botao;
      if (texto.textContent !== rotulo) texto.textContent = rotulo;
      return;
    }

    if (!espacador) barra.insertAdjacentHTML('beforeend', '<span class="u-spacer"></span>');
    barra.insertAdjacentHTML('beforeend', App.components.ui.Button({
      rotulo: rotulo,
      variante: 'ghost',
      tamanho: 'sm',
      acao: 'limpar-filtros'
    }));
  };

  /* Exposto porque a paginação monta o mesmo combo fora da barra — e o que
     faz um combo ser combo é ESTE HTML, casado com a delegação de `mount`.
     Duplicar a marcação lá seria criar um segundo combo que envelhece
     sozinho. */
  FilterBar.Combo = Combo;

  App.components.FilterBar = FilterBar;
})(window.App = window.App || {});
