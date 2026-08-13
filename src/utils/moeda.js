/* ==========================================================================
   utils/moeda.js — aritmética de dinheiro em CENTAVOS

   Decisão arquitetural 7 do projeto: dinheiro é inteiro em centavos, nunca
   float. `0.1 + 0.2 === 0.30000000000000004` é uma curiosidade em qualquer
   outro domínio e um erro de conta em honorários.

   Este módulo é a aritmética; `format.moeda()` continua sendo a apresentação.
   Migra para o React sem alteração.
   ========================================================================== */

(function (App) {
  'use strict';

  /**
   * Aceita o que o usuário digita e devolve centavos.
   *   'R$ 1.234,56' → 123456      '1234.56' → 123456
   *   1234.56       → 123456      '1.234'   → 123400
   *
   * A regra do separador: se houver vírgula, ela é o decimal (pt-BR) e os
   * pontos são milhar. Sem vírgula, um ponto só é decimal quando sobram 1 ou
   * 2 dígitos depois dele — '1.234' é mil duzentos e trinta e quatro reais,
   * '1.23' é um real e vinte e três centavos.
   */
  function deReais(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') return Math.round(valor * 100);

    var texto = String(valor).trim().replace(/[R$\s ]/gi, '');
    if (!texto) return 0;

    var negativo = /^-/.test(texto) || /^\(.*\)$/.test(texto);
    texto = texto.replace(/[()-]/g, '');

    if (texto.indexOf(',') !== -1) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else {
      var partes = texto.split('.');
      if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) {
        texto = partes.join('');            // todos os pontos eram milhar
      }
    }

    var numero = parseFloat(texto);
    if (isNaN(numero)) return 0;
    return Math.round(numero * 100) * (negativo ? -1 : 1);
  }

  /** 123456 → 1234.56 — só para exibir em <input type="number">. */
  function paraReais(centavos) {
    return (Number(centavos) || 0) / 100;
  }

  function somar() {
    var total = 0;
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (Array.isArray(v)) total += somar.apply(null, v);
      else total += Math.round(Number(v) || 0);
    }
    return total;
  }

  function subtrair(a, b) {
    return Math.round(Number(a) || 0) - Math.round(Number(b) || 0);
  }

  /** Multiplica por um fator qualquer, arredondando meio para cima. */
  function multiplicar(centavos, fator) {
    return Math.round((Number(centavos) || 0) * (Number(fator) || 0));
  }

  /** 20% de R$ 1.000,00 → percentual(100000, 20) === 20000 */
  function percentual(centavos, pct) {
    return Math.round((Number(centavos) || 0) * (Number(pct) || 0) / 100);
  }

  /**
   * Divide em N parcelas SEM PERDER CENTAVO — a soma das parcelas é sempre
   * igual ao total. O resto vai para as primeiras parcelas, que é como banco
   * e contrato de honorários fazem: R$ 100,00 em 3× vira 33,34 + 33,33 + 33,33.
   *
   * @returns {number[]} parcelas em centavos
   */
  function ratear(centavos, partes) {
    var total = Math.round(Number(centavos) || 0);
    var n = Math.max(1, Math.floor(partes) || 1);

    var base = Math.floor(Math.abs(total) / n);
    var resto = Math.abs(total) - base * n;
    var sinal = total < 0 ? -1 : 1;

    var lista = [];
    for (var i = 0; i < n; i++) {
      lista.push(sinal * (base + (i < resto ? 1 : 0)));
    }
    return lista;
  }

  /**
   * Rateio por pesos — repasse a correspondente, divisão entre sócios.
   * Mesma garantia: a soma bate com o total.
   */
  function ratearPorPeso(centavos, pesos) {
    var total = Math.round(Number(centavos) || 0);
    var somaPesos = pesos.reduce(function (s, p) { return s + (Number(p) || 0); }, 0);
    if (!somaPesos) return pesos.map(function () { return 0; });

    var parciais = pesos.map(function (p) {
      return Math.floor(total * (Number(p) || 0) / somaPesos);
    });
    var distribuido = parciais.reduce(function (s, v) { return s + v; }, 0);
    var sobra = total - distribuido;

    // A sobra vai para os maiores pesos, em ordem — critério estável.
    var ordem = pesos.map(function (p, i) { return { i: i, p: Number(p) || 0 }; })
                     .sort(function (a, b) { return b.p - a.p || a.i - b.i; });
    for (var k = 0; k < sobra; k++) {
      parciais[ordem[k % ordem.length].i] += 1;
    }
    return parciais;
  }

  function ehZero(centavos) {
    return Math.round(Number(centavos) || 0) === 0;
  }

  function comparar(a, b) {
    return (Math.round(Number(a) || 0)) - (Math.round(Number(b) || 0));
  }

  // --- Extenso ---------------------------------------------------------------
  // Necessário no contrato de honorários e no recibo (F2.5) — documento de
  // valor no Brasil escreve o número por extenso.

  var UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
                  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis',
                  'dezessete', 'dezoito', 'dezenove'];
  var DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta',
                 'setenta', 'oitenta', 'noventa'];
  var CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
                  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function ateNovecentos(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';

    var partes = [];
    var c = Math.floor(n / 100);
    var resto = n % 100;

    if (c) partes.push(CENTENAS[c]);
    if (resto < 20) {
      if (resto) partes.push(UNIDADES[resto]);
    } else {
      var d = Math.floor(resto / 10);
      var u = resto % 10;
      partes.push(DEZENAS[d] + (u ? ' e ' + UNIDADES[u] : ''));
    }
    return partes.join(' e ');
  }

  function grupos(n) {
    // [bilhões, milhões, milhares, unidades]
    return [
      Math.floor(n / 1000000000),
      Math.floor(n / 1000000) % 1000,
      Math.floor(n / 1000) % 1000,
      n % 1000
    ];
  }

  function inteiroExtenso(n) {
    if (n === 0) return 'zero';

    var g = grupos(n);
    var nomes = [
      [g[0], 'bilhão', 'bilhões'],
      [g[1], 'milhão', 'milhões'],
      [g[2], 'mil', 'mil']
    ];

    var partes = [];
    nomes.forEach(function (item) {
      if (!item[0]) return;
      var texto = item[2] === 'mil'
        ? (item[0] === 1 ? 'mil' : ateNovecentos(item[0]) + ' mil')
        : ateNovecentos(item[0]) + ' ' + (item[0] === 1 ? item[1] : item[2]);
      partes.push(texto);
    });

    if (g[3]) partes.push(ateNovecentos(g[3]));

    // "mil e duzentos" (com e) mas "mil duzentos e trinta" (sem) — a regra é:
    // o "e" final só entra quando o último grupo é redondo ou menor que 100.
    if (partes.length > 1) {
      var ultimo = partes[partes.length - 1];
      var ligaComE = g[3] < 100 || g[3] % 100 === 0;
      return partes.slice(0, -1).join(', ') + (ligaComE ? ' e ' : ' ') + ultimo;
    }
    return partes[0] || '';
  }

  /** 123456 → 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos' */
  function extenso(centavos) {
    var total = Math.round(Number(centavos) || 0);
    var negativo = total < 0;
    total = Math.abs(total);

    var reais = Math.floor(total / 100);
    var cents = total % 100;
    var partes = [];

    if (reais) partes.push(inteiroExtenso(reais) + ' ' + (reais === 1 ? 'real' : 'reais'));
    if (cents) partes.push(ateNovecentos(cents) + ' ' + (cents === 1 ? 'centavo' : 'centavos'));
    if (!partes.length) partes.push('zero real');

    return (negativo ? 'menos ' : '') + partes.join(' e ');
  }

  App.moeda = {
    deReais: deReais,
    paraReais: paraReais,
    somar: somar,
    subtrair: subtrair,
    multiplicar: multiplicar,
    percentual: percentual,
    ratear: ratear,
    ratearPorPeso: ratearPorPeso,
    ehZero: ehZero,
    comparar: comparar,
    extenso: extenso
  };
})(window.App = window.App || {});
