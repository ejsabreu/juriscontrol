/* ==========================================================================
   services/conteudoService.js — o conteúdo EDITÁVEL do documento

   Três coisas diferentes convivem no protótipo e é fácil confundi-las:

     db (localStorage) ....... METADADOS do documento — nome, versão, pasta
     arquivoService (memória)  BINÁRIO enviado nesta aba, morre no reload
     conteudoService (aqui) .. TEXTO editado pelo usuário, persistido

   Este módulo existe porque o editor abre em OUTRA ABA. Uma aba nova nasce
   com o arquivoService vazio — o binário não atravessa. O texto, sim: fica
   no localStorage, sob chave própria, e as duas abas leem do mesmo lugar.

   Por que chave separada (e não um campo no db):
     - o JSON do banco é reescrito inteiro a cada insert/update; carregar
       parágrafos de petição junto com 40 processos a cada gravação é caro;
     - subir a versão do schema do db descarta o banco e regeraria o seed —
       levando junto o que o usuário escreveu. Aqui o texto sobrevive.

   O que é honesto dizer: isto NÃO reescreve o arquivo original. Um .docx
   continua o .docx que foi enviado; o que se guarda aqui é a versão
   editável do registro, e a tela avisa isso ao usuário.

   Na migração este módulo DESAPARECE junto com o arquivoService: o conteúdo
   vira uma coluna (ou um objeto no storage) do backend e o editor passa a
   fazer PATCH /api/documentos/:id/conteudo.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  var CHAVE = 'jurisctrl.conteudo.v1';

  /* Teto por documento. A cota do localStorage é de ~5 MB para TUDO (banco
     incluso); 500 KB de texto é uma petição longuíssima e ainda deixa folga
     para dezenas de documentos. */
  var LIMITE_BYTES = 500 * 1024;

  var memoria = null;        // espelho em memória — a fonte de leitura
  var suportaStorage = null;
  var observadores = [];
  var ligadoAoStorage = false;

  function testarStorage() {
    if (suportaStorage !== null) return suportaStorage;
    try {
      window.localStorage.setItem('__teste_conteudo__', '1');
      window.localStorage.removeItem('__teste_conteudo__');
      suportaStorage = true;
    } catch (e) {
      suportaStorage = false;
    }
    return suportaStorage;
  }

  /**
   * Sem localStorage não há como a aba do editor ler o que esta aba gravou.
   * Quem chama usa isto para decidir entre abrir nova aba ou editar aqui
   * mesmo — melhor uma aba a menos que um editor em branco.
   */
  function suportado() {
    return testarStorage();
  }

  function carregar() {
    if (!testarStorage()) return {};
    try {
      var bruto = window.localStorage.getItem(CHAVE);
      return bruto ? (JSON.parse(bruto) || {}) : {};
    } catch (e) {
      console.warn('[conteudoService] Não foi possível ler o storage:', e.message);
      return {};
    }
  }

  function garantir() {
    if (!memoria) memoria = carregar();
    return memoria;
  }

  /** Tamanho em bytes UTF-8 — é o que vai para tamanhoBytes do documento. */
  function bytes(texto) {
    var s = String(texto || '');
    if (typeof window.TextEncoder === 'function') {
      try { return new window.TextEncoder().encode(s).length; } catch (e) { /* abaixo */ }
    }
    // Contagem manual: o jsdom antigo e navegadores sem TextEncoder caem aqui.
    var total = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) total += 1;
      else if (c < 0x800) total += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { total += 4; i++; }   // par surrogate
      else total += 3;
    }
    return total;
  }

  // --- Sanitização do modo rico ---------------------------------------------

  /* O resto do projeto escapa tudo com App.dom.esc antes de virar markup. O
     modo rico é a única exceção possível — um editor de negrito e listas
     precisa guardar tags. A troca justa é uma whitelist: o que não está
     aqui não sobrevive nem à gravação nem à exibição. */
  var TAGS_PERMITIDAS = ['P', 'BR', 'DIV', 'B', 'STRONG', 'I', 'EM', 'U', 'S',
                         'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A'];

  /**
   * Devolve o HTML só com as tags e atributos permitidos.
   * Usa o parser do próprio navegador (nada de regex em HTML) e trabalha
   * num nó solto — imagens e scripts não chegam a existir na página.
   */
  function sanitizarHtml(html) {
    var sujo = String(html || '');
    if (!sujo) return '';

    var molde;
    try {
      // <template> é inerte: nada lá dentro executa nem baixa recurso.
      molde = document.createElement('template');
      molde.innerHTML = sujo;
    } catch (e) {
      return App.dom.esc(sujo);
    }

    // Sem suporte a <template> não há como materializar o HTML com
    // segurança — devolve escapado, que é feio mas inofensivo.
    if (!molde.content) return App.dom.esc(sujo);

    limparNo(molde.content);

    var limpo = document.createElement('div');
    limpo.appendChild(molde.content);
    return limpo.innerHTML;
  }

  function limparNo(no) {
    var filhos = Array.prototype.slice.call(no.childNodes || []);

    filhos.forEach(function (filho) {
      if (filho.nodeType === 3) return;                  // texto: sempre passa
      if (filho.nodeType !== 1) {                        // comentário e afins
        filho.parentNode.removeChild(filho);
        return;
      }

      limparNo(filho);

      if (TAGS_PERMITIDAS.indexOf(filho.tagName) === -1) {
        // Descarta a tag, preserva o texto: perder a formatação é aceitável,
        // perder o que o usuário escreveu não é.
        while (filho.firstChild) filho.parentNode.insertBefore(filho.firstChild, filho);
        filho.parentNode.removeChild(filho);
        return;
      }

      Array.prototype.slice.call(filho.attributes || []).forEach(function (attr) {
        var nome = attr.name.toLowerCase();
        var ehLinkValido = filho.tagName === 'A' && nome === 'href' &&
                           /^(https?:|mailto:|#)/i.test(String(attr.value).trim());
        if (!ehLinkValido) filho.removeAttribute(attr.name);
      });

      if (filho.tagName === 'A') {
        filho.setAttribute('rel', 'noopener noreferrer');
        filho.setAttribute('target', '_blank');
      }
    });
  }

  // --- Leitura e gravação ---------------------------------------------------

  function tem(documentoId) {
    return !!(documentoId && garantir()[documentoId]);
  }

  /**
   * Há texto de verdade neste registro?
   *
   * Abrir o editor já grava um registro vazio (é o que atravessa para a
   * outra aba), então `tem()` responde "sim" para documento em branco. Quem
   * decide o que MOSTRAR ou BAIXAR precisa da outra pergunta: no modo rico,
   * `<p><br></p>` é uma folha em branco, não conteúdo.
   */
  function temTexto(registro) {
    if (!registro) return false;
    var conteudo = String(registro.conteudo || '');
    if (registro.modo === 'rico') conteudo = conteudo.replace(/<[^>]*>/g, '');
    return !!conteudo.replace(/&nbsp;/g, ' ').trim();
  }

  /** @returns {{modo, conteudo, atualizadoEm, atualizadoPorId}|null} */
  function ler(documentoId) {
    var registro = garantir()[documentoId];
    if (!registro) return null;
    return {
      modo: registro.modo || 'texto',
      conteudo: registro.conteudo || '',
      atualizadoEm: registro.atualizadoEm || null,
      atualizadoPorId: registro.atualizadoPorId || null
    };
  }

  function persistir() {
    if (!testarStorage()) return { ok: true, motivo: 'memoria' };
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(memoria));
      return { ok: true };
    } catch (e) {
      console.warn('[conteudoService] Não foi possível gravar:', e.message);
      return { ok: false, motivo: 'cota' };
    }
  }

  /**
   * Grava o conteúdo do documento.
   *
   * @param {string} documentoId
   * @param {Object} dados  { modo: 'texto'|'rico', conteudo, atualizadoPorId }
   * @returns {{ok: boolean, motivo?: string, registro?: Object}}
   *          motivo: 'documento' | 'tamanho' | 'cota'
   */
  function salvar(documentoId, dados) {
    if (!documentoId) return { ok: false, motivo: 'documento' };

    var d = dados || {};
    var modo = d.modo === 'rico' ? 'rico' : 'texto';
    var conteudo = modo === 'rico' ? sanitizarHtml(d.conteudo) : String(d.conteudo || '');

    var tamanho = bytes(conteudo);
    if (tamanho > LIMITE_BYTES) {
      return { ok: false, motivo: 'tamanho', bytes: tamanho, limite: LIMITE_BYTES };
    }

    var anterior = garantir()[documentoId] || null;
    var registro = {
      modo: modo,
      conteudo: conteudo,
      bytes: tamanho,
      atualizadoEm: new Date().toISOString(),
      atualizadoPorId: d.atualizadoPorId || null
    };

    memoria[documentoId] = registro;

    var gravou = persistir();
    if (!gravou.ok) {
      // Desfaz para a memória não divergir do que está no storage.
      if (anterior) memoria[documentoId] = anterior;
      else delete memoria[documentoId];
      return { ok: false, motivo: 'cota' };
    }

    return { ok: true, registro: registro };
  }

  /** Copia o conteúdo de um documento para outro — usado em "nova versão". */
  function copiar(deId, paraId) {
    var origem = ler(deId);
    if (!origem || !paraId) return { ok: false, motivo: 'documento' };
    return salvar(paraId, {
      modo: origem.modo,
      conteudo: origem.conteudo,
      atualizadoPorId: origem.atualizadoPorId
    });
  }

  function esquecer(documentoId) {
    if (!garantir()[documentoId]) return;
    delete memoria[documentoId];
    persistir();
  }

  function limpar() {
    memoria = {};
    if (testarStorage()) {
      try { window.localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
    }
  }

  function total() {
    return Object.keys(garantir()).length;
  }

  // --- Sincronia entre abas -------------------------------------------------

  /* O evento 'storage' só dispara nas OUTRAS abas — é exatamente o canal de
     volta do editor para a aba do processo: "o documento mudou, recarregue
     a lista". A aba que gravou não é notificada (nem precisa). */
  function aoStorage(evento) {
    if (evento.key && evento.key !== CHAVE) return;
    memoria = carregar();
    observadores.slice().forEach(function (cb) {
      try { cb(); } catch (e) { console.error('[conteudoService] observador:', e); }
    });
  }

  /**
   * @param {Function} callback  chamado quando outra aba grava conteúdo
   * @returns {Function} off()
   */
  function observar(callback) {
    if (typeof callback !== 'function') return function () {};

    if (!ligadoAoStorage) {
      window.addEventListener('storage', aoStorage);
      ligadoAoStorage = true;
    }
    observadores.push(callback);

    return function off() {
      var i = observadores.indexOf(callback);
      if (i !== -1) observadores.splice(i, 1);
    };
  }

  App.services.conteudoService = {
    LIMITE_BYTES: LIMITE_BYTES,
    suportado: suportado,
    tem: tem,
    temTexto: temTexto,
    ler: ler,
    salvar: salvar,
    copiar: copiar,
    esquecer: esquecer,
    limpar: limpar,
    total: total,
    bytes: bytes,
    sanitizarHtml: sanitizarHtml,
    observar: observar
  };
})(window.App = window.App || {});
