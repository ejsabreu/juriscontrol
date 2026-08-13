/* ==========================================================================
   utils/exportar.js — o documento sai do sistema

   O editor guarda duas coisas diferentes: texto puro (uma string) ou texto
   formatado (HTML da whitelist do conteudoService). Daqui saem os arquivos
   que o usuário leva embora.

   O QUE É GERADO DE VERDADE e o que não é — a lista importa, porque o
   projeto não entrega arquivo com extensão mentirosa:

     .txt .md .html .rtf   gerados aqui, byte a byte
     .pdf                  pelo diálogo de impressão do navegador
                           ("Salvar como PDF"), que é quem sabe fazer PDF
     .docx .odt            NÃO. São ZIP com XML dentro e o protótipo é
                           zero-dependência — renomear um HTML para .docx
                           daria um arquivo que o Word abre torto ou recusa

   O RTF cobre a lacuna do .docx melhor do que um .docx falso cobriria: é
   formato de texto puro, abre no Word com negrito, títulos e listas
   preservados, e é o que o próprio Google Docs oferece na lista de export.

   Na migração isto vira responsabilidade do backend (LibreOffice headless,
   pandoc, o que for) — e aí .docx e .odt entram na lista sem asterisco.
   ========================================================================== */

(function (App) {
  'use strict';

  /** Formatos oferecidos no menu "Baixar como". */
  var FORMATOS = [
    { id: 'txt',  label: 'Texto sem formatação', extensao: 'txt',
      mime: 'text/plain',  dica: 'Só o texto, sem nenhuma formatação' },
    { id: 'md',   label: 'Markdown', extensao: 'md',
      mime: 'text/markdown', dica: 'Títulos, negrito e listas em marcação de texto' },
    { id: 'html', label: 'Página da web', extensao: 'html',
      mime: 'text/html',   dica: 'Abre no navegador e também no Word' },
    { id: 'rtf',  label: 'Rich Text Format', extensao: 'rtf',
      mime: 'application/rtf', dica: 'Formatação preservada, abre no Word e no LibreOffice' },
    { id: 'pdf',  label: 'PDF', extensao: 'pdf',
      mime: null, dica: 'Pelo diálogo de impressão: escolha "Salvar como PDF"' }
  ];

  function esc(v) { return App.dom.esc(v); }

  /** O HTML do modo rico virado em árvore, já sanitizado. */
  function arvore(html) {
    var molde = document.createElement('template');
    molde.innerHTML = App.services.conteudoService.sanitizarHtml(html || '');
    return molde.content || molde;
  }

  /** O texto de dentro de um bloco, com <br> virando quebra de linha. */
  function textoInterno(no) {
    var texto = '';
    Array.prototype.slice.call(no.childNodes || []).forEach(function (filho) {
      if (filho.nodeType === 3) { texto += filho.nodeValue.replace(/\s+/g, ' '); return; }
      if (filho.nodeType !== 1) return;
      texto += filho.tagName === 'BR' ? '\n' : textoInterno(filho);
    });
    return texto;
  }

  // --- Texto puro -----------------------------------------------------------

  /** HTML → texto: um parágrafo por bloco, listas com marcador. */
  function htmlParaTexto(html) {
    var partes = [];

    function bloco(no, tipoLista) {
      var indice = 0;

      Array.prototype.slice.call(no.childNodes || []).forEach(function (filho) {
        if (filho.nodeType === 3) {
          if (filho.nodeValue.trim()) partes.push(filho.nodeValue.trim());
          return;
        }
        if (filho.nodeType !== 1) return;

        if (filho.tagName === 'UL' || filho.tagName === 'OL') {
          bloco(filho, filho.tagName);
          return;
        }

        if (filho.tagName === 'LI') {
          indice++;
          var marcador = tipoLista === 'OL' ? indice + '. ' : '• ';
          partes.push(marcador + textoInterno(filho).trim());
          return;
        }

        var texto = textoInterno(filho).trim();
        if (texto) partes.push(texto);
      });
    }

    bloco(arvore(html), null);
    return partes.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // --- Markdown -------------------------------------------------------------

  var MARCAS = { B: '**', STRONG: '**', I: '*', EM: '*', U: '' };

  function htmlParaMarkdown(html) {
    var partes = [];

    function inline(no) {
      var texto = '';
      Array.prototype.slice.call(no.childNodes || []).forEach(function (filho) {
        if (filho.nodeType === 3) { texto += filho.nodeValue.replace(/\s+/g, ' '); return; }
        if (filho.nodeType !== 1) return;
        if (filho.tagName === 'BR') { texto += '  \n'; return; }

        var marca = MARCAS[filho.tagName];
        var dentro = inline(filho);
        if (filho.tagName === 'A') {
          texto += '[' + dentro + '](' + (filho.getAttribute('href') || '') + ')';
        } else if (marca) {
          texto += dentro.trim() ? marca + dentro.trim() + marca : dentro;
        } else {
          texto += dentro;
        }
      });
      return texto;
    }

    function bloco(no, dentroDeLista) {
      Array.prototype.slice.call(no.childNodes || []).forEach(function (filho) {
        if (filho.nodeType === 3) {
          if (filho.nodeValue.trim()) partes.push(filho.nodeValue.trim());
          return;
        }
        if (filho.nodeType !== 1) return;

        switch (filho.tagName) {
          case 'H1': partes.push('# ' + inline(filho).trim()); break;
          case 'H2': partes.push('## ' + inline(filho).trim()); break;
          case 'H3': partes.push('### ' + inline(filho).trim()); break;
          case 'BLOCKQUOTE': partes.push('> ' + inline(filho).trim()); break;
          case 'UL':
          case 'OL': bloco(filho, filho.tagName); break;
          case 'LI':
            partes.push((dentroDeLista === 'OL' ? '1. ' : '- ') + inline(filho).trim());
            break;
          case 'P':
          case 'DIV': {
            var t = inline(filho).trim();
            if (t) partes.push(t);
            break;
          }
          default: {
            var solto = inline(filho).trim();
            if (solto) partes.push(solto);
          }
        }
      });
    }

    bloco(arvore(html), null);
    return partes.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // --- RTF ------------------------------------------------------------------

  /* Escape do RTF: as três chaves de controle e tudo que não é ASCII, que
     vira \uNNNN? — o '?' é o caractere de reposição anunciado pelo \uc1 do
     cabeçalho, e é o que um leitor antigo mostra no lugar do acento. */
  function escaparRtf(texto) {
    var saida = '';
    var s = String(texto || '');

    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      var ch = s[i];

      if (ch === '\\' || ch === '{' || ch === '}') saida += '\\' + ch;
      else if (ch === '\n') saida += '\\par\n';
      else if (c < 128) saida += ch;
      else saida += '\\u' + c + '?';
    }
    return saida;
  }

  var CABECALHO_RTF =
    '{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0' +
    '{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}' +
    '\\viewkind4\\pard\\f0\\fs24 ';

  function htmlParaRtf(html, titulo) {
    var corpo = '';

    function inline(no) {
      var texto = '';
      Array.prototype.slice.call(no.childNodes || []).forEach(function (filho) {
        if (filho.nodeType === 3) { texto += escaparRtf(filho.nodeValue.replace(/\s+/g, ' ')); return; }
        if (filho.nodeType !== 1) return;
        if (filho.tagName === 'BR') { texto += '\\line '; return; }

        var dentro = inline(filho);
        if (filho.tagName === 'B' || filho.tagName === 'STRONG') texto += '{\\b ' + dentro + '}';
        else if (filho.tagName === 'I' || filho.tagName === 'EM') texto += '{\\i ' + dentro + '}';
        else if (filho.tagName === 'U') texto += '{\\ul ' + dentro + '}';
        else texto += dentro;
      });
      return texto;
    }

    /** Um parágrafo RTF, com o tamanho de fonte do nível. */
    function paragrafo(conteudo, opcoes) {
      var o = opcoes || {};
      if (!conteudo.trim()) return;
      corpo += '\\pard' + (o.recuo ? '\\li360' : '') +
               (o.tamanho ? '\\fs' + o.tamanho : '\\fs24') +
               (o.negrito ? '\\b' : '') + ' ' +
               (o.marcador || '') + conteudo + (o.negrito ? '\\b0' : '') + '\\par\n';
    }

    function bloco(no, tipoLista) {
      Array.prototype.slice.call(no.childNodes || []).forEach(function (filho) {
        if (filho.nodeType === 3) {
          if (filho.nodeValue.trim()) paragrafo(escaparRtf(filho.nodeValue.trim()));
          return;
        }
        if (filho.nodeType !== 1) return;

        switch (filho.tagName) {
          case 'H1': paragrafo(inline(filho), { tamanho: 36, negrito: true }); break;
          case 'H2': paragrafo(inline(filho), { tamanho: 30, negrito: true }); break;
          case 'H3': paragrafo(inline(filho), { tamanho: 26, negrito: true }); break;
          case 'BLOCKQUOTE': paragrafo('{\\i ' + inline(filho) + '}', { recuo: true }); break;
          case 'UL':
          case 'OL': bloco(filho, filho.tagName); break;
          case 'LI':
            // Marcador literal: lista numerada de verdade em RTF exige tabela
            // \listtable, e o ganho não paga a complexidade num protótipo.
            paragrafo(inline(filho), {
              recuo: true,
              marcador: tipoLista === 'OL' ? '\\u8211?\\tab ' : '\\u8226?\\tab '
            });
            break;
          case 'P':
          case 'DIV': paragrafo(inline(filho)); break;
          default: paragrafo(inline(filho));
        }
      });
    }

    if (titulo) paragrafo(escaparRtf(titulo), { tamanho: 36, negrito: true });
    bloco(arvore(html), null);

    return CABECALHO_RTF + corpo + '}';
  }

  /** Texto puro → RTF: cada linha é um parágrafo, em monoespaçada. */
  function textoParaRtf(texto) {
    return '{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0' +
           '{\\fonttbl{\\f0\\fmodern\\fcharset0 Courier New;}}' +
           '\\viewkind4\\pard\\f0\\fs20 ' + escaparRtf(texto) + '}';
  }

  // --- HTML -----------------------------------------------------------------

  /** Documento HTML completo e autossuficiente — sem CSS externo. */
  function documentoHtml(titulo, corpo, monoespacado) {
    return [
      '<!DOCTYPE html>',
      '<html lang="pt-BR">',
      '<head>',
      '<meta charset="UTF-8">',
      '<title>' + esc(titulo || 'Documento') + '</title>',
      '<style>',
      'body{font-family:' + (monoespacado ? 'Consolas,monospace' : 'Georgia,serif') + ';',
      'max-width:46em;margin:3em auto;padding:0 1.5em;line-height:1.7;color:#1a1a1a}',
      'blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:1em;color:#555}',
      'pre{white-space:pre-wrap;word-break:break-word}',
      '@page{margin:2cm}',
      '</style>',
      '</head>',
      '<body>',
      corpo || '',
      '</body>',
      '</html>'
    ].join('\n');
  }

  // --- Ponto de entrada -----------------------------------------------------

  /**
   * Converte o conteúdo do editor para o formato pedido.
   *
   * @param {string} formatoId  'txt' | 'md' | 'html' | 'rtf'
   * @param {Object} dados      { nome, modo: 'texto'|'rico', conteudo }
   * @returns {{nome, mime, texto}|null}  null para 'pdf' (ver imprimir())
   */
  function gerar(formatoId, dados) {
    var formato = FORMATOS.filter(function (f) { return f.id === formatoId; })[0];
    if (!formato || formato.id === 'pdf') return null;

    var d = dados || {};
    var ehRico = d.modo === 'rico';
    var conteudo = d.conteudo || '';
    var base = String(d.nome || 'documento').replace(/\.[^.]+$/, '');
    var texto;

    switch (formato.id) {
      case 'txt':
        texto = ehRico ? htmlParaTexto(conteudo) : conteudo;
        break;
      case 'md':
        texto = ehRico ? htmlParaMarkdown(conteudo) : conteudo;
        break;
      case 'html':
        texto = ehRico
          ? documentoHtml(base, App.services.conteudoService.sanitizarHtml(conteudo), false)
          : documentoHtml(base, '<pre>' + esc(conteudo) + '</pre>', true);
        break;
      case 'rtf':
        texto = ehRico ? htmlParaRtf(conteudo, null) : textoParaRtf(conteudo);
        break;
      default:
        return null;
    }

    return { nome: base + '.' + formato.extensao, mime: formato.mime, texto: texto };
  }

  /**
   * Baixa o documento no formato pedido.
   * @returns {Promise<{ok, nome}>}
   */
  function baixar(formatoId, dados) {
    if (formatoId === 'pdf') {
      var abriu = imprimir(dados);
      return Promise.resolve({ ok: abriu, nome: null, impressao: true });
    }

    var arquivo = gerar(formatoId, dados);
    if (!arquivo) return Promise.resolve({ ok: false });

    return App.dom.baixar(arquivo.nome,
      'data:' + arquivo.mime + ';charset=utf-8,' + encodeURIComponent(arquivo.texto)
    ).then(function (ok) {
      return { ok: ok, nome: arquivo.nome };
    });
  }

  /**
   * PDF pelo caminho honesto: monta o documento num iframe fora da tela e
   * chama o diálogo de impressão, onde "Salvar como PDF" já existe em todo
   * navegador. Escrever um gerador de PDF à mão daria um arquivo pior.
   *
   * @returns {boolean} false = o navegador não deixou imprimir
   */
  function imprimir(dados) {
    var d = dados || {};
    var arquivo = gerar('html', d);
    if (!arquivo) return false;

    var quadro = document.createElement('iframe');
    quadro.setAttribute('aria-hidden', 'true');
    quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(quadro);

    try {
      var doc = quadro.contentWindow.document;
      doc.open();
      doc.write(arquivo.texto);
      doc.close();

      quadro.contentWindow.focus();
      quadro.contentWindow.print();
    } catch (e) {
      console.warn('[exportar] Não foi possível imprimir:', e.message);
      quadro.remove();
      return false;
    }

    // O print() é bloqueante na maioria dos navegadores, mas não em todos —
    // a folga evita descartar o iframe antes de o diálogo ler o conteúdo.
    setTimeout(function () { quadro.remove(); }, 1000);
    return true;
  }

  App.exportar = {
    FORMATOS: FORMATOS,
    gerar: gerar,
    baixar: baixar,
    imprimir: imprimir,
    documentoHtml: documentoHtml,
    htmlParaTexto: htmlParaTexto,
    htmlParaMarkdown: htmlParaMarkdown,
    htmlParaRtf: htmlParaRtf
  };
})(window.App = window.App || {});
