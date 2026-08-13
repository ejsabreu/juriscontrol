/* ==========================================================================
   services/tarefaService.js
       listar(filtros)      → GET   /api/tarefas?...
       mudarStatus(id, st)  → PATCH /api/tarefas/:id
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(tarefa, ctx) {
    var contexto = ctx || {
      processos: db().get('processos'),
      usuarios: db().get('usuarios'),
      pessoas: db().get('pessoas')
    };

    var processo = contexto.processos.filter(function (p) { return p.id === tarefa.processoId; })[0] || null;
    var responsavel = contexto.usuarios.filter(function (u) { return u.id === tarefa.responsavelId; })[0] || null;
    var cliente = contexto.pessoas.filter(function (p) { return p.id === tarefa.clienteId; })[0] || null;

    var checklist = tarefa.checklist || [];
    var feitos = checklist.filter(function (i) { return i.feito; }).length;

    var hoje = App.domain.prazos.hojeISO();

    return Object.assign({}, tarefa, {
      processo: processo,
      processoNumero: processo ? processo.numeroInterno : null,
      responsavel: responsavel,
      responsavelNome: responsavel ? responsavel.nome : '—',
      clienteNome: cliente ? cliente.nome : '—',
      checklistTotal: checklist.length,
      checklistFeitos: feitos,
      progresso: checklist.length ? Math.round((feitos / checklist.length) * 100) : null,
      atrasada: tarefa.status !== 'concluida' && tarefa.dataVencimento < hoje
    });
  }

  function listar(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var contexto = {
        processos: db().get('processos'),
        usuarios: db().get('usuarios'),
        pessoas: db().get('pessoas')
      };

      var lista = db().get('tarefas').map(function (t) { return enriquecer(t, contexto); });

      lista = lista.filter(function (t) {
        if (f.status && t.status !== f.status) return false;
        if (f.responsavelId && t.responsavelId !== f.responsavelId) return false;
        if (f.processoId && t.processoId !== f.processoId) return false;
        if (f.prioridade && t.prioridade !== f.prioridade) return false;
        if (f.apenasAtrasadas && !t.atrasada) return false;

        if (f.busca) {
          var termo = String(f.busca).toLowerCase();
          var alvo = [t.titulo, t.descricao, t.processoNumero, t.clienteNome,
                      t.responsavelNome].join(' ').toLowerCase();
          if (alvo.indexOf(termo) === -1) return false;
        }
        return true;
      });

      var pesos = {};
      App.domain.enums.PRIORIDADES.forEach(function (p) { pesos[p.id] = p.peso; });

      lista.sort(function (a, b) {
        if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
        var dp = (pesos[b.prioridade] || 0) - (pesos[a.prioridade] || 0);
        if (dp !== 0) return dp;
        return a.dataVencimento < b.dataVencimento ? -1 : 1;
      });

      return { itens: lista, total: lista.length };
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      return enriquecer(db().insert('tarefas', Object.assign({
        status: 'a_fazer',
        prioridade: 'media',
        checklist: [],
        descricao: '',
        concluidoEm: null
      }, dados), 'TRF'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizada = db().update('tarefas', id, alteracoes);
      if (!atualizada) throw http().ErroApi('Tarefa não encontrada.', 404);
      return enriquecer(atualizada);
    });
  }

  /** Movimentação do kanban de tarefas. */
  function mudarStatus(id, status) {
    return atualizar(id, {
      status: status,
      concluidoEm: status === 'concluida' ? App.domain.prazos.hojeISO() : null
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      db().remove('tarefas', id);
      return { id: id };
    });
  }

  function resumo() {
    return http().requisicao(function () {
      var hoje = App.domain.prazos.hojeISO();
      var todas = db().get('tarefas');
      var abertas = todas.filter(function (t) { return t.status !== 'concluida'; });

      return {
        total: todas.length,
        abertas: abertas.length,
        atrasadas: abertas.filter(function (t) { return t.dataVencimento < hoje; }).length,
        concluidas: todas.filter(function (t) { return t.status === 'concluida'; }).length
      };
    });
  }

  App.services.tarefaService = {
    listar: listar,
    criar: criar,
    atualizar: atualizar,
    mudarStatus: mudarStatus,
    remover: remover,
    resumo: resumo,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
