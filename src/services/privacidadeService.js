/* ==========================================================================
   services/privacidadeService.js — LGPD

   Quatro obrigações da lei que o sistema precisa conseguir cumprir, e que
   aqui são de verdade (não dependem de servidor para funcionar):

     · registro da base legal e do consentimento (arts. 7º e 8º)
     · atendimento ao titular em 15 dias (art. 18)
     · acesso e PORTABILIDADE dos dados (art. 18, II e V) — export em JSON/CSV
     · eliminação (art. 18, VI) — que num escritório é ANONIMIZAÇÃO

   Sobre eliminar: o projeto não apaga registro (decisão arquitetural 2), e a
   própria LGPD ressalva a guarda para exercício regular de direito em
   processo (art. 16, III). Um processo não pode perder a identificação da
   parte. Por isso "eliminar" aqui é despersonalizar o titular mantendo o
   registro — e a tela diz isso ao operador, em vez de prometer um DELETE que
   seria ilegal cumprir.

   SIMULADO: criptografia em repouso, backup automático e o e-mail de
   resposta ao titular. Real: tudo o que está listado acima.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function hojeISO() { return App.domain.prazos.hojeISO(); }

  function somarDias(iso, dias) {
    var d = App.format.parseISO(iso);
    d.setDate(d.getDate() + dias);
    return App.format.toISO(d);
  }

  // --- Consentimento ---------------------------------------------------------

  function consentimentos(pessoaId) {
    return http().requisicao(function () {
      return db().where('consentimentos', function (c) {
        return !pessoaId || c.pessoaId === pessoaId;
      }).sort(function (a, b) { return a.concedidoEm < b.concedidoEm ? 1 : -1; });
    });
  }

  function registrarConsentimento(dados) {
    return http().requisicao(function () {
      return db().insert('consentimentos', {
        pessoaId: dados.pessoaId,
        finalidade: dados.finalidade,
        base: dados.base || 'consentimento',
        concedidoEm: dados.concedidoEm || new Date().toISOString(),
        revogadoEm: null,
        textoVersao: dados.textoVersao || 'v1'
      }, 'CON');
    });
  }

  function revogarConsentimento(id) {
    return http().requisicao(function () {
      var atualizado = db().update('consentimentos', id, {
        revogadoEm: new Date().toISOString()
      });
      if (!atualizado) throw http().ErroApi('Consentimento não encontrado.', 404);
      return atualizado;
    });
  }

  // --- Solicitações do titular ----------------------------------------------

  function solicitacoes(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var pessoas = db().get('pessoas');

      return db().get('solicitacoesTitular')
        .map(function (s) {
          var pessoa = pessoas.filter(function (p) { return p.id === s.pessoaId; })[0] || null;
          var venceEm = s.prazoAtendimento;
          return Object.assign({}, s, {
            pessoa: pessoa,
            pessoaNome: pessoa ? pessoa.nome : '—',
            atrasada: s.status !== 'atendida' && venceEm < hojeISO()
          });
        })
        .filter(function (s) {
          if (f.status && s.status !== f.status) return false;
          if (f.tipo && s.tipo !== f.tipo) return false;
          if (f.pessoaId && s.pessoaId !== f.pessoaId) return false;
          return true;
        })
        .sort(function (a, b) { return a.prazoAtendimento < b.prazoAtendimento ? -1 : 1; });
    });
  }

  function criarSolicitacao(dados) {
    return http().requisicao(function () {
      var tipo = App.domain.enums.achar(App.domain.enums.TIPOS_SOLICITACAO_TITULAR, dados.tipo);
      if (!tipo) throw http().ErroApi('Tipo de solicitação inválido.', 400);

      var solicitadoEm = dados.solicitadoEm || hojeISO();

      return db().insert('solicitacoesTitular', {
        pessoaId: dados.pessoaId,
        tipo: dados.tipo,
        canal: dados.canal || 'email',
        solicitadoEm: solicitadoEm,
        // O prazo do art. 18 é de 15 dias CORRIDOS — não é prazo processual,
        // então não passa pelo motor de dias úteis.
        prazoAtendimento: somarDias(solicitadoEm, tipo.prazoDias),
        status: 'aberta',
        observacoes: dados.observacoes || '',
        respondidoEm: null,
        respostaTexto: null
      }, 'SOL');
    });
  }

  function atenderSolicitacao(id, respostaTexto) {
    return http().requisicao(function () {
      var atualizada = db().update('solicitacoesTitular', id, {
        status: 'atendida',
        respondidoEm: new Date().toISOString(),
        respostaTexto: respostaTexto || ''
      });
      if (!atualizada) throw http().ErroApi('Solicitação não encontrada.', 404);

      App.services.auditoriaService.registrar({
        acao: 'exportar',
        colecao: 'solicitacoesTitular',
        entidadeId: id,
        resumo: 'Solicitação de titular atendida'
      });
      return atualizada;
    });
  }

  // --- Dossiê do titular (acesso e portabilidade) ----------------------------

  /**
   * Tudo o que o sistema guarda sobre uma pessoa, em um objeto só.
   * É a resposta ao pedido de acesso e o arquivo da portabilidade.
   */
  function dossie(pessoaId) {
    return http().requisicao(function () {
      var pessoa = db().find('pessoas', pessoaId);
      if (!pessoa) throw http().ErroApi('Pessoa não encontrada.', 404);

      var processosCliente = db().where('processos', function (p) {
        return p.clienteId === pessoaId;
      });

      var participacoes = db().where('partesProcesso', function (pt) {
        return pt.pessoaId === pessoaId;
      });

      var idsProcessos = processosCliente.map(function (p) { return p.id; })
        .concat(participacoes.map(function (pt) { return pt.processoId; }));

      var documentos = db().where('documentos', function (d) {
        return idsProcessos.indexOf(d.processoId) !== -1;
      });

      // Auditoria dos registros do titular — parte do direito de acesso.
      var trilha = db().get('logsAuditoria').filter(function (log) {
        return log.entidadeId === pessoaId ||
               idsProcessos.indexOf(log.entidadeId) !== -1;
      });

      App.services.auditoriaService.registrar({
        acao: 'exportar',
        colecao: 'pessoas',
        entidadeId: pessoaId,
        resumo: 'Dossiê LGPD gerado para ' + pessoa.nome
      });

      return {
        geradoEm: new Date().toISOString(),
        titular: pessoa,
        processosComoCliente: processosCliente,
        participacoesEmProcessos: participacoes,
        documentosVinculados: documentos.map(function (d) {
          // O binário não existe no protótipo; o metadado, sim.
          return { id: d.id, nome: d.nome, categoria: d.categoria, uploadEm: d.uploadEm };
        }),
        consentimentos: db().where('consentimentos', function (c) {
          return c.pessoaId === pessoaId;
        }),
        solicitacoes: db().where('solicitacoesTitular', function (s) {
          return s.pessoaId === pessoaId;
        }),
        trilhaAuditoria: trilha
      };
    });
  }

  /** Baixa o dossiê em JSON — o formato da portabilidade (art. 18, V). */
  function baixarDossieJson(pessoaId) {
    return dossie(pessoaId).then(function (d) {
      var nome = 'dossie-lgpd-' + String(d.titular.nome).toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';

      if (typeof window.Blob === 'undefined') return false;
      var blob = new window.Blob([JSON.stringify(d, null, 2)],
                                 { type: 'application/json;charset=utf-8' });
      return App.dom.baixar(nome, blob);
    });
  }

  /** Baixa o resumo em CSV — o formato que o titular abre no Excel. */
  function baixarDossieCsv(pessoaId) {
    return dossie(pessoaId).then(function (d) {
      var linhas = [];

      Object.keys(d.titular).forEach(function (campo) {
        var valor = d.titular[campo];
        linhas.push({
          secao: 'Dados cadastrais',
          campo: campo,
          valor: (valor && typeof valor === 'object') ? JSON.stringify(valor) : valor
        });
      });

      d.processosComoCliente.forEach(function (p) {
        linhas.push({ secao: 'Processos', campo: p.numeroCnj, valor: p.assunto });
      });

      d.consentimentos.forEach(function (c) {
        linhas.push({
          secao: 'Consentimentos',
          campo: c.finalidade,
          valor: c.revogadoEm ? 'revogado em ' + c.revogadoEm : 'ativo desde ' + c.concedidoEm
        });
      });

      return App.csv.baixar('dossie-lgpd', linhas, [
        { campo: 'secao', titulo: 'Seção' },
        { campo: 'campo', titulo: 'Campo' },
        { campo: 'valor', titulo: 'Valor' }
      ]);
    });
  }

  // --- Anonimização ----------------------------------------------------------

  /**
   * Despersonaliza o titular preservando o registro.
   *
   * @param {boolean} irreversivel  true troca o nome por um identificador
   *                                derivado de hash; não há volta.
   */
  function anonimizarTitular(pessoaId, irreversivel) {
    return http().requisicao(function () {
      var pessoa = db().find('pessoas', pessoaId);
      if (!pessoa) throw http().ErroApi('Pessoa não encontrada.', 404);
      if (pessoa.anonimizadoEm) throw http().ErroApi('Titular já anonimizado.', 409);

      var tk = App.token;
      var atualizada = db().update('pessoas', pessoaId, {
        nome: tk.anonimizarNome(pessoa.nome, irreversivel),
        cpfCnpj: tk.anonimizarDocumento(pessoa.cpfCnpj),
        email: pessoa.email ? tk.anonimizarEmail(pessoa.email) : pessoa.email,
        telefone: pessoa.telefone ? '(**) *****-**' + String(pessoa.telefone).slice(-2) : pessoa.telefone,
        endereco: null,
        anonimizadoEm: new Date().toISOString(),
        anonimizacaoIrreversivel: !!irreversivel
      });

      App.services.auditoriaService.registrar({
        acao: 'remover',
        colecao: 'pessoas',
        entidadeId: pessoaId,
        resumo: 'Titular anonimizado' + (irreversivel ? ' (irreversível)' : ''),
        alteracoes: [{ campo: 'anonimizadoEm', de: null, para: atualizada.anonimizadoEm }]
      });

      return atualizada;
    });
  }

  // --- Backup ----------------------------------------------------------------

  /**
   * Exporta o banco inteiro em JSON.
   *
   * É a válvula de escape da decisão de não ter migração: subir a versão da
   * chave descarta os dados, e este arquivo é o que permite trazê-los de volta.
   */
  function baixarBackup() {
    return http().requisicao(function () {
      var conteudo = JSON.stringify({
        geradoEm: new Date().toISOString(),
        versao: db().CHAVE,
        dados: db().getTodosOsDados()
      }, null, 2);

      App.services.auditoriaService.registrar({
        acao: 'exportar',
        colecao: null,
        resumo: 'Backup completo do banco gerado'
      });

      if (typeof window.Blob === 'undefined') return false;
      var nome = 'juriscontrol-backup-' + hojeISO() + '.json';
      var blob = new window.Blob([conteudo], { type: 'application/json;charset=utf-8' });
      return App.dom.baixar(nome, blob);
    });
  }

  /**
   * Restaura de um backup. Valida antes de sobrescrever: um arquivo de outra
   * versão ou truncado não pode substituir o banco em silêncio.
   */
  function restaurarBackup(textoJson) {
    return http().requisicao(function () {
      var pacote;
      try {
        pacote = JSON.parse(textoJson);
      } catch (e) {
        throw http().ErroApi('O arquivo não é um JSON válido.', 400);
      }

      if (!pacote || !pacote.dados || !Array.isArray(pacote.dados.processos)) {
        throw http().ErroApi('O arquivo não parece um backup do JurisControl.', 400);
      }

      var incompativel = pacote.versao && pacote.versao !== db().CHAVE;
      db().substituirTudo(pacote.dados);

      App.services.auditoriaService.registrar({
        acao: 'atualizar',
        colecao: null,
        resumo: 'Banco restaurado a partir de backup de ' + (pacote.geradoEm || 'data desconhecida')
      });

      return {
        processos: pacote.dados.processos.length,
        geradoEm: pacote.geradoEm,
        incompativel: incompativel,
        versaoArquivo: pacote.versao
      };
    });
  }

  App.services.privacidadeService = {
    consentimentos: consentimentos,
    registrarConsentimento: registrarConsentimento,
    revogarConsentimento: revogarConsentimento,
    solicitacoes: solicitacoes,
    criarSolicitacao: criarSolicitacao,
    atenderSolicitacao: atenderSolicitacao,
    dossie: dossie,
    baixarDossieJson: baixarDossieJson,
    baixarDossieCsv: baixarDossieCsv,
    anonimizarTitular: anonimizarTitular,
    baixarBackup: baixarBackup,
    restaurarBackup: restaurarBackup
  };
})(window.App = window.App || {});
