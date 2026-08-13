/* ==========================================================================
   store/selectors.js — derivações puras sobre listas já carregadas

   Funções puras (entrada → saída, sem efeito colateral). No React viram
   useMemo ou selectors do Zustand/Reselect, com o corpo idêntico.
   ========================================================================== */

(function (App) {
  'use strict';

  var selectors = {};

  /**
   * Monta as colunas do kanban de processos.
   *
   * O agrupamento decide as colunas: por fase usa a ordem do rito processual
   * (colunas vazias continuam visíveis, porque a fase existe mesmo sem
   * processo nela); por responsável ou área, só aparece quem tem processo.
   *
   * @param {Array}  processos    já enriquecidos
   * @param {string} agruparPor   'faseId' | 'responsavelId' | 'areaId'
   * @param {Array}  usuarios
   * @returns {Array<{id,label,cor,itens,total,somaValor}>}
   */
  function colunasKanbanProcessos(processos, agruparPor, usuarios) {
    var enums = App.domain.enums;
    var definicoes;

    if (agruparPor === 'responsavelId') {
      var comProcesso = {};
      processos.forEach(function (p) { comProcesso[p.responsavelId] = true; });
      definicoes = (usuarios || [])
        .filter(function (u) { return comProcesso[u.id]; })
        .map(function (u) { return { id: u.id, label: u.nome, cor: u.cor }; });

    } else if (agruparPor === 'areaId') {
      var areasUsadas = {};
      processos.forEach(function (p) { areasUsadas[p.areaId] = true; });
      definicoes = enums.AREAS
        .filter(function (a) { return areasUsadas[a.id]; })
        .map(function (a) { return { id: a.id, label: a.label, cor: a.cor }; });

    } else {
      // Fase é o padrão: mantém a ordem do rito e todas as colunas visíveis.
      definicoes = enums.FASES.map(function (fase) {
        return { id: fase.id, label: fase.label, cor: fase.cor, descricao: fase.descricao };
      });
    }

    var porColuna = {};
    definicoes.forEach(function (d) { porColuna[d.id] = []; });

    var semColuna = [];
    processos.forEach(function (p) {
      var chave = p[agruparPor];
      if (porColuna[chave]) porColuna[chave].push(p);
      else semColuna.push(p);
    });

    var colunas = definicoes.map(function (d) {
      var itens = porColuna[d.id];
      return Object.assign({}, d, {
        itens: itens,
        total: itens.length,
        somaValor: itens.reduce(function (soma, p) { return soma + (p.valorCausa || 0); }, 0)
      });
    });

    if (semColuna.length) {
      colunas.push({
        id: '__sem__',
        label: 'Sem classificação',
        cor: 'var(--color-text-subtle)',
        itens: semColuna,
        total: semColuna.length,
        somaValor: semColuna.reduce(function (s, p) { return s + (p.valorCausa || 0); }, 0)
      });
    }

    return colunas;
  }

  /** Colunas do kanban de tarefas — sempre os 4 status, na ordem do fluxo. */
  function colunasKanbanTarefas(tarefas) {
    return App.domain.enums.STATUS_TAREFA.map(function (status) {
      var itens = tarefas.filter(function (t) { return t.status === status.id; });
      return {
        id: status.id,
        label: status.label,
        cor: status.cor,
        itens: itens,
        total: itens.length,
        atrasadas: itens.filter(function (t) { return t.atrasada; }).length
      };
    });
  }

  /** Agrupa qualquer lista por uma chave ou função. */
  function agrupar(lista, chave) {
    var fn = typeof chave === 'function' ? chave : function (item) { return item[chave]; };
    var mapa = {};
    lista.forEach(function (item) {
      var k = fn(item);
      if (!mapa[k]) mapa[k] = [];
      mapa[k].push(item);
    });
    return mapa;
  }

  function somar(lista, campo) {
    return lista.reduce(function (soma, item) { return soma + (Number(item[campo]) || 0); }, 0);
  }

  /** Distribuição percentual — alimenta as barras empilhadas do dashboard. */
  function distribuicao(contagens, definicoes) {
    var total = definicoes.reduce(function (s, d) { return s + (contagens[d.id] || 0); }, 0);
    return definicoes.map(function (d) {
      var valor = contagens[d.id] || 0;
      return {
        id: d.id,
        label: d.label,
        cor: d.cor,
        valor: valor,
        percentual: total ? (valor / total) * 100 : 0
      };
    });
  }

  /** Quantos filtros estão ativos — mostra o "limpar filtros" no momento certo. */
  function filtrosAtivos(filtros, ignorar) {
    var ignorados = ignorar || ['ordenarPor', 'direcao', 'pagina', 'porPagina'];
    return Object.keys(filtros).filter(function (chave) {
      if (ignorados.indexOf(chave) !== -1) return false;
      var v = filtros[chave];
      return v !== '' && v !== null && v !== undefined && v !== false;
    }).length;
  }

  selectors.colunasKanbanProcessos = colunasKanbanProcessos;
  selectors.colunasKanbanTarefas = colunasKanbanTarefas;
  selectors.agrupar = agrupar;
  selectors.somar = somar;
  selectors.distribuicao = distribuicao;
  selectors.filtrosAtivos = filtrosAtivos;

  App.selectors = selectors;
})(window.App = window.App || {});
