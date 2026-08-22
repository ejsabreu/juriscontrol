/* ==========================================================================
   services/painelService.js
       meuPainel()  → GET /api/painel

   MEU PAINEL — a tela inicial, e a única que responde "o que é meu".

   O dashboard do escritório mostra a carteira; esta mostra a pessoa. São
   perguntas diferentes e por isso são telas diferentes: um alternador
   "meus / todos" na mesma tela obrigaria quem lê um número a lembrar em que
   modo estava, e número que depende de um estado invisível é número que
   engana.

   O QUE CONTA COMO "MEU"

   Não é só `responsavelId`. Medindo a carteira do protótipo, o recorte
   estrito deixaria TRÊS dos nove usuários com a tela vazia — o admin, o
   estagiário e o financeiro têm zero prazo e zero tarefa no próprio nome,
   e ainda assim atuam em 4, 7 e 13 processos. Não é acidente do seed: prazo
   fica no nome de quem assina, e quem instrui o processo não assina.

   Então "meu" tem duas camadas, e a tela mostra as duas separadas:

     no meu nome   — sou o responsável do registro (prazo, tarefa, compromisso)
     da minha equipe — atuo no processo, como responsável dele ou na equipe

   PERFIL MUDA A FORMA, NÃO SÓ O CONTEÚDO

   Filtrar os mesmos blocos por pessoa produziria três vazios educados para
   o financeiro, cujo trabalho não tem prazo processual nenhum. Cada perfil
   declara os blocos que fazem sentido para ele em `BLOCOS_POR_PERFIL`.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }
  function motor(){ return App.domain.prazos; }

  /* `addDias` do motor recebe e devolve `Date`; aqui tudo circula em ISO. */
  function maisDias(iso, n) {
    return motor().paraISO(motor().addDias(motor().paraDate(iso), n));
  }

  /**
   * Blocos por perfil, na ordem em que aparecem.
   *
   * `advogado` e `socio` compartilham a forma — a diferença entre os dois é
   * de volume e de alcance nos relatórios, não do que precisam ver ao abrir
   * o sistema de manhã. `admin` recebe a mesma forma porque, no escritório
   * pequeno que este protótipo modela, quem administra também advoga.
   */
  var BLOCOS_POR_PERFIL = {
    admin:      ['prazos', 'tarefas', 'compromissos', 'acessos'],
    socio:      ['prazos', 'tarefas', 'compromissos', 'acessos'],
    advogado:   ['prazos', 'tarefas', 'compromissos', 'acessos'],
    /* Estagiário não baixa prazo (não tem `prazos.baixar`), mas precisa
       vê-los: é o que ele instrui. A tela mostra sem as ações. */
    estagiario: ['prazos', 'tarefas', 'compromissos', 'acessos'],
    /* Financeiro não tem prazo processual nem compromisso de audiência. O
       dia dele é vencimento a receber e boleto a compensar. */
    financeiro: ['financeiro', 'tarefas', 'acessos']
  };

  function blocosDe(perfil) {
    return BLOCOS_POR_PERFIL[perfil] || ['tarefas', 'acessos'];
  }

  /** Ids dos processos em que a pessoa atua — responsável dele ou na equipe. */
  function processosEmQueAtuo(usuario, processos) {
    return processos
      .filter(function (p) {
        return p.responsavelId === usuario.id ||
               (p.equipeIds || []).indexOf(usuario.id) !== -1;
      })
      .map(function (p) { return p.id; });
  }

  /**
   * Reparte uma lista em "no meu nome" e "da minha equipe".
   *
   * A ordem importa: um registro no meu nome NÃO aparece também na equipe,
   * senão a soma dos dois blocos passaria a ser maior que o total e nenhum
   * dos dois números poderia ser somado com o outro.
   */
  function repartir(lista, usuario, idsDeProcesso) {
    var meus = [], daEquipe = [];

    lista.forEach(function (item) {
      if (item.responsavelId === usuario.id) meus.push(item);
      else if (idsDeProcesso.indexOf(item.processoId) !== -1) daEquipe.push(item);
    });

    return { meus: meus, daEquipe: daEquipe };
  }

  function meuPainel() {
    return http().requisicao(function () {
      var usuario = App.store.getState().usuarioAtual;
      if (!usuario) throw http().ErroApi('Nenhuma sessão aberta.', 401);

      var hoje = motor().hojeISO();
      var liberados = App.services.acessoService.liberados();

      /* Uma leitura só do banco, repartida daqui para baixo: os blocos se
         cruzam (o prazo do bloco 1 é do mesmo processo do compromisso do
         bloco 3) e reler por bloco multiplicaria o custo sem ganhar nada. */
      var contexto = {
        processos: db().get('processos'),
        usuarios: db().get('usuarios'),
        pessoas: db().get('pessoas')
      };

      var perm = App.domain.permissoes;
      var visiveis = perm.filtrarProcessos(usuario, contexto.processos, liberados);
      var atuo = processosEmQueAtuo(usuario, visiveis);
      var blocos = blocosDe(usuario.perfil);
      var painel = { usuario: usuario, hoje: hoje, blocos: blocos };

      // --- Prazos ---------------------------------------------------------
      if (blocos.indexOf('prazos') !== -1) {
        var prazos = perm
          .filtrarPorProcesso(usuario, db().get('prazos'), contexto.processos, liberados)
          .filter(function (pz) {
            return pz.status === 'pendente' || pz.status === 'em_andamento';
          })
          .map(function (pz) { return App.services.prazoService.enriquecer(pz, contexto); })
          .sort(function (a, b) { return a.dataFatal < b.dataFatal ? -1 : 1; });

        var repartidos = repartir(prazos, usuario, atuo);
        painel.prazos = {
          meus: repartidos.meus,
          daEquipe: repartidos.daEquipe,
          criticosMeus: repartidos.meus.filter(function (pz) {
            return pz.semaforo === 'critico' || pz.semaforo === 'vencido';
          }),
          vencendoHoje: repartidos.meus.filter(function (pz) {
            return pz.dataFatal === hoje;
          }).length,
          podeBaixar: perm.pode(usuario, 'prazos.baixar')
        };
      }

      // --- Tarefas --------------------------------------------------------
      if (blocos.indexOf('tarefas') !== -1) {
        var tarefas = perm
          .filtrarPorProcesso(usuario, db().get('tarefas'), contexto.processos, liberados)
          .filter(function (t) { return t.status !== 'concluida'; })
          .map(function (t) { return App.services.tarefaService.enriquecer(t, contexto); })
          .sort(function (a, b) { return a.dataVencimento < b.dataVencimento ? -1 : 1; });

        var tRepartidas = repartir(tarefas, usuario, atuo);
        painel.tarefas = {
          meus: tRepartidas.meus,
          daEquipe: tRepartidas.daEquipe,
          atrasadas: tRepartidas.meus.filter(function (t) {
            return t.dataVencimento < hoje;
          })
        };
      }

      // --- Compromissos ---------------------------------------------------
      if (blocos.indexOf('compromissos') !== -1) {
        /* Sete dias corridos, e não "os próximos N": audiência é evento com
           hora marcada, e o que a pessoa precisa saber ao abrir o sistema é
           o que vem ESTA semana — não o sexto compromisso, que pode estar
           a três meses daqui. */
        var ate = maisDias(hoje, 7);

        var compromissos = perm
          .filtrarPorProcesso(usuario, db().get('compromissos'), contexto.processos, liberados)
          .filter(function (cp) {
            var dia = String(cp.dataHora).slice(0, 10);
            return cp.status === 'agendado' && dia >= hoje && dia <= ate;
          })
          .sort(function (a, b) { return a.dataHora < b.dataHora ? -1 : 1; });

        var cRepartidos = repartir(compromissos, usuario, atuo);
        painel.compromissos = {
          meus: cRepartidos.meus.map(function (cp) { return comProcesso(cp, contexto); }),
          daEquipe: cRepartidos.daEquipe.map(function (cp) { return comProcesso(cp, contexto); }),
          ate: ate,
          hoje: cRepartidos.meus.filter(function (cp) {
            return String(cp.dataHora).slice(0, 10) === hoje;
          }).length
        };
      }

      // --- Financeiro -----------------------------------------------------
      if (blocos.indexOf('financeiro') !== -1) {
        var fin = App.domain.financeiro;
        var lancamentos = db().get('lancamentos').filter(function (l) {
          return l.status !== 'cancelado';
        });

        var atrasados = lancamentos.filter(function (l) {
          return fin.situacao(l, hoje) === 'atrasado';
        });
        var vencemNaSemana = lancamentos.filter(function (l) {
          return fin.situacao(l, hoje) !== 'pago' &&
                 l.dataVencimento >= hoje &&
                 l.dataVencimento <= maisDias(hoje, 7);
        });

        painel.financeiro = {
          atrasados: atrasados.length,
          atrasadoCentavos: atrasados.reduce(function (s, l) {
            return s + (l.valorCentavos || 0) - (l.valorPagoCentavos || 0);
          }, 0),
          vencemNaSemana: vencemNaSemana.length,
          vencemCentavos: vencemNaSemana.reduce(function (s, l) {
            return s + (l.valorCentavos || 0) - (l.valorPagoCentavos || 0);
          }, 0),
          proximos: vencemNaSemana.sort(function (a, b) {
            return a.dataVencimento < b.dataVencimento ? -1 : 1;
          }).slice(0, 6)
        };
      }

      // --- Acessos de urgência --------------------------------------------
      if (blocos.indexOf('acessos') !== -1) {
        var porId = {};
        contexto.processos.forEach(function (p) { porId[p.id] = p; });

        painel.acessos = db().get('liberacoesAcesso')
          .filter(function (l) {
            return l.usuarioId === usuario.id && !l.encerradaEm &&
                   liberados.indexOf(l.processoId) !== -1;
          })
          .map(function (l) {
            var processo = porId[l.processoId] || null;
            var vence = maisDias(String(l.quando).slice(0, 10),
                                 App.services.acessoService.diasDe(processo));
            return Object.assign({}, l, {
              processo: processo,
              venceEm: vence,
              diasRestantes: motor().diasCorridosEntre(hoje, vence)
            });
          })
          .sort(function (a, b) { return a.diasRestantes - b.diasRestantes; });
      }

      return painel;
    });
  }

  function comProcesso(compromisso, contexto) {
    var processo = contexto.processos.filter(function (p) {
      return p.id === compromisso.processoId;
    })[0] || null;
    var cliente = processo && contexto.pessoas.filter(function (p) {
      return p.id === processo.clienteId;
    })[0];

    return Object.assign({}, compromisso, {
      processo: processo,
      clienteNome: cliente ? cliente.nome : '—'
    });
  }

  App.services.painelService = {
    BLOCOS_POR_PERFIL: BLOCOS_POR_PERFIL,
    blocosDe: blocosDe,
    meuPainel: meuPainel
  };
})(window.App = window.App || {});
