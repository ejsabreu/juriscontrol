/* ==========================================================================
   services/buscaService.js — busca global no conteúdo

   Monta o índice invertido de `domain/busca.js` a partir do banco e o
   consulta. Alcança o CONTEÚDO, não só o nome: o texto do documento, a
   descrição do andamento, o corpo da publicação.

   O índice é construído sob demanda e guardado em memória, invalidado a
   cada escrita no banco. Reconstruir a cada tecla digitada custaria o
   acervo inteiro por letra; nunca reconstruir mostraria resultado obsoleto
   logo depois de salvar um documento.

   O SEGREDO DE JUSTIÇA vale aqui também: o filtro roda ANTES de o resultado
   sair do service, com a mesma função de `domain/permissoes.js`. Uma busca
   que ignora a regra é o vazamento mais fácil de cometer — basta esquecer.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  var indice = null;
  var construidoEm = 0;

  /** Chamado pelo gancho de escrita: o índice envelheceu. */
  function invalidar() {
    indice = null;
  }

  function montar() {
    var registros = [];
    var enums = App.domain.enums;

    // Processos — nome, assunto, partes.
    db().get('processos').forEach(function (p) {
      registros.push({
        id: 'proc:' + p.id,
        tipo: 'processo',
        entidadeId: p.id,
        processoId: p.id,
        titulo: p.numeroCnj + ' ' + (p.numeroInterno || ''),
        texto: [p.assunto, p.classeProcessual, p.vara, p.comarca,
                (p.tags || []).join(' '), p.descricao].filter(Boolean).join(' '),
        rotulo: p.assunto || p.numeroCnj,
        sublinha: p.numeroCnj,
        destino: '#/processos/' + p.id
      });
    });

    // Pessoas.
    db().get('pessoas').forEach(function (p) {
      registros.push({
        id: 'pess:' + p.id,
        tipo: 'pessoa',
        entidadeId: p.id,
        titulo: p.nome,
        texto: [p.email, p.documento, p.observacoes].filter(Boolean).join(' '),
        rotulo: p.nome,
        sublinha: p.ehCliente ? 'Cliente' : 'Parte',
        destino: p.ehCliente ? '#/clientes/' + p.id : null
      });
    });

    /* Documentos: o metadado SEMPRE, o conteúdo quando existir. Documento
       enviado sem texto (só binário) continua achável pelo nome — que é o
       comportamento esperado por quem procura "procuração". */
    db().get('documentos').forEach(function (d) {
      var conteudo = App.services.conteudoService.ler(d.id);
      registros.push({
        id: 'doc:' + d.id,
        tipo: 'documento',
        entidadeId: d.id,
        processoId: d.processoId,
        titulo: d.nome,
        texto: [enums.rotulo(enums.CATEGORIAS_DOCUMENTO, d.categoria),
                conteudo ? conteudo.conteudo : ''].filter(Boolean).join(' '),
        rotulo: d.nome,
        sublinha: enums.rotulo(enums.CATEGORIAS_DOCUMENTO, d.categoria),
        temTexto: !!(conteudo && conteudo.conteudo),
        destino: '#/processos/' + d.processoId
      });
    });

    // Andamentos — a timeline é onde a história do processo está escrita.
    db().get('andamentos').forEach(function (a) {
      registros.push({
        id: 'and:' + a.id,
        tipo: 'andamento',
        entidadeId: a.id,
        processoId: a.processoId,
        titulo: a.titulo,
        texto: a.descricao || '',
        rotulo: a.titulo,
        sublinha: App.format.data(a.data),
        destino: '#/processos/' + a.processoId
      });
    });

    // Prazos.
    db().get('prazos').forEach(function (pz) {
      registros.push({
        id: 'praz:' + pz.id,
        tipo: 'prazo',
        entidadeId: pz.id,
        processoId: pz.processoId,
        titulo: pz.titulo,
        texto: pz.observacoes || '',
        rotulo: pz.titulo,
        sublinha: 'fatal ' + App.format.data(pz.dataFatal),
        destino: '#/processos/' + pz.processoId
      });
    });

    // Publicações do diário.
    db().get('publicacoes').forEach(function (pub) {
      registros.push({
        id: 'pub:' + pub.id,
        tipo: 'publicacao',
        entidadeId: pub.id,
        processoId: pub.processoId,
        titulo: pub.diario + ' ' + (pub.numeroCnjDetectado || ''),
        texto: pub.textoIntegral || '',
        rotulo: pub.diario + ' · ' + App.format.data(pub.dataDisponibilizacao),
        sublinha: pub.numeroCnjDetectado || 'sem número',
        destino: '#/publicacoes'
      });
    });

    // Leads do funil.
    db().get('leads').forEach(function (l) {
      registros.push({
        id: 'lead:' + l.id,
        tipo: 'lead',
        entidadeId: l.id,
        titulo: l.nome,
        texto: [l.resumoCaso, (l.contato || {}).email].filter(Boolean).join(' '),
        rotulo: l.nome,
        sublinha: 'Prospecção',
        destino: '#/crm/' + l.id
      });
    });

    // Modelos de peça.
    db().get('modelosPeca').forEach(function (m) {
      registros.push({
        id: 'mod:' + m.id,
        tipo: 'modelo',
        entidadeId: m.id,
        titulo: m.nome,
        texto: m.conteudoHtml || '',
        rotulo: m.nome,
        sublinha: 'Modelo de peça',
        destino: '#/modelos'
      });
    });

    indice = App.domain.busca.indexar(registros);
    construidoEm = Date.now();
    return indice;
  }

  function garantir() {
    return indice || montar();
  }

  /**
   * @param {string} consulta
   * @param {object} [opcoes]  { tipo, limite }
   */
  function buscar(consulta, opcoes) {
    return http().requisicao(function () {
      var op = opcoes || {};
      var resultados = App.domain.busca.buscar(garantir(), consulta, {
        tipo: op.tipo,
        limite: (op.limite || 20) * 2      // folga para o filtro de permissão
      });

      var usuario = App.store.getState().usuarioAtual;
      var permissoes = App.domain.permissoes;

      var visiveis = resultados.filter(function (r) {
        var reg = r.registro;
        if (!reg.processoId) return true;

        // Processo em segredo tira da busca tudo o que pende dele.
        var processo = db().find('processos', reg.processoId);
        if (!processo) return false;
        return permissoes.podeVerProcesso(usuario, processo,
                                         App.services.acessoService.liberados());
      }).slice(0, op.limite || 20);

      return {
        consulta: consulta,
        total: visiveis.length,
        itens: visiveis.map(function (r) {
          return Object.assign({}, r.registro, {
            pontos: r.pontos,
            trecho: App.domain.busca.destacar(r.registro.texto, consulta)
          });
        }),
        indice: { total: indice.total, termos: indice.totalTermos }
      };
    });
  }

  /** Agrupa por tipo — é como o painel da topbar apresenta o resultado. */
  function buscarAgrupado(consulta, limite) {
    return buscar(consulta, { limite: limite || 24 }).then(function (r) {
      var grupos = {};
      r.itens.forEach(function (item) {
        (grupos[item.tipo] = grupos[item.tipo] || []).push(item);
      });
      return { consulta: r.consulta, total: r.total, grupos: grupos, indice: r.indice };
    });
  }

  function estatisticas() {
    var i = garantir();
    return {
      registros: i.total,
      termos: i.totalTermos,
      construidoEm: construidoEm
    };
  }

  App.services.buscaService = {
    buscar: buscar,
    buscarAgrupado: buscarAgrupado,
    invalidar: invalidar,
    estatisticas: estatisticas
  };
})(window.App = window.App || {});
