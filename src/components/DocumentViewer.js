/* ==========================================================================
   components/DocumentViewer.js — visor de documento DENTRO do sistema

   O usuário nunca sai da aplicação para ver um documento: nada de nova aba,
   nada de download obrigatório. O visor abre no corpo de um Modal e tem duas
   metades:

     1. QUADRO — a prévia, quando o binário está na sessão (ver arquivoService)
     2. FICHA  — os metadados, que existem sempre

   Como o protótipo só tem binário do que foi enviado na sessão, a ficha é a
   parte que nunca falha. Ela é útil por si: categoria, versão, pasta, quem
   enviou, quando, e se o cliente vê no portal.

   Quando o documento JÁ FOI EDITADO no editor interno (conteudoService), é
   esse texto que o quadro mostra — não o binário original. O visor tem que
   refletir a última versão, senão o usuário edita numa aba e continua vendo
   o conteúdo antigo na outra.

   props:
     documento  registro enriquecido (uploadPor, pastaNome, ...)
     url        object URL do binário, ou null
     tipoPrevia 'imagem' | 'pdf' | 'texto' | 'rico' | 'sem-previa'

   mount(corpo, { documento, arquivo }) — preenche a prévia de texto, que é
   assíncrona quando vem do FileReader. As outras são declarativas no HTML.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  function esc(v) { return App.dom.esc(v); }

  var EXTENSOES_IMAGEM = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];
  var EXTENSOES_TEXTO  = ['txt', 'csv', 'md', 'json', 'xml', 'log', 'html', 'htm'];

  /* Formatos de texto FORMATADO. O navegador não lê o binário de um .docx
     (ZIP com XML dentro) sem biblioteca, e o projeto é zero-dependência —
     por isso eles editam em modo rico sobre o conteúdo do próprio sistema,
     com o aviso correspondente na tela do editor. */
  var EXTENSOES_RICAS = ['doc', 'docx', 'odt', 'rtf'];

  function conteudos() { return App.services.conteudoService; }

  /**
   * O conteúdo editado deste documento — só quando há texto de verdade.
   * Registro em branco (o editor cria um ao abrir) não vira prévia: o quadro
   * de "documento em branco" diz mais do que uma folha vazia.
   */
  function editado(documento) {
    var doc = documento || {};
    if (!doc.id || !conteudos()) return null;

    var registro = conteudos().ler(doc.id);
    return conteudos().temTexto(registro) ? registro : null;
  }

  /**
   * Em que modo este documento pode ser editado — null quando não pode.
   * É o que decide se o botão "Editar" aparece.
   * @returns {'texto'|'rico'|null}
   */
  function modoEdicao(documento) {
    var doc = documento || {};
    var mime = String(doc.tipoMime || '').toLowerCase();
    var ext = String(doc.extensao || '').toLowerCase();

    if (EXTENSOES_RICAS.indexOf(ext) !== -1) return 'rico';
    if (mime.indexOf('wordprocessing') !== -1 || mime === 'application/msword') return 'rico';

    if (EXTENSOES_TEXTO.indexOf(ext) !== -1) return 'texto';
    if (mime.indexOf('text/') === 0 || mime.indexOf('json') !== -1) return 'texto';

    return null;
  }

  /** Que tipo de prévia este documento admite. */
  function tipoPrevia(documento, temBinario) {
    // O texto editado no sistema vale mais que o binário: é a versão nova.
    var salvo = editado(documento);
    if (salvo) return salvo.modo === 'rico' ? 'rico' : 'texto';

    if (!temBinario) return 'sem-previa';

    var mime = String(documento.tipoMime || '').toLowerCase();
    var ext = String(documento.extensao || '').toLowerCase();

    if (mime.indexOf('image/') === 0 || EXTENSOES_IMAGEM.indexOf(ext) !== -1) return 'imagem';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mime.indexOf('text/') === 0 || mime.indexOf('json') !== -1 ||
        EXTENSOES_TEXTO.indexOf(ext) !== -1) return 'texto';

    return 'sem-previa';
  }

  function quadro(props) {
    var p = props || {};
    var doc = p.documento || {};
    var tipo = p.tipoPrevia || 'sem-previa';

    if (tipo === 'imagem' && p.url) {
      return '<div class="doc-visor__quadro doc-visor__quadro--imagem">' +
               '<img src="' + esc(p.url) + '" alt="' + esc(doc.nome) + '">' +
             '</div>';
    }

    if (tipo === 'pdf' && p.url) {
      return '<div class="doc-visor__quadro">' +
               '<iframe src="' + esc(p.url) + '" title="Prévia de ' + esc(doc.nome) + '"></iframe>' +
             '</div>';
    }

    if (tipo === 'rico') {
      // Já sanitizado na gravação; sanitiza de novo na exibição porque o
      // storage é editável por fora do sistema.
      var salvoRico = editado(doc);
      var corpoRico = conteudos().sanitizarHtml(salvoRico ? salvoRico.conteudo : '');

      return '<div class="doc-visor__quadro doc-visor__quadro--texto">' +
               '<div class="doc-visor__rico">' +
                 (corpoRico.replace(/<[^>]*>/g, '').trim()
                   ? corpoRico
                   : '<p class="u-sm u-subtle">Documento aberto no editor, ainda sem texto.</p>') +
               '</div>' +
             '</div>';
    }

    if (tipo === 'texto') {
      // Preenchido no mount() — a leitura do arquivo é assíncrona.
      return '<div class="doc-visor__quadro doc-visor__quadro--texto" data-visor-texto>' +
               '<p class="u-sm u-subtle">Carregando prévia…</p>' +
             '</div>';
    }

    // Documento que nasceu no sistema e ainda não foi escrito: dizer que
    // "o arquivo existiria no backend" seria falso — arquivo nenhum existe.
    if (doc.criadoNoEditor) {
      return '<div class="doc-visor__quadro doc-visor__quadro--vazio">' +
               '<div class="doc-visor__vazio-icone" aria-hidden="true">' +
                 esc(String(doc.extensao || '').toUpperCase()) +
               '</div>' +
               '<p class="u-sm u-bold">Documento em branco</p>' +
               '<p class="u-xs u-subtle doc-visor__vazio-texto">' +
                 'Criado no sistema e ainda sem uma linha escrita. Use <strong>Editar</strong> ' +
                 'para abrir o editor e começar.' +
               '</p>' +
             '</div>';
    }

    // Sem binário (o caso da maioria: o protótipo guarda só metadados) ou
    // formato sem prévia possível no navegador.
    return '<div class="doc-visor__quadro doc-visor__quadro--vazio">' +
             '<div class="doc-visor__vazio-icone" aria-hidden="true">' +
               (doc.extensao ? esc(String(doc.extensao).toUpperCase()) : '📄') +
             '</div>' +
             '<p class="u-sm u-bold">Prévia não disponível</p>' +
             '<p class="u-xs u-subtle doc-visor__vazio-texto">' +
               (p.url
                 ? 'Este formato não tem visualização no navegador. Os dados do ' +
                   'documento estão abaixo.'
                 : 'O protótipo guarda apenas os metadados deste documento — o arquivo ' +
                   'em si existiria no storage do backend. Envie um arquivo pela aba ' +
                   'Documentos para ver a prévia funcionando.') +
             '</p>' +
           '</div>';
  }

  function ficha(documento) {
    var doc = documento || {};
    var fmt = App.format;
    var enums = App.domain.enums;

    function item(termo, descricao) {
      return '<div>' +
               '<div class="def-list__term">' + esc(termo) + '</div>' +
               '<div class="def-list__desc">' + (descricao || '—') + '</div>' +
             '</div>';
    }

    return '<div class="def-list doc-visor__ficha">' +
      item('Nome do arquivo', '<span class="u-truncate">' + esc(doc.nome) + '</span>') +
      item('Categoria', esc(enums.rotulo(enums.CATEGORIAS_DOCUMENTO, doc.categoria, 'Outro'))) +
      item('Pasta', doc.pastaNome
            ? esc(doc.pastaNome)
            : '<span class="u-subtle">Raiz dos documentos</span>') +
      item('Formato', esc(String(doc.extensao || '—').toUpperCase()) +
            (doc.tipoMime ? ' <span class="u-xs u-subtle">' + esc(doc.tipoMime) + '</span>' : '')) +
      item('Tamanho', esc(fmt.bytes(doc.tamanhoBytes))) +
      item('Versão', 'v' + (doc.versao || 1)) +
      item('Enviado por', doc.uploadPor
            ? App.components.ui.Avatar({ usuario: doc.uploadPor, tamanho: 'sm' }) +
              ' <span style="vertical-align:middle">' + esc(doc.uploadPor.nome) + '</span>'
            : '—') +
      item('Enviado em', esc(fmt.data(doc.uploadEm)) +
            ' <span class="u-xs u-subtle">(' + esc(fmt.dataRelativa(doc.uploadEm)) + ')</span>') +
      (doc.editadoEm
        ? item('Editado no sistema',
            esc(fmt.dataHora(doc.editadoEm)) +
            (doc.editadoPorNome
              ? ' <span class="u-xs u-subtle">por ' + esc(doc.editadoPorNome) + '</span>'
              : ''))
        : '') +
      item('Portal do cliente', doc.visivelCliente
            ? App.components.ui.Badge({ rotulo: 'Visível ao cliente', variante: 'success' })
            : App.components.ui.Badge({ rotulo: 'Interno', variante: 'neutral' })) +
    '</div>';
  }

  function DocumentViewer(props) {
    var p = props || {};

    return '<div class="doc-visor" data-doc-visor>' +
             quadro(p) +
             '<h4 class="doc-visor__titulo">Dados do documento</h4>' +
             ficha(p.documento) +
           '</div>';
  }

  /**
   * Prévia de texto: do conteúdo editado quando existe (síncrono), senão do
   * próprio File — sem rede e sem sair da página.
   * @param {Element} corpo  corpo do modal
   * @param {Object}  props  { documento, arquivo }
   */
  DocumentViewer.mount = function (corpo, props) {
    var p = props || {};
    var destino = App.dom.qs('[data-visor-texto]', corpo);
    if (!destino) return;

    var salvo = editado(p.documento);
    if (salvo) {
      pintarTexto(destino, salvo.conteudo,
        'Este é o texto editado no sistema, não o arquivo enviado.');
      return;
    }

    if (!p.arquivo || typeof window.FileReader === 'undefined') {
      destino.innerHTML = '<p class="u-sm u-subtle">Prévia de texto indisponível.</p>';
      return;
    }

    var leitor = new window.FileReader();

    leitor.onload = function () {
      pintarTexto(destino, String(leitor.result || ''), null);
    };

    leitor.onerror = function () {
      destino.innerHTML = '<p class="u-sm u-subtle">Não foi possível ler o arquivo.</p>';
    };

    leitor.readAsText(p.arquivo);
  };

  var LIMITE_CARACTERES = 20000;   // trecho basta; o visor não é o editor

  function pintarTexto(destino, texto, nota) {
    var conteudo = String(texto || '');

    if (!conteudo.trim()) {
      destino.innerHTML = '<p class="u-sm u-subtle">Documento em branco.</p>';
      return;
    }

    var cortado = conteudo.length > LIMITE_CARACTERES;

    destino.innerHTML = '<pre class="doc-visor__texto">' +
        esc(conteudo.slice(0, LIMITE_CARACTERES)) + '</pre>' +
      (cortado ? '<p class="u-xs u-subtle">Exibindo os primeiros ' +
                 LIMITE_CARACTERES.toLocaleString('pt-BR') + ' caracteres.</p>' : '') +
      (nota ? '<p class="u-xs u-subtle">' + esc(nota) + '</p>' : '');
  }

  /**
   * A mesma ficha em texto puro. É o que o download entrega quando o
   * documento não tem binário — melhor devolver a identidade do documento do
   * que um arquivo falso com o nome de uma procuração de verdade.
   */
  DocumentViewer.fichaTexto = function (documento) {
    var doc = documento || {};
    var fmt = App.format;
    var enums = App.domain.enums;

    return [
      'JurisControl — ficha do documento',
      '',
      'Nome do arquivo : ' + (doc.nome || '—'),
      'Categoria       : ' + enums.rotulo(enums.CATEGORIAS_DOCUMENTO, doc.categoria, 'Outro'),
      'Pasta           : ' + (doc.pastaNome || 'Raiz dos documentos'),
      'Formato         : ' + String(doc.extensao || '—').toUpperCase() +
                             (doc.tipoMime ? ' (' + doc.tipoMime + ')' : ''),
      'Tamanho         : ' + fmt.bytes(doc.tamanhoBytes),
      'Versão          : v' + (doc.versao || 1),
      'Enviado por     : ' + (doc.uploadPor ? doc.uploadPor.nome : '—'),
      'Enviado em      : ' + fmt.data(doc.uploadEm),
      'Portal cliente  : ' + (doc.visivelCliente ? 'visível ao cliente' : 'interno'),
      '',
      'O arquivo em si não acompanha esta ficha: este é um protótipo sem',
      'backend e o binário existiria no storage do servidor. Documentos',
      'enviados na sessão atual baixam normalmente, com o conteúdo real —',
      'e documentos escritos no editor interno baixam o texto editado.'
    ].join('\n');
  };

  DocumentViewer.tipoPrevia = tipoPrevia;
  DocumentViewer.modoEdicao = modoEdicao;
  DocumentViewer.EXTENSOES_TEXTO = EXTENSOES_TEXTO;
  DocumentViewer.EXTENSOES_RICAS = EXTENSOES_RICAS;

  App.components.DocumentViewer = DocumentViewer;
})(window.App = window.App || {});
