/* ==========================================================================
   domain/busca.js — busca em texto por índice invertido

   A busca global da fase 1 alcançava processos e clientes pelo nome. Não
   alcançava o CONTEÚDO: a petição em que se escreveu determinada tese, o
   andamento que citou certa testemunha, o texto da publicação. É onde a
   informação some num escritório com dez anos de acervo.

   LÓGICA PURA — tokenização, índice e pontuação. Quem monta o índice a
   partir do banco é o `buscaService`; quem consome é a topbar.

   Por que índice invertido e não `indexOf` em tudo: varrer o acervo a cada
   tecla digitada custa proporcionalmente ao tamanho do acervo, e o protótipo
   já tem centenas de textos. O índice é construído uma vez e consultado em
   tempo proporcional ao TAMANHO DA CONSULTA — que é o que permite buscar
   enquanto se digita.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  var ACENTOS = new RegExp('[\u0300-\u036f]', 'g');

  /* Palavras que aparecem em quase toda peça e por isso não distinguem
     nada. Indexá-las encheria o índice e faria "de" trazer o acervo
     inteiro. A lista é curta de propósito: cortar demais esconde busca
     legítima ("dano moral" precisa de "moral"). */
  var VAZIAS = [
    'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
    'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sob',
    'e', 'ou', 'que', 'se', 'ao', 'aos', 'à', 'às', 'pelo', 'pela',
    'este', 'esta', 'esse', 'essa', 'isso', 'aquele', 'aquela',
    'ser', 'foi', 'sao', 'era', 'tem', 'ter', 'ha', 'mais', 'mas'
  ];

  var TAMANHO_MINIMO = 3;

  function normalizar(texto) {
    var minusculo = String(texto === null || texto === undefined ? '' : texto).toLowerCase();
    if (typeof minusculo.normalize !== 'function') return minusculo;
    return minusculo.normalize('NFD').replace(ACENTOS, '');
  }

  /* Quantidade de dígitos dos identificadores que este sistema escreve
     pontuados: CPF, CNPJ e número do CNJ. */
  var DIGITOS_DE_IDENTIFICADOR = [11, 14, 20];

  /**
   * '529.982.247-25' → '52998224725'.
   *
   * O tokenizador quebra em qualquer pontuação, então o CPF copiado de uma
   * petição virava '529', '982', '247' e '25' — e nenhum deles casava com o
   * dígito puro guardado no cadastro. Como a consulta e o índice passam
   * pelos MESMOS tokens, colapsar dos dois lados faz as duas grafias
   * chegarem ao mesmo termo.
   *
   * Só colapsa o que tem pontuação E tem a quantidade de dígitos de um
   * identificador conhecido. Sem essa trava, 'ADV-2024-0001' viraria um
   * único termo e procurar '2024' deixaria de achá-lo. O casamento por
   * prefixo cobre o resto: '0001234' continua achando o CNJ inteiro.
   */
  function juntarIdentificadores(texto) {
    return String(texto || '').replace(/\d[\d.\-/]*\d/g, function (trecho) {
      var digitos = trecho.replace(/\D/g, '');
      if (digitos.length === trecho.length) return trecho;   // já era puro
      return DIGITOS_DE_IDENTIFICADOR.indexOf(digitos.length) === -1
        ? trecho
        : digitos;
    });
  }

  /**
   * Texto → lista de termos indexáveis.
   * Remove marcação HTML antes: o acervo tem documento em texto rico, e
   * indexar `<strong>` faria a tag competir com a palavra.
   */
  function tokenizar(texto) {
    var limpo = juntarIdentificadores(String(texto || '').replace(/<[^>]*>/g, ' '));

    return normalizar(limpo)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(function (t) {
        if (t.length < TAMANHO_MINIMO) return false;
        return VAZIAS.indexOf(t) === -1;
      });
  }

  /**
   * Monta o índice invertido.
   *
   * @param {Array} registros  [{ id, tipo, titulo, texto, ... }]
   * @returns {{ termos, documentos, total }}
   *   termos: { termo: { docId: frequencia } }
   */
  function indexar(registros) {
    var termos = {};
    var documentos = {};

    (registros || []).forEach(function (r) {
      if (!r || !r.id) return;
      documentos[r.id] = r;

      /* O TÍTULO pesa mais que o corpo: quem procura "procuração" quer o
         documento chamado procuração antes daquele que a menciona de
         passagem. O peso 3 é o multiplicador dessa intenção. */
      var doTitulo = tokenizar(r.titulo);
      var doCorpo = tokenizar(r.texto);

      function registrar(lista, peso) {
        lista.forEach(function (t) {
          if (!termos[t]) termos[t] = {};
          termos[t][r.id] = (termos[t][r.id] || 0) + peso;
        });
      }

      registrar(doTitulo, 3);
      registrar(doCorpo, 1);
    });

    return {
      termos: termos,
      documentos: documentos,
      total: Object.keys(documentos).length,
      totalTermos: Object.keys(termos).length
    };
  }

  /**
   * Consulta o índice.
   *
   * Todos os termos da consulta precisam aparecer (AND) — buscar
   * "dano moral" e receber tudo que fala de "dano" tornaria a busca inútil
   * num acervo jurídico, onde as palavras isoladas são frequentes.
   *
   * Termo com 3+ caracteres também casa por PREFIXO: "indeniz" acha
   * "indenização" e "indenizatória", que é como se digita com pressa.
   *
   * @returns {Array} [{ registro, pontos, termos }] ordenado por relevância
   */
  function buscar(indice, consulta, opcoes) {
    var op = opcoes || {};
    var termosConsulta = tokenizar(consulta);
    if (!termosConsulta.length || !indice) return [];

    var pontosPorDoc = null;    // null = ainda não houve interseção
    var termosPorDoc = {};

    termosConsulta.forEach(function (termo) {
      var ocorrencias = {};

      // Casamento exato e por prefixo, na mesma passada.
      Object.keys(indice.termos).forEach(function (indexado) {
        if (indexado !== termo && indexado.indexOf(termo) !== 0) return;
        // Prefixo pontua menos que a palavra inteira.
        var fator = indexado === termo ? 1 : 0.6;

        var docs = indice.termos[indexado];
        Object.keys(docs).forEach(function (docId) {
          ocorrencias[docId] = (ocorrencias[docId] || 0) + docs[docId] * fator;
        });
      });

      if (pontosPorDoc === null) {
        pontosPorDoc = ocorrencias;
      } else {
        // Interseção: só sobrevive quem tem TODOS os termos.
        var novo = {};
        Object.keys(pontosPorDoc).forEach(function (docId) {
          if (ocorrencias[docId] !== undefined) {
            novo[docId] = pontosPorDoc[docId] + ocorrencias[docId];
          }
        });
        pontosPorDoc = novo;
      }

      Object.keys(ocorrencias).forEach(function (docId) {
        (termosPorDoc[docId] = termosPorDoc[docId] || []).push(termo);
      });
    });

    if (!pontosPorDoc) return [];

    return Object.keys(pontosPorDoc)
      .map(function (docId) {
        return {
          registro: indice.documentos[docId],
          pontos: Math.round(pontosPorDoc[docId] * 10) / 10,
          termos: termosPorDoc[docId] || []
        };
      })
      .filter(function (r) {
        if (!r.registro) return false;
        if (op.tipo && r.registro.tipo !== op.tipo) return false;
        return true;
      })
      .sort(function (a, b) { return b.pontos - a.pontos; })
      .slice(0, op.limite || 30);
  }

  /**
   * Trecho do texto em volta da primeira ocorrência, com os termos
   * destacados. É o que faz o resultado ser útil sem abrir o documento.
   */
  function destacar(texto, consulta, tamanho) {
    var limpo = String(texto || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!limpo) return '';

    var termos = tokenizar(consulta);
    var largura = tamanho || 160;
    var normalizado = normalizar(limpo);

    var posicao = -1;
    for (var i = 0; i < termos.length && posicao === -1; i++) {
      posicao = normalizado.indexOf(termos[i]);
    }
    if (posicao === -1) return limpo.slice(0, largura) + (limpo.length > largura ? '…' : '');

    var inicio = Math.max(0, posicao - Math.floor(largura / 3));
    var trecho = limpo.slice(inicio, inicio + largura);

    var prefixo = inicio > 0 ? '…' : '';
    var sufixo = inicio + largura < limpo.length ? '…' : '';

    /* O casamento acontece no texto NORMALIZADO (sem acento), mas o recorte
       sai do texto ORIGINAL. Procurar "negativacao" dentro de "negativação"
       com expressão regular nunca casaria — a normalização precisa valer
       para achar a posição, e o texto exibido precisa manter o acento.
       Por isso as faixas são calculadas na versão normalizada e aplicadas
       por índice na original: `normalizar` preserva o comprimento, então os
       índices coincidem. */
    var trechoNormal = normalizar(trecho);
    var faixas = [];

    termos.forEach(function (t) {
      var de = trechoNormal.indexOf(t);
      while (de !== -1) {
        faixas.push({ de: de, ate: de + t.length });
        de = trechoNormal.indexOf(t, de + t.length);
      }
    });

    if (!faixas.length) return prefixo + App.dom.esc(trecho) + sufixo;

    // Une sobreposições para não abrir <mark> dentro de <mark>.
    faixas.sort(function (a, b) { return a.de - b.de; });
    var unidas = [faixas[0]];
    faixas.slice(1).forEach(function (f) {
      var ultima = unidas[unidas.length - 1];
      if (f.de <= ultima.ate) ultima.ate = Math.max(ultima.ate, f.ate);
      else unidas.push(f);
    });

    /* Cada pedaço é escapado ANTES de virar HTML — o trecho vem do conteúdo
       do documento, e injetar aqui abriria a porta que a fase 1 fechou. */
    var saida = '';
    var cursor = 0;
    unidas.forEach(function (f) {
      saida += App.dom.esc(trecho.slice(cursor, f.de));
      saida += '<mark>' + App.dom.esc(trecho.slice(f.de, f.ate)) + '</mark>';
      cursor = f.ate;
    });
    saida += App.dom.esc(trecho.slice(cursor));

    return prefixo + saida + sufixo;
  }

  App.domain.busca = {
    VAZIAS: VAZIAS,
    TAMANHO_MINIMO: TAMANHO_MINIMO,
    normalizar: normalizar,
    juntarIdentificadores: juntarIdentificadores,
    tokenizar: tokenizar,
    indexar: indexar,
    buscar: buscar,
    destacar: destacar
  };
})(window.App = window.App || {});
