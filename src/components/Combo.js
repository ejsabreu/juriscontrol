/* ==========================================================================
   components/Combo.js — escolha de um entre poucos valores conhecidos

   Combo com lista PRÓPRIA, no lugar do `<select>` nativo.

   A lista de um `<select>` é desenhada pelo sistema operacional e não aceita
   CSS — não há como fazê-la parecer o painel da busca global. Para ter o
   mesmo painel, a lista precisa ser HTML nosso.

   O que se perde: o seletor nativo do celular (o rolete do iOS, a folha do
   Android). Em troca, o painel é o mesmo em todo lugar, e para três a seis
   opções curtas a lista simples resolve bem no toque.

   O gatilho é um `<button>` de verdade e o painel um `listbox` — assim o
   teclado e o leitor de tela continuam entendendo o que é isto.

   Nasceu dentro do `FilterBar`, e por um tempo era de lá que a paginação o
   importava. Saiu quando o formulário de cliente virou o terceiro a
   precisar dele: barra de filtros, paginação e formulário não têm por que
   depender uns dos outros para desenhar o mesmo gesto.

   DENTRO DE FORMULÁRIO (`campo: true`), o combo carrega um `<input hidden>`
   com o `name` — é ele que `formToObject` lê — e dispara `change` nele a
   cada escolha, para quem escuta um campo continuar escutando um campo.
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
   * @param {Object} campo
   * @param {string} campo.nome
   * @param {string} campo.rotulo    rótulo acessível do gatilho
   * @param {string} campo.opcoes    HTML de `<option>` (de `enums.opcoes`)
   * @param {boolean} [campo.numerico] converte o valor escolhido para número
   * @param {boolean} [campo.campo]  dentro de formulário: emite o input hidden
   * @param {string} [campo.id]      id do gatilho, para o `<label for>`
   */
  function Combo(campo) {
    var itens = lerOpcoes(campo.opcoes);
    var atual = itens.filter(function (i) { return i.selecionado; })[0] || itens[0];

    /* `numerico` existe por causa do seletor de itens por página: o valor de
       um atributo HTML é sempre string, e um `porPagina` de "15" faz o
       `slice(inicio, inicio + porPagina)` do service CONCATENAR em vez de
       somar — a lista vem vazia e ninguém entende por quê. A conversão fica
       aqui, e não em cada tela, porque quem sabe que o valor saiu de um
       atributo é o combo. */
    return '<div class="combo' + (campo.campo ? ' combo--campo' : '') + '"' +
             ' data-combo="' + esc(campo.nome) + '"' +
             (campo.numerico ? ' data-combo-numerico="1"' : '') + '>' +
             (campo.campo
               ? '<input type="hidden" name="' + esc(campo.nome) + '"' +
                 ' value="' + esc(atual ? atual.valor : '') + '">'
               : '') +
             '<button type="button" class="combo__trigger" data-action="abrir-combo"' +
               (campo.id ? ' id="' + esc(campo.id) + '"' : '') +
               (campo.desabilitado ? ' disabled' : '') +
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

  /**
   * Liga abrir, escolher, teclado e fechar.
   *
   * @param {Element}  root
   * @param {Object}   [handlers]  { aoMudar(nome, valor) } — opcional: dentro
   *                   de formulário quem escuta é o `change` do input hidden.
   */
  Combo.mount = function (root, handlers) {
    var h = handlers || {};

    App.dom.delegate(root, 'click', '[data-action="abrir-combo"]', function (evento, botao) {
      evento.preventDefault();
      evento.stopPropagation();
      var combo = botao.parentNode;
      var aberto = botao.getAttribute('aria-expanded') === 'true';
      fecharTodos(root);
      if (!aberto) abrir(combo);
    });

    App.dom.delegate(root, 'click', '.combo__item', function (evento, item) {
      evento.preventDefault();
      var combo = item.closest('.combo');
      var valor = item.dataset.comboValor;
      fecharTodos(root);
      marcarEscolhido(combo, item);

      var oculto = combo.querySelector('input[type="hidden"][name]');
      if (oculto && oculto.value !== valor) {
        oculto.value = valor;
        // Quem escuta o campo escuta `change`, como escutaria de um `<select>`.
        oculto.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (h.aoMudar) {
        h.aoMudar(combo.dataset.combo,
                  combo.dataset.comboNumerico ? Number(valor) : valor);
      }
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
      fecharTodos(root);
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
  };

  /* Registrado uma vez por carga da página — ver o porquê em `mount`. */
  var fechaForaLigado = false;

  function ligarFechaFora() {
    if (fechaForaLigado) return;
    fechaForaLigado = true;
    document.addEventListener('click', function () { fecharTodos(document); });
  }

  /**
   * Marca no gatilho a opção que acabou de ser escolhida.
   *
   * A barra de filtros NÃO é redesenhada quando um filtro muda — é o que
   * mantém de pé o campo de busca, o cursor e o foco (ver `trocarMiolo`). O
   * efeito colateral é que ninguém acertaria o combo: a tela troca só o
   * miolo, e o gatilho continuava dizendo "Todos os tipos" depois de a
   * pessoa escolher "Pessoa física".
   *
   * Quando a tela redesenha a barra inteira, este acerto é sobrescrito pelo
   * HTML novo — que já nasce com a opção certa marcada. Escrever duas vezes
   * o mesmo estado não faz mal; não escrever nenhuma vez, faz.
   */
  function marcarEscolhido(combo, item) {
    if (!combo) return;

    var rotulo = App.dom.qs('.combo__valor', combo);
    if (rotulo) rotulo.textContent = item.textContent;

    App.dom.qsa('.combo__item', combo).forEach(function (outro) {
      outro.setAttribute('aria-selected', outro === item ? 'true' : 'false');
    });
  }

  function fecharTodos(root) {
    App.dom.qsa('.combo__painel', root).forEach(function (painel) {
      painel.classList.add('u-hidden');
      painel.classList.remove('combo__painel--acima');
    });
    App.dom.qsa('.combo__trigger', root).forEach(function (gatilho) {
      gatilho.setAttribute('aria-expanded', 'false');
    });
  }

  function abrir(combo) {
    var gatilho = combo.querySelector('.combo__trigger');
    var painel = combo.querySelector('.combo__painel');
    if (!painel) return;

    painel.classList.remove('u-hidden');
    gatilho.setAttribute('aria-expanded', 'true');

    /* Dentro de um modal, o corpo rola e recorta o que passa da borda: um
       combo perto do rodapé abriria uma lista pela metade. Quando não cabe
       embaixo e cabe em cima, abre para cima.

       Sem layout — no jsdom, por exemplo — as medidas vêm zeradas e a
       condição é falsa: o padrão continua sendo abrir para baixo. */
    painel.classList.remove('combo__painel--acima');
    var recorte = containerQueRola(combo);
    if (recorte) {
      var caixaPainel = painel.getBoundingClientRect();
      var caixaGatilho = gatilho.getBoundingClientRect();
      var limite = recorte.getBoundingClientRect();
      var sobraAbaixo = limite.bottom - caixaGatilho.bottom;
      var sobraAcima = caixaGatilho.top - limite.top;
      if (caixaPainel.height > sobraAbaixo && caixaPainel.height <= sobraAcima) {
        painel.classList.add('combo__painel--acima');
      }
    }

    /* O foco vai para a opção ATUAL, e não para a primeira: quem abre um
       filtro quase sempre quer o vizinho do que já está escolhido. */
    var alvo = painel.querySelector('.combo__item[aria-selected="true"]') ||
               painel.querySelector('.combo__item');
    if (alvo) alvo.focus();
  }

  /** O ancestral que rola e portanto recorta — hoje, o corpo do modal. */
  function containerQueRola(elemento) {
    var no = elemento.parentNode;
    while (no && no.nodeType === 1) {
      if (no.classList && no.classList.contains('modal__body')) return no;
      no = no.parentNode;
    }
    return null;
  }

  Combo.lerOpcoes = lerOpcoes;
  Combo.fecharTodos = fecharTodos;

  App.components.Combo = Combo;
})(window.App = window.App || {});
