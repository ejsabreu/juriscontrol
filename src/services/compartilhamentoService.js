/* ==========================================================================
   services/compartilhamentoService.js — link do processo para o cliente

   Metade disto já existia desde a fase 1: `visivelCliente` em documentos,
   andamentos e prazos. Faltava o outro lado do link.

   ---------------------------------------------------------------------------
   O TOKEN É AUTOCONTIDO — e essa decisão mudou durante a implementação.

   O planejamento previa token opaco, que não carrega nada: o servidor
   consultaria a tabela de links. Só que este protótipo está publicado no
   GitHub Pages e o "banco" é o localStorage de cada navegador. Um token
   opaco produziria um link que **só abre na máquina de quem gerou** — ou
   seja, um recurso de compartilhamento que não compartilha.

   Então o token carrega o necessário para o portal se montar sozinho:

       PRO-00007.1101.20261231.a7Bc9dEf.1a2b3c4d
       processo   escopo  validade  nonce     verificação

   É a mesma forma de um JWT: dados no token, integridade conferida. Com isso
   o link abre em qualquer navegador, contra o mesmo seed determinístico.

   O que se perde, dito na cara:
     · o token revela o id interno do processo (o opaco não revelaria);
     · a soma de verificação NÃO é assinatura — sem servidor não há segredo
       para assinar. Ela detecta link truncado ou digitado errado, não
       falsificação. Na fase 3 vira HMAC conferido no servidor;
     · revogação só vale onde existe o registro local (o navegador do
       escritório). Token autocontido revogado em outra máquina é problema
       real de JWT, resolvido na fase 3 com lista de revogação no servidor.

   NÃO há senha de portal. Uma senha conferida no cliente, com o banco
   visível no mesmo navegador, não protege coisa alguma — seria teatro. A
   proteção honesta possível aqui é o token longo e a validade curta.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  /* Ordem fixa: cada posição do escopo vira um dígito do token. Mexer na
     ordem invalidaria os links já distribuídos. */
  var CHAVES_ESCOPO = ['andamentos', 'documentos', 'prazos', 'compromissos'];

  var VALIDADE_PADRAO_DIAS = 30;

  // --- Token -----------------------------------------------------------------

  function escopoParaDigitos(escopo) {
    var e = escopo || {};
    return CHAVES_ESCOPO.map(function (chave) { return e[chave] ? '1' : '0'; }).join('');
  }

  function digitosParaEscopo(digitos) {
    var escopo = {};
    CHAVES_ESCOPO.forEach(function (chave, i) {
      escopo[chave] = String(digitos || '')[i] === '1';
    });
    return escopo;
  }

  function compactarData(iso) {
    return String(iso || '').slice(0, 10).replace(/-/g, '');
  }

  function expandirData(compacta) {
    var s = String(compacta || '');
    if (s.length !== 8) return null;
    return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  }

  function montarToken(processoId, escopo, expiraEm, nonce) {
    var corpo = [processoId, escopoParaDigitos(escopo), compactarData(expiraEm), nonce].join('.');
    return corpo + '.' + App.token.hash(corpo);
  }

  /**
   * @returns {?{processoId, escopo, expiraEm, nonce, integro}}
   */
  function decodificar(token) {
    var partes = String(token || '').split('.');
    if (partes.length !== 5) return null;

    var corpo = partes.slice(0, 4).join('.');
    var expiraEm = expandirData(partes[2]);
    if (!expiraEm) return null;

    return {
      processoId: partes[0],
      escopo: digitosParaEscopo(partes[1]),
      expiraEm: expiraEm,
      nonce: partes[3],
      integro: App.token.hash(corpo) === partes[4]
    };
  }

  /** URL completa para copiar — funciona sob file:// e sob GitHub Pages. */
  function montarUrl(token) {
    var base = window.location.href.split('#')[0];
    return base + '#/portal/' + token;
  }

  // --- Criação e gestão ------------------------------------------------------

  function hojeISO() { return App.domain.prazos.hojeISO(); }

  function somarDias(iso, dias) {
    var d = App.format.parseISO(iso);
    d.setDate(d.getDate() + dias);
    return App.format.toISO(d);
  }

  /**
   * @param {object} dados  { processoId, escopo, validadeDias }
   */
  function criar(dados) {
    return http().requisicao(function () {
      var processo = db().find('processos', dados.processoId);
      if (!processo) throw http().ErroApi('Processo não encontrado.', 404);

      var usuario = App.store.getState().usuarioAtual;
      if (!App.domain.permissoes.pode(usuario, 'portal.compartilhar')) {
        throw http().ErroApi('Seu perfil não compartilha processo com cliente.', 403);
      }
      if (!App.domain.permissoes.podeVerProcesso(usuario, processo)) {
        throw http().ErroApi('Processo não encontrado.', 404);
      }

      // Segredo de justiça não vai para portal nenhum. É a regra do processo,
      // não uma preferência do escritório.
      if (processo.segredoJustica) {
        throw http().ErroApi(
          'Processo em segredo de justiça não pode ser compartilhado.', 409);
      }

      var escopo = Object.assign(
        { andamentos: true, documentos: true, prazos: true, compromissos: true },
        dados.escopo || {});

      if (!CHAVES_ESCOPO.some(function (c) { return escopo[c]; })) {
        throw http().ErroApi('Escolha ao menos uma seção para compartilhar.', 400);
      }

      var expiraEm = somarDias(hojeISO(), dados.validadeDias || VALIDADE_PADRAO_DIAS);
      var nonce = App.token.gerar(10);
      var token = montarToken(processo.id, escopo, expiraEm, nonce);

      var link = db().insert('linksCompartilhados', {
        processoId: processo.id,
        token: token,
        escopo: escopo,
        criadoPorId: usuario ? usuario.id : null,
        expiraEm: expiraEm,
        revogadoEm: null,
        totalAcessos: 0,
        ultimoAcessoEm: null
      }, 'LNK');

      App.services.auditoriaService.registrar({
        acao: 'compartilhar',
        colecao: 'processos',
        entidadeId: processo.id,
        resumo: 'Link do portal gerado para ' + processo.numeroCnj,
        alteracoes: [{ campo: 'expiraEm', de: null, para: expiraEm }]
      });

      return Object.assign({}, link, { url: montarUrl(token) });
    });
  }

  function listarDoProcesso(processoId) {
    return http().requisicao(function () {
      var hoje = hojeISO();
      return db().where('linksCompartilhados', function (l) {
        return l.processoId === processoId;
      })
        .map(function (l) {
          return Object.assign({}, l, {
            url: montarUrl(l.token),
            expirado: l.expiraEm < hoje,
            // `valido`, e não `ativo`: `ativo` é o soft delete de todo
            // registro do projeto, e um link revogado continua ativo no banco.
            valido: !l.revogadoEm && l.expiraEm >= hoje,
            criadoPor: db().find('usuarios', l.criadoPorId)
          });
        })
        .sort(function (a, b) { return a.criadoEm < b.criadoEm ? 1 : -1; });
    });
  }

  function revogar(id) {
    return http().requisicao(function () {
      var link = db().find('linksCompartilhados', id);
      if (!link) throw http().ErroApi('Link não encontrado.', 404);

      var atualizado = db().update('linksCompartilhados', id, {
        revogadoEm: new Date().toISOString()
      });

      App.services.auditoriaService.registrar({
        acao: 'compartilhar',
        colecao: 'processos',
        entidadeId: link.processoId,
        resumo: 'Link do portal revogado'
      });

      return atualizado;
    });
  }

  function acessosDe(linkId) {
    return http().requisicao(function () {
      return db().where('acessosPortal', function (a) { return a.linkId === linkId; })
        .sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
    });
  }

  // --- Abertura do portal ----------------------------------------------------

  function registrarAcesso(linkId, sucesso, motivo) {
    db().insert('acessosPortal', {
      linkId: linkId || null,
      quando: new Date().toISOString(),
      sucesso: !!sucesso,
      motivoFalha: motivo || null
    }, 'ACP');
  }

  /**
   * Monta o conteúdo do portal a partir do token.
   *
   * Devolve `{ ok:false, motivo }` para QUALQUER falha, sempre com a mesma
   * cara na tela: link inválido não distingue "não existe" de "expirou" de
   * "revogado", porque a distinção já entregaria que o processo existe.
   */
  function abrir(token) {
    return http().requisicao(function () {
      var payload = decodificar(token);
      if (!payload || !payload.integro) {
        registrarAcesso(null, false, 'token inválido');
        return { ok: false, motivo: 'invalido' };
      }

      // Registro local, quando existe: dá revogação e contagem de acessos.
      var link = db().get('linksCompartilhados').filter(function (l) {
        return l.token === token;
      })[0] || null;

      if (link && link.revogadoEm) {
        registrarAcesso(link.id, false, 'revogado');
        return { ok: false, motivo: 'invalido' };
      }
      if (payload.expiraEm < hojeISO()) {
        registrarAcesso(link && link.id, false, 'expirado');
        return { ok: false, motivo: 'invalido' };
      }

      var processo = db().find('processos', payload.processoId);
      if (!processo || processo.segredoJustica) {
        registrarAcesso(link && link.id, false, 'processo indisponível');
        return { ok: false, motivo: 'invalido' };
      }

      var escopo = link ? link.escopo : payload.escopo;

      var pessoas = db().get('pessoas');
      var usuarios = db().get('usuarios');
      function nomeUsuario(id) {
        var u = usuarios.filter(function (x) { return x.id === id; })[0];
        return u ? u.nome : '—';
      }

      var cliente = pessoas.filter(function (p) { return p.id === processo.clienteId; })[0] || null;

      /* Só o que está marcado como visível ao cliente. O filtro é aqui, na
         camada de dados: se ficasse na tela, bastaria um `desenhar()` novo
         para vazar. */
      var andamentos = escopo.andamentos
        ? db().where('andamentos', function (a) {
            return a.processoId === processo.id && a.visivelCliente === true;
          })
          .map(function (a) {
            return {
              id: a.id, data: a.data, tipo: a.tipo,
              titulo: a.titulo, descricao: a.descricao,
              autorNome: nomeUsuario(a.autorId)
            };
          })
          .sort(function (a, b) { return a.data < b.data ? 1 : -1; })
        : [];

      var documentos = escopo.documentos
        ? db().where('documentos', function (d) {
            return d.processoId === processo.id && d.visivelCliente === true;
          })
          .map(function (d) {
            return {
              id: d.id, nome: d.nome, categoria: d.categoria,
              tamanho: d.tamanho, versao: d.versao, uploadEm: d.uploadEm
            };
          })
          .sort(function (a, b) { return a.uploadEm < b.uploadEm ? 1 : -1; })
        : [];

      /* O prazo vira "aguardando manifestação até X". O cliente não precisa
         saber de prazo interno, responsável ou semáforo — e o escritório não
         quer que ele saiba. */
      var prazos = escopo.prazos
        ? db().where('prazos', function (pz) {
            return pz.processoId === processo.id && pz.visivelCliente === true &&
                   (pz.status === 'pendente' || pz.status === 'em_andamento');
          })
          .map(function (pz) {
            return { id: pz.id, titulo: pz.titulo, dataFatal: pz.dataFatal };
          })
          .sort(function (a, b) { return a.dataFatal < b.dataFatal ? -1 : 1; })
        : [];

      var compromissos = escopo.compromissos
        ? db().where('compromissos', function (cp) {
            return cp.processoId === processo.id && cp.status === 'agendado' &&
                   String(cp.dataHora).slice(0, 10) >= hojeISO();
          })
          .map(function (cp) {
            return {
              id: cp.id, tipo: cp.tipo, titulo: cp.titulo,
              dataHora: cp.dataHora, local: cp.local
            };
          })
          .sort(function (a, b) { return a.dataHora < b.dataHora ? -1 : 1; })
        : [];

      if (link) {
        db().update('linksCompartilhados', link.id, {
          totalAcessos: (link.totalAcessos || 0) + 1,
          ultimoAcessoEm: new Date().toISOString()
        });
      }
      registrarAcesso(link && link.id, true, null);

      /* A capa do portal é DELIBERADAMENTE reduzida. Nada de valorProvisao,
         risco, valorCausa, equipe interna ou tags: são informação de gestão
         do escritório, e algumas delas (a provisão, sobretudo) seriam
         constrangedoras na tela do cliente. */
      return {
        ok: true,
        registrado: !!link,
        expiraEm: payload.expiraEm,
        escopo: escopo,
        processo: {
          numeroCnj: processo.numeroCnj,
          classeProcessual: processo.classeProcessual,
          assunto: processo.assunto,
          areaId: processo.areaId,
          faseId: processo.faseId,
          status: processo.status,
          tribunalId: processo.tribunalId,
          comarca: processo.comarca,
          vara: processo.vara,
          dataDistribuicao: processo.dataDistribuicao,
          clienteNome: cliente ? cliente.nome : '—',
          responsavelNome: nomeUsuario(processo.responsavelId)
        },
        andamentos: andamentos,
        documentos: documentos,
        prazos: prazos,
        compromissos: compromissos
      };
    });
  }

  App.services.compartilhamentoService = {
    criar: criar,
    abrir: abrir,
    revogar: revogar,
    listarDoProcesso: listarDoProcesso,
    acessosDe: acessosDe,
    montarUrl: montarUrl,
    decodificar: decodificar,
    montarToken: montarToken,
    CHAVES_ESCOPO: CHAVES_ESCOPO,
    VALIDADE_PADRAO_DIAS: VALIDADE_PADRAO_DIAS
  };
})(window.App = window.App || {});
