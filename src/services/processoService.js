/* ==========================================================================
   services/processoService.js

   MIGRAÇÃO: as assinaturas abaixo já são as da futura API REST.
       listar(filtros)  →  GET  /api/processos?...
       obter(id)        →  GET  /api/processos/:id
       criar(dados)     →  POST /api/processos
       atualizar(id, d) →  PUT  /api/processos/:id
       remover(id)      →  DELETE /api/processos/:id
   O "enriquecimento" feito aqui é exatamente o que o backend devolveria
   pronto — por isso as telas não mudam quando o banco entrar.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()    { return App.services.db; }
  function http()  { return App.services.http; }
  function prazos(){ return App.domain.prazos; }

  /**
   * SEGREDO DE JUSTIÇA (F2.1) — filtrado aqui, na camada de dados, e não nas
   * telas. É de propósito: um processo em segredo precisa sumir da lista, do
   * kanban, da busca global, do dashboard e dos indicadores de uma vez só.
   * Espalhar a checagem pelas telas garantiria esquecer uma.
   *
   * Na fase 3 esta mesma regra roda no servidor — o `WHERE` da consulta.
   */
  /* Nome longo de propósito: `obter()` já tem uma função local `usuario(uid)`
     que resolve o autor de um andamento, e ela sobrepõe qualquer homônima do
     módulo por hoisting. */
  function usuarioDaSessao() {
    return App.store.getState().usuarioAtual;
  }

  function visiveis(lista) {
    return App.domain.permissoes.filtrarProcessos(usuarioDaSessao(), lista);
  }

  /** Anexa cliente, responsável e o prazo pendente mais próximo. */
  function enriquecer(processo, contexto) {
    var ctx = contexto || {
      pessoas: db().get('pessoas'),
      usuarios: db().get('usuarios'),
      prazos: db().get('prazos')
    };

    var cliente = ctx.pessoas.filter(function (p) { return p.id === processo.clienteId; })[0] || null;
    var responsavel = ctx.usuarios.filter(function (u) { return u.id === processo.responsavelId; })[0] || null;

    var pendentes = ctx.prazos
      .filter(function (pz) {
        return pz.processoId === processo.id &&
               (pz.status === 'pendente' || pz.status === 'em_andamento');
      })
      .sort(function (a, b) { return a.dataFatal < b.dataFatal ? -1 : 1; });

    var proximo = pendentes[0] || null;

    return Object.assign({}, processo, {
      cliente: cliente,
      clienteNome: cliente ? cliente.nome : '—',
      responsavel: responsavel,
      responsavelNome: responsavel ? responsavel.nome : '—',
      prazoProximo: proximo ? Object.assign({}, proximo, prazos().avaliar(proximo)) : null,
      totalPrazosPendentes: pendentes.length
    });
  }

  function aplicarFiltros(lista, filtros) {
    var f = filtros || {};

    return lista.filter(function (p) {
      if (f.status && p.status !== f.status) return false;
      if (f.faseId && p.faseId !== f.faseId) return false;
      if (f.areaId && p.areaId !== f.areaId) return false;
      if (f.responsavelId && p.responsavelId !== f.responsavelId) return false;
      if (f.clienteId && p.clienteId !== f.clienteId) return false;
      if (f.tribunalId && p.tribunalId !== f.tribunalId) return false;
      if (f.risco && p.risco !== f.risco) return false;

      if (f.apenasComPrazoCritico) {
        var sem = p.prazoProximo && p.prazoProximo.semaforo;
        if (sem !== 'critico' && sem !== 'vencido') return false;
      }

      if (f.busca) {
        var termo = String(f.busca).toLowerCase().trim();
        var alvo = [
          p.numeroCnj, p.numeroInterno, p.clienteNome, p.assunto,
          p.classeProcessual, p.comarca, p.vara, p.responsavelNome
        ].join(' ').toLowerCase();
        // Busca por número também ignora a pontuação do CNJ.
        var alvoDigitos = String(p.numeroCnj).replace(/\D/g, '');
        var termoDigitos = termo.replace(/\D/g, '');
        var achouPorNumero = termoDigitos.length >= 3 && alvoDigitos.indexOf(termoDigitos) !== -1;
        if (alvo.indexOf(termo) === -1 && !achouPorNumero) return false;
      }

      return true;
    });
  }

  var COMPARADORES = {
    numeroCnj:        function (a, b) { return a.numeroCnj.localeCompare(b.numeroCnj); },
    numeroInterno:    function (a, b) { return a.numeroInterno.localeCompare(b.numeroInterno); },
    clienteNome:      function (a, b) { return a.clienteNome.localeCompare(b.clienteNome, 'pt-BR'); },
    valorCausa:       function (a, b) { return a.valorCausa - b.valorCausa; },
    dataDistribuicao: function (a, b) { return a.dataDistribuicao < b.dataDistribuicao ? -1 : 1; },
    responsavelNome:  function (a, b) { return a.responsavelNome.localeCompare(b.responsavelNome, 'pt-BR'); },
    prazo: function (a, b) {
      var da = a.prazoProximo ? a.prazoProximo.dataFatal : '9999-12-31';
      var dbb = b.prazoProximo ? b.prazoProximo.dataFatal : '9999-12-31';
      return da < dbb ? -1 : da > dbb ? 1 : 0;
    }
  };

  /**
   * @param {Object} [filtros] busca, status, faseId, areaId, responsavelId,
   *                           clienteId, tribunalId, risco, ordenarPor, direcao,
   *                           pagina, porPagina
   */
  function listar(filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var contexto = {
        pessoas: db().get('pessoas'),
        usuarios: db().get('usuarios'),
        prazos: db().get('prazos')
      };

      var lista = visiveis(db().get('processos')).map(function (p) {
        return enriquecer(p, contexto);
      });

      lista = aplicarFiltros(lista, f);

      var comparador = COMPARADORES[f.ordenarPor || 'dataDistribuicao'];
      if (comparador) {
        lista.sort(comparador);
        if (f.direcao === 'desc') lista.reverse();
      }

      var total = lista.length;
      var pagina = f.pagina || 1;
      var porPagina = f.porPagina || total || 1;
      var inicio = (pagina - 1) * porPagina;

      return {
        itens: f.porPagina ? lista.slice(inicio, inicio + porPagina) : lista,
        total: total,
        pagina: pagina,
        porPagina: porPagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina))
      };
    });
  }

  /** Detalhe completo: processo + partes + andamentos + prazos + documentos + tarefas. */
  function obter(id) {
    return http().requisicao(function () {
      var processo = db().find('processos', id);
      if (!processo) throw http().ErroApi('Processo não encontrado.', 404);

      // 404, não 403: dizer "sem permissão" já revelaria que o processo em
      // segredo existe, e para quem não pode vê-lo ele não existe.
      if (!App.domain.permissoes.podeVerProcesso(usuarioDaSessao(), processo)) {
        throw http().ErroApi('Processo não encontrado.', 404);
      }

      var pessoas = db().get('pessoas');
      var usuarios = db().get('usuarios');

      function pessoa(pid) { return pessoas.filter(function (p) { return p.id === pid; })[0] || null; }
      function usuario(uid) { return usuarios.filter(function (u) { return u.id === uid; })[0] || null; }

      var partes = db().where('partesProcesso', function (pt) { return pt.processoId === id; })
        .map(function (pt) { return Object.assign({}, pt, { pessoa: pessoa(pt.pessoaId) }); });

      var andamentos = db().where('andamentos', function (a) { return a.processoId === id; })
        .map(function (a) { return Object.assign({}, a, { autor: usuario(a.autorId) }); })
        .sort(function (a, b) { return a.data < b.data ? 1 : -1; });   // mais recente primeiro

      var listaPrazos = db().where('prazos', function (pz) { return pz.processoId === id; })
        .map(function (pz) {
          return Object.assign({}, pz, App.domain.prazos.avaliar(pz), {
            responsavel: usuario(pz.responsavelId)
          });
        })
        .sort(function (a, b) { return a.dataFatal < b.dataFatal ? -1 : 1; });

      var documentos = db().where('documentos', function (d) { return d.processoId === id; })
        .map(function (d) {
          return Object.assign({ pastaId: null }, d, { uploadPor: usuario(d.uploadPorId) });
        })
        .sort(function (a, b) { return a.uploadEm < b.uploadEm ? 1 : -1; });

      // Pastas da aba Documentos — hierarquia rasa, montada na tela.
      var pastasDocumento = db().where('pastasDocumento', function (pt) { return pt.processoId === id; })
        .map(function (pt) { return Object.assign({}, pt, { criadoPor: usuario(pt.criadoPorId) }); })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

      var tarefas = db().where('tarefas', function (t) { return t.processoId === id; })
        .map(function (t) { return Object.assign({}, t, { responsavel: usuario(t.responsavelId) }); });

      var compromissos = db().where('compromissos', function (cp) { return cp.processoId === id; })
        .sort(function (a, b) { return a.dataHora < b.dataHora ? -1 : 1; });

      /* PROCESSOS VINCULADOS (F2.10) — apensos, cautelar, execução, embargos.
         Passam pelo MESMO filtro de segredo de justiça: um processo em
         segredo não pode vazar por ser apenso de outro que a pessoa vê.
         O vínculo existe, mas para quem não pode vê-lo ele não aparece. */
      function visivel(p) {
        return App.domain.permissoes.podeVerProcesso(usuarioDaSessao(), p);
      }
      function resumo(p) {
        return {
          id: p.id, numeroCnj: p.numeroCnj, numeroInterno: p.numeroInterno,
          assunto: p.assunto, classeProcessual: p.classeProcessual,
          status: p.status, faseId: p.faseId, valorCausa: p.valorCausa
        };
      }

      var pai = processo.processoPaiId
        ? db().find('processos', processo.processoPaiId) : null;

      var apensos = db()
        .where('processos', function (p) { return p.processoPaiId === id; })
        .filter(visivel)
        .map(resumo);

      return Object.assign(enriquecer(processo), {
        processoPai: pai && visivel(pai) ? resumo(pai) : null,
        apensos: apensos,
        partes: partes,
        andamentos: andamentos,
        prazos: listaPrazos,
        documentos: documentos,
        pastasDocumento: pastasDocumento,
        tarefas: tarefas,
        compromissos: compromissos,
        equipe: (processo.equipeIds || []).map(usuario).filter(Boolean)
      });
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      var novo = db().insert('processos', Object.assign({
        tipo: 'judicial',
        status: 'ativo',
        faseId: 'distribuicao',
        segredoJustica: false,
        equipeIds: [],
        tags: [],
        valorProvisao: 0,
        processoPaiId: null
      }, dados), 'PRO');

      db().insert('andamentos', {
        processoId: novo.id,
        data: App.domain.prazos.hojeISO(),
        tipo: 'movimentacao',
        titulo: 'Processo cadastrado no sistema',
        descricao: 'Cadastro inicial realizado.',
        origem: 'manual',
        visivelCliente: false,
        autorId: novo.responsavelId,
        documentosIds: []
      }, 'AND');

      return enriquecer(novo);
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('processos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Processo não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      var removido = db().remove('processos', id);
      if (!removido) throw http().ErroApi('Processo não encontrado.', 404);
      return { id: id };
    });
  }

  /**
   * Vincula um processo a outro (apenso). `paiId` nulo desfaz o vínculo.
   *
   * A checagem de CICLO não é preciosismo: A → B → A faria a árvore de
   * apensos da tela recorrer para sempre, e travar o navegador é pior do
   * que recusar o vínculo. Subimos a cadeia inteira antes de gravar.
   */
  function vincular(id, paiId) {
    return http().requisicao(function () {
      var processo = db().find('processos', id);
      if (!processo) throw http().ErroApi('Processo não encontrado.', 404);

      if (!paiId) {
        return enriquecer(db().update('processos', id, { processoPaiId: null }));
      }
      if (paiId === id) {
        throw http().ErroApi('Um processo não pode ser apenso de si mesmo.', 400);
      }

      var pai = db().find('processos', paiId);
      if (!pai) throw http().ErroApi('Processo principal não encontrado.', 404);
      if (!App.domain.permissoes.podeVerProcesso(usuarioDaSessao(), pai)) {
        throw http().ErroApi('Processo principal não encontrado.', 404);
      }

      var visitados = {};
      var atual = pai;
      while (atual) {
        if (atual.id === id) {
          throw http().ErroApi(
            'Este vínculo criaria um ciclo: o processo escolhido já está abaixo deste.',
            409);
        }
        if (visitados[atual.id]) break;      // cadeia já corrompida — não insiste
        visitados[atual.id] = true;
        atual = atual.processoPaiId ? db().find('processos', atual.processoPaiId) : null;
      }

      return enriquecer(db().update('processos', id, { processoPaiId: paiId }));
    });
  }

  /**
   * Movimentação do kanban. Além de gravar o campo, registra um andamento —
   * mudar de fase é um fato do processo e precisa ficar na timeline.
   */
  function mudarCampoKanban(id, campo, valor) {
    return http().requisicao(function () {
      var processo = db().find('processos', id);
      if (!processo) throw http().ErroApi('Processo não encontrado.', 404);
      if (processo[campo] === valor) return enriquecer(processo);

      var enums = App.domain.enums;
      var rotuloDe = {
        faseId: function (v) { return enums.rotulo(enums.FASES, v); },
        responsavelId: function (v) {
          var u = db().find('usuarios', v);
          return u ? u.nome : v;
        },
        areaId: function (v) { return enums.rotulo(enums.AREAS, v); }
      };

      var descrever = rotuloDe[campo] || function (v) { return v; };
      var de = descrever(processo[campo]);
      var para = descrever(valor);

      var alteracoes = {};
      alteracoes[campo] = valor;

      // Arquivar pelo kanban precisa refletir no status, senão o processo
      // continua contando como ativo nos indicadores.
      if (campo === 'faseId') {
        if (valor === 'arquivado') {
          alteracoes.status = 'arquivado';
          alteracoes.dataEncerramento = App.domain.prazos.hojeISO();
        } else if (processo.status === 'arquivado') {
          alteracoes.status = 'ativo';
          alteracoes.dataEncerramento = null;
        }
      }

      var atualizado = db().update('processos', id, alteracoes);

      var nomeCampo = { faseId: 'Fase', responsavelId: 'Responsável', areaId: 'Área' }[campo] || campo;
      db().insert('andamentos', {
        processoId: id,
        data: App.domain.prazos.hojeISO(),
        tipo: 'nota_interna',
        titulo: nomeCampo + ' alterada: ' + de + ' → ' + para,
        descricao: 'Alteração registrada pelo quadro kanban.',
        origem: 'manual',
        visivelCliente: false,
        autorId: db().get('usuarios')[0].id,
        documentosIds: []
      }, 'AND');

      return enriquecer(atualizado);
    });
  }

  function mudarFase(id, faseId) {
    return mudarCampoKanban(id, 'faseId', faseId);
  }

  /** Indicadores do dashboard, calculados em uma passada só. */
  function estatisticas() {
    return http().requisicao(function () {
      // Os indicadores também respeitam o segredo: um sócio e um estagiário
      // veem carteiras de tamanhos diferentes, e é assim que deve ser.
      var processos = visiveis(db().get('processos'));
      var ativos = processos.filter(function (p) { return p.status === 'ativo'; });

      var porFase = {};
      var porArea = {};
      var porRisco = { provavel: 0, possivel: 0, remoto: 0 };
      var valorTotal = 0;
      var provisaoTotal = 0;

      ativos.forEach(function (p) {
        porFase[p.faseId] = (porFase[p.faseId] || 0) + 1;
        porArea[p.areaId] = (porArea[p.areaId] || 0) + 1;
        porRisco[p.risco] = (porRisco[p.risco] || 0) + 1;
        valorTotal += p.valorCausa || 0;
        provisaoTotal += p.valorProvisao || 0;
      });

      return {
        total: processos.length,
        ativos: ativos.length,
        suspensos: processos.filter(function (p) { return p.status === 'suspenso'; }).length,
        arquivados: processos.filter(function (p) { return p.status === 'arquivado'; }).length,
        porFase: porFase,
        porArea: porArea,
        porRisco: porRisco,
        valorTotal: valorTotal,
        provisaoTotal: provisaoTotal
      };
    });
  }

  App.services.processoService = {
    listar: listar,
    obter: obter,
    criar: criar,
    atualizar: atualizar,
    remover: remover,
    vincular: vincular,
    mudarFase: mudarFase,
    mudarCampoKanban: mudarCampoKanban,
    estatisticas: estatisticas,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
