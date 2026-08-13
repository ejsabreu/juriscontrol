/* ==========================================================================
   domain/prazos.js — motor de contagem de prazos processuais
   LÓGICA PURA — migra para o React sem nenhuma alteração.

   Regras implementadas (CPC/2015):
   - Art. 219      Prazos processuais contam-se apenas em DIAS ÚTEIS
   - Art. 224      Exclui-se o dia do começo, inclui-se o do vencimento
   - Art. 224 §1º  Vencendo em dia sem expediente, PRORROGA para o dia útil seguinte
   - Art. 224 §2º  Publicação = 1º dia útil seguinte à disponibilização no DJe
   - Art. 224 §3º  A contagem inicia no 1º dia útil seguinte à publicação
   - Art. 220      Suspensão dos prazos entre 20/12 e 20/01, inclusive
   - Art. 229      Prazo em dobro para litisconsortes com procuradores distintos

   Toda data entra e sai como string ISO 'YYYY-MM-DD'.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  var feriados = null;   // resolvido em tempo de chamada, não de definição
  function fer() {
    if (!feriados) feriados = App.domain.feriados;
    return feriados;
  }

  var MAX_ITERACOES = 3000;   // trava de segurança contra laço infinito

  // --- Conversões -----------------------------------------------------------

  function paraDate(valor) {
    if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    if (!valor) return null;
    var s = String(valor).slice(0, 10);
    return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  }

  function paraISO(date) {
    if (!date) return null;
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + d;
  }

  function addDias(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  function hojeISO() {
    return paraISO(new Date());
  }

  // --- Classificação de dias ------------------------------------------------

  function ehFimDeSemana(data) {
    var d = paraDate(data);
    return d.getDay() === 0 || d.getDay() === 6;
  }

  /** Dia útil = não é fim de semana e não é feriado (nacional ou forense). */
  function ehDiaUtil(data) {
    var d = paraDate(data);
    if (ehFimDeSemana(d)) return false;
    return !fer().ehFeriado(paraISO(d));
  }

  /** Dia suspenso = dentro do recesso do art. 220 (o prazo não corre). */
  function ehDiaSuspenso(data) {
    return fer().estaEmRecesso(paraDate(data));
  }

  /**
   * Dia contável = dia útil que não está suspenso.
   * É a unidade que o motor soma para chegar à data fatal.
   */
  function ehDiaContavel(data) {
    return ehDiaUtil(data) && !ehDiaSuspenso(data);
  }

  /** Motivo pelo qual um dia não é contável — usado na memória de cálculo. */
  function motivoNaoContavel(data) {
    var d = paraDate(data);
    if (ehFimDeSemana(d)) return 'fim de semana';
    var f = fer().ehFeriado(paraISO(d));
    if (f) return f.nome;
    if (ehDiaSuspenso(d)) return 'recesso forense (art. 220)';
    return null;
  }

  // --- Navegação entre dias -------------------------------------------------

  /** A própria data, se for contável; senão a primeira contável seguinte. */
  function diaUtilOuSeguinte(data) {
    var d = paraDate(data);
    var i = 0;
    while (!ehDiaContavel(d) && i++ < MAX_ITERACOES) d = addDias(d, 1);
    return d;
  }

  /** A primeira data contável estritamente posterior. */
  function proximoDiaUtil(data) {
    return diaUtilOuSeguinte(addDias(paraDate(data), 1));
  }

  function diaUtilAnterior(data) {
    var d = addDias(paraDate(data), -1);
    var i = 0;
    while (!ehDiaContavel(d) && i++ < MAX_ITERACOES) d = addDias(d, -1);
    return d;
  }

  /**
   * Soma n dias contáveis a partir de `data`, contando a própria `data`
   * como dia 1 quando ela for contável (semântica do art. 224).
   */
  function somarDiasUteis(data, n) {
    if (n <= 0) return paraDate(data);
    var d = diaUtilOuSeguinte(data);
    var contados = 1;
    var i = 0;
    while (contados < n && i++ < MAX_ITERACOES) {
      d = addDias(d, 1);
      if (ehDiaContavel(d)) contados++;
    }
    return d;
  }

  /** Subtrai n dias contáveis — usado para achar o prazo interno de segurança. */
  function subtrairDiasUteis(data, n) {
    var d = paraDate(data);
    for (var i = 0; i < n; i++) d = diaUtilAnterior(d);
    return d;
  }

  /**
   * Dias contáveis no intervalo (inicio, fim] — exclui o início, inclui o fim.
   * Responde "quantos dias úteis faltam". Negativo se `fim` já passou.
   */
  function diasUteisEntre(inicio, fim) {
    var a = paraDate(inicio);
    var b = paraDate(fim);
    if (!a || !b) return 0;

    var sinal = b >= a ? 1 : -1;
    var de = sinal > 0 ? a : b;
    var ate = sinal > 0 ? b : a;

    var total = 0;
    var cursor = addDias(de, 1);
    var i = 0;
    while (cursor <= ate && i++ < MAX_ITERACOES) {
      if (ehDiaContavel(cursor)) total++;
      cursor = addDias(cursor, 1);
    }
    return total * sinal;
  }

  function diasCorridosEntre(inicio, fim) {
    var a = paraDate(inicio);
    var b = paraDate(fim);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }

  // --- Semáforo -------------------------------------------------------------

  var LIMITE_CRITICO = 2;
  var LIMITE_ATENCAO = 5;

  /**
   * Classifica a urgência pela quantidade de dias úteis restantes.
   * É o que dá cor ao card no kanban, na agenda e no dashboard.
   */
  function semaforo(diasRestantes) {
    if (diasRestantes < 0) return 'vencido';
    if (diasRestantes <= LIMITE_CRITICO) return 'critico';
    if (diasRestantes <= LIMITE_ATENCAO) return 'atencao';
    return 'ok';
  }

  var ROTULOS_SEMAFORO = {
    ok: 'No prazo',
    atencao: 'Atenção',
    critico: 'Crítico',
    vencido: 'Vencido',
    cumprido: 'Cumprido'
  };

  /**
   * Estado de urgência de um prazo já persistido.
   * Prazo baixado não tem urgência — sai do semáforo.
   */
  function avaliar(prazo, referencia) {
    var hoje = referencia || hojeISO();

    if (prazo.status === 'cumprido' || prazo.status === 'cancelado') {
      return { semaforo: 'cumprido', diasRestantes: null, rotulo: ROTULOS_SEMAFORO.cumprido };
    }
    if (prazo.status === 'perdido') {
      return { semaforo: 'vencido', diasRestantes: null, rotulo: 'Perdido' };
    }

    var restantes = diasUteisEntre(hoje, prazo.dataFatal);
    // diasUteisEntre exclui o dia inicial: se a data fatal é hoje, resulta 0 → crítico.
    if (prazo.dataFatal < hoje) restantes = -Math.abs(diasCorridosEntre(prazo.dataFatal, hoje));

    var sem = semaforo(restantes);
    return {
      semaforo: sem,
      diasRestantes: restantes,
      rotulo: ROTULOS_SEMAFORO[sem],
      vencendoHoje: prazo.dataFatal === hoje
    };
  }

  // --- Cálculo completo -----------------------------------------------------

  /**
   * Calcula todas as datas de um prazo a partir da disponibilização no DJe.
   *
   * @param {Object} opcoes
   * @param {string} opcoes.dataDisponibilizacao  ISO — data no diário eletrônico
   * @param {number} opcoes.dias                  prazo legal (ex.: 15)
   * @param {string} [opcoes.tipoContagem]        'uteis' (padrão) | 'corridos'
   * @param {number} [opcoes.diasAntecedencia]    folga interna do escritório (padrão 3)
   * @param {boolean}[opcoes.dobro]               art. 229 — prazo em dobro
   * @param {boolean}[opcoes.jaPublicado]         a data informada já é a da publicação
   * @returns {Object} datas calculadas + memória de cálculo
   */
  function calcular(opcoes) {
    var o = opcoes || {};
    var dias = Number(o.dias) || 0;
    var tipoContagem = o.tipoContagem || 'uteis';
    var antecedencia = o.diasAntecedencia === undefined ? 3 : Number(o.diasAntecedencia);
    var memoria = [];

    var disponibilizacao = paraDate(o.dataDisponibilizacao);
    if (!disponibilizacao || !dias) return null;

    // Passo 1 — publicação (art. 224 §2º)
    var publicacao;
    if (o.jaPublicado) {
      publicacao = disponibilizacao;
      memoria.push({
        passo: 'Publicação',
        data: paraISO(publicacao),
        texto: 'Data informada já é a da publicação.'
      });
    } else {
      publicacao = proximoDiaUtil(disponibilizacao);
      memoria.push({
        passo: 'Publicação',
        data: paraISO(publicacao),
        texto: 'Art. 224 §2º — 1º dia útil seguinte à disponibilização no DJe (' +
               formatarBR(disponibilizacao) + ').'
      });
    }

    // Passo 2 — início da contagem (art. 224 §3º)
    var inicio = proximoDiaUtil(publicacao);
    memoria.push({
      passo: 'Início da contagem',
      data: paraISO(inicio),
      texto: 'Art. 224 §3º — 1º dia útil seguinte à publicação. Este é o dia 1 do prazo.'
    });

    // Passo 3 — prazo aplicável (art. 229)
    var diasEfetivos = o.dobro ? dias * 2 : dias;
    if (o.dobro) {
      memoria.push({
        passo: 'Prazo em dobro',
        data: null,
        texto: 'Art. 229 — litisconsortes com procuradores distintos: ' +
               dias + ' → ' + diasEfetivos + ' dias.'
      });
    }

    // Passo 4 — data fatal
    var fatal;
    var suspensoes = [];

    if (tipoContagem === 'corridos') {
      fatal = addDias(inicio, diasEfetivos - 1);
      if (!ehDiaContavel(fatal)) {
        var motivoOriginal = motivoNaoContavel(fatal);
        var prorrogada = diaUtilOuSeguinte(fatal);
        memoria.push({
          passo: 'Prorrogação',
          data: paraISO(prorrogada),
          texto: 'Art. 224 §1º — o termo final caiu em ' + formatarBR(fatal) +
                 ' (' + motivoOriginal + '), prorrogado para o dia útil seguinte.'
        });
        fatal = prorrogada;
      }
      memoria.push({
        passo: 'Data fatal',
        data: paraISO(fatal),
        texto: diasEfetivos + ' dias corridos a partir de ' + formatarBR(inicio) + '.'
      });
    } else {
      // Percorre dia a dia registrando o que foi pulado — é isso que
      // permite a tela mostrar POR QUE a data fatal é aquela.
      var cursor = new Date(inicio.getTime());
      var contados = 1;
      var guarda = 0;

      while (contados < diasEfetivos && guarda++ < MAX_ITERACOES) {
        cursor = addDias(cursor, 1);
        if (ehDiaContavel(cursor)) {
          contados++;
        } else {
          suspensoes.push({ data: paraISO(cursor), motivo: motivoNaoContavel(cursor) });
        }
      }
      fatal = cursor;

      var recessoPulado = suspensoes.filter(function (s) {
        return s.motivo && s.motivo.indexOf('recesso') === 0;
      }).length;

      memoria.push({
        passo: 'Data fatal',
        data: paraISO(fatal),
        texto: diasEfetivos + ' dias úteis (art. 219) a partir de ' + formatarBR(inicio) +
               '. Foram pulados ' + suspensoes.length + ' dias não contáveis' +
               (recessoPulado ? ', sendo ' + recessoPulado + ' de recesso forense' : '') + '.'
      });
    }

    // Passo 5 — prazo interno de segurança
    var interna = antecedencia > 0 ? subtrairDiasUteis(fatal, antecedencia) : fatal;
    if (antecedencia > 0) {
      memoria.push({
        passo: 'Prazo interno',
        data: paraISO(interna),
        texto: antecedencia + ' dias úteis de antecedência sobre a data fatal ' +
               '(política do escritório, não é prazo legal).'
      });
    }

    var hoje = hojeISO();
    var restantes = paraISO(fatal) < hoje
      ? -Math.abs(diasCorridosEntre(fatal, hoje))
      : diasUteisEntre(hoje, fatal);

    return {
      dataDisponibilizacao: paraISO(disponibilizacao),
      dataPublicacao: paraISO(publicacao),
      dataInicioContagem: paraISO(inicio),
      dataFatal: paraISO(fatal),
      dataInterna: paraISO(interna),
      diasEfetivos: diasEfetivos,
      tipoContagem: tipoContagem,
      diasAntecedencia: antecedencia,
      diasRestantes: restantes,
      semaforo: semaforo(restantes),
      diasPulados: suspensoes,
      memoria: memoria
    };
  }

  function formatarBR(date) {
    var d = paraDate(date);
    if (!d) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  App.domain.prazos = {
    paraDate: paraDate,
    paraISO: paraISO,
    hojeISO: hojeISO,
    addDias: addDias,
    ehFimDeSemana: ehFimDeSemana,
    ehDiaUtil: ehDiaUtil,
    ehDiaSuspenso: ehDiaSuspenso,
    ehDiaContavel: ehDiaContavel,
    motivoNaoContavel: motivoNaoContavel,
    diaUtilOuSeguinte: diaUtilOuSeguinte,
    proximoDiaUtil: proximoDiaUtil,
    diaUtilAnterior: diaUtilAnterior,
    somarDiasUteis: somarDiasUteis,
    subtrairDiasUteis: subtrairDiasUteis,
    diasUteisEntre: diasUteisEntre,
    diasCorridosEntre: diasCorridosEntre,
    semaforo: semaforo,
    avaliar: avaliar,
    calcular: calcular,
    ROTULOS_SEMAFORO: ROTULOS_SEMAFORO
  };
})(window.App = window.App || {});
