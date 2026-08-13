/* ==========================================================================
   domain/boleto.js — código de barras e linha digitável (FEBRABAN)

   A MATEMÁTICA AQUI É REAL. O layout de 44 posições do código de barras, a
   linha digitável de 47, o fator de vencimento, o dígito verificador geral
   por módulo 11 e os três DVs de campo por módulo 10 são exatamente os da
   especificação FEBRABAN. Uma linha gerada aqui é conferida sem erro por
   qualquer validador.

   O QUE NÃO É REAL: o banco. O código 999 não existe, e nenhum boleto é
   REGISTRADO — registro exige convênio com banco e troca de arquivo CNAB
   ou API, ou seja, servidor. A tela diz isso.

   Por que fazer a conta de verdade, então? Porque é a parte que dá para
   fazer certo, e fazer errado seria pior que não fazer: uma linha digitável
   plausível mas inválida é a mentira que só se descobre no caixa.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  var BANCO_FICTICIO = '999';
  var MOEDA_REAL = '9';

  /* Base do fator de vencimento na especificação original. O fator estourou
     os 4 dígitos em 21/02/2025; a FEBRABAN definiu que ele volta a 1000 no
     dia seguinte, com nova base. O tratamento está em `fatorVencimento`. */
  var BASE_FATOR = '1997-10-07';
  var BASE_FATOR_NOVA = '2025-02-22';

  function apenasDigitos(valor) {
    return String(valor === null || valor === undefined ? '' : valor).replace(/\D/g, '');
  }

  function zeros(valor, tamanho) {
    var texto = apenasDigitos(valor);
    while (texto.length < tamanho) texto = '0' + texto;
    return texto.slice(-tamanho);
  }

  /**
   * Módulo 11 — DV geral do código de barras.
   * Pesos 2 a 9, cíclicos, da direita para a esquerda. Resto 0, 1 ou 10
   * resulta em DV 1, por definição da especificação.
   */
  function modulo11(numero) {
    var digitos = apenasDigitos(numero);
    var peso = 2;
    var soma = 0;

    for (var i = digitos.length - 1; i >= 0; i--) {
      soma += parseInt(digitos[i], 10) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }

    var resto = soma % 11;
    var dv = 11 - resto;
    return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv;
  }

  /**
   * Módulo 10 — DV de cada campo da linha digitável.
   * Pesos 2 e 1 alternados da direita; produto de dois dígitos é somado
   * algarismo a algarismo (15 → 1+5 = 6).
   */
  function modulo10(numero) {
    var digitos = apenasDigitos(numero);
    var peso = 2;
    var soma = 0;

    for (var i = digitos.length - 1; i >= 0; i--) {
      var produto = parseInt(digitos[i], 10) * peso;
      if (produto > 9) produto = Math.floor(produto / 10) + (produto % 10);
      soma += produto;
      peso = peso === 2 ? 1 : 2;
    }

    return (10 - (soma % 10)) % 10;
  }

  /**
   * Dias entre a base e o vencimento. Vencimento fora da faixa representável
   * resulta em 0000 — que a especificação define como "sem vencimento", e é
   * mais honesto do que estourar o campo com um número truncado.
   */
  function fatorVencimento(dataVencimento) {
    var vencimento = App.format.parseISO(dataVencimento);
    if (!vencimento) return '0000';

    function diasDesde(base) {
      var inicio = App.format.parseISO(base);
      return Math.round((vencimento - inicio) / 86400000);
    }

    var fator = diasDesde(BASE_FATOR);

    // Depois de 21/02/2025 o contador recomeça em 1000 sobre a nova base.
    if (fator > 9999) fator = 1000 + diasDesde(BASE_FATOR_NOVA);

    if (fator < 0 || fator > 9999) return '0000';
    return zeros(fator, 4);
  }

  /**
   * Nosso número: identificador do título no banco. Formato e DV variam por
   * banco; aqui é o padrão mais comum — 11 posições com DV por módulo 11.
   */
  function nossoNumero(sequencial) {
    var base = zeros(sequencial, 11);
    return base + modulo11(base);
  }

  /**
   * Código de barras de 44 posições.
   *
   *   1-3   banco          4     moeda        5     DV geral
   *   6-9   fator venc.    10-19 valor        20-44 campo livre
   */
  function codigoBarras(dados) {
    var d = dados || {};
    var banco = zeros(d.banco || BANCO_FICTICIO, 3);
    var valor = zeros(Math.max(0, Math.round(d.valorCentavos || 0)), 10);
    var fator = fatorVencimento(d.dataVencimento);
    var campoLivre = zeros(d.campoLivre || nossoNumero(d.sequencial || 1), 25);

    // O DV ocupa a 5ª posição, mas é calculado sobre o número SEM ele.
    var semDv = banco + MOEDA_REAL + fator + valor + campoLivre;
    var dv = modulo11(semDv);

    return banco + MOEDA_REAL + dv + fator + valor + campoLivre;
  }

  /**
   * Linha digitável de 47 posições, a partir do código de barras.
   *
   *   Campo 1 (10) banco + moeda + livre[1-5]   + DV mód. 10
   *   Campo 2 (11) livre[6-15]                  + DV mód. 10
   *   Campo 3 (11) livre[16-25]                 + DV mód. 10
   *   Campo 4  (1) DV geral do código de barras
   *   Campo 5 (14) fator de vencimento + valor
   */
  function linhaDigitavel(codigo) {
    var c = apenasDigitos(codigo);
    if (c.length !== 44) return null;

    var banco = c.slice(0, 3);
    var moeda = c.slice(3, 4);
    var dvGeral = c.slice(4, 5);
    var fator = c.slice(5, 9);
    var valor = c.slice(9, 19);
    var livre = c.slice(19, 44);

    var campo1 = banco + moeda + livre.slice(0, 5);
    var campo2 = livre.slice(5, 15);
    var campo3 = livre.slice(15, 25);

    return campo1 + modulo10(campo1) +
           campo2 + modulo10(campo2) +
           campo3 + modulo10(campo3) +
           dvGeral +
           fator + valor;
  }

  /** 47 dígitos → '99990.00009 12345.678901 23456.789012 3 45670000012345' */
  function formatarLinha(linha) {
    var d = apenasDigitos(linha);
    if (d.length !== 47) return String(linha || '');

    return d.slice(0, 5) + '.' + d.slice(5, 10) + ' ' +
           d.slice(10, 15) + '.' + d.slice(15, 21) + ' ' +
           d.slice(21, 26) + '.' + d.slice(26, 32) + ' ' +
           d.slice(32, 33) + ' ' +
           d.slice(33);
  }

  /**
   * Confere uma linha digitável — os três DVs de campo e o DV geral.
   * Existe para o teste provar que a geração está certa, e para a tela
   * poder validar linha digitada à mão na conciliação da fase 3.
   */
  function validarLinha(linha) {
    var d = apenasDigitos(linha);
    if (d.length !== 47) {
      return { valida: false, motivo: 'A linha digitável tem 47 dígitos.' };
    }

    var campos = [
      { numero: d.slice(0, 9),   dv: d.slice(9, 10) },
      { numero: d.slice(10, 20), dv: d.slice(20, 21) },
      { numero: d.slice(21, 31), dv: d.slice(31, 32) }
    ];

    for (var i = 0; i < campos.length; i++) {
      if (modulo10(campos[i].numero) !== parseInt(campos[i].dv, 10)) {
        return { valida: false, motivo: 'Dígito verificador do campo ' + (i + 1) + ' inválido.' };
      }
    }

    var codigo = reconstruirCodigoBarras(d);
    var semDv = codigo.slice(0, 4) + codigo.slice(5);
    if (modulo11(semDv) !== parseInt(codigo.slice(4, 5), 10)) {
      return { valida: false, motivo: 'Dígito verificador geral inválido.' };
    }

    return { valida: true, codigoBarras: codigo };
  }

  /** Desfaz o embaralhamento da linha digitável e devolve as 44 posições. */
  function reconstruirCodigoBarras(linha) {
    var d = apenasDigitos(linha);
    if (d.length !== 47) return null;

    var banco = d.slice(0, 3);
    var moeda = d.slice(3, 4);
    var dvGeral = d.slice(32, 33);
    var fatorValor = d.slice(33, 47);
    var livre = d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);

    return banco + moeda + dvGeral + fatorValor + livre;
  }

  /** Tudo o que a tela precisa para exibir e imprimir um boleto. */
  function emitir(dados) {
    var d = dados || {};
    var numeroTitulo = nossoNumero(d.sequencial || 1);
    var codigo = codigoBarras({
      banco: d.banco,
      valorCentavos: d.valorCentavos,
      dataVencimento: d.dataVencimento,
      campoLivre: d.campoLivre || (numeroTitulo + zeros(d.sequencial || 1, 13))
    });
    var linha = linhaDigitavel(codigo);

    return {
      banco: BANCO_FICTICIO,
      nossoNumero: numeroTitulo,
      codigoBarras: codigo,
      linhaDigitavel: linha,
      linhaFormatada: formatarLinha(linha),
      fatorVencimento: codigo.slice(5, 9),
      valorCentavos: Math.round(d.valorCentavos || 0),
      dataVencimento: d.dataVencimento
    };
  }

  App.domain.boleto = {
    BANCO_FICTICIO: BANCO_FICTICIO,
    modulo10: modulo10,
    modulo11: modulo11,
    fatorVencimento: fatorVencimento,
    nossoNumero: nossoNumero,
    codigoBarras: codigoBarras,
    linhaDigitavel: linhaDigitavel,
    formatarLinha: formatarLinha,
    validarLinha: validarLinha,
    reconstruirCodigoBarras: reconstruirCodigoBarras,
    emitir: emitir
  };
})(window.App = window.App || {});
