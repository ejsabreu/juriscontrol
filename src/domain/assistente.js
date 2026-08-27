/* ==========================================================================
   domain/assistente.js — o que dá para afirmar sem modelo de linguagem

   Este arquivo é a resposta honesta à pergunta "e a IA?".

   Sem backend não há LLM: não há como chamar API sem servidor, e fingir que
   há seria a pior mentira do protótipo — porque é a única que o usuário não
   tem como conferir. Então a divisão é explícita:

     CAMADA A (aqui)  — regra e dicionário. Resumo do processo, próxima ação,
                        duplicidade, risco sugerido, revisão de peça. Tudo
                        determinístico, testável e AUDITÁVEL: cada conclusão
                        vem acompanhada do porquê.

     CAMADA B (services/simulado/iaService.js) — a assinatura de uma chamada
                        de API, com o corpo montado a partir DESTA camada e
                        dos modelos de F2.7.

   O que parece inteligência lá é, aqui, dicionário que se pode ler.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  function enums() { return App.domain.enums; }
  function prazos() { return App.domain.prazos; }

  // --- Resumo do processo ---------------------------------------------------------

  /**
   * Síntese estruturada a partir da timeline.
   *
   * Não é "resumo em linguagem natural" no sentido de texto gerado: são
   * FATOS extraídos e ordenados, que a tela apresenta em frases. A
   * diferença importa — cada item aqui pode ser rastreado até o registro
   * que o originou.
   *
   * @param {object} dados { processo, andamentos, prazos, compromissos, documentos }
   */
  function resumirProcesso(dados) {
    var d = dados || {};
    var processo = d.processo || {};
    var listaAndamentos = (d.andamentos || []).slice()
      .sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    var listaPrazos = d.prazos || [];
    var hoje = d.hoje || prazos().hojeISO();

    var fase = enums().achar(enums().FASES, processo.faseId);
    var area = enums().achar(enums().AREAS, processo.areaId);

    // Marcos: o primeiro andamento de cada tipo relevante conta a história.
    var marcos = [];
    function primeiro(tipo) {
      return listaAndamentos.filter(function (a) { return a.tipo === tipo; })[0] || null;
    }

    if (processo.dataDistribuicao) {
      marcos.push({ chave: 'distribuicao', data: processo.dataDistribuicao,
                    texto: 'Distribuído em ' + App.format.data(processo.dataDistribuicao) });
    }
    var citacao = listaAndamentos.filter(function (a) {
      return /cita/i.test(a.titulo || '');
    })[0];
    if (citacao) {
      marcos.push({ chave: 'citacao', data: citacao.data,
                    texto: 'Citação em ' + App.format.data(citacao.data) });
    }
    var sentenca = primeiro('sentenca');
    if (sentenca) {
      marcos.push({ chave: 'sentenca', data: sentenca.data,
                    texto: 'Sentença em ' + App.format.data(sentenca.data) });
    }

    var abertos = listaPrazos.filter(function (p) {
      return p.status === 'pendente' || p.status === 'em_andamento';
    });
    var cumpridos = listaPrazos.filter(function (p) { return p.status === 'cumprido'; });
    var perdidos = listaPrazos.filter(function (p) { return p.status === 'perdido'; });

    var proximoPrazo = abertos.slice().sort(function (a, b) {
      return a.dataFatal < b.dataFatal ? -1 : 1;
    })[0] || null;

    var proximoCompromisso = (d.compromissos || [])
      .filter(function (c) {
        return c.status === 'agendado' && String(c.dataHora).slice(0, 10) >= hoje;
      })
      .sort(function (a, b) { return a.dataHora < b.dataHora ? -1 : 1; })[0] || null;

    var ultimoAndamento = listaAndamentos[listaAndamentos.length - 1] || null;

    // Tempo parado é sinal: processo sem movimentação há meses precisa de
    // uma olhada, mesmo que nada esteja vencido.
    var diasSemMovimento = ultimoAndamento
      ? prazos().diasCorridosEntre(ultimoAndamento.data, hoje)
      : null;

    var frases = [];
    frases.push('Ação ' + (area ? 'de ' + area.label.toLowerCase() : '') +
                (processo.assunto ? ' — ' + processo.assunto : '') + '.');
    if (fase) frases.push('Atualmente em ' + fase.label.toLowerCase() + '.');
    if (marcos.length) frases.push(marcos.map(function (m) { return m.texto; }).join('; ') + '.');

    frases.push(listaAndamentos.length + ' andamento(s) registrado(s)' +
      (diasSemMovimento !== null
        ? ', o último há ' + diasSemMovimento + ' dia(s)' : '') + '.');

    if (cumpridos.length || perdidos.length || abertos.length) {
      frases.push(cumpridos.length + ' prazo(s) cumprido(s), ' +
                  abertos.length + ' em aberto' +
                  (perdidos.length ? ' e ' + perdidos.length + ' PERDIDO(S)' : '') + '.');
    }
    if (proximoPrazo) {
      frases.push('Próximo prazo: ' + proximoPrazo.titulo + ' até ' +
                  App.format.data(proximoPrazo.dataFatal) + '.');
    }
    if (proximoCompromisso) {
      frases.push('Próximo compromisso: ' + proximoCompromisso.titulo + ' em ' +
                  App.format.dataHora(proximoCompromisso.dataHora) + '.');
    }

    return {
      texto: frases.join(' '),
      frases: frases,
      marcos: marcos,
      totalAndamentos: listaAndamentos.length,
      diasSemMovimento: diasSemMovimento,
      prazosAbertos: abertos.length,
      prazosCumpridos: cumpridos.length,
      prazosPerdidos: perdidos.length,
      proximoPrazo: proximoPrazo,
      proximoCompromisso: proximoCompromisso,
      totalDocumentos: (d.documentos || []).length
    };
  }

  // --- Próxima ação ----------------------------------------------------------------

  /* Regras de sugestão por fase. Cada uma diz O QUE fazer e POR QUE — a
     justificativa é o que permite ao advogado discordar com base. */
  var ACOES_POR_FASE = {
    distribuicao: { acao: 'Conferir a distribuição e providenciar a citação',
                    porque: 'a ação foi protocolada e ainda não há citação registrada' },
    citacao:      { acao: 'Acompanhar a citação da parte contrária',
                    porque: 'o processo está aguardando a triangulação da relação processual' },
    instrucao:    { acao: 'Verificar provas pendentes e prazos de manifestação',
                    porque: 'a fase de instrução é onde as provas são produzidas' },
    sentenca:     { acao: 'Acompanhar a publicação da sentença',
                    porque: 'o processo está concluso para julgamento' },
    recurso:      { acao: 'Conferir prazos recursais e contrarrazões',
                    porque: 'o processo está em grau recursal' },
    execucao:     { acao: 'Acompanhar o cumprimento e eventual penhora',
                    porque: 'a fase de execução exige impulso do credor' },
    arquivado:    { acao: 'Conferir se há valores a levantar antes do arquivamento definitivo',
                    porque: 'processo arquivado com valor pendente é dinheiro esquecido' }
  };

  /**
   * O que fazer neste processo agora.
   *
   * A ordem das regras é a ordem da urgência: prazo vencido vence tudo,
   * e sugerir "acompanhar a instrução" a quem tem prazo perdido seria
   * ruído no pior momento possível.
   *
   * @returns {Array} [{ prioridade, acao, porque }]
   */
  function proximaAcao(dados) {
    var d = dados || {};
    var processo = d.processo || {};
    var listaPrazos = d.prazos || [];
    var hoje = d.hoje || prazos().hojeISO();
    var sugestoes = [];

    var abertos = listaPrazos.filter(function (p) {
      return p.status === 'pendente' || p.status === 'em_andamento';
    });

    var vencidos = abertos.filter(function (p) { return p.dataFatal < hoje; });
    if (vencidos.length) {
      sugestoes.push({
        prioridade: 'critica',
        acao: 'Regularizar ' + vencidos.length + ' prazo(s) VENCIDO(S)',
        porque: 'a data fatal já passou — se o ato não foi praticado, registre a perda ' +
                'com justificativa'
      });
    }

    var criticos = abertos.filter(function (p) {
      var restantes = prazos().diasUteisEntre(hoje, p.dataFatal);
      return p.dataFatal >= hoje && restantes <= 3;
    });
    if (criticos.length) {
      sugestoes.push({
        prioridade: 'critica',
        acao: 'Preparar ' + criticos[0].titulo,
        porque: 'faltam poucos dias úteis para a data fatal'
      });
    }

    // Prazo cumprido sem conferência (F2.2) fica pendurado e ninguém vê.
    var semConferir = listaPrazos.filter(function (p) {
      return p.status === 'cumprido' && !p.conferidoEm;
    });
    if (semConferir.length) {
      sugestoes.push({
        prioridade: 'atencao',
        acao: semConferir.length + ' prazo(s) aguardando conferência',
        porque: 'a dupla conferência exige confirmação de outra pessoa'
      });
    }

    var docs = d.documentos || [];
    if (!docs.some(function (x) { return x.categoria === 'procuracao'; })) {
      sugestoes.push({
        prioridade: 'atencao',
        acao: 'Juntar a procuração',
        porque: 'não há documento de categoria "procuração" neste processo'
      });
    }

    var resumo = resumirProcesso(d);
    if (resumo.diasSemMovimento !== null && resumo.diasSemMovimento > 90 &&
        processo.status === 'ativo') {
      sugestoes.push({
        prioridade: 'atencao',
        acao: 'Verificar andamento no tribunal',
        porque: 'o processo está sem movimentação há ' + resumo.diasSemMovimento + ' dias'
      });
    }

    var daFase = ACOES_POR_FASE[processo.faseId];
    if (daFase) {
      sugestoes.push({ prioridade: 'info', acao: daFase.acao, porque: daFase.porque });
    }

    if (processo.segredoJustica) {
      sugestoes.push({
        prioridade: 'info',
        acao: 'Processo em segredo de justiça',
        porque: 'não pode ser compartilhado por link e só é visível à equipe'
      });
    }

    return sugestoes;
  }

  // --- Duplicidade -------------------------------------------------------------------

  /** Distância de edição — usada para achar nome quase igual. */
  function distancia(a, b) {
    var s = String(a || '');
    var t = String(b || '');
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;

    var linha = [];
    for (var i = 0; i <= t.length; i++) linha[i] = i;

    for (var j = 1; j <= s.length; j++) {
      var anterior = linha[0];
      linha[0] = j;
      for (var k = 1; k <= t.length; k++) {
        var temporario = linha[k];
        linha[k] = Math.min(
          linha[k] + 1,
          linha[k - 1] + 1,
          anterior + (s[j - 1] === t[k - 1] ? 0 : 1)
        );
        anterior = temporario;
      }
    }
    return linha[t.length];
  }

  function similaridade(a, b) {
    var s = App.domain.busca.normalizar(a);
    var t = App.domain.busca.normalizar(b);
    var maior = Math.max(s.length, t.length);
    if (!maior) return 0;
    return Math.round((1 - distancia(s, t) / maior) * 100);
  }

  /**
   * Cadastro duplicado — o erro que só aparece quando já há dois clientes
   * com o mesmo nome e históricos diferentes.
   *
   * Documento igual é CERTEZA; nome parecido é SUSPEITA, e a distinção
   * aparece no retorno para a tela não tratar as duas do mesmo jeito.
   */
  function detectarDuplicidadePessoa(candidato, existentes) {
    var c = candidato || {};
    var achados = [];
    var docCandidato = String(c.documento || '').replace(/\D/g, '');

    (existentes || []).forEach(function (p) {
      if (p.id && p.id === c.id) return;

      var docExistente = String(p.documento || '').replace(/\D/g, '');
      if (docCandidato && docExistente && docCandidato === docExistente) {
        achados.push({
          registro: p, tipo: 'documento', confianca: 'certeza', similaridade: 100,
          porque: 'mesmo CPF/CNPJ'
        });
        return;
      }

      if (c.nome && p.nome) {
        var sim = similaridade(c.nome, p.nome);
        if (sim >= 85) {
          achados.push({
            registro: p, tipo: 'nome', confianca: sim >= 95 ? 'alta' : 'media',
            similaridade: sim,
            porque: 'nome ' + sim + '% parecido com "' + p.nome + '"'
          });
        }
      }
    });

    return achados.sort(function (a, b) { return b.similaridade - a.similaridade; });
  }

  /** Processo com o mesmo número CNJ já cadastrado. */
  function detectarDuplicidadeProcesso(numeroCnj, existentes) {
    var alvo = String(numeroCnj || '').replace(/\D/g, '');
    if (!alvo) return [];

    return (existentes || [])
      .filter(function (p) {
        return String(p.numeroCnj || '').replace(/\D/g, '') === alvo;
      })
      .map(function (p) {
        return { registro: p, tipo: 'cnj', confianca: 'certeza', similaridade: 100,
                 porque: 'já existe processo com este número CNJ' };
      });
  }

  // --- Risco -------------------------------------------------------------------------

  /* Peso por fase: quanto mais avançado sem desfecho favorável, maior a
     chance de perda. Não é estatística de verdade — é heurística, e a tela
     diz isso. */
  var PESO_FASE = {
    distribuicao: 0, citacao: 5, instrucao: 10,
    sentenca: 20, recurso: 15, execucao: 25, arquivado: 0
  };

  /**
   * Risco sugerido a partir do histórico do próprio escritório.
   *
   * A base é a taxa de perda observada NA MESMA ÁREA, ajustada pela fase e
   * pelo que já aconteceu no processo. Sem histórico suficiente, devolve
   * `null` em vez de chutar — sugerir "provável" com base em dois processos
   * seria pior que não sugerir.
   */
  function sugerirRisco(dados) {
    var d = dados || {};
    var processo = d.processo || {};
    var mesmaArea = (d.historicoDaArea || []).filter(function (p) {
      return p.status === 'encerrado' || p.status === 'arquivado';
    });

    if (mesmaArea.length < 5) {
      return {
        risco: null,
        confianca: 'insuficiente',
        porque: 'há apenas ' + mesmaArea.length + ' processo(s) encerrado(s) nesta área — ' +
                'poucos para basear uma sugestão'
      };
    }

    var perdidos = mesmaArea.filter(function (p) { return p.risco === 'provavel'; }).length;
    var taxa = Math.round((perdidos / mesmaArea.length) * 100);

    var pontos = taxa + (PESO_FASE[processo.faseId] || 0);

    // Prazo perdido é o sinal mais forte que existe.
    var perdidosNoProcesso = (d.prazos || [])
      .filter(function (p) { return p.status === 'perdido'; }).length;
    if (perdidosNoProcesso) pontos += 25;

    var risco = pontos >= 60 ? 'provavel' : pontos >= 30 ? 'possivel' : 'remoto';

    var razoes = [
      taxa + '% dos processos encerrados nesta área tiveram perda provável'
    ];
    if (PESO_FASE[processo.faseId]) {
      razoes.push('fase de ' +
        enums().rotulo(enums().FASES, processo.faseId).toLowerCase() + ' pesa no cálculo');
    }
    if (perdidosNoProcesso) {
      razoes.push(perdidosNoProcesso + ' prazo(s) perdido(s) neste processo');
    }

    return {
      risco: risco,
      confianca: mesmaArea.length >= 15 ? 'media' : 'baixa',
      pontos: pontos,
      baseHistorica: mesmaArea.length,
      porque: razoes.join('; '),
      razoes: razoes
    };
  }

  // --- Revisão de peça ------------------------------------------------------------------

  /**
   * Confere a peça contra o cadastro ANTES do protocolo.
   *
   * Cada achado é um erro que já aconteceu em escritório de verdade:
   * variável não substituída, número CNJ inválido no corpo, prazo citado
   * que não bate com o cadastrado, valor divergente.
   *
   * @returns {Array} [{ gravidade, tipo, mensagem, detalhe }]
   */
  function revisarPeca(texto, contexto) {
    var achados = [];
    var conteudo = String(texto || '');
    var ctx = contexto || {};
    var processo = ctx.processo || {};

    // 1. Variável de modelo não substituída.
    var pendentes = App.domain.modelos.listarVariaveis(conteudo);
    if (pendentes.length) {
      achados.push({
        gravidade: 'critica', tipo: 'variavel',
        mensagem: pendentes.length + ' variável(is) de modelo não substituída(s)',
        detalhe: pendentes.join(', ')
      });
    }
    if (conteudo.indexOf('var-pendente') !== -1) {
      achados.push({
        gravidade: 'critica', tipo: 'lacuna',
        mensagem: 'Há lacunas destacadas no texto',
        detalhe: 'campos que o sistema não conseguiu preencher e ninguém completou'
      });
    }

    // 2. Marcador de rascunho esquecido.
    var rascunhos = conteudo.match(/\[[^\]]{2,40}\]/g) || [];
    var suspeitos = rascunhos.filter(function (r) {
      return /descrever|fundamenta|preencher|inserir|xxx|todo|pedido|razões|mérito/i.test(r);
    });
    if (suspeitos.length) {
      achados.push({
        gravidade: 'critica', tipo: 'rascunho',
        mensagem: suspeitos.length + ' marcador(es) de rascunho no texto',
        detalhe: suspeitos.slice(0, 4).join(', ')
      });
    }

    // 3. Número CNJ citado que não é válido.
    var numeros = conteudo.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [];
    numeros.forEach(function (n) {
      if (!App.domain.cnj.validar(n).valido) {
        achados.push({
          gravidade: 'critica', tipo: 'cnj',
          mensagem: 'Número CNJ inválido no texto',
          detalhe: n + ' — o dígito verificador não confere'
        });
      } else if (processo.numeroCnj &&
                 n.replace(/\D/g, '') !== String(processo.numeroCnj).replace(/\D/g, '')) {
        achados.push({
          gravidade: 'atencao', tipo: 'cnj',
          mensagem: 'A peça cita um processo diferente',
          detalhe: 'no texto: ' + n + ' · neste processo: ' + processo.numeroCnj
        });
      }
    });

    // 4. Prazo citado que não bate com o cadastrado.
    var prazoNoTexto = App.domain.classificador.extrairPrazoTexto(conteudo);
    var prazoAberto = (ctx.prazos || []).filter(function (p) {
      return p.status === 'pendente' || p.status === 'em_andamento';
    })[0];
    if (prazoNoTexto && prazoAberto && prazoAberto.quantidadeDias &&
        prazoNoTexto.dias !== prazoAberto.quantidadeDias) {
      achados.push({
        gravidade: 'atencao', tipo: 'prazo',
        mensagem: 'O prazo citado no texto difere do cadastrado',
        detalhe: 'no texto: ' + prazoNoTexto.dias + ' dias · cadastrado: ' +
                 prazoAberto.quantidadeDias + ' dias'
      });
    }

    // 5. Valor citado que não bate com o valor da causa.
    var valores = conteudo.match(/R\$\s?[\d.]+,\d{2}/g) || [];
    if (processo.valorCausa && valores.length) {
      var esperado = App.format.moeda(processo.valorCausa).replace(/\s/g, '');
      var bate = valores.some(function (v) { return v.replace(/\s/g, '') === esperado; });
      if (!bate) {
        achados.push({
          gravidade: 'info', tipo: 'valor',
          mensagem: 'Nenhum valor citado coincide com o valor da causa',
          detalhe: 'valor da causa: ' + App.format.moeda(processo.valorCausa) +
                   ' · citados: ' + valores.slice(0, 3).join(', ')
        });
      }
    }

    // 6. Peça sem assinatura do advogado.
    if (ctx.advogado && ctx.advogado.nome &&
        conteudo.indexOf(ctx.advogado.nome) === -1) {
      achados.push({
        gravidade: 'atencao', tipo: 'assinatura',
        mensagem: 'A peça não cita o advogado responsável',
        detalhe: 'esperado: ' + ctx.advogado.nome
      });
    }

    return achados;
  }

  // --- Gramática de intenções da busca -----------------------------------------------

  /* Padrões reconhecidos na busca. É gramática, não modelo: cada padrão é
     uma expressão regular que devolve um filtro estruturado. Quando nenhum
     casa, a busca cai no índice de F2.7 — que continua sendo o caminho
     principal. */
  var INTENCOES = [
    {
      id: 'prazos_vencendo',
      teste: /praz\w*.*(vencend|vence|vencer|criticos?|urgent)/i,
      montar: function () {
        return { rota: '#/agenda', descricao: 'prazos que vencem em breve' };
      }
    },
    {
      id: 'prazos_vencidos',
      teste: /praz\w*.*(vencid|atrasad|perdid)/i,
      montar: function () {
        return { rota: '#/agenda', descricao: 'prazos vencidos ou perdidos' };
      }
    },
    {
      id: 'publicacoes_pendentes',
      teste: /publicac\w*|diario|dje|triagem/i,
      montar: function () {
        return { rota: '#/publicacoes', descricao: 'fila de publicações' };
      }
    },
    {
      id: 'financeiro_atrasado',
      teste: /(inadimpl|atrasad|receber|cobran).*(cliente|titul|honorar)|honorar\w*.*atrasad/i,
      montar: function () {
        return { rota: '#/financeiro', descricao: 'títulos em atraso' };
      }
    },
    {
      id: 'funil',
      teste: /(lead|prospec|funil|proposta)/i,
      montar: function () {
        return { rota: '#/crm', descricao: 'funil de prospecção' };
      }
    },
    {
      id: 'processos_por_area',
      teste: /processos?\s+(?:de|da|do)\s+(\w+)/i,
      montar: function (m) {
        var termo = App.domain.busca.normalizar(m[1]);
        var area = enums().AREAS.filter(function (a) {
          return App.domain.busca.normalizar(a.label).indexOf(termo) === 0;
        })[0];
        if (!area) return null;
        return { rota: '#/processos?areaId=' + area.id,
                 descricao: 'processos da área ' + area.label.toLowerCase() };
      }
    },
    {
      id: 'tarefas_atrasadas',
      teste: /tarefas?.*(atrasad|pendent|fazer)/i,
      montar: function () {
        return { rota: '#/tarefas', descricao: 'tarefas pendentes' };
      }
    },
    {
      id: 'modelos',
      teste: /modelo|minuta|peticao\s+model/i,
      montar: function () {
        return { rota: '#/modelos', descricao: 'biblioteca de modelos' };
      }
    }
  ];

  /**
   * Interpreta a consulta como uma intenção de navegação.
   *
   * O casamento acontece sobre o texto NORMALIZADO: "publicações do diário"
   * precisa casar com o padrão `publicac`, e `\w` não alcança `õ` nem `á`
   * em expressão regular de JavaScript. Escrever os padrões já sem acento e
   * normalizar a entrada é mais simples que enchê-los de classes Unicode.
   *
   * @returns {?{id, rota, descricao}} null quando nenhum padrão casa
   */
  function interpretarBusca(consulta) {
    var bruto = String(consulta || '').trim();
    if (bruto.length < 4) return null;

    var texto = App.domain.busca.normalizar(bruto);

    for (var i = 0; i < INTENCOES.length; i++) {
      var m = texto.match(INTENCOES[i].teste);
      if (!m) continue;

      var resultado = INTENCOES[i].montar(m);
      if (resultado) return Object.assign({ id: INTENCOES[i].id }, resultado);
    }
    return null;
  }

  App.domain.assistente = {
    ACOES_POR_FASE: ACOES_POR_FASE,
    INTENCOES: INTENCOES,
    resumirProcesso: resumirProcesso,
    proximaAcao: proximaAcao,
    detectarDuplicidadePessoa: detectarDuplicidadePessoa,
    detectarDuplicidadeProcesso: detectarDuplicidadeProcesso,
    similaridade: similaridade,
    sugerirRisco: sugerirRisco,
    revisarPeca: revisarPeca,
    interpretarBusca: interpretarBusca
  };
})(window.App = window.App || {});
