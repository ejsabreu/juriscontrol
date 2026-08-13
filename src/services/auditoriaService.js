/* ==========================================================================
   services/auditoriaService.js — trilha de auditoria

   Pluga-se no gancho que F2.0 deixou em `db.js`: toda escrita passa por aqui
   e vira registro. É defesa profissional, não enfeite — em escritório de
   advocacia, saber quem alterou o quê e quando é o que sustenta a versão do
   escritório numa reclamação.

   DUAS DECISÕES QUE MOLDAM O ARQUIVO:

   1. Recursão. Gravar o log é uma escrita, que dispara o gancho, que grava
      outro log — laço infinito na primeira alteração. Barrado em dois
      níveis: a coleção `logsAuditoria` é ignorada, e há uma trava de
      reentrância para o caso de alguém plugar outro gancho por cima.

   2. Tamanho. Guardar o objeto inteiro antes e depois estouraria os 5 MB do
      localStorage em poucas centenas de edições. O registro guarda apenas
      os CAMPOS QUE MUDARAM — que é, não por acaso, exatamente o que a tela
      de auditoria mostra.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  /* Ruído: mudam em toda escrita e não dizem nada a quem lê a trilha. */
  var CAMPOS_IGNORADOS = ['atualizadoEm', 'criadoEm', 'id'];

  var ligado = false;
  var gravando = false;   // trava de reentrância

  function usuarioAtualId() {
    var u = App.store.getState().usuarioAtual;
    return u ? u.id : null;
  }

  /** Valor compacto: objeto e array viram resumo, não JSON inteiro. */
  function resumirValor(valor) {
    if (valor === null || valor === undefined) return null;
    if (Array.isArray(valor)) return '[' + valor.length + ' item(ns)]';
    if (typeof valor === 'object') return '{…}';
    if (typeof valor === 'string' && valor.length > 120) return valor.slice(0, 117) + '…';
    return valor;
  }

  /**
   * Campos que mudaram entre dois estados do mesmo registro.
   * @returns {Array} [{ campo, de, para }]
   */
  function diferencas(antes, depois) {
    if (!depois) return [];
    var lista = [];
    var chaves = Object.keys(depois);

    if (antes) {
      Object.keys(antes).forEach(function (c) {
        if (chaves.indexOf(c) === -1) chaves.push(c);
      });
    }

    chaves.forEach(function (campo) {
      if (CAMPOS_IGNORADOS.indexOf(campo) !== -1) return;

      var de = antes ? antes[campo] : undefined;
      var para = depois[campo];
      if (JSON.stringify(de) === JSON.stringify(para)) return;

      lista.push({ campo: campo, de: resumirValor(de), para: resumirValor(para) });
    });

    return lista;
  }

  /** Rótulo curto do registro afetado, para a trilha ser legível. */
  function descrever(colecao, registro) {
    if (!registro) return colecao;
    return registro.numeroCnj || registro.titulo || registro.nome ||
           registro.descricao || registro.id || colecao;
  }

  /**
   * Grava um evento. Usado pelo gancho e também à mão, para o que não é
   * escrita no banco: consulta a dado sensível, exportação, compartilhamento.
   */
  function registrar(evento) {
    var e = evento || {};
    if (gravando) return null;          // não audita a própria auditoria

    gravando = true;
    try {
      return db().insert('logsAuditoria', {
        quando: new Date().toISOString(),
        usuarioId: e.usuarioId !== undefined ? e.usuarioId : usuarioAtualId(),
        acao: e.acao || 'atualizar',
        colecao: e.colecao || null,
        entidadeId: e.entidadeId || null,
        resumo: e.resumo || null,
        alteracoes: e.alteracoes || [],
        origem: e.origem || 'ui'
      }, 'LOG');
    } finally {
      gravando = false;
    }
  }

  /** Gancho instalado em db.js — recebe toda escrita do sistema. */
  function aoEscrever(colecao, acao, antes, depois) {
    if (colecao === 'logsAuditoria') return;   // barreira nº 1
    if (gravando) return;                      // barreira nº 2

    var alteracoes = acao === 'criar' ? [] : diferencas(antes, depois);

    // Alteração que não mudou nada de relevante não vira linha na trilha.
    if (acao === 'atualizar' && alteracoes.length === 0) return;

    registrar({
      acao: acao,
      colecao: colecao,
      entidadeId: (depois && depois.id) || (antes && antes.id) || null,
      resumo: descrever(colecao, depois || antes),
      alteracoes: alteracoes
    });
  }

  function iniciar() {
    if (ligado) return;
    db().configurarAuditoria(aoEscrever);
    ligado = true;
  }

  function parar() {
    db().configurarAuditoria(null);
    ligado = false;
  }

  function estaLigada() { return ligado; }

  /**
   * @param {object} f  usuarioId, acao, colecao, entidadeId, de, ate, busca,
   *                    pagina, porPagina
   */
  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var usuarios = db().get('usuarios');

      function usuario(id) {
        return usuarios.filter(function (u) { return u.id === id; })[0] || null;
      }

      var lista = db().get('logsAuditoria')
        .map(function (log) {
          var u = usuario(log.usuarioId);
          return Object.assign({}, log, {
            usuario: u,
            usuarioNome: u ? u.nome : 'Sistema',
            data: String(log.quando).slice(0, 10)
          });
        })
        .filter(function (log) {
          if (filtros.usuarioId && log.usuarioId !== filtros.usuarioId) return false;
          if (filtros.acao && log.acao !== filtros.acao) return false;
          if (filtros.colecao && log.colecao !== filtros.colecao) return false;
          if (filtros.entidadeId && log.entidadeId !== filtros.entidadeId) return false;
          if (filtros.de && log.data < filtros.de) return false;
          if (filtros.ate && log.data > filtros.ate) return false;

          if (filtros.busca) {
            var termo = String(filtros.busca).toLowerCase();
            var alvo = [log.resumo, log.colecao, log.entidadeId, log.usuarioNome]
              .join(' ').toLowerCase();
            if (alvo.indexOf(termo) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });   // recente primeiro

      var total = lista.length;
      var pagina = filtros.pagina || 1;
      var porPagina = filtros.porPagina || 30;
      var inicio = (pagina - 1) * porPagina;

      return {
        itens: lista.slice(inicio, inicio + porPagina),
        total: total,
        pagina: pagina,
        porPagina: porPagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina))
      };
    });
  }

  /** Coleções presentes na trilha — alimenta o filtro da tela. */
  function colecoesRegistradas() {
    var vistas = {};
    db().get('logsAuditoria').forEach(function (log) {
      if (log.colecao) vistas[log.colecao] = true;
    });
    return Object.keys(vistas).sort();
  }

  /** Trilha de um registro específico — usada na ficha do processo. */
  function historicoDe(colecao, entidadeId) {
    return listar({ colecao: colecao, entidadeId: entidadeId, porPagina: 200 });
  }

  App.services.auditoriaService = {
    iniciar: iniciar,
    parar: parar,
    estaLigada: estaLigada,
    registrar: registrar,
    listar: listar,
    historicoDe: historicoDe,
    colecoesRegistradas: colecoesRegistradas,
    diferencas: diferencas,
    aoEscrever: aoEscrever
  };
})(window.App = window.App || {});
