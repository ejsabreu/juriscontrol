/* ==========================================================================
   utils/format.js — formatação para apresentação
   Migra para o React sem alteração (só troca a IIFE por export).

   Convenção do projeto:
   - datas trafegam internamente como string ISO 'YYYY-MM-DD'
   - dinheiro trafega em CENTAVOS (inteiro), nunca float
   ========================================================================== */

(function (App) {
  'use strict';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                     'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
                     'quinta-feira', 'sexta-feira', 'sábado'];

  /**
   * Converte 'YYYY-MM-DD' em Date LOCAL.
   * new Date('2024-05-10') seria interpretado como UTC e poderia
   * retroceder um dia dependendo do fuso — por isso o parse manual.
   */
  function parseISO(iso) {
    if (!iso) return null;
    if (iso instanceof Date) return iso;
    var partes = String(iso).slice(0, 10).split('-');
    if (partes.length !== 3) return null;
    return new Date(+partes[0], +partes[1] - 1, +partes[2]);
  }

  function toISO(date) {
    if (!date) return '';
    if (typeof date === 'string') return date.slice(0, 10);
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + d;
  }

  /** '2024-05-10' → '10/05/2024' */
  function data(iso) {
    var d = parseISO(iso);
    if (!d) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' +
           d.getFullYear();
  }

  /** '2024-05-10' → '10 de maio de 2024' */
  function dataExtenso(iso) {
    var d = parseISO(iso);
    if (!d) return '—';
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  /** '2024-05-10' → '10 mai' */
  function dataCurta(iso) {
    var d = parseISO(iso);
    if (!d) return '—';
    return d.getDate() + ' ' + MESES_ABREV[d.getMonth()];
  }

  /** '2024-05-10T14:30' → '10/05/2024 14:30' */
  function dataHora(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' +
           d.getFullYear() + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
  }

  function hora(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
  }

  function diaSemana(iso) {
    var d = parseISO(iso);
    return d ? DIAS_SEMANA[d.getDay()] : '';
  }

  /** 'há 3 dias' / 'em 5 dias' — relativo a hoje. */
  function dataRelativa(iso) {
    var d = parseISO(iso);
    if (!d) return '';
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    var diff = Math.round((d - hoje) / 86400000);

    if (diff === 0) return 'hoje';
    if (diff === 1) return 'amanhã';
    if (diff === -1) return 'ontem';
    if (diff > 0) return 'em ' + diff + ' dias';
    return 'há ' + Math.abs(diff) + ' dias';
  }

  /** 125000 (centavos) → 'R$ 1.250,00' */
  function moeda(centavos) {
    if (centavos === null || centavos === undefined || isNaN(centavos)) return '—';
    var valor = centavos / 100;
    return 'R$ ' + valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /** 125000000 (centavos) → 'R$ 1,3 mi' — para cabeçalho de coluna do kanban. */
  function moedaCompacta(centavos) {
    if (!centavos) return 'R$ 0';
    var valor = centavos / 100;
    if (valor >= 1000000) return 'R$ ' + (valor / 1000000).toFixed(1).replace('.', ',') + ' mi';
    if (valor >= 1000) return 'R$ ' + Math.round(valor / 1000) + ' mil';
    return 'R$ ' + Math.round(valor);
  }

  function numero(valor) {
    if (valor === null || valor === undefined) return '—';
    return Number(valor).toLocaleString('pt-BR');
  }

  /** CPF/CNPJ conforme a quantidade de dígitos. */
  function documento(valor) {
    if (!valor) return '—';
    var d = String(valor).replace(/\D/g, '');
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (d.length === 14) {
      return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return valor;
  }

  function telefone(valor) {
    if (!valor) return '—';
    var d = String(valor).replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return valor;
  }

  function cep(valor) {
    if (!valor) return '—';
    var d = String(valor).replace(/\D/g, '');
    return d.replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  /** Iniciais para avatar: 'Maria Silva Costa' → 'MC' */
  function iniciais(nome) {
    if (!nome) return '?';
    var todas = String(nome).trim().split(/\s+/);
    // Descarta conectivos ("de", "da", "dos") para não gerar iniciais como "MD".
    var partes = todas.filter(function (p) { return p.length > 2; });
    if (partes.length === 0) partes = todas;
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  function truncar(texto, max) {
    if (!texto) return '';
    var t = String(texto);
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  function bytes(n) {
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }

  function plural(n, singular, pluralForma) {
    return n === 1 ? singular : (pluralForma || singular + 's');
  }

  App.format = {
    parseISO: parseISO,
    toISO: toISO,
    data: data,
    dataExtenso: dataExtenso,
    dataCurta: dataCurta,
    dataHora: dataHora,
    hora: hora,
    diaSemana: diaSemana,
    dataRelativa: dataRelativa,
    moeda: moeda,
    moedaCompacta: moedaCompacta,
    numero: numero,
    documento: documento,
    telefone: telefone,
    cep: cep,
    iniciais: iniciais,
    truncar: truncar,
    bytes: bytes,
    plural: plural,
    MESES: MESES,
    MESES_ABREV: MESES_ABREV,
    DIAS_SEMANA: DIAS_SEMANA
  };
})(window.App = window.App || {});
