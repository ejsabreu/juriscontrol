/* ==========================================================================
   components/DocumentExplorer.js — explorador de pastas e documentos

   Um nível por vez (estilo gerenciador de arquivos), não árvore expandida:
   a pasta de um processo tem poucas dezenas de itens e o advogado navega
   por caminho ("Petições / Protocolados"), não por sanfona.

   props:
     pastas       [{ id, nome, paiId, totalDocumentos, totalSubpastas,
                     totalDocumentosRecursivo }]
     documentos   [{ id, nome, pastaId, categoria, extensao, ... }]
     pastaAtual   id da pasta aberta (null = raiz)
     caminho      [{ id, nome }] da raiz até a pasta atual
     podeEditar   bool (default true) — esconde as ações de escrita

   mount(root, {
     aoMoverDocumento(documentoId, pastaDestinoId),
     aoMoverPasta(pastaId, pastaDestinoId),
     aoSoltarArquivos(arquivos, pastaDestinoId)   // FileList do computador
   })

   Alvos de soltura (data-drop-pasta): linha de pasta, migalha do caminho e
   a linha "voltar". O valor vazio significa raiz. Os mesmos alvos aceitam
   arquivos vindos de fora do navegador — é o envio por arrasto.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  function plural(n, singular, pluralForma) {
    return n + ' ' + App.format.plural(n, singular, pluralForma);
  }

  /** Resumo do conteúdo da pasta, mostrado na linha fechada. */
  function resumoPasta(pasta) {
    var partes = [];
    if (pasta.totalSubpastas) partes.push(plural(pasta.totalSubpastas, 'pasta'));

    var docs = pasta.totalDocumentosRecursivo !== undefined
      ? pasta.totalDocumentosRecursivo : pasta.totalDocumentos;
    partes.push(plural(docs || 0, 'documento'));

    return partes.join(' · ');
  }

  function migalhas(caminho, pastaAtual) {
    var html = '<nav class="doc-crumbs" aria-label="Caminho da pasta">' +
      '<button type="button" class="doc-crumbs__item' +
        (pastaAtual ? '' : ' doc-crumbs__item--active') + '"' +
        ' data-action="abrir-pasta" data-value=""' +
        ' data-drop-pasta="" title="Raiz dos documentos do processo">' +
        '<span aria-hidden="true">🗂</span> Documentos' +
      '</button>';

    (caminho || []).forEach(function (pasta, indice) {
      var ultima = indice === caminho.length - 1;
      html += '<span class="doc-crumbs__sep" aria-hidden="true">/</span>' +
        '<button type="button" class="doc-crumbs__item' +
          (ultima ? ' doc-crumbs__item--active' : '') + '"' +
          ' data-action="abrir-pasta" data-value="' + esc(pasta.id) + '"' +
          ' data-drop-pasta="' + esc(pasta.id) + '">' +
          esc(pasta.nome) +
        '</button>';
    });

    return html + '</nav>';
  }

  function linhaVoltar(caminho) {
    // O destino é a pasta-avó: soltar aqui tira o item do nível atual.
    var destino = caminho.length > 1 ? caminho[caminho.length - 2] : null;
    var rotulo = destino ? destino.nome : 'Documentos';

    return '<div class="doc-row doc-row--up" data-drop-pasta="' + esc(destino ? destino.id : '') + '"' +
             ' data-action="abrir-pasta" data-value="' + esc(destino ? destino.id : '') + '"' +
             ' role="button" tabindex="0" title="Voltar para ' + esc(rotulo) + '">' +
             '<span class="doc-row__icon" aria-hidden="true">↰</span>' +
             '<div class="doc-row__main">' +
               '<div class="u-sm u-bold">.. voltar para ' + esc(rotulo) + '</div>' +
               '<div class="u-xs u-subtle">Arraste um item até aqui para tirá-lo desta pasta</div>' +
             '</div>' +
           '</div>';
  }

  function linhaPasta(pasta, podeEditar) {
    var ui = App.components.ui;

    return '<div class="doc-row doc-row--pasta" draggable="true"' +
             ' data-pasta-id="' + esc(pasta.id) + '"' +
             ' data-drop-pasta="' + esc(pasta.id) + '">' +
             '<span class="doc-row__icon doc-row__icon--pasta" aria-hidden="true">📁</span>' +
             '<div class="doc-row__main">' +
               '<button type="button" class="doc-row__nome"' +
                 ' data-action="abrir-pasta" data-value="' + esc(pasta.id) + '">' +
                 esc(pasta.nome) +
               '</button>' +
               '<div class="u-xs u-subtle">' + esc(resumoPasta(pasta)) + '</div>' +
             '</div>' +
             (podeEditar
               ? '<div class="doc-row__actions">' +
                   ui.Button({ rotulo: 'Mover', tamanho: 'sm', variante: 'ghost', icone: '↔',
                               acao: 'mover-pasta', valor: pasta.id,
                               titulo: 'Mover pasta para outro lugar' }) +
                   ui.Button({ rotulo: 'Renomear', tamanho: 'sm', variante: 'ghost', icone: '✎',
                               acao: 'renomear-pasta', valor: pasta.id }) +
                   ui.Button({ rotulo: 'Excluir', tamanho: 'sm', variante: 'ghost', icone: '🗑',
                               acao: 'excluir-pasta', valor: pasta.id,
                               titulo: 'Excluir a pasta — o conteúdo sobe um nível' }) +
                 '</div>'
               : '') +
           '</div>';
  }

  function linhaDocumento(doc, podeEditar) {
    var ui = App.components.ui;
    var fmt = App.format;
    var enums = App.domain.enums;

    return '<div class="doc-row doc-row--documento" draggable="true"' +
             ' data-documento-id="' + esc(doc.id) + '">' +
             '<button type="button" class="doc-row__icon doc-item__icon"' +
               ' data-action="abrir-documento" data-value="' + esc(doc.id) + '"' +
               ' title="Abrir o documento">' + esc(doc.extensao) + '</button>' +
             '<div class="doc-row__main">' +
               // O nome abre o visor: é o gesto que o usuário já espera.
               '<button type="button" class="doc-row__nome u-truncate"' +
                 ' data-action="abrir-documento" data-value="' + esc(doc.id) + '">' +
                 esc(doc.nome) +
               '</button>' +
               '<div class="u-xs u-subtle">' +
                 esc(enums.rotulo(enums.CATEGORIAS_DOCUMENTO, doc.categoria)) +
                 ' · ' + esc(fmt.bytes(doc.tamanhoBytes)) +
                 ' · v' + doc.versao +
                 ' · enviado por ' + esc(doc.uploadPor ? doc.uploadPor.nome : '—') +
                 ' em ' + esc(fmt.data(doc.uploadEm)) +
               '</div>' +
             '</div>' +
             (doc.visivelCliente
               ? ui.Badge({ rotulo: 'Visível ao cliente', variante: 'success' })
               : ui.Badge({ rotulo: 'Interno', variante: 'neutral' })) +
             '<div class="doc-row__actions">' +
               // Sempre disponível: o visor abre no próprio sistema e mostra a
               // ficha mesmo quando não há prévia do arquivo.
               ui.Button({ rotulo: 'Abrir', tamanho: 'sm', variante: 'ghost', icone: '⛶',
                           acao: 'abrir-documento', valor: doc.id,
                           titulo: 'Abrir o documento sem sair do sistema' }) +
               ui.Button({ rotulo: 'Baixar', tamanho: 'sm', variante: 'ghost', icone: '⤓',
                           acao: 'baixar-documento', valor: doc.id,
                           titulo: 'Baixar o documento' }) +
               // Só onde a edição existe de verdade: texto e texto formatado.
               // Abre em aba nova — é a única ação daqui que sai do sistema.
               (App.components.DocumentViewer.modoEdicao(doc)
                 ? ui.Button({ rotulo: 'Editar', tamanho: 'sm', variante: 'ghost', icone: '✎',
                               acao: 'editar-documento', valor: doc.id,
                               titulo: 'Editar o documento em uma nova aba' })
                 : '') +
               (podeEditar
                 ? ui.Button({ rotulo: 'Mover', tamanho: 'sm', variante: 'ghost', icone: '↔',
                               acao: 'mover-documento', valor: doc.id,
                               titulo: 'Mover documento para uma pasta' })
                 : '') +
             '</div>' +
           '</div>';
  }

  function DocumentExplorer(props) {
    var p = props || {};
    var pastaAtual = p.pastaAtual || null;
    var caminho = p.caminho || [];
    var podeEditar = p.podeEditar !== false;

    var pastas = (p.pastas || []).filter(function (pasta) {
      return (pasta.paiId || null) === pastaAtual;
    });
    var documentos = (p.documentos || []).filter(function (doc) {
      return (doc.pastaId || null) === pastaAtual;
    });

    var html = '<div class="doc-explorer" data-doc-explorer' +
                 ' data-pasta-atual="' + esc(pastaAtual || '') + '">';

    html += '<div class="doc-explorer__toolbar">' +
              migalhas(caminho, pastaAtual) +
              (podeEditar
                ? '<div class="doc-explorer__toolbar-actions">' +
                    App.components.ui.Button({
                      rotulo: 'Nova pasta', tamanho: 'sm', variante: 'secondary',
                      icone: '📁', acao: 'nova-pasta', valor: pastaAtual || ''
                    }) +
                    // Documento que nasce aqui, sem arquivo: vai direto para
                    // o editor, como o "novo documento" do Docs.
                    App.components.ui.Button({
                      rotulo: 'Novo documento', tamanho: 'sm', variante: 'secondary',
                      icone: '✎', acao: 'novo-documento', valor: pastaAtual || '',
                      titulo: 'Criar um documento em branco e escrever no editor'
                    }) +
                    App.components.ui.Button({
                      rotulo: 'Enviar documentos', tamanho: 'sm', variante: 'primary',
                      icone: '⤒', acao: 'enviar-documentos', valor: pastaAtual || ''
                    }) +
                  '</div>'
                : '') +
            '</div>';

    // A lista inteira é dropzone da pasta atual: soltar no vazio devolve o
    // item ao nível aberto (útil para tirar algo de uma subpasta).
    html += '<div class="doc-explorer__lista" data-drop-pasta="' + esc(pastaAtual || '') + '"' +
            ' data-drop-fundo="1">';

    if (pastaAtual) html += linhaVoltar(caminho);

    pastas.forEach(function (pasta) { html += linhaPasta(pasta, podeEditar); });
    documentos.forEach(function (doc) { html += linhaDocumento(doc, podeEditar); });

    if (!pastas.length && !documentos.length) {
      html += '<div class="doc-explorer__vazio">' +
                App.components.ui.EmptyState({
                  icone: pastaAtual ? '📂' : '📄',
                  titulo: pastaAtual ? 'Pasta vazia' : 'Nenhum documento anexado',
                  texto: podeEditar
                    ? 'Arraste arquivos do seu computador para cá ou use “Enviar documentos”.'
                    : 'Nenhum documento nesta pasta.',
                  acao: podeEditar
                    ? App.components.ui.Button({
                        rotulo: 'Enviar documentos', variante: 'primary', icone: '⤒',
                        acao: 'enviar-documentos', valor: pastaAtual || ''
                      })
                    : null
                }) +
              '</div>';
    }

    html += '</div>';

    if (podeEditar) {
      html += '<div class="doc-explorer__dica u-xs u-subtle">' +
                'Arraste um documento sobre uma pasta para movê-lo — pastas também podem ' +
                'ser aninhadas. Arquivos soltos do computador são enviados para a pasta ' +
                'sob o cursor.' +
              '</div>';
    }

    return html + '</div>';
  }

  /**
   * Drag & drop nativo por delegação — o mesmo desenho do KanbanBoard, então
   * sobrevive ao re-render do painel e não acumula listener.
   * @param {Element} root
   * @param {Object}  handlers { aoMoverDocumento, aoMoverPasta }
   */
  DocumentExplorer.mount = function (root, handlers) {
    var h = handlers || {};
    if (!root) return;

    var arrastando = null;   // { tipo: 'documento'|'pasta', id, origem, elemento }

    function limparRealces() {
      App.dom.qsa('.doc-row--dragover, .doc-crumbs__item--dragover, ' +
                  '.doc-explorer__lista--dragover, .doc-row--soltar-arquivo, ' +
                  '.doc-explorer__lista--soltar-arquivo', root)
        .forEach(function (el) {
          el.classList.remove('doc-row--dragover');
          el.classList.remove('doc-crumbs__item--dragover');
          el.classList.remove('doc-explorer__lista--dragover');
          el.classList.remove('doc-row--soltar-arquivo');
          el.classList.remove('doc-explorer__lista--soltar-arquivo');
        });
    }

    /** Arrasto vindo de FORA do navegador (arquivos do sistema). */
    function ehArrastoDeArquivo(evento) {
      var dt = evento.dataTransfer;
      if (!dt) return false;
      var tipos = dt.types ? Array.prototype.slice.call(dt.types) : [];
      return tipos.indexOf('Files') !== -1;
    }

    function classeRealceArquivo(alvo) {
      if (alvo.hasAttribute('data-drop-fundo')) return 'doc-explorer__lista--soltar-arquivo';
      return 'doc-row--soltar-arquivo';
    }

    function classeRealce(alvo) {
      if (alvo.classList.contains('doc-crumbs__item')) return 'doc-crumbs__item--dragover';
      if (alvo.hasAttribute('data-drop-fundo')) return 'doc-explorer__lista--dragover';
      return 'doc-row--dragover';
    }

    /** Alvo inválido: soltar a pasta sobre si mesma ou sobre a origem do item. */
    function destinoValido(alvo) {
      if (!arrastando) return false;
      var destino = alvo.getAttribute('data-drop-pasta') || null;

      if (arrastando.tipo === 'pasta' && destino === arrastando.id) return false;
      if (destino === arrastando.origem) return false;
      return true;
    }

    App.dom.delegate(root, 'dragstart', '[data-documento-id], [data-pasta-id]', function (evento, linha) {
      var ehPasta = linha.hasAttribute('data-pasta-id');
      var lista = linha.closest('[data-drop-fundo]');

      arrastando = {
        tipo: ehPasta ? 'pasta' : 'documento',
        id: ehPasta ? linha.dataset.pastaId : linha.dataset.documentoId,
        origem: lista ? (lista.getAttribute('data-drop-pasta') || null) : null,
        elemento: linha
      };
      linha.classList.add('doc-row--dragging');

      if (evento.dataTransfer) {
        evento.dataTransfer.effectAllowed = 'move';
        // Alguns navegadores só iniciam o arrasto se houver payload.
        try { evento.dataTransfer.setData('text/plain', arrastando.id); } catch (e) { /* ignora */ }
      }
    });

    App.dom.delegate(root, 'dragend', '[data-documento-id], [data-pasta-id]', function (evento, linha) {
      linha.classList.remove('doc-row--dragging');
      limparRealces();
      arrastando = null;
    });

    App.dom.delegate(root, 'dragover', '[data-drop-pasta]', function (evento, alvo) {
      // Arquivo do computador: aceita em qualquer alvo, sem item interno.
      if (!arrastando) {
        if (!h.aoSoltarArquivos || !ehArrastoDeArquivo(evento)) return;
        evento.preventDefault();
        if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'copy';
        limparRealces();
        alvo.classList.add(classeRealceArquivo(alvo));
        return;
      }

      evento.preventDefault();   // sem isso o navegador recusa o drop
      if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'move';

      limparRealces();
      if (destinoValido(alvo)) alvo.classList.add(classeRealce(alvo));
    });

    App.dom.delegate(root, 'dragleave', '[data-drop-pasta]', function (evento, alvo) {
      // Não limpa ao apenas cruzar um filho do próprio alvo.
      if (alvo.contains(evento.relatedTarget)) return;
      alvo.classList.remove(classeRealce(alvo));
      alvo.classList.remove(classeRealceArquivo(alvo));
    });

    App.dom.delegate(root, 'drop', '[data-drop-pasta]', function (evento, alvo) {
      evento.preventDefault();
      evento.stopPropagation();   // a linha ganha do fundo da lista
      limparRealces();

      if (!arrastando) {
        // Envio por arrasto: o destino é a pasta sob o cursor.
        var dt = evento.dataTransfer;
        var arquivos = dt && dt.files ? Array.prototype.slice.call(dt.files) : [];
        if (arquivos.length && h.aoSoltarArquivos) {
          h.aoSoltarArquivos(arquivos, alvo.getAttribute('data-drop-pasta') || null);
        }
        return;
      }

      var item = arrastando;
      arrastando = null;
      if (item.elemento) item.elemento.classList.remove('doc-row--dragging');

      var destino = alvo.getAttribute('data-drop-pasta') || null;
      if (destino === item.origem) return;                              // mesmo lugar
      if (item.tipo === 'pasta' && destino === item.id) return;         // sobre si mesma

      if (item.tipo === 'pasta') {
        if (h.aoMoverPasta) h.aoMoverPasta(item.id, destino);
      } else if (h.aoMoverDocumento) {
        h.aoMoverDocumento(item.id, destino);
      }
    });

    // A linha "voltar" também responde ao teclado (é role=button).
    App.dom.delegate(root, 'keydown', '.doc-row--up', function (evento, linha) {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      evento.preventDefault();
      linha.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  App.components.DocumentExplorer = DocumentExplorer;
})(window.App = window.App || {});
