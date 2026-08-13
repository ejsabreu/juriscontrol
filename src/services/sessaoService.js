/* ==========================================================================
   services/sessaoService.js — sessão do usuário

   SIMULADO, e a tela de entrada diz isso: escolher um usuário de uma lista
   não é autenticação. Não há senha, não há hash, não há prova de identidade.

   O que é REAL aqui: a sessão existe, expira, é restaurada ao recarregar, e
   tudo o que o sistema faz depois passa pela matriz de permissões de
   `domain/permissoes.js`. A identidade é fingida; o controle de acesso que
   se apoia nela, não.

   MIGRAÇÃO:
       entrar(credenciais) → POST /api/sessao       (e volta um JWT)
       sair()              → DELETE /api/sessao
       restaurar()         → GET  /api/sessao/atual
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  var CHAVE = 'jurisctrl.sessao.v1';
  var DURACAO_HORAS = 12;

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function agora() { return new Date(); }

  function gravar(sessao) {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(sessao));
    } catch (e) { /* storage indisponível — a sessão vale só nesta aba */ }
  }

  function lerGravada() {
    try {
      var bruto = window.localStorage.getItem(CHAVE);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      return null;
    }
  }

  function apagarGravada() {
    try { window.localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
  }

  function montar(usuario) {
    var inicio = agora();
    var fim = new Date(inicio.getTime() + DURACAO_HORAS * 3600000);
    return {
      usuarioId: usuario.id,
      perfil: usuario.perfil,
      iniciadaEm: inicio.toISOString(),
      expiraEm: fim.toISOString()
    };
  }

  function expirou(sessao) {
    if (!sessao || !sessao.expiraEm) return true;
    return new Date(sessao.expiraEm).getTime() <= agora().getTime();
  }

  /** Usuários oferecidos na tela de entrada — um por perfil, no mínimo. */
  function listarUsuarios() {
    return http().requisicao(function () {
      var perfis = App.domain.enums.PERFIS;
      return db().get('usuarios')
        .slice()
        .sort(function (a, b) {
          var ia = perfis.map(function (p) { return p.id; }).indexOf(a.perfil);
          var ib = perfis.map(function (p) { return p.id; }).indexOf(b.perfil);
          return ia - ib || a.nome.localeCompare(b.nome, 'pt-BR');
        });
    });
  }

  /**
   * "Autenticação" do protótipo: recebe um id e confia nele.
   * A assinatura já é a da fase 3 — lá entra `{ email, senha }`.
   */
  function entrar(usuarioId) {
    return http().requisicao(function () {
      var usuario = db().find('usuarios', usuarioId);
      if (!usuario) throw http().ErroApi('Usuário não encontrado.', 404);
      if (usuario.ativo === false) throw http().ErroApi('Usuário inativo.', 403);

      var sessao = montar(usuario);
      gravar(sessao);
      App.store.setState({ usuarioAtual: usuario, sessao: sessao });

      if (App.services.auditoriaService) {
        App.services.auditoriaService.registrar({
          acao: 'entrar',
          colecao: 'usuarios',
          entidadeId: usuario.id,
          resumo: usuario.nome + ' entrou no sistema'
        });
      }

      return { usuario: usuario, sessao: sessao };
    });
  }

  function sair() {
    return http().requisicao(function () {
      var usuario = App.store.getState().usuarioAtual;
      if (usuario && App.services.auditoriaService) {
        App.services.auditoriaService.registrar({
          acao: 'entrar',
          colecao: 'usuarios',
          entidadeId: usuario.id,
          resumo: usuario.nome + ' saiu do sistema'
        });
      }
      apagarGravada();
      App.store.setState({ usuarioAtual: null, sessao: null });
      return { ok: true };
    });
  }

  /**
   * Restaura a sessão gravada. SÍNCRONO de propósito: roda no bootstrap,
   * antes da primeira rota, e uma Promise aqui abriria a janela em que a
   * aplicação existe sem saber quem é o usuário.
   *
   * @returns {object|null} o usuário, ou null se não há sessão válida
   */
  function restaurar() {
    var sessao = lerGravada();
    if (!sessao) return null;

    if (expirou(sessao)) {
      apagarGravada();
      return null;
    }

    var usuario = db().find('usuarios', sessao.usuarioId);
    if (!usuario) {
      apagarGravada();
      return null;
    }

    App.store.setState({ usuarioAtual: usuario, sessao: sessao });
    return usuario;
  }

  /** Usuário da sessão corrente — a fonte única para permissões. */
  function atual() {
    return App.store.getState().usuarioAtual || null;
  }

  function ativa() {
    var sessao = App.store.getState().sessao;
    return !!atual() && !expirou(sessao);
  }

  /** Atalho: `sessaoService.pode('financeiro.ver')`. */
  function pode(recurso) {
    return App.domain.permissoes.pode(atual(), recurso);
  }

  App.services.sessaoService = {
    listarUsuarios: listarUsuarios,
    entrar: entrar,
    sair: sair,
    restaurar: restaurar,
    atual: atual,
    ativa: ativa,
    pode: pode,
    DURACAO_HORAS: DURACAO_HORAS
  };
})(window.App = window.App || {});
