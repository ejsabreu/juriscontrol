/* ==========================================================================
   components/DocumentEditor.js — a folha de edição

   Componente de APRESENTAÇÃO, no contrato do projeto: recebe props, devolve
   string de HTML, e os listeners ficam no mount(). Quem sabe salvar é a
   página (DocumentoEditorPage); aqui só se sabe desenhar e ler o que está
   escrito.

   Dois modos, escolhidos pela extensão do documento:

     texto  .txt .md .csv .json .xml .log ...  <textarea> monoespaçado
     rico   .doc .docx .odt .rtf .html         <div contenteditable> + toolbar

   Sobre document.execCommand: está deprecado e todo mundo sabe. É também o
   único caminho para negrito/lista sem trazer uma biblioteca — e o projeto
   é zero-dependência rodando por file://. Na migração isto vira TipTap ou
   Slate, e o resto do editor (autosave, versão, storage) não muda.

   props:
     documento   registro do documento
     modo        'texto' | 'rico'
     conteudo    texto/HTML inicial
     aviso       HTML do banner honesto (opcional)
     podeFechar  mostra "Fechar aba" (só quando veio de window.open)
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  /* Cada botão é um comando do execCommand. Nada de estado próprio: o
     usuário vê o efeito no texto, não no botão. */
  var FERRAMENTAS = [
    { comando: 'bold',            icone: 'B',  titulo: 'Negrito (Ctrl+B)', classe: 'u-bold' },
    { comando: 'italic',          icone: 'I',  titulo: 'Itálico (Ctrl+I)', estilo: 'font-style:italic' },
    { comando: 'underline',       icone: 'U',  titulo: 'Sublinhado (Ctrl+U)', estilo: 'text-decoration:underline' },
    { separador: true },
    { comando: 'formatBlock',     valor: 'h1', icone: 'H1', titulo: 'Título' },
    { comando: 'formatBlock',     valor: 'h2', icone: 'H2', titulo: 'Subtítulo' },
    { comando: 'formatBlock',     valor: 'p',  icone: '¶',  titulo: 'Parágrafo normal' },
    { separador: true },
    { comando: 'insertUnorderedList', icone: '•—', titulo: 'Lista com marcadores' },
    { comando: 'insertOrderedList',   icone: '1—', titulo: 'Lista numerada' },
    { comando: 'formatBlock', valor: 'blockquote', icone: '❝', titulo: 'Citação' },
    { separador: true },
    { comando: 'undo',            icone: '↶', titulo: 'Desfazer (Ctrl+Z)' },
    { comando: 'redo',            icone: '↷', titulo: 'Refazer (Ctrl+Shift+Z)' }
  ];

  function barraFerramentas() {
    var html = '<div class="editor-doc__toolbar" role="toolbar" aria-label="Formatação">';

    FERRAMENTAS.forEach(function (f) {
      if (f.separador) {
        html += '<span class="editor-doc__toolbar-sep" aria-hidden="true"></span>';
        return;
      }
      html += '<button type="button" class="editor-doc__ferramenta' +
                (f.classe ? ' ' + f.classe : '') + '"' +
                ' data-comando="' + esc(f.comando) + '"' +
                (f.valor ? ' data-comando-valor="' + esc(f.valor) + '"' : '') +
                (f.estilo ? ' style="' + f.estilo + '"' : '') +
                ' title="' + esc(f.titulo) + '" aria-label="' + esc(f.titulo) + '">' +
                esc(f.icone) +
              '</button>';
    });

    return html + '</div>';
  }

  /**
   * "Baixar como" — a lista de formatos do Docs, menos os que este protótipo
   * não sabe produzir. Um <details> em vez de dropdown com JS: fecha sozinho
   * com Esc, funciona sem listener e não precisa de posicionamento manual.
   */
  function menuExportar() {
    var html = '<details class="editor-doc__menu" data-menu-exportar>' +
                 '<summary class="btn btn--ghost btn--sm">' +
                   '<span aria-hidden="true">⤓</span><span>Baixar como</span>' +
                 '</summary>' +
                 '<div class="editor-doc__menu-painel" role="menu">';

    App.exportar.FORMATOS.forEach(function (formato) {
      html += '<button type="button" class="editor-doc__menu-item" role="menuitem"' +
                ' data-action="exportar" data-value="' + esc(formato.id) + '">' +
                '<span class="editor-doc__menu-ext">.' + esc(formato.extensao) + '</span>' +
                '<span>' +
                  '<span class="u-sm">' + esc(formato.label) + '</span>' +
                  '<span class="u-xs u-subtle" style="display:block">' +
                    esc(formato.dica) + '</span>' +
                '</span>' +
              '</button>';
    });

    // A ausência do .docx é uma decisão, não um esquecimento — e o usuário
    // que veio do Docs procura por ele. Melhor dizer onde foi parar.
    html += '<p class="editor-doc__menu-nota u-xs u-subtle">' +
              '<strong>.docx e .odt</strong> não são gerados: são pacotes ZIP e o ' +
              'protótipo não tem biblioteca para montá-los. O <strong>.rtf</strong> ' +
              'abre no Word com a formatação preservada.' +
            '</p>';

    return html + '</div></details>';
  }

  function cabecalho(p) {
    var ui = App.components.ui;
    var doc = p.documento || {};

    return '<header class="editor-doc__barra">' +
             identidade(doc, p) +
             '<div class="editor-doc__acoes">' +
               '<span class="editor-doc__status" data-editor-status' +
                 ' role="status" aria-live="polite">Pronto para editar</span>' +
               ui.Button({ rotulo: 'Salvar', variante: 'primary', tamanho: 'sm',
                           icone: '💾', acao: 'salvar-agora',
                           titulo: 'Salvar agora (Ctrl+S) — o editor também salva sozinho' }) +
               ui.Button({ rotulo: 'Nova versão', variante: 'secondary', tamanho: 'sm',
                           icone: '⧉', acao: 'salvar-versao',
                           titulo: 'Congela o texto atual como uma nova versão do documento' }) +
               (p.variaveis
                 ? ui.Button({ rotulo: 'Variáveis', variante: 'secondary', tamanho: 'sm',
                               icone: '{ }', acao: 'alternar-variaveis',
                               titulo: 'Lista as variáveis do modelo e insere no cursor' })
                 : '') +
               menuExportar() +
               ui.Button({ rotulo: 'Ver no processo', variante: 'ghost', tamanho: 'sm',
                           icone: '←', acao: 'voltar-processo',
                           titulo: 'Abrir o processo deste documento' }) +
               (p.podeFechar
                 ? ui.Button({ rotulo: 'Fechar aba', variante: 'ghost', tamanho: 'sm',
                               icone: '✕', acao: 'fechar-aba' })
                 : '') +
             '</div>' +
           '</header>';
  }

  /** Identificação do documento no canto esquerdo da barra. */
  function identidade(doc, p) {
    return '<div class="editor-doc__identidade">' +
             '<span class="editor-doc__ext" aria-hidden="true">' +
               esc(String(doc.extensao || '?').toUpperCase()) +
             '</span>' +
             '<div class="editor-doc__titulo-bloco">' +
               '<h1 class="editor-doc__titulo u-truncate">' + esc(doc.nome) + '</h1>' +
               '<div class="u-xs u-subtle">' +
                 'v' + (doc.versao || 1) +
                 ' · ' + esc(p.modo === 'rico' ? 'editor de texto formatado' : 'editor de texto puro') +
                 (doc.processoNumero ? ' · ' + esc(doc.processoNumero) : '') +
               '</div>' +
             '</div>' +
           '</div>';
  }

  /* PAINEL DE VARIÁVEIS (F2.10, adiado de F2.7)
     Quem escreve um modelo precisa saber que variáveis existem e como se
     escrevem. Sem a lista, resta decorar 24 chaves ou digitar errado — e
     variável digitada errada não falha: sai como texto no documento
     protocolado. Por isso o painel INSERE, em vez de só documentar.

     Aparece quando `props.variaveis` é verdadeiro; quem edita um .txt
     comum não tem por que vê-lo. */
  function painelVariaveis(p) {
    if (!p.variaveis) return '';

    var catalogo = App.domain.modelos.CATALOGO;
    var grupos = {};
    catalogo.forEach(function (v) { (grupos[v.grupo] = grupos[v.grupo] || []).push(v); });

    var corpo = Object.keys(grupos).map(function (grupo) {
      return '<div class="editor-vars__grupo">' +
        '<h3 class="editor-vars__titulo">' + esc(grupo) + '</h3>' +
        grupos[grupo].map(function (v) {
          return '<button type="button" class="editor-vars__item"' +
                   ' data-inserir-variavel="' + esc(v.chave) + '"' +
                   ' title="' + esc('Inserir {{' + v.chave + '}}') + '">' +
                   '<code>' + esc(v.chave) + '</code>' +
                   '<span class="editor-vars__desc">' + esc(v.descricao) + '</span>' +
                 '</button>';
        }).join('') +
      '</div>';
    }).join('');

    var filtros = App.domain.modelos.FILTROS
      ? Object.keys(App.domain.modelos.FILTROS) : [];

    return '<aside class="editor-vars" data-editor-vars hidden' +
             ' aria-label="Variáveis disponíveis">' +
             '<p class="editor-vars__ajuda u-xs">Clique para inserir no ponto do cursor. ' +
             'O que não for preenchido no documento final aparece destacado, ' +
             '<strong>nunca some sozinho</strong>.</p>' +
             corpo +
             (filtros.length
               ? '<div class="editor-vars__grupo">' +
                   '<h3 class="editor-vars__titulo">Filtros</h3>' +
                   '<p class="editor-vars__ajuda u-xs">Escreva ' +
                     '<code>{{cliente.nome|maiuscula}}</code>. Disponíveis: ' +
                     filtros.map(esc).join(', ') + '.</p>' +
                 '</div>'
               : '') +
           '</aside>';
  }

  function folha(p) {
    if (p.modo === 'rico') {
      return '<div class="editor-doc__folha" data-editor-folha>' +
               '<div class="editor-doc__area editor-doc__area--rico" contenteditable="true"' +
                 ' role="textbox" aria-multiline="true" aria-label="Conteúdo do documento"' +
                 ' data-editor-rico spellcheck="true">' +
                 (p.conteudo || '<p><br></p>') +
               '</div>' +
             '</div>';
    }

    return '<div class="editor-doc__folha" data-editor-folha>' +
             '<textarea class="editor-doc__area editor-doc__area--texto"' +
               ' data-editor-texto spellcheck="false"' +
               ' aria-label="Conteúdo do documento">' + esc(p.conteudo || '') + '</textarea>' +
           '</div>';
  }

  function DocumentEditor(props) {
    var p = props || {};

    return '<div class="editor-doc" data-editor-doc data-modo="' + esc(p.modo || 'texto') + '">' +
             cabecalho(p) +
             (p.aviso
               ? '<div class="editor-doc__aviso" role="note">' + p.aviso + '</div>'
               : '') +
             (p.modo === 'rico' ? barraFerramentas() : '') +
             '<div class="editor-doc__corpo">' +
               folha(p) +
               painelVariaveis(p) +
             '</div>' +
             '<footer class="editor-doc__rodape u-xs u-subtle" data-editor-rodape></footer>' +
           '</div>';
  }

  /**
   * Liga o editor. Devolve a alça que a página usa para ler e mexer no
   * conteúdo — o DOM não vaza para fora daqui.
   *
   * @param {Element} raiz       container já com o HTML de DocumentEditor()
   * @param {Object}  props      { modo }
   * @param {Object}  callbacks  { aoAlterar, aoSalvar }
   * @returns {{ler, escrever, focar, status, rodape, destruir}}
   */
  DocumentEditor.mount = function (raiz, props, callbacks) {
    var p = props || {};
    var cb = callbacks || {};
    var modo = p.modo === 'rico' ? 'rico' : 'texto';

    var area = App.dom.qs(modo === 'rico' ? '[data-editor-rico]' : '[data-editor-texto]', raiz);
    var elStatus = App.dom.qs('[data-editor-status]', raiz);
    var elRodape = App.dom.qs('[data-editor-rodape]', raiz);
    var descartes = [];

    function ler() {
      if (!area) return '';
      return modo === 'rico' ? area.innerHTML : area.value;
    }

    function escrever(conteudo) {
      if (!area) return;
      if (modo === 'rico') area.innerHTML = conteudo || '<p><br></p>';
      else area.value = conteudo || '';
      atualizarRodape();
    }

    /** Contagem viva — o "9 palavras" do rodapé do Docs. */
    function atualizarRodape() {
      if (!elRodape) return;
      var texto = modo === 'rico' ? (area.textContent || '') : ler();
      var palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;

      elRodape.textContent =
        palavras + ' ' + App.format.plural(palavras, 'palavra') + ' · ' +
        texto.length + ' ' + App.format.plural(texto.length, 'caractere') +
        (modo === 'texto'
          ? ' · ' + texto.split('\n').length + ' ' +
            App.format.plural(texto.split('\n').length, 'linha')
          : '');
    }

    function aoDigitar() {
      atualizarRodape();
      if (cb.aoAlterar) cb.aoAlterar();
    }

    if (area) {
      descartes.push(escutar(area, 'input', aoDigitar));

      // Colar no modo rico: entra como texto puro. Colar de um site traz
      // <span style> e <img> que a sanitização descartaria depois — melhor
      // não prometer o que não se guarda.
      if (modo === 'rico') {
        descartes.push(escutar(area, 'paste', function (evento) {
          var transferencia = evento.clipboardData || window.clipboardData;
          if (!transferencia) return;
          evento.preventDefault();
          var texto = transferencia.getData('text/plain') || '';
          try { document.execCommand('insertText', false, texto); } catch (e) { /* ignora */ }
          aoDigitar();
        }));
      }

      // Tab dentro do textarea indenta em vez de pular para o próximo botão:
      // num .json ou .csv é o que a mão espera.
      if (modo === 'texto') {
        descartes.push(escutar(area, 'keydown', function (evento) {
          if (evento.key !== 'Tab' || evento.ctrlKey || evento.altKey) return;
          evento.preventDefault();
          var inicio = area.selectionStart;
          var fim = area.selectionEnd;
          area.value = area.value.slice(0, inicio) + '\t' + area.value.slice(fim);
          area.selectionStart = area.selectionEnd = inicio + 1;
          aoDigitar();
        }));
      }
    }

    // Toolbar do modo rico. mousedown, não click: o click chegaria depois do
    // contenteditable perder o foco e a seleção, e o comando cairia no vazio.
    App.dom.qsa('[data-comando]', raiz).forEach(function (botao) {
      descartes.push(escutar(botao, 'mousedown', function (evento) {
        evento.preventDefault();
        if (area) area.focus();
        try {
          document.execCommand(botao.dataset.comando, false,
            botao.dataset.comandoValor || null);
        } catch (e) {
          console.warn('[DocumentEditor] comando indisponível:', botao.dataset.comando);
        }
        aoDigitar();
      }));
    });

    /* Painel de variáveis (F2.10).
       mousedown, e não click, pelo mesmo motivo da toolbar: no modo rico o
       click chegaria depois de o contenteditable ter perdido a seleção, e a
       variável cairia no começo do documento em vez de no cursor. */
    var elVars = App.dom.qs('[data-editor-vars]', raiz);
    var btnVars = App.dom.qs('[data-action="alternar-variaveis"]', raiz);

    if (btnVars && elVars) {
      descartes.push(escutar(btnVars, 'click', function () {
        elVars.hidden = !elVars.hidden;
        btnVars.setAttribute('aria-expanded', String(!elVars.hidden));
      }));
    }

    App.dom.qsa('[data-inserir-variavel]', raiz).forEach(function (botao) {
      descartes.push(escutar(botao, 'mousedown', function (evento) {
        evento.preventDefault();
        inserirNoCursor('{{' + botao.dataset.inserirVariavel + '}}');
      }));
    });

    function inserirNoCursor(texto) {
      if (!area) return;
      area.focus();

      if (modo === 'rico') {
        try {
          document.execCommand('insertText', false, texto);
        } catch (e) {
          area.innerHTML += esc(texto);
        }
      } else {
        var inicio = area.selectionStart;
        var fim = area.selectionEnd;
        area.value = area.value.slice(0, inicio) + texto + area.value.slice(fim);
        area.selectionStart = area.selectionEnd = inicio + texto.length;
      }
      aoDigitar();
    }

    // Ctrl+S no documento inteiro: o atalho vale mesmo com o foco na barra.
    descartes.push(escutar(document, 'keydown', function (evento) {
      if (!(evento.ctrlKey || evento.metaKey) || String(evento.key).toLowerCase() !== 's') return;
      evento.preventDefault();
      if (cb.aoSalvar) cb.aoSalvar();
    }));

    atualizarRodape();

    return {
      ler: ler,
      escrever: escrever,
      focar: function () { if (area) area.focus(); },
      /** @param {string} texto @param {string} [tom] 'salvando'|'salvo'|'erro'|'editando' */
      status: function (texto, tom) {
        if (!elStatus) return;
        elStatus.textContent = texto;
        elStatus.className = 'editor-doc__status' +
          (tom ? ' editor-doc__status--' + tom : '');
      },
      destruir: function () {
        descartes.forEach(function (off) { off(); });
        descartes = [];
      }
    };
  };

  /** addEventListener que já devolve o seu próprio remove. */
  function escutar(alvo, evento, handler) {
    alvo.addEventListener(evento, handler);
    return function () { alvo.removeEventListener(evento, handler); };
  }

  App.components.DocumentEditor = DocumentEditor;
})(window.App = window.App || {});
