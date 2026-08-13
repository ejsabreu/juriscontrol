/* ==========================================================================
   domain/cnj.js — número único de processo judicial
   Resolução CNJ nº 65/2008.
   LÓGICA PURA — migra para o React sem nenhuma alteração.

   Formato: NNNNNNN-DD.AAAA.J.TR.OOOO

     0001234 - 71 . 2024 . 8 . 26 . 0100
        │       │     │     │    │    └── órgão de origem (4 dígitos)
        │       │     │     │    └─────── tribunal (2)
        │       │     │     └──────────── segmento do Judiciário (1)
        │       │     └────────────────── ano do ajuizamento (4)
        │       └──────────────────────── dígito verificador (2)
        └──────────────────────────────── sequencial por ano e origem (7)
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  var SEGMENTOS = {
    1: 'Supremo Tribunal Federal',
    2: 'Conselho Nacional de Justiça',
    3: 'Superior Tribunal de Justiça',
    4: 'Justiça Federal',
    5: 'Justiça do Trabalho',
    6: 'Justiça Eleitoral',
    7: 'Justiça Militar da União',
    8: 'Justiça Estadual',
    9: 'Justiça Militar Estadual'
  };

  function digitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  /**
   * Dígito verificador — módulo 97 base 10 (ISO 7064).
   *
   * Reordena o número como NNNNNNN + AAAA + J + TR + OOOO, acrescenta '00'
   * no lugar do DV e calcula 98 − (valor mod 97). Como o número tem 20 dígitos
   * e estoura Number.MAX_SAFE_INTEGER, o resto é acumulado em blocos.
   */
  function calcularDV(sequencial, ano, segmento, tribunal, origem) {
    var base = String(sequencial).padStart(7, '0') +
               String(ano).padStart(4, '0') +
               String(segmento).padStart(1, '0') +
               String(tribunal).padStart(2, '0') +
               String(origem).padStart(4, '0') + '00';

    var resto = 0;
    for (var i = 0; i < base.length; i++) {
      resto = (resto * 10 + Number(base[i])) % 97;
    }

    return String(98 - resto).padStart(2, '0');
  }

  /** Divide o número em suas partes. Retorna null se não tiver 20 dígitos. */
  function parsear(valor) {
    var d = digitos(valor);
    if (d.length !== 20) return null;

    var sequencial = d.slice(0, 7);
    var dv         = d.slice(7, 9);
    var ano        = d.slice(9, 13);
    var segmento   = d.slice(13, 14);
    var tribunal   = d.slice(14, 16);
    var origem     = d.slice(16, 20);

    return {
      sequencial: sequencial,
      dv: dv,
      ano: ano,
      segmento: segmento,
      segmentoNome: SEGMENTOS[Number(segmento)] || 'Segmento desconhecido',
      tribunal: tribunal,
      origem: origem,
      dvEsperado: calcularDV(sequencial, ano, segmento, tribunal, origem)
    };
  }

  /**
   * @returns {{valido: boolean, erro: string|null, partes: Object|null}}
   */
  function validar(valor) {
    var d = digitos(valor);

    if (!d) {
      return { valido: false, erro: 'Informe o número do processo.', partes: null };
    }
    if (d.length !== 20) {
      return {
        valido: false,
        erro: 'O número deve ter 20 dígitos (informado: ' + d.length + ').',
        partes: null
      };
    }

    var partes = parsear(d);

    if (!SEGMENTOS[Number(partes.segmento)]) {
      return {
        valido: false,
        erro: 'Segmento "' + partes.segmento + '" não existe no padrão CNJ.',
        partes: partes
      };
    }

    var anoNum = Number(partes.ano);
    var anoAtual = new Date().getFullYear();
    if (anoNum < 1900 || anoNum > anoAtual + 1) {
      return { valido: false, erro: 'Ano de ajuizamento inválido: ' + partes.ano + '.', partes: partes };
    }

    if (partes.dv !== partes.dvEsperado) {
      return {
        valido: false,
        erro: 'Dígito verificador inválido — informado ' + partes.dv +
              ', esperado ' + partes.dvEsperado + '.',
        partes: partes
      };
    }

    return { valido: true, erro: null, partes: partes };
  }

  function ehValido(valor) {
    return validar(valor).valido;
  }

  /** 20 dígitos → 'NNNNNNN-DD.AAAA.J.TR.OOOO' */
  function formatar(valor) {
    var d = digitos(valor);
    if (d.length !== 20) return String(valor || '');
    return d.slice(0, 7) + '-' + d.slice(7, 9) + '.' + d.slice(9, 13) + '.' +
           d.slice(13, 14) + '.' + d.slice(14, 16) + '.' + d.slice(16, 20);
  }

  /** Monta um número válido a partir das partes, calculando o DV. */
  function montar(sequencial, ano, segmento, tribunal, origem) {
    var dv = calcularDV(sequencial, ano, segmento, tribunal, origem);
    return formatar(
      String(sequencial).padStart(7, '0') + dv +
      String(ano).padStart(4, '0') +
      String(segmento) +
      String(tribunal).padStart(2, '0') +
      String(origem).padStart(4, '0')
    );
  }

  App.domain.cnj = {
    SEGMENTOS: SEGMENTOS,
    digitos: digitos,
    calcularDV: calcularDV,
    parsear: parsear,
    validar: validar,
    ehValido: ehValido,
    formatar: formatar,
    montar: montar
  };
})(window.App = window.App || {});
