/* ==========================================================================
   utils/mask.js — máscaras de input
   No React vira um hook (useMask) ou é substituído por react-imask;
   as funções de transformação de string abaixo permanecem idênticas.
   ========================================================================== */

(function (App) {
  'use strict';

  function so(digitos) {
    return String(digitos || '').replace(/\D/g, '');
  }

  /** 0001234-71.2024.8.26.0100 */
  function cnj(valor) {
    var d = so(valor).slice(0, 20);
    var out = d.slice(0, 7);
    if (d.length > 7)  out += '-' + d.slice(7, 9);
    if (d.length > 9)  out += '.' + d.slice(9, 13);
    if (d.length > 13) out += '.' + d.slice(13, 14);
    if (d.length > 14) out += '.' + d.slice(14, 16);
    if (d.length > 16) out += '.' + d.slice(16, 20);
    return out;
  }

  function cpf(valor) {
    var d = so(valor).slice(0, 11);
    var out = d.slice(0, 3);
    if (d.length > 3) out += '.' + d.slice(3, 6);
    if (d.length > 6) out += '.' + d.slice(6, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }

  function cnpj(valor) {
    var d = so(valor).slice(0, 14);
    var out = d.slice(0, 2);
    if (d.length > 2)  out += '.' + d.slice(2, 5);
    if (d.length > 5)  out += '.' + d.slice(5, 8);
    if (d.length > 8)  out += '/' + d.slice(8, 12);
    if (d.length > 12) out += '-' + d.slice(12, 14);
    return out;
  }

  /** Alterna entre CPF e CNPJ conforme a quantidade digitada. */
  function documento(valor) {
    var d = so(valor);
    return d.length <= 11 ? cpf(d) : cnpj(d);
  }

  function telefone(valor) {
    var d = so(valor).slice(0, 11);
    if (d.length === 0) return '';
    var out = '(' + d.slice(0, 2);
    if (d.length > 2) {
      out += ') ';
      out += d.length > 10 ? d.slice(2, 7) : d.slice(2, 6);
    }
    if (d.length > 6) {
      out += '-' + (d.length > 10 ? d.slice(7, 11) : d.slice(6, 10));
    }
    return out;
  }

  function cep(valor) {
    var d = so(valor).slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }

  /** Digitação da direita para a esquerda: '12345' → 'R$ 123,45'. Retorna string. */
  function moeda(valor) {
    var d = so(valor);
    if (!d) return '';
    var n = parseInt(d, 10) / 100;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** 'R$ 1.234,56' → 123456 (centavos) */
  function moedaParaCentavos(texto) {
    var d = so(texto);
    return d ? parseInt(d, 10) : 0;
  }

  /**
   * Liga a máscara a um input, preservando a posição do cursor ao digitar
   * no meio do texto (senão o cursor pula para o fim a cada tecla).
   */
  function aplicar(input, fn) {
    if (!input) return;
    input.addEventListener('input', function () {
      var antes = input.value.length;
      var pos = input.selectionStart;
      input.value = fn(input.value);
      var delta = input.value.length - antes;
      var novaPos = Math.max(0, pos + delta);
      if (document.activeElement === input) {
        input.setSelectionRange(novaPos, novaPos);
      }
    });
    if (input.value) input.value = fn(input.value);
  }

  App.mask = {
    so: so,
    cnj: cnj,
    cpf: cpf,
    cnpj: cnpj,
    documento: documento,
    telefone: telefone,
    cep: cep,
    moeda: moeda,
    moedaParaCentavos: moedaParaCentavos,
    aplicar: aplicar
  };
})(window.App = window.App || {});
