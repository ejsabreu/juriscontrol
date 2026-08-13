/* ==========================================================================
   domain/alertas.js — o que deveria estar avisado, hoje

   O motor de prazos é a melhor peça do sistema e, até aqui, ele não avisava
   ninguém. Este módulo fecha essa lacuna.

   FUNÇÃO PURA: `avaliar(estado, hoje)` recebe as coleções e uma data e
   devolve a lista de avisos que **deveriam existir** naquele dia. Não grava,
   não lê banco, não conhece tela. Quem persiste é o `notificacaoService`.

   IDEMPOTÊNCIA é o requisito central, não um detalhe. O avaliador roda no
   bootstrap e a cada 5 minutos; se rodar duas vezes no mesmo dia gerar dois
   avisos do mesmo fato, o sino vira ruído e o usuário para de olhar — que é
   o pior desfecho possível para um sistema cuja função é lembrar de prazo.
   A garantia vem da CHAVE determinística de cada aviso:

       prazo_proximo:PRZ-4711:3     tipo : entidade : marco

   O marco é o que distingue um aviso do outro dentro do mesmo prazo (faltam
   3 dias ≠ faltam 5 dias). Já a chave dos avisos que se repetem todo dia —
   prazo vencido, resumo diário — leva a data no lugar do marco, porque aí a
   repetição diária É o comportamento desejado.

   UNIDADE DE CONTAGEM: prazo processual conta em DIAS ÚTEIS, pelo mesmo
   motor do art. 219 do CPC. Compromisso, tarefa e financeiro contam em dias
   CORRIDOS — audiência não adia por ser sábado.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  function prazos() { return App.domain.prazos; }

  /* Regras padrão do escritório. Viram registros editáveis em
     `regrasAlerta`; enquanto ninguém editar, valem estas. */
  var REGRAS_PADRAO = [
    { gatilho: 'prazo',        antecedenciaDias: [5, 3, 1, 0], canais: ['app', 'email'], ativo: true },
    { gatilho: 'compromisso',  antecedenciaDias: [3, 1, 0],    canais: ['app', 'email'], ativo: true },
    { gatilho: 'tarefa',       antecedenciaDias: [1, 0],       canais: ['app'],          ativo: true },
    { gatilho: 'publicacao',   antecedenciaDias: [0],          canais: ['app'],          ativo: true },
    { gatilho: 'financeiro',   antecedenciaDias: [3, 0],       canais: ['app'],          ativo: true },
    { gatilho: 'follow_up',    antecedenciaDias: [0],          canais: ['app'],          ativo: true }
  ];

  var HORA_DIGEST = 8;

  function chaveDe(tipo, entidadeId, marco) {
    return tipo + ':' + entidadeId + ':' + marco;
  }

  function regraDe(regras, gatilho) {
    var lista = regras && regras.length ? regras : REGRAS_PADRAO;
    var achada = null;
    lista.forEach(function (r) {
      if (r.gatilho === gatilho && r.ativo !== false) achada = r;
    });
    return achada;
  }

  function dispara(regra, dias) {
    if (!regra) return false;
    // Já passou da data: dispara sempre (o atraso não deixa de existir).
    if (dias < 0) return true;
    return (regra.antecedenciaDias || []).indexOf(dias) !== -1;
  }

  function diasCorridos(de, ate) {
    return prazos().diasCorridosEntre(de, ate);
  }

  function soData(valor) {
    return String(valor || '').slice(0, 10);
  }

  // --- Avaliadores por gatilho ----------------------------------------------

  function avaliarPrazos(estado, hoje, regras, saida) {
    var regra = regraDe(regras, 'prazo');
    if (!regra) return;

    (estado.prazos || []).forEach(function (prazo) {
      if (prazo.ativo === false) return;
      if (prazo.status !== 'pendente' && prazo.status !== 'em_andamento') return;

      var estadoPrazo = prazos().avaliar(prazo, hoje);
      var dias = estadoPrazo.diasRestantes;
      if (dias === null || dias === undefined) return;
      if (!dispara(regra, dias)) return;

      var tipo, gravidade, titulo, marco;

      if (dias < 0) {
        tipo = 'prazo_vencido';
        gravidade = 'critica';
        titulo = 'Prazo VENCIDO: ' + prazo.titulo;
        // Repete todo dia enquanto não for resolvido — é intencional.
        marco = hoje;
      } else if (dias === 0) {
        tipo = 'prazo_hoje';
        gravidade = 'critica';
        titulo = 'Vence hoje: ' + prazo.titulo;
        marco = 0;
      } else {
        tipo = 'prazo_proximo';
        gravidade = dias <= 1 ? 'critica' : 'atencao';
        titulo = 'Faltam ' + dias + ' ' +
                 App.format.plural(dias, 'dia útil', 'dias úteis') + ': ' + prazo.titulo;
        marco = dias;
      }

      saida.push({
        chave: chaveDe(tipo, prazo.id, marco),
        usuarioId: prazo.responsavelId,
        tipo: tipo,
        gravidade: gravidade,
        titulo: titulo,
        mensagem: 'Data fatal em ' + App.format.data(prazo.dataFatal) +
                  (prazo.dataInterna ? ' · prazo interno em ' + App.format.data(prazo.dataInterna) : ''),
        entidadeColecao: 'prazos',
        entidadeId: prazo.id,
        processoId: prazo.processoId,
        canais: regra.canais || ['app'],
        diasRestantes: dias
      });
    });
  }

  function avaliarCompromissos(estado, hoje, regras, saida) {
    var regra = regraDe(regras, 'compromisso');
    if (!regra) return;

    (estado.compromissos || []).forEach(function (cp) {
      if (cp.ativo === false) return;
      if (cp.status !== 'agendado') return;

      var data = soData(cp.dataHora);
      if (data < hoje) return;                     // audiência passada não avisa

      var dias = diasCorridos(hoje, data);
      if (!dispara(regra, dias)) return;

      saida.push({
        chave: chaveDe('compromisso', cp.id, dias),
        usuarioId: cp.responsavelId,
        tipo: 'compromisso',
        gravidade: dias === 0 ? 'critica' : 'atencao',
        titulo: (dias === 0 ? 'Hoje: ' : 'Em ' + dias + ' ' +
                 App.format.plural(dias, 'dia') + ': ') + cp.titulo,
        mensagem: App.format.dataHora(cp.dataHora) + (cp.local ? ' · ' + cp.local : ''),
        entidadeColecao: 'compromissos',
        entidadeId: cp.id,
        processoId: cp.processoId,
        canais: regra.canais || ['app'],
        diasRestantes: dias
      });
    });
  }

  function avaliarTarefas(estado, hoje, regras, saida) {
    var regra = regraDe(regras, 'tarefa');
    if (!regra) return;

    (estado.tarefas || []).forEach(function (t) {
      if (t.ativo === false) return;
      if (t.status === 'concluida') return;
      if (!t.dataVencimento) return;

      var dias = diasCorridos(hoje, t.dataVencimento);
      if (t.dataVencimento < hoje) dias = -diasCorridos(t.dataVencimento, hoje);
      if (!dispara(regra, dias)) return;

      var atrasada = dias < 0;
      saida.push({
        chave: chaveDe('tarefa_atrasada', t.id, atrasada ? hoje : dias),
        usuarioId: t.responsavelId,
        tipo: 'tarefa_atrasada',
        gravidade: atrasada ? 'atencao' : 'info',
        titulo: (atrasada ? 'Tarefa atrasada: ' : 'Tarefa vence em breve: ') + t.titulo,
        mensagem: 'Vencimento em ' + App.format.data(t.dataVencimento),
        entidadeColecao: 'tarefas',
        entidadeId: t.id,
        processoId: t.processoId,
        canais: regra.canais || ['app'],
        diasRestantes: dias
      });
    });
  }

  /* Os três avaliadores abaixo só produzem algo quando os módulos donos
     existirem (F2.4, F2.5 e F2.6). Ficam aqui desde já porque a regra é a
     mesma e o `avaliar` não deve mudar de forma a cada módulo novo. */

  function avaliarPublicacoes(estado, hoje, regras, saida) {
    var regra = regraDe(regras, 'publicacao');
    if (!regra) return;

    var novas = (estado.publicacoes || []).filter(function (p) {
      return p.ativo !== false && p.status === 'nova';
    });
    if (!novas.length) return;

    // Uma notificação por DIA para o lote, não uma por publicação: trinta
    // avisos idênticos no sino é o mesmo que nenhum.
    (estado.usuarios || []).forEach(function (u) {
      if (!App.domain.permissoes.pode(u, 'publicacoes.triar')) return;
      saida.push({
        chave: chaveDe('publicacao_nova', u.id, hoje),
        usuarioId: u.id,
        tipo: 'publicacao_nova',
        gravidade: 'info',
        titulo: novas.length + ' ' + App.format.plural(novas.length, 'publicação', 'publicações') +
                ' aguardando triagem',
        mensagem: 'Vincule ao processo e gere o prazo correspondente.',
        entidadeColecao: 'publicacoes',
        entidadeId: null,
        canais: regra.canais || ['app'],
        diasRestantes: 0
      });
    });
  }

  function avaliarFinanceiro(estado, hoje, regras, saida) {
    var regra = regraDe(regras, 'financeiro');
    if (!regra) return;

    (estado.lancamentos || []).forEach(function (l) {
      if (l.ativo === false) return;
      if (l.status === 'pago' || l.status === 'cancelado') return;
      if (!l.dataVencimento) return;

      var dias = l.dataVencimento < hoje
        ? -diasCorridos(l.dataVencimento, hoje)
        : diasCorridos(hoje, l.dataVencimento);
      if (!dispara(regra, dias)) return;

      var vencido = dias < 0;
      saida.push({
        chave: chaveDe('financeiro', l.id, vencido ? hoje : dias),
        usuarioId: l.responsavelId || null,
        tipo: 'financeiro',
        gravidade: vencido ? 'atencao' : 'info',
        titulo: (vencido ? 'Título vencido: ' : 'Título a vencer: ') + (l.descricao || ''),
        mensagem: App.format.moeda(l.valorCentavos) + ' · vencimento em ' +
                  App.format.data(l.dataVencimento),
        entidadeColecao: 'lancamentos',
        entidadeId: l.id,
        processoId: l.processoId,
        canais: regra.canais || ['app'],
        diasRestantes: dias
      });
    });
  }

  function avaliarFollowUp(estado, hoje, regras, saida) {
    var regra = regraDe(regras, 'follow_up');
    if (!regra) return;

    (estado.leads || []).forEach(function (lead) {
      if (lead.ativo === false) return;
      if (lead.etapa === 'ganho' || lead.etapa === 'perdido') return;
      if (!lead.proximoContatoEm || lead.proximoContatoEm > hoje) return;

      saida.push({
        chave: chaveDe('follow_up', lead.id, hoje),
        usuarioId: lead.responsavelId,
        tipo: 'follow_up',
        gravidade: 'info',
        titulo: 'Retornar contato: ' + lead.nome,
        mensagem: 'Follow-up previsto para ' + App.format.data(lead.proximoContatoEm) + '.',
        entidadeColecao: 'leads',
        entidadeId: lead.id,
        canais: regra.canais || ['app'],
        diasRestantes: 0
      });
    });
  }

  // --- Resumo do dia --------------------------------------------------------

  /**
   * Um aviso por usuário por dia, consolidando o que ele tem pela frente.
   * Só é gerado a partir da hora configurada — antes disso o resumo estaria
   * incompleto — e só quando há de fato algo a resumir.
   */
  function montarDigest(saida, estado, hoje, agora) {
    var hora = agora instanceof Date ? agora.getHours() : HORA_DIGEST;
    if (hora < HORA_DIGEST) return [];

    var porUsuario = {};
    saida.forEach(function (n) {
      if (!n.usuarioId) return;
      if (n.tipo === 'digest') return;
      (porUsuario[n.usuarioId] = porUsuario[n.usuarioId] || []).push(n);
    });

    return Object.keys(porUsuario).map(function (usuarioId) {
      var itens = porUsuario[usuarioId];
      var criticos = itens.filter(function (n) { return n.gravidade === 'critica'; }).length;

      return {
        chave: chaveDe('digest', usuarioId, hoje),
        usuarioId: usuarioId,
        tipo: 'digest',
        gravidade: criticos ? 'atencao' : 'info',
        titulo: 'Resumo do dia · ' + itens.length + ' ' +
                App.format.plural(itens.length, 'item', 'itens') + ' exigindo atenção',
        mensagem: criticos
          ? criticos + ' ' + App.format.plural(criticos, 'item crítico', 'itens críticos') +
            ' na sua fila de hoje.'
          : 'Nada crítico hoje.',
        entidadeColecao: null,
        entidadeId: null,
        canais: ['app', 'email'],
        diasRestantes: 0
      };
    });
  }

  // --- Ponto de entrada -----------------------------------------------------

  /**
   * @param {Object} estado  { prazos, compromissos, tarefas, publicacoes,
   *                           lancamentos, leads, usuarios, regrasAlerta }
   * @param {string} [hoje]  ISO 'YYYY-MM-DD' — injetável para o teste não
   *                         depender do relógio
   * @param {Date}   [agora] só para decidir a hora do resumo diário
   * @returns {Array} avisos que deveriam existir hoje, cada um com `chave`
   */
  function avaliar(estado, hoje, agora) {
    var dados = estado || {};
    var dia = hoje || prazos().hojeISO();
    var regras = dados.regrasAlerta || [];
    var saida = [];

    avaliarPrazos(dados, dia, regras, saida);
    avaliarCompromissos(dados, dia, regras, saida);
    avaliarTarefas(dados, dia, regras, saida);
    avaliarPublicacoes(dados, dia, regras, saida);
    avaliarFinanceiro(dados, dia, regras, saida);
    avaliarFollowUp(dados, dia, regras, saida);

    // Sem responsável não há para quem avisar — e um aviso sem destinatário
    // é um aviso que ninguém lê.
    saida = saida.filter(function (n) { return !!n.usuarioId; });

    return saida.concat(montarDigest(saida, dados, dia, agora));
  }

  /**
   * Diferença entre o que deveria existir e o que já existe.
   * É esta função que torna a operação idempotente: rodar de novo no mesmo
   * dia devolve lista vazia.
   *
   * @param {Array} desejadas  saída de avaliar()
   * @param {Array} existentes notificações já gravadas (precisam ter `chave`)
   */
  function novidades(desejadas, existentes) {
    var vistas = {};
    (existentes || []).forEach(function (n) { vistas[n.chave] = true; });
    return (desejadas || []).filter(function (n) { return !vistas[n.chave]; });
  }

  App.domain.alertas = {
    REGRAS_PADRAO: REGRAS_PADRAO,
    HORA_DIGEST: HORA_DIGEST,
    avaliar: avaliar,
    novidades: novidades,
    chaveDe: chaveDe,
    regraDe: regraDe,
    dispara: dispara
  };
})(window.App = window.App || {});
