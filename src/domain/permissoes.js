/* ==========================================================================
   domain/permissoes.js — matriz de permissões e segredo de justiça

   Até a fase 1, `Usuario.perfil` era um rótulo na topbar e `segredoJustica`
   um campo que não restringia nada. Este módulo é onde os dois viram
   comportamento.

   Lógica PURA: recebe usuário e recurso, devolve boolean. Não conhece store,
   service, DOM nem rota. Migra para o React sem uma linha de alteração, e é
   a mesma função que o backend da fase 3 vai reimplementar do lado de lá —
   porque permissão conferida só no cliente não é permissão, é decoração.
   O protótipo aplica no cliente porque cliente é tudo o que ele tem; a
   anotação existe para ninguém confundir as duas coisas.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  /**
   * Matriz perfil → recursos. '*' é o coringa do administrador.
   *
   * Os ids batem com `enums.RECURSOS_PERMISSAO`, e há um teste que trava a
   * divergência: recurso citado aqui e ausente de lá (ou o contrário) quebra
   * a suíte, senão a tela de perfis mostraria menos do que o sistema aplica.
   */
  var MATRIZ = {
    admin: ['*'],

    socio: [
      'processos.ver', 'processos.editar', 'processos.segredo',
      'escritorio.ver',
      'prazos.baixar', 'prazos.conferir',
      'documentos.editar', 'documentos.excluir',
      'financeiro.ver',
      'crm.ver',
      'relatorios.ver', 'relatorios.todos',
      'portal.compartilhar',
      'publicacoes.triar'
    ],

    /* Sem `escritorio.ver`: a tela inicial do advogado e o painel PESSOAL, e
       carteira total, provisao contabil e distribuicao por fase nao mudam o
       que ele faz hoje. Quem coordena a carteira e quem precisa do retrato
       dela — e e quem administra ou tem sociedade no escritorio. */
    advogado: [
      'processos.ver', 'processos.editar',
      'prazos.baixar', 'prazos.conferir',
      'documentos.editar', 'documentos.excluir',
      'crm.ver',
      'relatorios.ver',
      'portal.compartilhar',
      'publicacoes.triar'
    ],

    /* Estagiário instrui o processo mas não assume o ato: não baixa prazo,
       não exclui documento e não compartilha nada com cliente. */
    estagiario: [
      'processos.ver',
      'documentos.editar',
      'publicacoes.triar'
    ],

    /* O financeiro precisa enxergar o processo para vincular honorário, mas
       não edita o processo nem participa da vida processual. */
    financeiro: [
      'processos.ver',
      'financeiro.ver', 'financeiro.lancar',
      'relatorios.ver'
    ]
  };

  function recursosDe(perfil) {
    return MATRIZ[perfil] || [];
  }

  /**
   * @param {object} usuario  { perfil }
   * @param {string} recurso  id de enums.RECURSOS_PERMISSAO
   */
  function pode(usuario, recurso) {
    if (!usuario || !usuario.perfil || !recurso) return false;
    var lista = recursosDe(usuario.perfil);
    return lista.indexOf('*') !== -1 || lista.indexOf(recurso) !== -1;
  }

  /** Verdadeiro se o usuário tem TODOS os recursos da lista. */
  function podeTudo(usuario, recursos) {
    return (recursos || []).every(function (r) { return pode(usuario, r); });
  }

  /** Verdadeiro se tem PELO MENOS UM — usado para exibir seção de menu. */
  function podeAlgum(usuario, recursos) {
    return (recursos || []).some(function (r) { return pode(usuario, r); });
  }

  /**
   * Segredo de justiça.
   *
   * A regra do CPC não é "quem tem cargo alto vê": é quem atua no processo.
   * Por isso `processos.segredo` (admin e sócio) convive com a checagem de
   * participação — advogado e estagiário veem o processo em segredo apenas
   * quando são o responsável ou estão na equipe dele.
   */
  function podeVerProcesso(usuario, processo, liberados) {
    if (!usuario || !processo) return false;
    if (!pode(usuario, 'processos.ver')) return false;
    if (!processo.segredoJustica) return true;
    if (pode(usuario, 'processos.segredo')) return true;

    if (processo.responsavelId === usuario.id) return true;
    if ((processo.equipeIds || []).indexOf(usuario.id) !== -1) return true;

    /* Acesso de urgência já registrado (F2.1). Vem por último de propósito:
       é a exceção, não um quinto caminho normal. Quem chega por aqui LÊ e
       nada mais — editar, vincular e compartilhar não recebem esta lista,
       então continuam exigindo que a pessoa realmente atue no processo. */
    return (liberados || []).indexOf(processo.id) !== -1;
  }

  /** Filtra uma lista de processos pelo que o usuário pode enxergar. */
  function filtrarProcessos(usuario, lista, liberados) {
    return (lista || []).filter(function (p) {
      return podeVerProcesso(usuario, p, liberados);
    });
  }

  /**
   * Filtra registros PENDURADOS num processo — prazo, tarefa, compromisso,
   * documento — pela visibilidade do processo a que pertencem.
   *
   * Não existe regra de sigilo própria desses registros, e não deve existir:
   * o que o CPC protege é o processo, e eles só expõem o que já está lá —
   * número CNJ, cliente, assunto, vara. Uma regra por coleção acabaria
   * divergindo da regra do processo no primeiro ajuste que alguém fizesse
   * em só uma delas.
   *
   * Registro sem processo localizável fica FORA. Cobre o processo
   * soft-deletado, que `db.get` não devolve, e o órfão por dado
   * inconsistente. Nos dois casos, omitir é o lado seguro de errar quando a
   * dúvida é sigilo.
   *
   * @param {Object}   usuario
   * @param {Array}    registros  qualquer coisa com `processoId`
   * @param {Array}    processos  os processos já lidos do banco
   * @param {Array}   [liberados] ids de processo com acesso de urgência
   */
  function filtrarPorProcesso(usuario, registros, processos, liberados) {
    var porId = {};
    (processos || []).forEach(function (p) { porId[p.id] = p; });

    return (registros || []).filter(function (r) {
      var processo = porId[r.processoId];
      if (!processo) return false;
      return podeVerProcesso(usuario, processo, liberados);
    });
  }

  /**
   * Edição do processo: além do recurso, ninguém edita o que não pode ver.
   * Processo encerrado ou arquivado só é editado por quem administra.
   */
  function podeEditarProcesso(usuario, processo) {
    if (!podeVerProcesso(usuario, processo)) return false;
    if (!pode(usuario, 'processos.editar')) return false;
    if (processo.status === 'arquivado' || processo.status === 'encerrado') {
      return pode(usuario, 'processos.segredo');   // admin e sócio
    }
    return true;
  }

  /**
   * @returns {'editar'|'ver'|'negado'}
   */
  function nivelDocumento(usuario, documento, processo) {
    if (!usuario || !documento) return 'negado';
    if (processo && !podeVerProcesso(usuario, processo)) return 'negado';
    return pode(usuario, 'documentos.editar') ? 'editar' : 'ver';
  }

  /**
   * Dupla conferência (F2.2): quem cumpriu não confere o próprio prazo.
   * A regra existe porque o seguro de responsabilidade civil do escritório
   * cobra exatamente isso.
   */
  function podeConferirPrazo(usuario, prazo) {
    if (!pode(usuario, 'prazos.conferir')) return false;
    if (!prazo) return false;
    return prazo.responsavelId !== usuario.id;
  }

  /**
   * Relatórios: quem não tem 'relatorios.todos' vê apenas os próprios
   * números. Devolve o id a fixar no filtro, ou null quando vê tudo.
   */
  function escopoRelatorio(usuario) {
    if (!pode(usuario, 'relatorios.ver')) return 'negado';
    return pode(usuario, 'relatorios.todos') ? null : (usuario && usuario.id) || 'negado';
  }

  App.domain.permissoes = {
    MATRIZ: MATRIZ,
    recursosDe: recursosDe,
    pode: pode,
    podeTudo: podeTudo,
    podeAlgum: podeAlgum,
    podeVerProcesso: podeVerProcesso,
    filtrarProcessos: filtrarProcessos,
    filtrarPorProcesso: filtrarPorProcesso,
    podeEditarProcesso: podeEditarProcesso,
    nivelDocumento: nivelDocumento,
    podeConferirPrazo: podeConferirPrazo,
    escopoRelatorio: escopoRelatorio
  };
})(window.App = window.App || {});
