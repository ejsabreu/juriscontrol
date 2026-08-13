/* ==========================================================================
   domain/classificador.js — leitura de publicação do diário oficial

   Fecha o ciclo que justifica o sistema inteiro: publicação no DJe → prazo
   calculado → responsável avisado. O motor de prazos existe desde a fase 1;
   faltava a ponta que lê a publicação e diz QUE prazo é aquele.

   LÓGICA PURA, e de propósito: é regra e dicionário, não modelo de
   linguagem. Recebe texto, devolve sugestão com o grau de confiança e os
   termos que a sustentaram — o usuário vê POR QUE o sistema sugeriu, e a
   triagem continua sendo dele.

   Este arquivo é também o alicerce honesto do "assistente" de F2.8: o que
   lá parece inteligência é, aqui, dicionário auditável.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  /* Dicionário por tipo de prazo. `peso` separa o termo que identifica o
     ato (peso 3) do que apenas combina com ele (peso 1) — "contestar" decide;
     "citado" acompanha.

     A ordem NÃO importa: vence a maior pontuação. */
  var REGRAS = [
    { tipoPrazoId: 'embargos', dias: 5, termos: [
      { t: 'embargos de declaração', peso: 3 },
      { t: 'embargos declaratórios', peso: 3 },
      { t: 'omissão, contradição', peso: 1 },
      { t: 'obscuridade', peso: 1 }
    ] },

    { tipoPrazoId: 'contestacao', dias: 15, termos: [
      { t: 'para contestar', peso: 3 },
      { t: 'apresentar contestação', peso: 3 },
      { t: 'oferecer contestação', peso: 3 },
      // A palavra sozinha sugere sem decidir: aparece também em "réplica à
      // contestação" e em "manifeste-se sobre a contestação".
      { t: 'contestação', peso: 2 },
      { t: 'defesa', peso: 1 },
      { t: 'citação', peso: 1 },
      { t: 'cite-se', peso: 2 }
    ] },

    { tipoPrazoId: 'recurso_ape', dias: 15, termos: [
      { t: 'apelação', peso: 3 },
      { t: 'recurso de apelação', peso: 3 },
      { t: 'interpor apelação', peso: 3 },
      { t: 'sentença', peso: 1 }
    ] },

    /* `exclui` desqualifica outra regra quando este termo aparece. Não é
       peso: é incompatibilidade. "Contrarrazões ao recurso de apelação" fala
       de apelação o tempo todo, mas a parte intimada está RESPONDENDO ao
       recurso, não interpondo — e ninguém faz as duas coisas na mesma
       intimação. Sem isso, a regra da apelação vencia pela repetição da
       palavra e o prazo nasceria na pessoa errada. */
    { tipoPrazoId: 'contrarrazoes', dias: 15, exclui: ['recurso_ape'], termos: [
      { t: 'contrarrazões', peso: 3 },
      { t: 'contra-razões', peso: 3 },
      { t: 'responder ao recurso', peso: 2 }
    ] },

    { tipoPrazoId: 'agravo', dias: 15, termos: [
      { t: 'agravo de instrumento', peso: 3 },
      { t: 'agravo interno', peso: 3 },
      { t: 'decisão interlocutória', peso: 1 }
    ] },

    { tipoPrazoId: 'reptreplica', dias: 15, termos: [
      { t: 'réplica', peso: 3 },
      { t: 'replicar', peso: 3 },
      { t: 'manifeste-se sobre a contestação', peso: 3 }
    ] },

    { tipoPrazoId: 'alegacoes', dias: 15, termos: [
      { t: 'alegações finais', peso: 3 },
      { t: 'memoriais', peso: 3 },
      { t: 'razões finais', peso: 3 }
    ] },

    { tipoPrazoId: 'cumprimento', dias: 15, termos: [
      { t: 'cumprimento voluntário', peso: 3 },
      { t: 'pagamento voluntário', peso: 3 },
      { t: 'multa de 10%', peso: 2 },
      { t: 'art. 523', peso: 2 }
    ] },

    { tipoPrazoId: 'impugnacao', dias: 15, termos: [
      { t: 'impugnação ao cumprimento', peso: 3 },
      { t: 'impugnar o cumprimento', peso: 3 },
      { t: 'embargos à execução', peso: 3 }
    ] },

    { tipoPrazoId: 'manifestacao', dias: 5, termos: [
      { t: 'manifeste-se', peso: 2 },
      { t: 'manifestação', peso: 2 },
      { t: 'diga a parte', peso: 2 },
      { t: 'sobre o laudo', peso: 2 },
      { t: 'sobre os documentos', peso: 1 },
      { t: 'ciência', peso: 1 }
    ] }
  ];

  /* Publicação que NÃO abre prazo. Reconhecê-las é tão importante quanto
     reconhecer as que abrem: sugerir prazo em despacho de mero expediente
     enche a agenda de prazo fantasma e o usuário passa a ignorar a fila. */
  var TERMOS_SEM_PRAZO = [
    'sem prazo', 'mero expediente', 'arquivem-se', 'arquive-se',
    'transitado em julgado', 'trânsito em julgado', 'cumpra-se, publique-se',
    'homologo por sentença', 'nada a prover'
  ];

  var NUMEROS_POR_EXTENSO = {
    'um': 1, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10, 'onze': 11,
    'doze': 12, 'treze': 13, 'quatorze': 14, 'catorze': 14, 'quinze': 15,
    'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19,
    'vinte': 20, 'trinta': 30
  };

  /* Bloco Unicode dos acentos combinantes que o NFD separa da letra.
     Montado por escape e não escrito direto na expressão: caractere
     combinante solto no código-fonte é invisível no editor e some no
     primeiro salvamento distraído. */
  var ACENTOS_COMBINANTES = new RegExp('[\u0300-\u036f]', 'g');

  /**
   * Minúsculas sem acento. O diário mistura caixa e acentuação na mesma
   * publicação ("CONTESTAÇÃO", "contestacao", "Contestação"), e comparar
   * termo a termo sem normalizar erraria por bobagem tipográfica.
   */
  function normalizar(texto) {
    var minusculo = String(texto === null || texto === undefined ? '' : texto).toLowerCase();
    if (typeof minusculo.normalize !== 'function') return minusculo;
    return minusculo.normalize('NFD').replace(ACENTOS_COMBINANTES, '');
  }

  function contem(textoNormalizado, termo) {
    return textoNormalizado.indexOf(normalizar(termo)) !== -1;
  }

  // --- Extração --------------------------------------------------------------

  /**
   * Número CNJ no texto, VALIDADO pelo dígito verificador.
   * O diário publica muitos números; só interessa o que é um CNJ de verdade.
   */
  function extrairCnj(texto) {
    var achados = String(texto || '')
      .match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [];

    for (var i = 0; i < achados.length; i++) {
      if (App.domain.cnj.validar(achados[i]).valido) return achados[i];
    }

    // Sem pontuação: 20 dígitos seguidos.
    var crus = String(texto || '').match(/\b\d{20}\b/g) || [];
    for (var j = 0; j < crus.length; j++) {
      var formatado = crus[j].replace(
        /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6');
      if (App.domain.cnj.validar(formatado).valido) return formatado;
    }

    return null;
  }

  /**
   * Prazo dito no próprio texto: "no prazo de 15 (quinze) dias".
   * O texto manda sobre a tabela — o juiz pode fixar prazo diferente do
   * legal, e é o que ele escreveu que vale.
   *
   * @returns {?{dias, emDobro, trecho}}
   */
  function extrairPrazoTexto(texto) {
    var bruto = String(texto || '');
    var normal = normalizar(bruto);

    var emDobro = contem(normal, 'prazo em dobro') || contem(normal, 'em dobro');

    // "prazo de 15 dias" / "prazo de quinze (15) dias" / "em 05 dias"
    var comDigito = bruto.match(/praz[oa][^.]{0,40}?(\d{1,3})\s*(?:\([^)]*\))?\s*dias?/i) ||
                    bruto.match(/\bem\s+(\d{1,3})\s*(?:\([^)]*\))?\s*dias?/i);
    if (comDigito) {
      return { dias: parseInt(comDigito[1], 10), emDobro: emDobro, trecho: comDigito[0].trim() };
    }

    var porExtenso = normal.match(/praz[oa][^.]{0,40}?\b([a-z]+)\s*(?:\([^)]*\))?\s*dias?/);
    if (porExtenso && NUMEROS_POR_EXTENSO[porExtenso[1]]) {
      return {
        dias: NUMEROS_POR_EXTENSO[porExtenso[1]],
        emDobro: emDobro,
        trecho: porExtenso[0].trim()
      };
    }

    return null;
  }

  /**
   * Advogados citados na publicação — é por eles que o monitoramento por OAB
   * casa a publicação com o escritório.
   * @returns {Array<{nome, oab, uf}>}
   */
  function extrairAdvogados(texto) {
    var achados = [];
    var expressao = /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ.\s]{4,60}?)\s*[-–—]?\s*OAB[\/\s]*([A-Z]{2})[\s-]*(\d{3,7})/g;
    var m;

    while ((m = expressao.exec(String(texto || ''))) !== null) {
      achados.push({
        nome: m[1].replace(/\s+/g, ' ').trim(),
        uf: m[2],
        oab: m[3]
      });
    }
    return achados;
  }

  /** Partes em CAIXA ALTA, como o diário costuma publicar. */
  function extrairPartes(texto) {
    var achados = String(texto || '')
      .match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s&.]{6,60}\b/g) || [];

    var descartar = ['DJE', 'DIARIO', 'DIÁRIO', 'TRIBUNAL', 'JUSTIÇA', 'OAB',
                     'ADV', 'ADVOGADO', 'PROCESSO', 'VARA', 'CADERNO'];

    return achados
      .map(function (t) { return t.replace(/\s+/g, ' ').trim(); })
      .filter(function (t) {
        if (t.length < 8) return false;
        return !descartar.some(function (d) { return t.indexOf(d) !== -1; });
      })
      .filter(function (t, i, lista) { return lista.indexOf(t) === i; })
      .slice(0, 4);
  }

  // --- Classificação ---------------------------------------------------------

  /**
   * Que ato a publicação exige e em quantos dias.
   *
   * @returns {{tipoPrazoId, dias, tipoContagem, emDobro, confianca, termos, abrePrazo}}
   *   confianca: 'alta' | 'media' | 'baixa' | 'nenhuma'
   */
  function classificar(texto) {
    var normal = normalizar(texto);

    var semPrazo = TERMOS_SEM_PRAZO.filter(function (t) { return contem(normal, t); });

    var pontuadas = REGRAS.map(function (regra) {
      var achados = regra.termos.filter(function (item) { return contem(normal, item.t); });

      /* Termo contido em outro termo achado NÃO pontua de novo: "recurso de
         apelação" já traz "apelação" dentro, e contar os dois inflaria a
         regra por repetição da mesma evidência. */
      var semSobreposicao = achados.filter(function (item) {
        return !achados.some(function (outro) {
          return outro !== item &&
                 normalizar(outro.t).indexOf(normalizar(item.t)) !== -1;
        });
      });

      var pontos = semSobreposicao.reduce(function (soma, item) {
        return soma + item.peso;
      }, 0);

      return {
        regra: regra,
        pontos: pontos,
        termos: semSobreposicao.map(function (i) { return i.t; })
      };
    }).filter(function (r) { return r.pontos > 0; });

    // Incompatibilidade: uma regra presente elimina a outra por completo.
    var excluidas = {};
    pontuadas.forEach(function (r) {
      (r.regra.exclui || []).forEach(function (id) { excluidas[id] = true; });
    });

    pontuadas = pontuadas
      .filter(function (r) { return !excluidas[r.regra.tipoPrazoId]; })
      .sort(function (a, b) { return b.pontos - a.pontos; });

    var doTexto = extrairPrazoTexto(texto);

    // Nada reconhecido: devolve o que dá para afirmar, sem inventar tipo.
    if (!pontuadas.length) {
      return {
        tipoPrazoId: doTexto ? 'custom' : null,
        dias: doTexto ? doTexto.dias : null,
        tipoContagem: 'uteis',
        emDobro: !!(doTexto && doTexto.emDobro),
        confianca: doTexto ? 'baixa' : 'nenhuma',
        termos: [],
        abrePrazo: !!doTexto && !semPrazo.length,
        motivoSemPrazo: semPrazo[0] || null
      };
    }

    var vencedora = pontuadas[0];
    var segunda = pontuadas[1];

    /* Confiança alta exige termo decisivo (peso 3, ou seja, 3+ pontos) E
       folga sobre a segunda colocada. Empate técnico vira média: a fila de
       triagem continua sendo do humano, e fingir certeza seria pior que
       admitir a dúvida. */
    var folga = vencedora.pontos - (segunda ? segunda.pontos : 0);
    var confianca = vencedora.pontos >= 3 && folga >= 2 ? 'alta'
                  : vencedora.pontos >= 2 ? 'media'
                  : 'baixa';

    // O prazo dito no texto vence a tabela.
    var dias = doTexto ? doTexto.dias : vencedora.regra.dias;

    return {
      tipoPrazoId: vencedora.regra.tipoPrazoId,
      dias: dias,
      tipoContagem: 'uteis',
      emDobro: !!(doTexto && doTexto.emDobro),
      confianca: semPrazo.length ? 'baixa' : confianca,
      termos: vencedora.termos,
      diasDoTexto: doTexto ? doTexto.dias : null,
      abrePrazo: !semPrazo.length,
      motivoSemPrazo: semPrazo[0] || null,
      alternativa: segunda ? segunda.regra.tipoPrazoId : null
    };
  }

  /**
   * Leitura completa: tudo o que se consegue afirmar sobre uma publicação.
   * É o que a fila de triagem mostra ao lado do texto.
   */
  function analisar(texto) {
    return {
      numeroCnj: extrairCnj(texto),
      advogados: extrairAdvogados(texto),
      partes: extrairPartes(texto),
      prazoNoTexto: extrairPrazoTexto(texto),
      sugestao: classificar(texto)
    };
  }

  App.domain.classificador = {
    REGRAS: REGRAS,
    TERMOS_SEM_PRAZO: TERMOS_SEM_PRAZO,
    normalizar: normalizar,
    extrairCnj: extrairCnj,
    extrairPrazoTexto: extrairPrazoTexto,
    extrairAdvogados: extrairAdvogados,
    extrairPartes: extrairPartes,
    classificar: classificar,
    analisar: analisar
  };
})(window.App = window.App || {});
