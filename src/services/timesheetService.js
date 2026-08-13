/* ==========================================================================
   services/timesheetService.js — apontamento de horas

   Duas funções que parecem uma só e não são:
     · medir o tempo gasto — vira custo, e é o que diz se o processo dá lucro;
     · faturar o tempo — vira receita, só no contrato por hora.

   Hora não faturável continua sendo apontada. É ela que explica por que um
   contrato de valor fixo deu prejuízo, e um sistema que só registra o que
   pode cobrar esconde exatamente o que interessa saber.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(a, ctx) {
    var contexto = ctx || {
      processos: db().get('processos'),
      usuarios: db().get('usuarios')
    };

    var processo = contexto.processos.filter(function (p) {
      return p.id === a.processoId;
    })[0] || null;
    var usuario = contexto.usuarios.filter(function (u) {
      return u.id === a.usuarioId;
    })[0] || null;

    return Object.assign({}, a, {
      processo: processo,
      processoNumero: processo ? processo.numeroCnj : '—',
      usuario: usuario,
      usuarioNome: usuario ? usuario.nome : '—',
      horas: Math.floor((a.minutos || 0) / 60),
      minutosResto: (a.minutos || 0) % 60,
      faturado: !!a.lancamentoId,
      valorCentavos: Math.round((a.valorHoraCentavos || 0) * (a.minutos || 0) / 60)
    });
  }

  /** 135 → '2h15' */
  function formatarDuracao(minutos) {
    var m = Math.max(0, Math.round(minutos || 0));
    var h = Math.floor(m / 60);
    var resto = m % 60;
    if (!h) return resto + 'min';
    return h + 'h' + (resto ? String(resto).padStart(2, '0') : '');
  }

  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var contexto = { processos: db().get('processos'), usuarios: db().get('usuarios') };

      var lista = db().get('apontamentos')
        .map(function (a) { return enriquecer(a, contexto); })
        .filter(function (a) {
          if (filtros.usuarioId && a.usuarioId !== filtros.usuarioId) return false;
          if (filtros.processoId && a.processoId !== filtros.processoId) return false;
          if (filtros.de && a.data < filtros.de) return false;
          if (filtros.ate && a.data > filtros.ate) return false;
          if (filtros.apenasFaturaveis && a.faturavel === false) return false;
          if (filtros.apenasNaoFaturados && a.lancamentoId) return false;
          return true;
        })
        .sort(function (a, b) { return a.data < b.data ? 1 : -1; });

      var minutos = lista.reduce(function (s, a) { return s + (a.minutos || 0); }, 0);
      var faturaveis = lista.filter(function (a) { return a.faturavel !== false; });

      return {
        itens: lista,
        total: lista.length,
        minutos: minutos,
        minutosFaturaveis: faturaveis.reduce(function (s, a) { return s + (a.minutos || 0); }, 0),
        valorCentavos: faturaveis.reduce(function (s, a) { return s + a.valorCentavos; }, 0),
        duracao: formatarDuracao(minutos)
      };
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      var minutos = Math.round(Number(dados.minutos) || 0);
      if (minutos <= 0) throw http().ErroApi('Informe o tempo gasto.', 400);
      if (!dados.processoId) throw http().ErroApi('Informe o processo.', 400);

      var usuario = App.store.getState().usuarioAtual;

      // O valor-hora do contrato do processo é o que vale; sem contrato por
      // hora, fica o valor de referência do escritório.
      var contrato = db().where('contratos', function (c) {
        return c.processoId === dados.processoId && c.valorHoraCentavos > 0;
      })[0];

      return enriquecer(db().insert('apontamentos', {
        processoId: dados.processoId,
        tarefaId: dados.tarefaId || null,
        usuarioId: dados.usuarioId || (usuario ? usuario.id : null),
        data: dados.data || App.domain.prazos.hojeISO(),
        minutos: minutos,
        descricao: dados.descricao || '',
        faturavel: dados.faturavel !== false,
        valorHoraCentavos: Math.round(
          dados.valorHoraCentavos || (contrato ? contrato.valorHoraCentavos : 25000)),
        lancamentoId: null,
        aprovadoPorId: null
      }, 'APT'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var a = db().find('apontamentos', id);
      if (!a) throw http().ErroApi('Apontamento não encontrado.', 404);
      if (a.lancamentoId) {
        throw http().ErroApi('Apontamento já faturado não pode ser alterado.', 409);
      }
      return enriquecer(db().update('apontamentos', id, alteracoes));
    });
  }

  function remover(id) {
    return http().requisicao(function () {
      var a = db().find('apontamentos', id);
      if (!a) throw http().ErroApi('Apontamento não encontrado.', 404);
      if (a.lancamentoId) {
        throw http().ErroApi('Apontamento já faturado não pode ser excluído.', 409);
      }
      db().remove('apontamentos', id);
      return { id: id };
    });
  }

  /**
   * Fatura as horas não faturadas de um processo em UM lançamento.
   *
   * Um lançamento por apontamento entupiria o contas a receber com dezenas
   * de títulos de R$ 80 — a fatura é do período, não do clique.
   */
  function faturar(processoId, opcoes) {
    return http().requisicao(function () {
      var op = opcoes || {};

      var pendentes = db().where('apontamentos', function (a) {
        return a.processoId === processoId && a.faturavel !== false && !a.lancamentoId &&
               (!op.de || a.data >= op.de) && (!op.ate || a.data <= op.ate);
      });

      if (!pendentes.length) {
        throw http().ErroApi('Não há horas faturáveis pendentes neste processo.', 409);
      }

      var minutos = pendentes.reduce(function (s, a) { return s + (a.minutos || 0); }, 0);
      var valor = pendentes.reduce(function (s, a) {
        return s + Math.round((a.valorHoraCentavos || 0) * (a.minutos || 0) / 60);
      }, 0);

      var processo = db().find('processos', processoId);
      var contrato = db().where('contratos', function (c) {
        return c.processoId === processoId;
      })[0];
      var hoje = App.domain.prazos.hojeISO();

      var lancamento = db().insert('lancamentos', {
        tipo: 'receita',
        origem: 'honorario',
        contratoId: contrato ? contrato.id : null,
        processoId: processoId,
        clienteId: processo ? processo.clienteId : null,
        descricao: 'Honorários por hora — ' + formatarDuracao(minutos) +
                   ' (' + pendentes.length + ' apontamento(s))',
        valorCentavos: valor,
        valorPagoCentavos: 0,
        dataCompetencia: App.domain.financeiro.competenciaDe(hoje),
        dataVencimento: op.dataVencimento ||
          App.format.toISO(App.domain.prazos.somarDiasUteis(hoje, 11)),
        dataPagamento: null,
        status: 'em_aberto',
        reembolsavel: false,
        boletoId: null,
        parcela: null
      }, 'LAN');

      pendentes.forEach(function (a) {
        db().update('apontamentos', a.id, { lancamentoId: lancamento.id });
      });

      return {
        lancamento: lancamento,
        apontamentos: pendentes.length,
        minutos: minutos,
        duracao: formatarDuracao(minutos)
      };
    });
  }

  /** Horas por usuário no período — base do relatório de produtividade (F2.9). */
  function porUsuario(de, ate) {
    return http().requisicao(function () {
      var usuarios = db().get('usuarios');
      var mapa = {};

      db().get('apontamentos').forEach(function (a) {
        if (de && a.data < de) return;
        if (ate && a.data > ate) return;

        var chave = a.usuarioId || 'sem';
        if (!mapa[chave]) mapa[chave] = { minutos: 0, faturaveis: 0, valorCentavos: 0 };
        mapa[chave].minutos += a.minutos || 0;
        if (a.faturavel !== false) {
          mapa[chave].faturaveis += a.minutos || 0;
          mapa[chave].valorCentavos +=
            Math.round((a.valorHoraCentavos || 0) * (a.minutos || 0) / 60);
        }
      });

      return Object.keys(mapa).map(function (id) {
        var u = usuarios.filter(function (x) { return x.id === id; })[0];
        return Object.assign({
          usuarioId: id,
          usuarioNome: u ? u.nome : 'Sem responsável',
          duracao: formatarDuracao(mapa[id].minutos)
        }, mapa[id]);
      }).sort(function (a, b) { return b.minutos - a.minutos; });
    });
  }

  App.services.timesheetService = {
    listar: listar,
    criar: criar,
    atualizar: atualizar,
    remover: remover,
    faturar: faturar,
    porUsuario: porUsuario,
    formatarDuracao: formatarDuracao,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
