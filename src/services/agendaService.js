/* ==========================================================================
   services/agendaService.js
       eventos(de, ate) → GET /api/agenda?de=...&ate=...

   Unifica prazos e compromissos numa única lista de eventos, que é o que
   o calendário consome. O semáforo do prazo vira a cor do evento.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()    { return App.services.db; }
  function http()  { return App.services.http; }
  function motor() { return App.domain.prazos; }

  /**
   * Eventos do período, já normalizados: { id, tipo, data, titulo, ... }.
   * @param {string} de   ISO
   * @param {string} ate  ISO
   */
  function eventos(de, ate, filtros) {
    return http().requisicao(function () {
      var f = filtros || {};
      var processos = db().get('processos');
      var usuarios = db().get('usuarios');
      var pessoas = db().get('pessoas');

      function processo(pid) {
        return processos.filter(function (p) { return p.id === pid; })[0] || null;
      }
      function usuario(uid) {
        return usuarios.filter(function (u) { return u.id === uid; })[0] || null;
      }
      function clienteDe(proc) {
        if (!proc) return null;
        return pessoas.filter(function (p) { return p.id === proc.clienteId; })[0] || null;
      }

      var lista = [];

      if (f.tipo !== 'compromisso') {
        db().get('prazos').forEach(function (pz) {
          if (pz.dataFatal < de || pz.dataFatal > ate) return;
          if (f.responsavelId && pz.responsavelId !== f.responsavelId) return;
          if (f.apenasAbertos && pz.status !== 'pendente' && pz.status !== 'em_andamento') return;

          var proc = processo(pz.processoId);
          var avaliacao = motor().avaliar(pz);
          var cliente = clienteDe(proc);

          lista.push({
            id: pz.id,
            categoria: 'prazo',
            data: pz.dataFatal,
            hora: null,
            titulo: pz.titulo,
            subtitulo: proc ? proc.numeroInterno + ' · ' + (cliente ? cliente.nome : '') : '',
            semaforo: pz.status === 'cumprido' ? 'cumprido' : avaliacao.semaforo,
            status: pz.status,
            processoId: pz.processoId,
            processoNumero: proc ? proc.numeroCnj : '',
            responsavel: usuario(pz.responsavelId),
            href: proc ? '#/processos/' + proc.id : '#/agenda',
            registro: pz
          });
        });
      }

      if (f.tipo !== 'prazo') {
        db().get('compromissos').forEach(function (cp) {
          var dataCp = String(cp.dataHora).slice(0, 10);
          if (dataCp < de || dataCp > ate) return;
          if (f.responsavelId && cp.responsavelId !== f.responsavelId) return;

          var proc = processo(cp.processoId);
          var cliente = clienteDe(proc);

          lista.push({
            id: cp.id,
            categoria: 'compromisso',
            data: dataCp,
            hora: String(cp.dataHora).slice(11, 16),
            titulo: cp.titulo,
            subtitulo: cp.local,
            tipoCompromisso: cp.tipo,
            status: cp.status,
            processoId: cp.processoId,
            processoNumero: proc ? proc.numeroCnj : '',
            clienteNome: cliente ? cliente.nome : '',
            responsavel: usuario(cp.responsavelId),
            href: proc ? '#/processos/' + proc.id : '#/agenda',
            registro: cp
          });
        });
      }

      lista.sort(function (a, b) {
        if (a.data !== b.data) return a.data < b.data ? -1 : 1;
        return (a.hora || '99:99') < (b.hora || '99:99') ? -1 : 1;
      });

      return { itens: lista, total: lista.length };
    });
  }

  /** Agrupa por data — formato direto de consumo do calendário. */
  function porDia(de, ate, filtros) {
    return eventos(de, ate, filtros).then(function (resultado) {
      var mapa = {};
      resultado.itens.forEach(function (ev) {
        if (!mapa[ev.data]) mapa[ev.data] = [];
        mapa[ev.data].push(ev);
      });
      return { mapa: mapa, itens: resultado.itens, total: resultado.total };
    });
  }

  function criarCompromisso(dados) {
    return http().requisicao(function () {
      return db().insert('compromissos', Object.assign({
        status: 'agendado',
        duracaoMin: 60,
        participantesIds: [],
        observacoes: ''
      }, dados), 'CMP');
    });
  }

  function atualizarCompromisso(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('compromissos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Compromisso não encontrado.', 404);
      return atualizado;
    });
  }

  /** Próximos compromissos — usado no dashboard. */
  function proximos(limite) {
    return http().requisicao(function () {
      var hoje = motor().hojeISO();
      var processos = db().get('processos');
      var pessoas = db().get('pessoas');

      return db().get('compromissos')
        .filter(function (cp) {
          return String(cp.dataHora).slice(0, 10) >= hoje && cp.status === 'agendado';
        })
        .sort(function (a, b) { return a.dataHora < b.dataHora ? -1 : 1; })
        .slice(0, limite || 6)
        .map(function (cp) {
          var proc = processos.filter(function (p) { return p.id === cp.processoId; })[0];
          var cliente = proc && pessoas.filter(function (p) { return p.id === proc.clienteId; })[0];
          return Object.assign({}, cp, {
            processo: proc || null,
            clienteNome: cliente ? cliente.nome : '—'
          });
        });
    });
  }

  App.services.agendaService = {
    eventos: eventos,
    porDia: porDia,
    criarCompromisso: criarCompromisso,
    atualizarCompromisso: atualizarCompromisso,
    proximos: proximos
  };
})(window.App = window.App || {});
