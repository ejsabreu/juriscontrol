/* ==========================================================================
   utils/dom.js — helpers de DOM
   Na migração para React este módulo é DESCARTADO: o React resolve
   renderização e eventos. Nada de lógica de negócio pode viver aqui.
   ========================================================================== */

(function (App) {
  'use strict';

  /**
   * Escapa texto para interpolação segura em template string de HTML.
   * Todo dado vindo do "banco" passa por aqui antes de virar markup.
   */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Substitui o conteúdo de um elemento por uma string de HTML. */
  function render(target, html) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;
    el.innerHTML = html;
    return el;
  }

  /** Delegação de evento — sobrevive à re-renderização do conteúdo interno. */
  function delegate(root, eventName, selector, handler) {
    if (!root) return function () {};

    function listener(event) {
      var match = event.target.closest(selector);
      if (match && root.contains(match)) {
        handler.call(match, event, match);
      }
    }

    root.addEventListener(eventName, listener);
    return function off() {
      root.removeEventListener(eventName, listener);
    };
  }

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /** Cria elemento com atributos e filhos — usado onde string de HTML não serve. */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);

    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else if (key === 'html') node.innerHTML = attrs[key];
      else if (key === 'text') node.textContent = attrs[key];
      else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
      else if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, attrs[key]);
    });

    (children || []).forEach(function (child) {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });

    return node;
  }

  /** Serializa um <form> em objeto simples (checkbox vira boolean). */
  function formToObject(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (field) {
      if (!field.name || field.disabled) return;
      if (field.type === 'checkbox') data[field.name] = field.checked;
      else if (field.type === 'radio') { if (field.checked) data[field.name] = field.value; }
      else data[field.name] = field.value;
    });
    return data;
  }

  /**
   * Dispara o download de um arquivo SEM sair da página: cria um <a download>,
   * clica nele e o descarta.
   *
   * @param {string}      nomeArquivo  nome sugerido ao navegador
   * @param {Blob|string} origem       Blob/File, ou uma URL já pronta
   * @returns {Promise<boolean>} false = não foi possível preparar o download
   */
  function baixar(nomeArquivo, origem) {
    if (!origem) return Promise.resolve(false);

    // URL pronta (ex.: a que o arquivoService já mantém) — nada a revogar.
    if (typeof origem === 'string') {
      return Promise.resolve(clicarLinkDeDownload(nomeArquivo, origem, null));
    }

    var temObjectURL = typeof window.URL !== 'undefined' &&
                       typeof window.URL.createObjectURL === 'function';

    if (temObjectURL) {
      var url;
      try {
        url = window.URL.createObjectURL(origem);
      } catch (e) {
        console.warn('[dom] Não foi possível preparar o download:', e.message);
        return Promise.resolve(false);
      }
      return Promise.resolve(clicarLinkDeDownload(nomeArquivo, url, url));
    }

    // Ambiente sem createObjectURL (o jsdom das suítes é um): data: URL.
    if (typeof window.FileReader === 'undefined') return Promise.resolve(false);

    return new Promise(function (resolve) {
      var leitor = new window.FileReader();
      leitor.onload = function () {
        resolve(clicarLinkDeDownload(nomeArquivo, String(leitor.result), null));
      };
      leitor.onerror = function () { resolve(false); };
      leitor.readAsDataURL(origem);
    });
  }

  function clicarLinkDeDownload(nomeArquivo, url, urlParaRevogar) {
    var link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo || 'arquivo';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revogar antes do clique terminar cancela o download em alguns
    // navegadores — daí a folga.
    if (urlParaRevogar) {
      setTimeout(function () {
        try { window.URL.revokeObjectURL(urlParaRevogar); } catch (e) { /* ignora */ }
      }, 4000);
    }
    return true;
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 250);
    };
  }

  App.dom = {
    esc: esc,
    render: render,
    delegate: delegate,
    qs: qs,
    qsa: qsa,
    el: el,
    formToObject: formToObject,
    baixar: baixar,
    debounce: debounce
  };
})(window.App = window.App || {});
