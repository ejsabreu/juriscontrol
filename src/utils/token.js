/* ==========================================================================
   utils/token.js — tokens opacos e hash

   Três usos na fase 2:
     · token do link do portal (F2.3)
     · hash de conteúdo para deduplicar publicação (F2.4)
     · anonimização de dados do titular (F2.1)

   AVISO HONESTO: FNV-1a não é hash criptográfico. Serve para identidade e
   deduplicação, nunca para segredo. Onde a fase 3 precisar de segurança de
   verdade — senha, assinatura, token de sessão — entra hash com sal no
   servidor. O protótipo não finge o contrário.
   ========================================================================== */

(function (App) {
  'use strict';

  // Sem I, O, 0 e 1: token é lido em voz alta e digitado à mão.
  var ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

  function aleatorios(quantidade) {
    var cripto = window.crypto || window.msCrypto;
    if (cripto && typeof cripto.getRandomValues === 'function') {
      var buffer = new Uint8Array(quantidade);
      cripto.getRandomValues(buffer);
      return buffer;
    }
    // Ambiente sem WebCrypto (o jsdom das suítes pode ser um).
    var lista = [];
    for (var i = 0; i < quantidade; i++) lista.push(Math.floor(Math.random() * 256));
    return lista;
  }

  /**
   * Token opaco para o link do portal. Opaco de propósito: não carrega o id
   * do processo, então adivinhar um token não revela quantos processos o
   * escritório tem nem permite iterar sobre eles.
   */
  function gerar(tamanho) {
    var n = tamanho || 32;
    var bytes = aleatorios(n);
    var saida = '';
    for (var i = 0; i < n; i++) {
      saida += ALFABETO[bytes[i] % ALFABETO.length];
    }
    return saida;
  }

  /** FNV-1a 32 bits → 8 caracteres hex. Determinístico e estável. */
  function hash(texto) {
    var h = 0x811c9dc5;
    var s = String(texto === null || texto === undefined ? '' : texto);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      // h * 16777619 sem estourar o inteiro de 32 bits do JS
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /** Hash mais longo para deduplicar publicação — dois passes, 16 caracteres. */
  function hashLongo(texto) {
    var s = String(texto === null || texto === undefined ? '' : texto);
    return hash(s) + hash(s.split('').reverse().join('') + s.length);
  }

  /**
   * Anonimização que PRESERVA O FORMATO — exigência prática da LGPD combinada
   * com a do processo: o registro precisa continuar existindo e conferindo
   * (soft delete é decisão do projeto), mas sem identificar o titular.
   *
   *   'Maria Silva Costa' → 'M****** S***** C****'
   *   com `irreversivel`, vira 'Titular a3f19c02' — sem volta.
   */
  function anonimizarNome(nome, irreversivel) {
    if (!nome) return '';
    if (irreversivel) return 'Titular ' + hash(nome);

    return String(nome).trim().split(/\s+/).map(function (parte) {
      if (parte.length <= 2) return parte;
      return parte[0] + '*'.repeat(parte.length - 1);
    }).join(' ');
  }

  /**
   * '12345678901' → '***.456.789-**'
   *
   * Máscara convencional brasileira: escondem-se os três primeiros dígitos e
   * os dois do verificador, preservando o miolo. É o formato que o titular
   * reconhece como seu documento sem que o número inteiro fique exposto.
   */
  function anonimizarDocumento(valor) {
    var d = String(valor || '').replace(/\D/g, '');
    if (d.length === 11) return '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**';
    if (d.length === 14) return '**.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-**';
    return '***';
  }

  /**
   * 'maria@escritorio.com.br' → 'ma***@escritorio.com.br'
   *
   * O comprimento do usuário é preservado — mascarar não pode inventar nem
   * comer caractere, senão o titular não reconhece o próprio e-mail. Sempre
   * some pelo menos um caractere real: com usuário de 1 ou 2 letras, mostrar
   * "quase tudo" não seria anonimizar nada.
   */
  function anonimizarEmail(email) {
    var partes = String(email || '').split('@');
    if (partes.length !== 2 || !partes[0]) return '***';

    var usuario = partes[0];
    if (usuario.length <= 1) return '*@' + partes[1];

    var visiveis = Math.min(2, usuario.length - 1);
    return usuario.slice(0, visiveis) +
           '*'.repeat(usuario.length - visiveis) + '@' + partes[1];
  }

  App.token = {
    gerar: gerar,
    hash: hash,
    hashLongo: hashLongo,
    anonimizarNome: anonimizarNome,
    anonimizarDocumento: anonimizarDocumento,
    anonimizarEmail: anonimizarEmail
  };
})(window.App = window.App || {});
