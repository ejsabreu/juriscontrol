/* ==========================================================================
   services/prazoService.js
       listar(filtros)        → GET  /api/prazos?...
       criar(dados)           → POST /api/prazos
       cumprir(id)            → POST /api/prazos/:id/cumprir
       simular(parametros)    → cálculo local, NUNCA vai para o servidor
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()     { return App.services.db; }
  function http()   { return App.services.http; }
  function motor()  { return App.domain.prazos; }

  /** Prazo herda a visibilidade do processo. A regra vive no dominio. */
  function visiveisPara(prazos, processos) {
    return App.domain.permissoes.filtrarPorProcesso(
      App.store.getState().usuarioAtual, prazos, processos);
  }

  function enriquecer(prazo, ctx) {
    var contexto = ctx || {
      processos: db().get('processos'),
      usuarios: db().get('usuarios'),
      pessoas: db().get('pessoas')
    };

    var processo = contexto.processos.filter(function (p) { return p.id === prazo.processoId; })[0] || null;
    var cliente = processo
      ? contexto.pessoas.filter(function (p) { return p.id === processo.clienteId; })[0]
      : null;
    var responsavel = contexto.usuarios.filter(function (u) { return u.id === prazo.responsavelId; })[0] || null;

    return Object.assign({}, prazo, motor().avaliar(prazo), {
      processo: processo,
      processoNumero: processo ? processo.numeroCnj : '—',
      processoInterno: processo ? processo.numeroInterno : '—',
      clienteNome: cliente ? cliente.nome : '—',
      responsavel: responsavel,
      responsavelNome: responsavel ? responsavel.nome : '—'
    });
  }

  /**
   * @param {Object} [filtros] status, semaforo, responsavelId, processoId,
   *                           de, ate (ISO), busca, apenasAbertos, ordenarPor
   */
  function listar(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var contexto = {
        processos: db().get('processos'),
        usuarios: db().get('usuarios'),
        pessoas: db().get('pessoas')
      };

      /* Mesmo recorte do `resumo()`: os dois pontos de entrada do modulo
         respondem a mesma pergunta e nao podem responder diferente. */
      var lista = visiveisPara(db().get('prazos'), contexto.processos)
        .map(function (pz) { return enriquecer(pz, contexto); });

      lista = lista.filter(function (pz) {
        if (f.apenasAbertos && pz.status !== 'pendente' && pz.status !== 'em_andamento') return false;
        if (f.status && pz.status !== f.status) return false;
        if (f.semaforo && pz.semaforo !== f.semaforo) return false;
        if (f.responsavelId && pz.responsavelId !== f.responsavelId) return false;
        if (f.processoId && pz.processoId !== f.processoId) return false;
        if (f.de && pz.dataFatal < f.de) return false;
        if (f.ate && pz.dataFatal > f.ate) return false;

        if (f.busca) {
          var termo = String(f.busca).toLowerCase();
          var alvo = [pz.titulo, pz.processoNumero, pz.processoInterno,
                      pz.clienteNome, pz.responsavelNome].join(' ').toLowerCase();
          if (alvo.indexOf(termo) === -1) return false;
        }
        return true;
      });

      lista.sort(function (a, b) {
        return a.dataFatal < b.dataFatal ? -1 : a.dataFatal > b.dataFatal ? 1 : 0;
      });

      if (f.limite) lista = lista.slice(0, f.limite);

      return { itens: lista, total: lista.length };
    });
  }

  /**
   * Cria o prazo calculando as datas pelo motor — a UI envia a
   * disponibilização e o prazo legal; quem decide as datas é o domínio.
   */
  function criar(dados) {
    return http().requisicao(function () {
      var calculo = motor().calcular({
        dataDisponibilizacao: dados.dataDisponibilizacao,
        dias: dados.quantidadeDias,
        tipoContagem: dados.tipoContagem || 'uteis',
        diasAntecedencia: dados.diasAntecedencia === undefined ? 3 : dados.diasAntecedencia,
        dobro: !!dados.dobro,
        jaPublicado: !!dados.jaPublicado
      });

      if (!calculo) throw http().ErroApi('Não foi possível calcular o prazo com os dados informados.', 400);

      var novo = db().insert('prazos', {
        processoId: dados.processoId,
        titulo: dados.titulo,
        tipoPrazoId: dados.tipoPrazoId || 'custom',
        tipoContagem: calculo.tipoContagem,
        quantidadeDias: calculo.diasEfetivos,
        dataDisponibilizacao: calculo.dataDisponibilizacao,
        dataPublicacao: calculo.dataPublicacao,
        dataInicioContagem: calculo.dataInicioContagem,
        dataFatal: calculo.dataFatal,
        dataInterna: calculo.dataInterna,
        diasAntecedencia: calculo.diasAntecedencia,
        responsavelId: dados.responsavelId,
        prioridade: dados.prioridade || 'media',
        status: 'pendente',
        dataCumprimento: null,
        observacoes: dados.observacoes || '',
        andamentoOrigemId: dados.andamentoOrigemId || null
      }, 'PRZ');

      return enriquecer(novo);
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('prazos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Prazo não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  /** Baixa do prazo — registra andamento, porque cumprir prazo é fato do processo. */
  function cumprir(id, observacoes) {
    return http().requisicao(function () {
      var prazo = db().find('prazos', id);
      if (!prazo) throw http().ErroApi('Prazo não encontrado.', 404);

      var hoje = motor().hojeISO();
      var atualizado = db().update('prazos', id, {
        status: 'cumprido',
        dataCumprimento: hoje,
        cumpridoPorId: App.store.getState().usuarioAtual
          ? App.store.getState().usuarioAtual.id : prazo.responsavelId,
        observacoes: observacoes || prazo.observacoes
      });

      db().insert('andamentos', {
        processoId: prazo.processoId,
        data: hoje,
        tipo: 'peticao',
        titulo: 'Prazo cumprido: ' + prazo.titulo,
        descricao: 'Data fatal era ' + prazo.dataFatal + '.',
        origem: 'manual',
        visivelCliente: true,
        autorId: prazo.responsavelId,
        documentosIds: []
      }, 'AND');

      return enriquecer(atualizado);
    });
  }

  function reabrir(id) {
    return atualizar(id, {
      status: 'pendente', dataCumprimento: null,
      conferidoPorId: null, conferidoEm: null, cumpridoPorId: null
    });
  }

  /**
   * DUPLA CONFERÊNCIA (F2.2).
   *
   * Quem cumpriu não confere o próprio prazo — a regra existe porque é o que
   * o seguro de responsabilidade civil do escritório costuma exigir, e um
   * conferente que é a mesma pessoa não confere nada.
   *
   * A checagem de "outra pessoa" mora em `domain/permissoes.js` e é aplicada
   * aqui, no service, e não na tela: um botão escondido não é uma trava.
   */
  function conferir(id) {
    return http().requisicao(function () {
      var prazo = db().find('prazos', id);
      if (!prazo) throw http().ErroApi('Prazo não encontrado.', 404);
      if (prazo.status !== 'cumprido') {
        throw http().ErroApi('Só prazo cumprido pode ser conferido.', 409);
      }
      if (prazo.conferidoEm) throw http().ErroApi('Prazo já conferido.', 409);

      var usuario = App.store.getState().usuarioAtual;
      if (!App.domain.permissoes.pode(usuario, 'prazos.conferir')) {
        throw http().ErroApi('Seu perfil não confere prazo.', 403);
      }
      var executor = prazo.cumpridoPorId || prazo.responsavelId;
      if (usuario && usuario.id === executor) {
        throw http().ErroApi('A conferência precisa ser de outra pessoa.', 409);
      }

      var atualizado = db().update('prazos', id, {
        conferidoPorId: usuario ? usuario.id : null,
        conferidoEm: new Date().toISOString()
      });

      db().insert('andamentos', {
        processoId: prazo.processoId,
        data: motor().hojeISO(),
        tipo: 'nota_interna',
        titulo: 'Prazo conferido: ' + prazo.titulo,
        descricao: 'Conferência realizada por ' + (usuario ? usuario.nome : '—') + '.',
        origem: 'manual',
        visivelCliente: false,
        autorId: usuario ? usuario.id : prazo.responsavelId,
        documentosIds: []
      }, 'AND');

      return enriquecer(atualizado);
    });
  }

  /**
   * Marca o prazo como PERDIDO. O motivo é obrigatório: prazo perdido é o
   * evento mais grave do sistema, e sem a justificativa registrada o
   * escritório não tem como reconstruir depois o que aconteceu.
   */
  function marcarPerdido(id, motivo) {
    return http().requisicao(function () {
      var texto = String(motivo || '').trim();
      if (texto.length < 10) {
        throw http().ErroApi(
          'Descreva o motivo da perda com pelo menos 10 caracteres.', 400);
      }

      var prazo = db().find('prazos', id);
      if (!prazo) throw http().ErroApi('Prazo não encontrado.', 404);

      var usuario = App.store.getState().usuarioAtual;
      var atualizado = db().update('prazos', id, {
        status: 'perdido',
        motivoPerda: texto,
        perdidoEm: new Date().toISOString(),
        perdidoRegistradoPorId: usuario ? usuario.id : null
      });

      db().insert('andamentos', {
        processoId: prazo.processoId,
        data: motor().hojeISO(),
        tipo: 'nota_interna',
        titulo: 'PRAZO PERDIDO: ' + prazo.titulo,
        descricao: 'Data fatal era ' + prazo.dataFatal + '. Motivo: ' + texto,
        origem: 'manual',
        visivelCliente: false,
        autorId: usuario ? usuario.id : prazo.responsavelId,
        documentosIds: []
      }, 'AND');

      return enriquecer(atualizado);
    });
  }

  /** Prazos cumpridos aguardando conferência de um segundo usuário. */
  function pendentesDeConferencia() {
    return http().requisicao(function () {
      var contexto = {
        processos: db().get('processos'),
        pessoas: db().get('pessoas'),
        usuarios: db().get('usuarios')
      };
      return db().get('prazos')
        .filter(function (pz) { return pz.status === 'cumprido' && !pz.conferidoEm; })
        .map(function (pz) { return enriquecer(pz, contexto); })
        .sort(function (a, b) { return a.dataCumprimento < b.dataCumprimento ? -1 : 1; });
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      db().remove('prazos', id);
      return { id: id };
    });
  }

  /**
   * Simulador do motor de contagem. É síncrono de propósito: o cálculo é
   * puro e local, e a tela responde a cada tecla sem ida ao servidor.
   */
  function simular(parametros) {
    return motor().calcular(parametros);
  }

  /** Contadores do semáforo para o dashboard. */
  function resumo() {
    return http().requisicao(function () {
      var contexto = {
        processos: db().get('processos'),
        usuarios: db().get('usuarios'),
        pessoas: db().get('pessoas')
      };

      /* O recorte de permissao vem ANTES de qualquer contagem: se saisse
         depois, a lista respeitaria o segredo de justica mas o subtitulo
         "N em risco" continuaria contando o que a pessoa nao pode ver — e um
         numero que nao bate com a lista abaixo dele e pior que nenhum. */
      var meusPrazos = visiveisPara(db().get('prazos'), contexto.processos);

      var abertos = meusPrazos
        .filter(function (pz) { return pz.status === 'pendente' || pz.status === 'em_andamento'; })
        .map(function (pz) { return enriquecer(pz, contexto); });

      var contagem = { ok: 0, atencao: 0, critico: 0, vencido: 0 };
      abertos.forEach(function (pz) { contagem[pz.semaforo] = (contagem[pz.semaforo] || 0) + 1; });

      var hoje = motor().hojeISO();

      return {
        totalAbertos: abertos.length,
        contagem: contagem,
        vencendoHoje: abertos.filter(function (pz) { return pz.dataFatal === hoje; }).length,
        perdidos: meusPrazos.filter(function (pz) { return pz.status === 'perdido'; }).length,
        criticos: abertos
          .filter(function (pz) { return pz.semaforo === 'critico' || pz.semaforo === 'vencido'; })
          .sort(function (a, b) { return a.dataFatal < b.dataFatal ? -1 : 1; })
      };
    });
  }

  App.services.prazoService = {
    listar: listar,
    criar: criar,
    atualizar: atualizar,
    cumprir: cumprir,
    conferir: conferir,
    marcarPerdido: marcarPerdido,
    pendentesDeConferencia: pendentesDeConferencia,
    reabrir: reabrir,
    remover: remover,
    simular: simular,
    resumo: resumo,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
