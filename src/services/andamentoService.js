/* ==========================================================================
   services/andamentoService.js
       listar(filtros) → GET  /api/andamentos?processoId=...
       criar(dados)    → POST /api/andamentos

   Na fase 2, a captura de publicações do DJe alimenta esta mesma coleção
   com origem = 'publicacao' — por isso o campo já existe.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(andamento, ctx) {
    var contexto = ctx || {
      usuarios: db().get('usuarios'),
      processos: db().get('processos')
    };

    var autor = contexto.usuarios.filter(function (u) { return u.id === andamento.autorId; })[0] || null;
    var processo = contexto.processos.filter(function (p) { return p.id === andamento.processoId; })[0] || null;

    return Object.assign({}, andamento, {
      autor: autor,
      autorNome: autor ? autor.nome : 'Sistema',
      processo: processo,
      processoNumero: processo ? processo.numeroInterno : null
    });
  }

  function listar(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var contexto = {
        usuarios: db().get('usuarios'),
        processos: db().get('processos')
      };

      var lista = db().get('andamentos').map(function (a) { return enriquecer(a, contexto); });

      lista = lista.filter(function (a) {
        if (f.processoId && a.processoId !== f.processoId) return false;
        if (f.tipo && a.tipo !== f.tipo) return false;
        if (f.origem && a.origem !== f.origem) return false;
        if (f.apenasVisiveisCliente && !a.visivelCliente) return false;
        if (f.de && a.data < f.de) return false;
        if (f.ate && a.data > f.ate) return false;
        if (f.busca) {
          var termo = String(f.busca).toLowerCase();
          if ((a.titulo + ' ' + a.descricao).toLowerCase().indexOf(termo) === -1) return false;
        }
        return true;
      });

      lista.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });

      if (f.limite) lista = lista.slice(0, f.limite);

      return { itens: lista, total: lista.length };
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      return enriquecer(db().insert('andamentos', Object.assign({
        data: App.domain.prazos.hojeISO(),
        tipo: 'movimentacao',
        origem: 'manual',
        visivelCliente: true,
        descricao: '',
        documentosIds: []
      }, dados), 'AND'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('andamentos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Andamento não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      db().remove('andamentos', id);
      return { id: id };
    });
  }

  App.services.andamentoService = {
    listar: listar,
    criar: criar,
    atualizar: atualizar,
    remover: remover
  };
})(window.App = window.App || {});
