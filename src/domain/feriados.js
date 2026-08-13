/* ==========================================================================
   domain/feriados.js — calendário forense
   Calcula feriados em vez de tabelá-los, para funcionar em qualquer ano.
   LÓGICA PURA — migra para o React sem nenhuma alteração.

   Fontes:
   - Lei 662/1949 e Lei 10.607/2002 — feriados nacionais
   - Lei 14.759/2023 — 20/11 Consciência Negra como feriado nacional
   - Lei 5.010/1966, art. 62 — feriados forenses na Justiça Federal
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  var cache = {};

  function iso(date) {
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + d;
  }

  function somarDias(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  /**
   * Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano).
   * É a âncora de todos os feriados móveis.
   */
  function pascoa(ano) {
    var a = ano % 19;
    var b = Math.floor(ano / 100);
    var c = ano % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31);
    var dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }

  /** Todos os feriados (nacionais + forenses) de um ano. */
  function listar(ano) {
    var p = pascoa(ano);

    var lista = [
      // --- Nacionais fixos ---
      { data: ano + '-01-01', nome: 'Confraternização Universal', abrangencia: 'nacional' },
      { data: ano + '-04-21', nome: 'Tiradentes',                 abrangencia: 'nacional' },
      { data: ano + '-05-01', nome: 'Dia do Trabalho',            abrangencia: 'nacional' },
      { data: ano + '-09-07', nome: 'Independência do Brasil',    abrangencia: 'nacional' },
      { data: ano + '-10-12', nome: 'Nossa Senhora Aparecida',    abrangencia: 'nacional' },
      { data: ano + '-11-02', nome: 'Finados',                    abrangencia: 'nacional' },
      { data: ano + '-11-15', nome: 'Proclamação da República',   abrangencia: 'nacional' },
      { data: ano + '-11-20', nome: 'Consciência Negra',          abrangencia: 'nacional' },
      { data: ano + '-12-25', nome: 'Natal',                      abrangencia: 'nacional' },

      // --- Móveis (ancorados na Páscoa) ---
      { data: iso(somarDias(p, -48)), nome: 'Carnaval',            abrangencia: 'forense' },
      { data: iso(somarDias(p, -47)), nome: 'Carnaval',            abrangencia: 'forense' },
      { data: iso(somarDias(p, -46)), nome: 'Quarta-feira de Cinzas', abrangencia: 'forense' },
      { data: iso(somarDias(p, -2)),  nome: 'Sexta-feira Santa',   abrangencia: 'nacional' },
      { data: iso(somarDias(p, 60)),  nome: 'Corpus Christi',      abrangencia: 'forense' },

      // --- Forenses (sem expediente no Judiciário) ---
      { data: ano + '-08-11', nome: 'Dia do Advogado',            abrangencia: 'forense' },
      { data: ano + '-10-28', nome: 'Dia do Servidor Público',    abrangencia: 'forense' },
      { data: ano + '-11-01', nome: 'Dia de Todos os Santos',     abrangencia: 'forense' },
      { data: ano + '-12-08', nome: 'Dia da Justiça',             abrangencia: 'forense' }
    ];

    return lista;
  }

  /** Mapa { 'YYYY-MM-DD': feriado } cobrindo um intervalo de anos, memoizado. */
  function mapa(anoInicio, anoFim) {
    var chave = anoInicio + ':' + anoFim;
    if (cache[chave]) return cache[chave];

    var m = {};
    for (var ano = anoInicio; ano <= anoFim; ano++) {
      listar(ano).forEach(function (f) {
        // Um feriado nacional prevalece sobre um forense na mesma data.
        if (!m[f.data] || f.abrangencia === 'nacional') m[f.data] = f;
      });
    }

    cache[chave] = m;
    return m;
  }

  /** Mapa amplo o bastante para qualquer navegação do protótipo. */
  function mapaPadrao() {
    var atual = new Date().getFullYear();
    return mapa(atual - 3, atual + 3);
  }

  /** Retorna o feriado da data, ou null. Aceita Date ou string ISO. */
  function ehFeriado(data) {
    var chave = typeof data === 'string' ? data.slice(0, 10) : iso(data);
    return mapaPadrao()[chave] || null;
  }

  /**
   * Recesso forense: CPC art. 220 suspende o curso dos prazos processuais
   * entre 20/12 e 20/01, inclusive.
   */
  function estaEmRecesso(data) {
    var d = typeof data === 'string'
      ? new Date(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10))
      : data;
    var mes = d.getMonth() + 1;
    var dia = d.getDate();
    return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
  }

  /** Feriados dentro de um intervalo, ordenados — usado pelo calendário. */
  function emPeriodo(isoInicio, isoFim) {
    var m = mapaPadrao();
    return Object.keys(m)
      .filter(function (k) { return k >= isoInicio && k <= isoFim; })
      .sort()
      .map(function (k) { return m[k]; });
  }

  App.domain.feriados = {
    pascoa: pascoa,
    listar: listar,
    mapa: mapa,
    mapaPadrao: mapaPadrao,
    ehFeriado: ehFeriado,
    estaEmRecesso: estaEmRecesso,
    emPeriodo: emPeriodo
  };
})(window.App = window.App || {});
