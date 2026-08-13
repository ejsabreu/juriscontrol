/* ==========================================================================
   components/Toast.js — notificações efêmeras
   No React vira um Context com uma fila (react-hot-toast, sonner…).
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var regiao = null;

  function garantirRegiao() {
    if (regiao && document.body.contains(regiao)) return regiao;
    regiao = document.createElement('div');
    regiao.className = 'toast-region';
    regiao.setAttribute('role', 'status');
    regiao.setAttribute('aria-live', 'polite');
    document.body.appendChild(regiao);
    return regiao;
  }

  var ICONES = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  /**
   * @param {Object} props
   * @param {string} props.titulo
   * @param {string} [props.mensagem]
   * @param {string} [props.tipo]      'success' | 'error' | 'warning' | 'info'
   * @param {number} [props.duracao]   ms; 0 mantém até o usuário fechar
   */
  function mostrar(props) {
    var p = props || {};
    var tipo = p.tipo || 'info';
    var duracao = p.duracao === undefined ? 3600 : p.duracao;
    var esc = App.dom.esc;

    var elemento = document.createElement('div');
    elemento.className = 'toast toast--' + tipo;
    elemento.innerHTML =
      '<span class="toast__icon" aria-hidden="true">' + (ICONES[tipo] || ICONES.info) + '</span>' +
      '<div>' +
        '<div class="toast__title">' + esc(p.titulo || '') + '</div>' +
        (p.mensagem ? '<div class="toast__message">' + esc(p.mensagem) + '</div>' : '') +
      '</div>' +
      '<button class="toast__close" aria-label="Fechar">×</button>';

    garantirRegiao().appendChild(elemento);

    var temporizador = null;

    function remover() {
      if (!elemento.parentNode) return;
      clearTimeout(temporizador);
      elemento.classList.add('toast--leaving');
      setTimeout(function () {
        if (elemento.parentNode) elemento.remove();
      }, 160);
    }

    elemento.querySelector('.toast__close').addEventListener('click', remover);

    // Pausa a contagem enquanto o ponteiro está sobre o toast.
    if (duracao > 0) {
      temporizador = setTimeout(remover, duracao);
      elemento.addEventListener('mouseenter', function () { clearTimeout(temporizador); });
      elemento.addEventListener('mouseleave', function () {
        temporizador = setTimeout(remover, 1200);
      });
    }

    return remover;
  }

  App.components.Toast = {
    mostrar: mostrar,
    sucesso: function (titulo, mensagem) {
      return mostrar({ tipo: 'success', titulo: titulo, mensagem: mensagem });
    },
    erro: function (titulo, mensagem) {
      return mostrar({ tipo: 'error', titulo: titulo, mensagem: mensagem, duracao: 5200 });
    },
    aviso: function (titulo, mensagem) {
      return mostrar({ tipo: 'warning', titulo: titulo, mensagem: mensagem });
    },
    info: function (titulo, mensagem) {
      return mostrar({ tipo: 'info', titulo: titulo, mensagem: mensagem });
    }
  };
})(window.App = window.App || {});
