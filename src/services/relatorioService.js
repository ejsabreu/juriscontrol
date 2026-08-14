/* ==========================================================================
   services/relatorioService.js — monta e serve os relatórios

   Junta as coleções, aplica PERMISSÃO e ESCOPO, e chama a função pura de
   `domain/indicadores.js`. Nenhum cálculo mora aqui.

   Duas regras de acesso, ambas de F2.1 e nenhuma nova:
     · o relatório exige um recurso (`relatorios.ver`, `financeiro.ver`…);
     · quem não tem `relatorios.todos` vê apenas os PRÓPRIOS números — o
       advogado abre "produtividade" e enxerga a si mesmo, não a equipe.

   O segredo de justiça também vale: processo invisível não entra em conta
   nenhuma, senão o total do relatório denunciaria a existência dele.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }
  function perm() { return App.domain.permissoes; }

  /** Relatórios que o usuário corrente pode abrir. */
  function catalogo() {
    var usuario = App.store.getState().usuarioAtual;

    return App.domain.indicadores.CATALOGO
      .filter(function (r) { return perm().pode(usuario, r.permissao); })
      .map(function (r) {
        return {
          id: r.id, nome: r.nome, grupo: r.grupo, icone: r.icone,
          descricao: r.descricao,
          restrito: r.escopoProprio && !perm().pode(usuario, 'relatorios.todos')
        };
      });
  }

  /**
   * Coleções visíveis ao usuário, já filtradas.
   *
   * @param {?string} escopoUsuarioId  quando presente, restringe ao que é dele
   */
  function coletar(escopoUsuarioId) {
    var usuario = App.store.getState().usuarioAtual;

    // Segredo de justiça primeiro: tudo o mais pende dos processos.
    var processos = perm().filtrarProcessos(usuario, db().get('processos'));
    var idsVisiveis = {};
    processos.forEach(function (p) { idsVisiveis[p.id] = true; });

    function doProcesso(lista) {
      return lista.filter(function (item) {
        return !item.processoId || idsVisiveis[item.processoId];
      });
    }

    var dados = {
      processos: processos,
      pessoas: db().get('pessoas'),
      usuarios: db().get('usuarios'),
      prazos: doProcesso(db().get('prazos')),
      tarefas: doProcesso(db().get('tarefas')),
      apontamentos: doProcesso(db().get('apontamentos')),
      lancamentos: doProcesso(db().get('lancamentos')),
      contratos: doProcesso(db().get('contratos')),
      publicacoes: doProcesso(db().get('publicacoes')),
      leads: db().get('leads')
    };

    if (!escopoUsuarioId) return dados;

    /* Escopo próprio: o advogado vê os números DELE. Filtrar aqui, e não na
       tela, garante que o total exibido bata com a lista — total geral com
       lista filtrada é o jeito clássico de o relatório mentir. */
    dados.processos = dados.processos.filter(function (p) {
      return p.responsavelId === escopoUsuarioId ||
             (p.equipeIds || []).indexOf(escopoUsuarioId) !== -1;
    });
    dados.prazos = dados.prazos.filter(function (p) {
      return p.responsavelId === escopoUsuarioId;
    });
    dados.tarefas = dados.tarefas.filter(function (t) {
      return t.responsavelId === escopoUsuarioId;
    });
    dados.apontamentos = dados.apontamentos.filter(function (a) {
      return a.usuarioId === escopoUsuarioId;
    });
    dados.leads = dados.leads.filter(function (l) {
      return l.responsavelId === escopoUsuarioId;
    });
    dados.usuarios = dados.usuarios.filter(function (u) { return u.id === escopoUsuarioId; });

    return dados;
  }

  /**
   * @param {string} id       relatório do catálogo
   * @param {object} filtros  { de, ate, areaId, responsavelId }
   */
  function gerar(id, filtros) {
    return http().requisicao(function () {
      var definicao = App.domain.indicadores.achar(id);
      if (!definicao) throw http().ErroApi('Relatório não encontrado.', 404);

      var usuario = App.store.getState().usuarioAtual;
      if (!perm().pode(usuario, definicao.permissao)) {
        throw http().ErroApi('Seu perfil não tem acesso a este relatório.', 403);
      }

      var f = filtros || {};
      var escopo = perm().escopoRelatorio(usuario);

      // `escopoRelatorio` devolve null (vê tudo), 'negado' ou o id do usuário.
      var restringirA = null;
      if (definicao.escopoProprio && escopo && escopo !== 'negado') restringirA = escopo;
      // O filtro manual de responsável só é aceito de quem vê tudo.
      if (!restringirA && f.responsavelId && escopo === null) restringirA = f.responsavelId;

      var dados = coletar(restringirA);

      if (f.areaId) {
        var idsArea = {};
        dados.processos = dados.processos.filter(function (p) {
          var manter = p.areaId === f.areaId;
          if (manter) idsArea[p.id] = true;
          return manter;
        });
        ['prazos', 'tarefas', 'apontamentos', 'lancamentos', 'contratos', 'publicacoes']
          .forEach(function (colecao) {
            dados[colecao] = dados[colecao].filter(function (item) {
              return !item.processoId || idsArea[item.processoId];
            });
          });
      }

      dados.periodo = { de: f.de || null, ate: f.ate || null };
      dados.hoje = App.domain.prazos.hojeISO();

      var resultado = definicao.calcular(dados);

      App.services.auditoriaService.registrar({
        acao: 'consultar', colecao: 'relatorios', entidadeId: id,
        resumo: 'Relatório consultado: ' + definicao.nome
      });

      return Object.assign({}, resultado, {
        id: id,
        icone: definicao.icone,
        grupo: definicao.grupo,
        escopoProprio: !!restringirA,
        escopoNome: restringirA
          ? (db().find('usuarios', restringirA) || {}).nome || null
          : null,
        periodo: dados.periodo
      });
    });
  }

  /** CSV do relatório — a tabela, não o gráfico. */
  function exportarCsv(relatorio) {
    if (!relatorio || !relatorio.tabela) return Promise.resolve(false);

    var colunas = relatorio.tabela.colunas.map(function (c) {
      return {
        campo: c.campo,
        titulo: c.titulo,
        // O CSV leva o valor FORMATADO: quem abre no Excel quer ler
        // "R$ 1.250,00", não "125000".
        formatar: c.formatar
      };
    });

    var nome = 'relatorio-' + relatorio.id +
      (relatorio.periodo && relatorio.periodo.de ? '-' + relatorio.periodo.de : '');

    App.services.auditoriaService.registrar({
      acao: 'exportar', colecao: 'relatorios', entidadeId: relatorio.id,
      resumo: 'Relatório exportado em CSV: ' + relatorio.titulo
    });

    return App.csv.baixar(nome, relatorio.tabela.linhas, colunas);
  }

  App.services.relatorioService = {
    catalogo: catalogo,
    gerar: gerar,
    exportarCsv: exportarCsv,
    coletar: coletar
  };
})(window.App = window.App || {});
