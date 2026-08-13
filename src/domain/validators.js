/* ==========================================================================
   domain/validators.js — validação de documentos e campos
   LÓGICA PURA — migra para o React sem nenhuma alteração.
   Cada validador devolve { valido, erro } para a UI exibir a mensagem.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  function digitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  function ok() {
    return { valido: true, erro: null };
  }

  function falha(msg) {
    return { valido: false, erro: msg };
  }

  /** CPF — dois dígitos verificadores, módulo 11. */
  function cpf(valor) {
    var d = digitos(valor);
    if (!d) return falha('Informe o CPF.');
    if (d.length !== 11) return falha('O CPF deve ter 11 dígitos.');
    if (/^(\d)\1{10}$/.test(d)) return falha('CPF inválido.');

    for (var t = 9; t < 11; t++) {
      var soma = 0;
      for (var i = 0; i < t; i++) {
        soma += Number(d[i]) * ((t + 1) - i);
      }
      var dv = ((soma * 10) % 11) % 10;
      if (dv !== Number(d[t])) return falha('CPF inválido.');
    }

    return ok();
  }

  /** CNPJ — dois dígitos verificadores, módulo 11 com pesos cíclicos 2..9. */
  function cnpj(valor) {
    var d = digitos(valor);
    if (!d) return falha('Informe o CNPJ.');
    if (d.length !== 14) return falha('O CNPJ deve ter 14 dígitos.');
    if (/^(\d)\1{13}$/.test(d)) return falha('CNPJ inválido.');

    function dvDe(tamanho) {
      var numeros = d.slice(0, tamanho);
      var peso = tamanho - 7;
      var soma = 0;
      for (var i = tamanho; i >= 1; i--) {
        soma += Number(numeros[tamanho - i]) * peso--;
        if (peso < 2) peso = 9;
      }
      var resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    }

    if (dvDe(12) !== Number(d[12])) return falha('CNPJ inválido.');
    if (dvDe(13) !== Number(d[13])) return falha('CNPJ inválido.');

    return ok();
  }

  /** Escolhe CPF ou CNPJ pela quantidade de dígitos. */
  function documento(valor, tipoPessoa) {
    var d = digitos(valor);
    if (tipoPessoa === 'PF') return cpf(d);
    if (tipoPessoa === 'PJ') return cnpj(d);
    if (d.length <= 11) return cpf(d);
    return cnpj(d);
  }

  function email(valor) {
    if (!valor) return falha('Informe o e-mail.');
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor).trim())
      ? ok()
      : falha('E-mail inválido.');
  }

  var UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
             'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

  /** Inscrição na OAB: número (1 a 6 dígitos) + UF. */
  function oab(numero, uf) {
    var n = digitos(numero);
    if (!n) return falha('Informe o número da OAB.');
    if (n.length < 1 || n.length > 6) return falha('Número de OAB inválido.');
    if (!uf || UFS.indexOf(String(uf).toUpperCase()) === -1) return falha('UF da OAB inválida.');
    return ok();
  }

  function obrigatorio(valor, nomeCampo) {
    var v = valor === null || valor === undefined ? '' : String(valor).trim();
    return v ? ok() : falha((nomeCampo || 'Campo') + ' é obrigatório.');
  }

  function dataISO(valor, nomeCampo) {
    if (!valor) return falha((nomeCampo || 'Data') + ' é obrigatória.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return falha('Data inválida.');
    var d = new Date(valor + 'T00:00:00');
    return isNaN(d) ? falha('Data inválida.') : ok();
  }

  function telefone(valor) {
    var d = digitos(valor);
    if (!d) return ok();   // opcional
    return (d.length === 10 || d.length === 11) ? ok() : falha('Telefone inválido.');
  }

  function cep(valor) {
    var d = digitos(valor);
    if (!d) return ok();   // opcional
    return d.length === 8 ? ok() : falha('CEP deve ter 8 dígitos.');
  }

  /**
   * Valida um objeto contra um mapa de regras.
   * @param {Object} dados
   * @param {Object} regras  { campo: fn(valor, dados) → {valido, erro} }
   * @returns {{valido: boolean, erros: Object}}
   */
  function validarFormulario(dados, regras) {
    var erros = {};
    var valido = true;

    Object.keys(regras).forEach(function (campo) {
      var resultado = regras[campo](dados[campo], dados);
      if (resultado && !resultado.valido) {
        erros[campo] = resultado.erro;
        valido = false;
      }
    });

    return { valido: valido, erros: erros };
  }

  App.domain.validators = {
    UFS: UFS,
    cpf: cpf,
    cnpj: cnpj,
    documento: documento,
    email: email,
    oab: oab,
    obrigatorio: obrigatorio,
    dataISO: dataISO,
    telefone: telefone,
    cep: cep,
    validarFormulario: validarFormulario,
    ok: ok,
    falha: falha
  };
})(window.App = window.App || {});
