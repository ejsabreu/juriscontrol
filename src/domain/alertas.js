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

  /* Hora padrão de envio de cada regra. Não é usada pelo avaliador — que
     decide por DATA, não por relógio —, mas é o que a tela de regras grava ao
     materializar as padrão. Aqui porque é padrão do escritório, ao lado das
     outras. */
  var HORA_ENVIO_PADRAO = 8;

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

      /* PISO DO SISTEMA: prazo no vermelho do semáforo avisa TODO dia em que
         estiver vermelho, esteja ou não na régua de antecedência.

         A régua é uma escolha de quando lembrar com folga — 5 dias, 3 dias.
         O vermelho não é escolha: é o prazo prestes a ser perdido. Com a
         régua padrão [5,3,1,0], um prazo a 2 dias úteis ficava no vão entre
         dois degraus e não avisava ninguém — no acervo atual são três prazos
         críticos calados. Quem quiser silêncio desliga a regra inteira; o que
         não existe é "avise a 5 dias, mas não a 2".

         Quem define o vermelho é `domain/prazos.js`, e não um número repetido
         aqui: o dia em que o semáforo mudar de limiar, isto acompanha. */
      var noVermelho = estadoPrazo.semaforo === 'critico' ||
                       estadoPrazo.semaforo === 'vencido';
      if (!noVermelho && !dispara(regra, dias)) return;

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
        gravidade = noVermelho ? 'critica' : 'atencao';
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

    /* Toda a fila pendente, não só as novas.
       A publicação já vinculada ao processo ainda espera o prazo ser gerado, e
       a "sem vínculo" espera alguém achar o processo à mão — as duas exigem
       ação tanto quanto a recém-chegada. Avisar só das novas escondia
       justamente as que travaram no meio da triagem, que são as que ninguém
       lembra sozinho. Quem lista o que é pendente é o catálogo de status, o
       mesmo que o resumo da fila lê. */
    var pendentes = App.domain.enums.statusPendentesPublicacao();

    var porStatus = {};
    var total = 0;

    (estado.publicacoes || []).forEach(function (p) {
      if (p.ativo === false) return;
      if (pendentes.indexOf(p.status) === -1) return;
      porStatus[p.status] = (porStatus[p.status] || 0) + 1;
      total++;
    });

    if (!total) return;

    // A quebra por situação é o que diz o que fazer: 12 novas pede triagem,
    // 3 sem vínculo pede garimpo. Um número só não distingue os dois.
    var DETALHE = {
      nova: 'aguardando triagem',
      vinculada: 'sem prazo gerado',
      sem_vinculo: 'sem processo vinculado'
    };
    var detalhe = pendentes
      .filter(function (s) { return porStatus[s]; })
      .map(function (s) { return porStatus[s] + ' ' + DETALHE[s]; })
      .join(' · ');

    // Uma notificação por DIA para o lote, não uma por publicação: trinta
    // avisos idênticos no sino é o mesmo que nenhum.
    (estado.usuarios || []).forEach(function (u) {
      if (!App.domain.permissoes.pode(u, 'publicacoes.triar')) return;
      saida.push({
        chave: chaveDe('publicacao_nova', u.id, hoje),
        usuarioId: u.id,
        tipo: 'publicacao_nova',
        gravidade: 'info',
        titulo: total + ' ' + App.format.plural(total, 'publicação', 'publicações') +
                ' aguardando ação',
        mensagem: detalhe,
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

  // --- Ponto de entrada -----------------------------------------------------

  /* NÃO HÁ RESUMO DO DIA. Existiu: um aviso por pessoa por dia dizendo "N
     itens exigindo atenção". Saiu porque contava o que já estava logo abaixo
     dele, no mesmo painel — e desde que o sino separa por categoria, o painel
     aberto já É o resumo, com os itens à mão em vez de um número.
     Pior: o número congelava na primeira geração do dia (a chave era
     `digest:usuário:data`), então de tarde ele contradizia a própria lista. */

  /**
   * @param {Object} estado  { prazos, compromissos, tarefas, publicacoes,
   *                           lancamentos, leads, usuarios, regrasAlerta }
   * @param {string} [hoje]  ISO 'YYYY-MM-DD' — injetável para o teste não
   *                         depender do relógio
   * @returns {Array} avisos que deveriam existir hoje, cada um com `chave`
   */
  function avaliar(estado, hoje) {
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
    return saida.filter(function (n) { return !!n.usuarioId; });
  }

  // --- Categorias (para o sino) ---------------------------------------------

  /** Em que gaveta um tipo cai. Tipo desconhecido vai para 'outros'. */
  function categoriaDe(tipo) {
    var categorias = App.domain.enums.CATEGORIAS_NOTIFICACAO;
    var achada = 'outros';
    categorias.forEach(function (c) {
      if ((c.tipos || []).indexOf(tipo) !== -1) achada = c.id;
    });
    return achada;
  }

  /**
   * Reparte as notificações nas gavetas do sino.
   *
   * POR QUE ISTO EXISTE: o painel mostrava as mais recentes e pronto. Numa
   * manhã de sincronização, trinta publicações novas ocupavam a lista inteira
   * e empurravam para fora o único prazo vencido — o aviso mais caro do
   * sistema, invisível por chegar alguns minutos antes. Separar por categoria
   * é o que garante lugar a cada assunto, independente do volume dos outros.
   *
   * Dentro da gaveta, NÃO LIDAS PRIMEIRO: o que ninguém viu ainda é o que se
   * foi olhar, e numa categoria com muitos avisos os já lidos empurrariam o
   * novo para o fim da rolagem.
   *
   * Devolve só o que a tela desenha — nome e itens. Já devolveu total, não
   * lidas e quantas ficaram de fora; os três morreram junto com o corte por
   * categoria e com o número no cabeçalho da gaveta, e contagem que ninguém lê
   * é a que passa a divergir sem ninguém notar.
   *
   * @param {Array} notificacoes  já filtradas por usuário
   * @returns {Array} [{ id, label, itens }] — sem as categorias vazias, na
   *                  ordem do catálogo
   */
  function agruparPorCategoria(notificacoes) {
    var porCategoria = {};

    (notificacoes || []).forEach(function (n) {
      var id = categoriaDe(n.tipo);
      (porCategoria[id] = porCategoria[id] || []).push(n);
    });

    return App.domain.enums.CATEGORIAS_NOTIFICACAO.map(function (categoria) {
      var itens = (porCategoria[categoria.id] || []).slice();

      /* `sort` estável a partir do ES2019: quem já veio ordenado por data
         mantém a ordem dentro de cada metade. */
      itens.sort(function (a, b) {
        return (a.lidaEm ? 1 : 0) - (b.lidaEm ? 1 : 0);
      });

      return { id: categoria.id, label: categoria.label, itens: itens };
    }).filter(function (grupo) { return grupo.itens.length > 0; });
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
    HORA_ENVIO_PADRAO: HORA_ENVIO_PADRAO,
    avaliar: avaliar,
    novidades: novidades,
    categoriaDe: categoriaDe,
    agruparPorCategoria: agruparPorCategoria,
    chaveDe: chaveDe,
    regraDe: regraDe,
    dispara: dispara
  };
})(window.App = window.App || {});
