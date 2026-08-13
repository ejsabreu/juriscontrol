/* ==========================================================================
   services/monitoramentoService.js — o que o escritório monitora no diário

   Serviço de recorte funciona assim: o escritório cadastra a OAB de quem
   assina as peças (ou o nome/CNPJ do cliente) e recebe tudo o que sair no
   diário com aquele termo. É o cadastro dessa lista que mora aqui.

   MIGRAÇÃO: as assinaturas já são as do CRUD que a fase 3 vai expor.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(m, usuarios) {
    var lista = usuarios || db().get('usuarios');
    var enums = App.domain.enums;

    return Object.assign({}, m, {
      usuario: lista.filter(function (u) { return u.id === m.usuarioId; })[0] || null,
      rotuloTipo: enums.rotulo(enums.TIPOS_MONITORAMENTO, m.tipo),
      tribunaisRotulos: (m.tribunais || []).map(function (t) {
        return enums.rotulo(enums.TRIBUNAIS, t);
      })
    });
  }

  function listar() {
    return http().requisicao(function () {
      var usuarios = db().get('usuarios');
      return db().get('monitoramentos')
        .map(function (m) { return enriquecer(m, usuarios); })
        .sort(function (a, b) { return a.tipo < b.tipo ? -1 : 1; });
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      var valor = String(dados.valor || '').trim();
      if (!valor) throw http().ErroApi('Informe o termo a monitorar.', 400);

      var tipo = App.domain.enums.achar(App.domain.enums.TIPOS_MONITORAMENTO, dados.tipo);
      if (!tipo) throw http().ErroApi('Tipo de monitoramento inválido.', 400);

      // Monitorar o mesmo termo duas vezes duplicaria toda publicação dele.
      var repetido = db().get('monitoramentos').filter(function (m) {
        return m.tipo === dados.tipo && m.valor === valor && m.uf === (dados.uf || null);
      })[0];
      if (repetido) throw http().ErroApi('Este termo já está sendo monitorado.', 409);

      return enriquecer(db().insert('monitoramentos', {
        tipo: dados.tipo,
        valor: valor,
        uf: dados.uf || null,
        tribunais: dados.tribunais || [],
        usuarioId: dados.usuarioId || null,
        ultimaSincronizacaoEm: null
      }, 'MON'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('monitoramentos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Monitoramento não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      if (!db().remove('monitoramentos', id)) {
        throw http().ErroApi('Monitoramento não encontrado.', 404);
      }
      return { id: id };
    });
  }

  App.services.monitoramentoService = {
    listar: listar,
    criar: criar,
    atualizar: atualizar,
    remover: remover,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
