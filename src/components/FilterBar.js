/* ==========================================================================
   components/FilterBar.js — barra de busca e filtros

   props.campos: [{ tipo:'busca'|'select'|'toggle', nome, rotulo, opcoes, valor }]
   Emite tudo por callback — a barra não conhece o store nem os services.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  /* As opções chegam como HTML de `<option>`, que é o que `enums.opcoes()`
     produz e o que todas as telas já passam. Ler de volta essa string é
     seguro porque a origem é UMA função conhecida — não é HTML arbitrário
     de usuário. Trocar a API para receber array obrigaria a mexer em toda
     tela que tem filtro, e o ganho seria só de forma. */
  var OPCAO = /<option value="([^"]*)"([^>]*)>([\s\S]*?)<\/option>/g;

  function lerOpcoes(html) {
    var itens = [];
    var m;
    OPCAO.lastIndex = 0;
    while ((m = OPCAO.exec(html || '')) !== null) {
      itens.push({
        valor: m[1],
        selecionado: m[2].indexOf('selected') !== -1,
        label: m[3].replace(/<[^>]*>/g, '')
      });
    }
    return itens;
  }

  /**
   * Combo com lista PRÓPRIA, no lugar do `<select>` nativo.
   *
   * A lista de um `<select>` é desenhada pelo sistema operacional e não
   * aceita CSS — não há como fazê-la parecer o painel da busca global. Para
   * ter o mesmo painel, a lista precisa ser HTML nosso.
   *
   * O que se perde: o seletor nativo do celular (o rolete do iOS, a folha do
   * Android). Em troca, o painel é o mesmo em todo lugar, e para três a seis
   * opções curtas a lista simples resolve bem no toque.
   *
   * O gatilho é um `<button>` de verdade e o painel um `listbox` — assim o
   * teclado e o leitor de tela continuam entendendo o que é isto.
   */
  function Combo(campo) {
    var itens = lerOpcoes(campo.opcoes);
    var atual = itens.filter(function (i) { return i.selecionado; })[0] || itens[0];

    return '<div class="combo" data-combo="' + esc(campo.nome) + '">' +
             '<button type="button" class="combo__trigger" data-action="abrir-combo"' +
               ' aria-haspopup="listbox" aria-expanded="false"' +
               ' aria-label="' + esc(campo.rotulo) + '">' +
               '<span class="combo__valor">' + esc(atual ? atual.label : '') + '</span>' +
               '<span class="combo__seta" aria-hidden="true"></span>' +
             '</button>' +
             '<div class="combo__painel u-hidden" role="listbox"' +
               ' aria-label="' + esc(campo.rotulo) + '">' +
               itens.map(function (i) {
                 return '<button type="button" class="combo__item" role="option"' +
                          ' data-combo-valor="' + esc(i.valor) + '"' +
                          ' aria-selected="' + (i.selecionado ? 'true' : 'false') + '">' +
                          esc(i.label) +
                        '</button>';
               }).join('') +
             '</div>' +
           '</div>';
  }

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

    App.dom.delegate(root, 'click', '[data-action="abrir-combo"]', function (evento, botao) {
      evento.preventDefault();
      evento.stopPropagation();
      var combo = botao.parentNode;
      var aberto = botao.getAttribute('aria-expanded') === 'true';
      fecharCombos(root);
      if (!aberto) abrirCombo(combo);
    });

    App.dom.delegate(root, 'click', '.combo__item', function (evento, item) {
      evento.preventDefault();
      var combo = item.closest('.combo');
      fecharCombos(root);
      h.aoMudar(combo.dataset.combo, item.dataset.comboValor);
    });

    /* Setas andam pela lista. O `<button>` já trata Enter e Espaço sozinho,
       e Tab sai do painel — só a navegação vertical precisa de código. */
    App.dom.delegate(root, 'keydown', '.combo__painel', function (evento) {
      if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
      evento.preventDefault();
      var painel = evento.target.closest('.combo__painel');
      var itens = Array.prototype.slice.call(painel.querySelectorAll('.combo__item'));
      var i = itens.indexOf(evento.target);
      var passo = evento.key === 'ArrowDown' ? 1 : -1;
      var proximo = itens[(i + passo + itens.length) % itens.length];
      if (proximo) proximo.focus();
    });

    App.dom.delegate(root, 'keydown', '.combo', function (evento) {
      if (evento.key !== 'Escape') return;
      var combo = evento.target.closest('.combo');
      fecharCombos(root);
      var gatilho = combo.querySelector('.combo__trigger');
      if (gatilho) gatilho.focus();
    });

    /* Clique fora fecha. Precisa morar no DOCUMENTO, porque o clique pode
       cair em qualquer lugar da tela — e por isso é registrado UMA VEZ para
       todo o módulo, não por container.

       O router troca o `<main>` a cada rota e descarta os listeners dele
       junto; um listener de documento não é descartado, então registrar por
       chamada de `mount` acumularia um por rota visitada. Como ele fecha
       qualquer combo do documento, um só serve para todos. */
    ligarFechaFora();

    App.dom.delegate(root, 'change', 'input[type="checkbox"][data-filtro]', function (evento, campo) {
      h.aoMudar(campo.dataset.filtro, campo.checked);
    });

    if (h.aoLimpar) {
      App.dom.delegate(root, 'click', '[data-action="limpar-filtros"]', function () {
        h.aoLimpar();
      });
    }
  };

  /* Registrado uma vez por carga da página — ver o porquê em `mount`. */
  var fechaForaLigado = false;

  function ligarFechaFora() {
    if (fechaForaLigado) return;
    fechaForaLigado = true;
    document.addEventListener('click', function () { fecharCombos(document); });
  }

  function fecharCombos(root) {
    App.dom.qsa('.combo__painel', root).forEach(function (painel) {
      painel.classList.add('u-hidden');
    });
    App.dom.qsa('.combo__trigger', root).forEach(function (gatilho) {
      gatilho.setAttribute('aria-expanded', 'false');
    });
  }

  function abrirCombo(combo) {
    var gatilho = combo.querySelector('.combo__trigger');
    var painel = combo.querySelector('.combo__painel');
    if (!painel) return;

    painel.classList.remove('u-hidden');
    gatilho.setAttribute('aria-expanded', 'true');

    /* O foco vai para a opção ATUAL, e não para a primeira: quem abre um
       filtro quase sempre quer o vizinho do que já está escolhido. */
    var alvo = painel.querySelector('.combo__item[aria-selected="true"]') ||
               painel.querySelector('.combo__item');
    if (alvo) alvo.focus();
  }

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

  App.components.FilterBar = FilterBar;
})(window.App = window.App || {});
