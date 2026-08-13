/* ==========================================================================
   services/db.js — "banco de dados" do protótipo

   Persiste em localStorage com fallback em memória (o protótipo roda por
   file://, onde a política de storage varia entre navegadores).

   Regra do projeto: NADA é apagado de verdade. remove() faz soft delete
   marcando ativo=false — escritório de advocacia não perde registro.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  // A versão faz parte da chave: subir a versão descarta o banco antigo e
  // regenera o seed. Usado quando o modelo ganha coleção/campo novo
  // (v2 = pastas de documentos; v3 = coleções da fase 2; v4 = o seed passou a
  // POVOAR publicações e monitoramentos, e sem regerar a fila de triagem
  // nasceria vazia para quem já tinha banco), já que o protótipo não tem
  // migração. A válvula de escape é o backup em JSON (F2.1).
  var CHAVE = 'jurisctrl.db.v4';
  var estado = null;
  var suportaStorage = null;

  /* Coleções da fase 2 declaradas de uma vez, ainda que vazias até o módulo
     dono chegar. Sem isso, cada módulo precisaria subir a versão da chave —
     e cada subida descarta os dados de quem está usando o protótipo. */
  var COLECOES_FASE2 = [
    'publicacoes', 'monitoramentos', 'sincronizacoes',                    // F2.4
    'contratos', 'lancamentos', 'boletos', 'repasses', 'apontamentos',    // F2.5
    'leads', 'interacoes', 'propostas',                                   // F2.6
    'notificacoes', 'regrasAlerta', 'caixaSaida',                         // F2.2
    'linksCompartilhados', 'acessosPortal',                               // F2.3
    'logsAuditoria', 'consentimentos', 'solicitacoesTitular',             // F2.1
    'modelosPeca', 'assinaturas', 'acessosDocumento',                     // F2.7
    'feriadosEscritorio', 'configuracoes'                                 // F2.10
  ];

  /* Gancho de auditoria — nasce desligado e é plugado em F2.1. Existe agora
     porque ligá-lo depois significaria refazer 12 services; aqui é uma linha. */
  var aoEscrever = null;

  /** F2.1 chama isto com (colecao, acao, antes, depois). Passar null desliga. */
  function configurarAuditoria(fn) {
    aoEscrever = typeof fn === 'function' ? fn : null;
  }

  function notificarEscrita(colecao, acao, antes, depois) {
    if (!aoEscrever) return;
    // Auditoria nunca derruba a operação auditada.
    try {
      aoEscrever(colecao, acao, antes, depois);
    } catch (e) {
      console.warn('[db] Falha ao registrar auditoria:', e.message);
    }
  }

  function testarStorage() {
    if (suportaStorage !== null) return suportaStorage;
    try {
      window.localStorage.setItem('__teste__', '1');
      window.localStorage.removeItem('__teste__');
      suportaStorage = true;
    } catch (e) {
      suportaStorage = false;
    }
    return suportaStorage;
  }

  function carregar() {
    if (!testarStorage()) return null;
    try {
      var bruto = window.localStorage.getItem(CHAVE);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      console.warn('[db] Não foi possível ler o storage:', e.message);
      return null;
    }
  }

  function persistir() {
    if (!testarStorage() || !estado) return;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) {
      console.warn('[db] Não foi possível gravar no storage:', e.message);
    }
  }

  /** Toda coleção da fase 2 existe como array, mesmo antes do módulo dono. */
  function garantirColecoes(alvo) {
    var criou = false;
    COLECOES_FASE2.forEach(function (nome) {
      if (!Array.isArray(alvo[nome])) {
        alvo[nome] = [];
        criou = true;
      }
    });
    return criou;
  }

  /**
   * Carrega do storage ou gera o seed na primeira execução.
   *
   * IDEMPOTENTE de propósito. Várias telas chamam `init()` defensivamente ao
   * renderizar, e sem esta guarda cada chamada relia o storage — que sob
   * `file://` costuma estar indisponível, fazendo `carregar()` devolver null
   * e o banco inteiro ser REGERADO a partir do seed. O estrago passou
   * despercebido na fase 1 porque o seed é determinístico: regerar produzia
   * dados idênticos. A trilha de auditoria da F2.1, que nasce em tempo de
   * execução e não no seed, foi o primeiro dado a sumir de forma visível.
   */
  function init(forcarSeed) {
    if (!forcarSeed && estado) return estado;

    if (!forcarSeed) {
      estado = carregar();
    }
    if (!estado) {
      estado = App.seed.gerar();
      garantirColecoes(estado);
      persistir();
      return estado;
    }
    if (garantirColecoes(estado)) persistir();
    return estado;
  }

  function garantir() {
    if (!estado) init();
    return estado;
  }

  function agora() {
    return new Date().toISOString();
  }

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  // --- Operações ------------------------------------------------------------

  /** Registros ativos da coleção (clonados — ninguém muta o banco por referência). */
  function get(colecao) {
    var lista = garantir()[colecao] || [];
    return clonar(lista.filter(function (r) { return r.ativo !== false; }));
  }

  /** Inclui os soft-deletados — usado só em auditoria. */
  function getTodos(colecao) {
    return clonar(garantir()[colecao] || []);
  }

  function find(colecao, id) {
    var lista = garantir()[colecao] || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id && lista[i].ativo !== false) return clonar(lista[i]);
    }
    return null;
  }

  function where(colecao, predicado) {
    return get(colecao).filter(predicado);
  }

  function proximoId(prefixo) {
    return prefixo + '-' + Date.now().toString(36).toUpperCase() +
           '-' + Math.floor(Math.random() * 1000);
  }

  function insert(colecao, registro, prefixoId) {
    var db = garantir();
    if (!db[colecao]) db[colecao] = [];

    var novo = clonar(registro);
    novo.id = novo.id || proximoId(prefixoId || 'REG');
    novo.ativo = novo.ativo !== false;
    novo.criadoEm = agora();
    novo.atualizadoEm = novo.criadoEm;

    db[colecao].push(novo);
    persistir();
    notificarEscrita(colecao, 'criar', null, novo);
    return clonar(novo);
  }

  function update(colecao, id, alteracoes, acao) {
    var db = garantir();
    var lista = db[colecao] || [];

    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) {
        var antes = clonar(lista[i]);
        Object.keys(alteracoes).forEach(function (campo) {
          if (campo === 'id' || campo === 'criadoEm') return;   // imutáveis
          lista[i][campo] = alteracoes[campo];
        });
        lista[i].atualizadoEm = agora();
        persistir();
        notificarEscrita(colecao, acao || 'atualizar', antes, clonar(lista[i]));
        return clonar(lista[i]);
      }
    }
    return null;
  }

  /** Soft delete — o registro permanece, apenas sai das consultas. */
  function remove(colecao, id) {
    return update(colecao, id, { ativo: false }, 'remover');
  }

  function contar(colecao, predicado) {
    var lista = get(colecao);
    return predicado ? lista.filter(predicado).length : lista.length;
  }

  /** Cópia do banco inteiro, soft-deletados incluídos — base do backup (F2.1). */
  function getTodosOsDados() {
    return clonar(garantir());
  }

  /**
   * Substitui o banco inteiro — restauração de backup.
   *
   * Passa por `garantirColecoes` de propósito: um backup gerado antes de um
   * módulo novo não tem a coleção dele, e sem isso a restauração deixaria o
   * banco em um estado que o resto do sistema não espera.
   */
  function substituirTudo(novosDados) {
    if (!novosDados || typeof novosDados !== 'object') return null;
    estado = clonar(novosDados);
    garantirColecoes(estado);
    persistir();
    return estado;
  }

  /** Descarta tudo e regenera o seed — botão "restaurar dados" da UI. */
  function reset() {
    estado = null;
    if (testarStorage()) {
      try { window.localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
    }
    return init(true);
  }

  /**
   * Ocupação do banco no storage. O teto do localStorage é de ~5 MB por origem
   * e a fase 2 traz nove módulos de dados — medir é o que evita descobrir o
   * estouro em produção, com o seed já reduzido tarde demais.
   *
   * @returns {{bytes, kb, mb, limiteMb, percentual, porColecao, alerta}}
   */
  function diagnostico() {
    var db = garantir();
    var serializado = JSON.stringify(db);
    var bytes = serializado.length * 2;          // UTF-16 no storage
    var LIMITE_MB = 5;

    var porColecao = Object.keys(db)
      .filter(function (nome) { return Array.isArray(db[nome]); })
      .map(function (nome) {
        return {
          colecao: nome,
          registros: db[nome].length,
          bytes: JSON.stringify(db[nome]).length * 2
        };
      })
      .sort(function (a, b) { return b.bytes - a.bytes; });

    var mb = bytes / 1048576;
    return {
      bytes: bytes,
      kb: Math.round(bytes / 1024),
      mb: Math.round(mb * 100) / 100,
      limiteMb: LIMITE_MB,
      percentual: Math.round((mb / LIMITE_MB) * 1000) / 10,
      porColecao: porColecao,
      alerta: mb / LIMITE_MB > 0.7
    };
  }

  App.services.db = {
    init: init,
    get: get,
    getTodos: getTodos,
    find: find,
    where: where,
    insert: insert,
    update: update,
    remove: remove,
    contar: contar,
    reset: reset,
    proximoId: proximoId,
    persistir: persistir,
    getTodosOsDados: getTodosOsDados,
    substituirTudo: substituirTudo,
    configurarAuditoria: configurarAuditoria,
    diagnostico: diagnostico,
    COLECOES_FASE2: COLECOES_FASE2,
    CHAVE: CHAVE
  };
})(window.App = window.App || {});
