/* ==========================================================================
   components/Chart.js — gráficos em SVG puro

   Zero dependência, como o resto do protótipo: barras/colunas, linha, donut
   e sparkline desenhados à mão. Consumido por F2.5 (fluxo de caixa) e F2.9
   (relatórios), e retroalimenta o dashboard.

   CONTRATO DO PROJETO: função pura que recebe props e devolve HTML; efeitos
   (tooltip) em Chart.mount(root). Na migração vira um componente React que
   devolve o mesmo <svg> — a geometria não muda de framework.

   ---------------------------------------------------------------------------
   REGRAS QUE ESTE ARQUIVO IMPLEMENTA (e por quê)

   · Paleta categórica de 8 slots em ORDEM FIXA, atribuída em sequência e
     nunca ciclada. A 9ª série vira "Outros" (cinza) — inventar um 9º matiz
     produziria um par indistinguível para quem tem daltonismo. A ordem foi
     validada por simulação de protanopia/deuteranopia; está em tokens.css
     com os números.
   · Um eixo de valor, sempre. Nunca dois eixos Y: duas medidas de escalas
     diferentes viram dois gráficos. É o erro nº 1 em gráfico de negócio, e
     aqui ele é impossível por construção — não há prop para isso.
   · Ordem que É significado (fase, etapa do funil, faixa de aging) usa a
     rampa ORDINAL de um matiz só, não a categórica: assim o leitor vê a
     ordem na cor. `paleta: 'ordinal'`.
   · Marca fina: coluna ≤ 24px com ponta arredondada de 4px e base reta na
     linha zero; linha de 2px; ponto ≥ 8px com anel de 2px na cor da
     superfície; área a 10% de opacidade. Grade em fio de 1px, sólida.
   · Vão de 2px na cor da superfície entre marcas que se encostam (segmentos
     empilhados e colunas vizinhas). É o branco que separa — nunca um
     contorno, que só acrescenta tinta.
   · Texto NUNCA usa a cor da série. Rótulo, eixo e legenda em tinta de
     texto; a identidade vem da marca colorida ao lado.
   · Legenda sempre que houver 2+ séries; nenhuma quando há uma só (o título
     já diz o que está plotado).
   · VISÃO DE TABELA sempre presente. É acessibilidade e é também o canal de
     alívio exigido pelos três slots que ficam abaixo de 3:1 de contraste no
     tema claro. Não é opcional: `tabela: false` só é legítimo em sparkline.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var esc = null;
  function e(v) {
    if (!esc) esc = App.dom.esc;
    return esc(v);
  }

  var MAX_SLOTS = 8;
  var ESPESSURA_MAX = 24;    // marca fina: a coluna nunca preenche a banda
  var RAIO_PONTA = 4;
  var VAO = 2;               // vão na cor da superfície entre marcas coladas
  var RAIO_PONTO = 4;        // diâmetro 8px

  // --- Cor -------------------------------------------------------------------

  function corCategorica(indice) {
    return indice < MAX_SLOTS
      ? 'var(--chart-' + (indice + 1) + ')'
      : 'var(--chart-neutro)';
  }

  /** Rampa de um matiz: distribui N passos pelos 7 disponíveis. */
  function corOrdinal(indice, total) {
    if (total <= 1) return 'var(--chart-seq-4)';
    var passo = Math.round(1 + (indice / (total - 1)) * 6);
    return 'var(--chart-seq-' + Math.min(7, Math.max(1, passo)) + ')';
  }

  function corDaSerie(serie, indice, total, paleta) {
    if (serie && serie.cor) return serie.cor;              // responsabilidade do chamador
    if (paleta === 'ordinal') return corOrdinal(indice, total);
    return corCategorica(indice);
  }

  /**
   * Dobra a 9ª série em diante numa única "Outros".
   * A regra não é estética: a paleta tem 8 slots validados e ciclar cores
   * criaria duas séries com a mesma identidade visual.
   */
  function dobrarExcedente(series, paleta) {
    if (paleta === 'ordinal' || !series || series.length <= MAX_SLOTS) return series || [];

    var mantidas = series.slice(0, MAX_SLOTS - 1);
    var excedente = series.slice(MAX_SLOTS - 1);
    var quantidade = (excedente[0].valores || []).length;

    var somados = [];
    for (var i = 0; i < quantidade; i++) {
      somados.push(excedente.reduce(function (soma, s) {
        return soma + (Number((s.valores || [])[i]) || 0);
      }, 0));
    }

    mantidas.push({
      id: '__outros',
      label: 'Outros (' + excedente.length + ')',
      valores: somados,
      cor: 'var(--chart-neutro)'
    });
    return mantidas;
  }

  // --- Escala ----------------------------------------------------------------

  function passoLimpo(bruto) {
    if (!bruto || !isFinite(bruto)) return 1;
    var expoente = Math.floor(Math.log(bruto) / Math.LN10);
    var fracao = bruto / Math.pow(10, expoente);
    var arredondado = fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 5 ? 5 : 10;
    return arredondado * Math.pow(10, expoente);
  }

  /** Marcas do eixo em números redondos — 0 / 1.000 / 2.000, nunca 0 / 873. */
  function ticks(min, max, alvo) {
    if (!isFinite(min) || !isFinite(max)) return [0, 1];
    if (min === max) { max = min + (min === 0 ? 1 : Math.abs(min) * 0.1); }

    var passo = passoLimpo((max - min) / (alvo || 4));
    var inicio = Math.floor(min / passo) * passo;
    var fim = Math.ceil(max / passo) * passo;

    var lista = [];
    for (var v = inicio; v <= fim + passo * 1e-6; v += passo) {
      lista.push(Math.round(v * 1e6) / 1e6);
    }
    return lista;
  }

  function extremos(series, empilhado) {
    var min = 0;
    var max = 0;
    var quantidade = 0;

    (series || []).forEach(function (s) {
      quantidade = Math.max(quantidade, (s.valores || []).length);
    });

    for (var i = 0; i < quantidade; i++) {
      if (empilhado) {
        var positivos = 0;
        var negativos = 0;
        (series || []).forEach(function (s) {
          var v = Number((s.valores || [])[i]) || 0;
          if (v >= 0) positivos += v; else negativos += v;
        });
        max = Math.max(max, positivos);
        min = Math.min(min, negativos);
      } else {
        (series || []).forEach(function (s) {
          var v = Number((s.valores || [])[i]) || 0;
          max = Math.max(max, v);
          min = Math.min(min, v);
        });
      }
    }
    return { min: min, max: max, quantidade: quantidade };
  }

  // --- Caminhos --------------------------------------------------------------

  /** Coluna: ponta superior arredondada, base reta na linha de base. */
  function caminhoColuna(x, y, largura, altura, raio) {
    if (altura <= 0.5) return '';
    var r = Math.min(raio, largura / 2, altura);
    return 'M' + x + ' ' + (y + altura) +
           ' V' + (y + r) +
           ' A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y +
           ' H' + (x + largura - r) +
           ' A' + r + ' ' + r + ' 0 0 1 ' + (x + largura) + ' ' + (y + r) +
           ' V' + (y + altura) + ' Z';
  }

  /** Barra horizontal: ponta direita arredondada, esquerda reta. */
  function caminhoBarra(x, y, largura, altura, raio) {
    if (largura <= 0.5) return '';
    var r = Math.min(raio, altura / 2, largura);
    return 'M' + x + ' ' + y +
           ' H' + (x + largura - r) +
           ' A' + r + ' ' + r + ' 0 0 1 ' + (x + largura) + ' ' + (y + r) +
           ' V' + (y + altura - r) +
           ' A' + r + ' ' + r + ' 0 0 1 ' + (x + largura - r) + ' ' + (y + altura) +
           ' H' + x + ' Z';
  }

  function retanguloSimples(x, y, largura, altura) {
    if (altura <= 0.5 || largura <= 0.5) return '';
    return 'M' + x + ' ' + y + ' H' + (x + largura) + ' V' + (y + altura) + ' H' + x + ' Z';
  }

  // --- Peças comuns ----------------------------------------------------------

  function formatarPadrao(v) {
    return App.format.numero(v);
  }

  function legenda(series, paleta) {
    if (!series || series.length < 2) return '';   // uma série: o título já nomeia

    var html = '<div class="chart__legend">';
    series.forEach(function (s, i) {
      html += '<span class="chart__legend-item">' +
                '<span class="chart__swatch" style="background:' +
                  corDaSerie(s, i, series.length, paleta) + '"></span>' +
                e(s.label) +
              '</span>';
    });
    return html + '</div>';
  }

  /**
   * Visão de tabela — sempre presente.
   * Acessibilidade e, no tema claro, o canal de alívio dos slots que ficam
   * abaixo de 3:1. Fica recolhida para não competir com o gráfico.
   */
  function tabela(categorias, series, formatar) {
    var f = formatar || formatarPadrao;

    var html = '<details class="chart__table">' +
                 '<summary>Ver como tabela</summary>' +
                 '<div class="chart__table-scroll"><table class="table table--compact"><thead><tr><th>Categoria</th>';
    series.forEach(function (s) { html += '<th class="u-right">' + e(s.label) + '</th>'; });
    html += '</tr></thead><tbody>';

    (categorias || []).forEach(function (cat, i) {
      html += '<tr><th scope="row">' + e(cat) + '</th>';
      series.forEach(function (s) {
        html += '<td class="u-right u-tabular">' + e(f((s.valores || [])[i] || 0)) + '</td>';
      });
      html += '</tr>';
    });

    return html + '</tbody></table></div></details>';
  }

  function moldura(props, corpo, series, paleta) {
    var p = props || {};
    var cabecalho = '';

    if (p.titulo || p.subtitulo) {
      cabecalho = '<div class="chart__header">' +
        (p.titulo ? '<h4 class="chart__title">' + e(p.titulo) + '</h4>' : '') +
        (p.subtitulo ? '<span class="chart__subtitle">' + e(p.subtitulo) + '</span>' : '') +
        '</div>';
    }

    return '<figure class="chart' + (p.classe ? ' ' + p.classe : '') + '"' +
             (p.id ? ' id="' + e(p.id) + '"' : '') + '>' +
             cabecalho +
             legenda(series, paleta) +
             '<div class="chart__plot">' + corpo + '</div>' +
             (p.tabela === false ? '' : tabela(p.categorias, series, p.formatarValor)) +
             (p.nota ? '<figcaption class="chart__note">' + e(p.nota) + '</figcaption>' : '') +
           '</figure>';
  }

  function dica(texto) {
    return ' data-tooltip="' + e(texto) + '"';
  }

  // --- Barras / Colunas ------------------------------------------------------

  /**
   * @param {object}   p
   * @param {string[]} p.categorias
   * @param {Array}    p.series        [{ id, label, valores: [] }]
   * @param {string}   p.orientacao    'coluna' (padrão) | 'barra'
   * @param {boolean}  p.empilhado
   * @param {string}   p.paleta        'categorica' (padrão) | 'ordinal'
   * @param {Function} p.formatarValor
   * @param {boolean}  p.rotular       rótulo direto na ponta (padrão: true com 1 série)
   */
  function Barras(props) {
    var p = props || {};
    var paleta = p.paleta || 'categorica';
    var categorias = p.categorias || [];
    var series = dobrarExcedente(p.series || [], paleta);
    var formatar = p.formatarValor || formatarPadrao;
    var horizontal = p.orientacao === 'barra';

    if (!series.length || !categorias.length) {
      return moldura(p, '<div class="chart__empty">Sem dados no período</div>', [], paleta);
    }

    var lim = extremos(series, p.empilhado);
    var marcas = ticks(Math.min(0, lim.min), Math.max(0, lim.max), 4);
    var vMin = marcas[0];
    var vMax = marcas[marcas.length - 1];

    // Rótulo direto por padrão só com uma série — um número em cada marca de
    // um gráfico de 4 séries é ruído, não informação.
    var rotular = p.rotular !== undefined ? p.rotular : (series.length === 1 && !p.empilhado);

    var largura = 640;
    var altura = p.altura || (horizontal ? Math.max(160, categorias.length * 34 + 40) : 260);
    var pad = horizontal
      ? { topo: 8, dir: 48, base: 26, esq: 116 }
      : { topo: 14, dir: 12, base: 28, esq: 52 };

    var plotL = largura - pad.esq - pad.dir;
    var plotA = altura - pad.topo - pad.base;

    function posValor(v) {
      var fracao = (v - vMin) / (vMax - vMin || 1);
      return horizontal ? pad.esq + fracao * plotL : pad.topo + (1 - fracao) * plotA;
    }

    var zero = posValor(0);
    var svg = '';

    // Grade e eixo de valor — recessivos, fio de 1px, sólidos.
    marcas.forEach(function (t) {
      var pos = posValor(t);
      if (horizontal) {
        svg += '<line class="chart__grid" x1="' + pos + '" y1="' + pad.topo +
               '" x2="' + pos + '" y2="' + (pad.topo + plotA) + '"/>' +
               '<text class="chart__tick" x="' + pos + '" y="' + (altura - 8) +
               '" text-anchor="middle">' + e(formatar(t)) + '</text>';
      } else {
        svg += '<line class="chart__grid" x1="' + pad.esq + '" y1="' + pos +
               '" x2="' + (largura - pad.dir) + '" y2="' + pos + '"/>' +
               '<text class="chart__tick" x="' + (pad.esq - 8) + '" y="' + (pos + 4) +
               '" text-anchor="end">' + e(formatar(t)) + '</text>';
      }
    });

    var banda = (horizontal ? plotA : plotL) / categorias.length;
    var grupos = p.empilhado ? 1 : series.length;
    // O vão de 2px entre colunas vizinhas é a separação; a folga de 8px
    // impede que a marca preencha a banda inteira.
    var espessura = Math.min(ESPESSURA_MAX, (banda - 8 - (grupos - 1) * VAO) / grupos);
    espessura = Math.max(3, espessura);
    var larguraGrupo = espessura * grupos + VAO * (grupos - 1);

    categorias.forEach(function (cat, iCat) {
      var inicioBanda = (horizontal ? pad.topo : pad.esq) + banda * iCat;
      var offset = inicioBanda + (banda - larguraGrupo) / 2;

      // Rótulo da categoria
      if (horizontal) {
        svg += '<text class="chart__cat" x="' + (pad.esq - 10) + '" y="' +
               (inicioBanda + banda / 2 + 4) + '" text-anchor="end">' +
               e(App.format.truncar(cat, 18)) + '</text>';
      } else {
        svg += '<text class="chart__cat" x="' + (inicioBanda + banda / 2) + '" y="' +
               (altura - 10) + '" text-anchor="middle">' +
               e(App.format.truncar(cat, 10)) + '</text>';
      }

      if (p.empilhado) {
        var acumuladoPos = 0;
        var acumuladoNeg = 0;
        // O último segmento com valor recebe a ponta arredondada; os de
        // dentro ficam retos, porque não têm ponta livre.
        var ultimoComValor = -1;
        series.forEach(function (s, i) {
          if ((Number((s.valores || [])[iCat]) || 0) > 0) ultimoComValor = i;
        });

        series.forEach(function (s, iSerie) {
          var valor = Number((s.valores || [])[iCat]) || 0;
          if (!valor) return;

          var de = valor >= 0 ? acumuladoPos : acumuladoNeg;
          var ate = de + valor;
          if (valor >= 0) acumuladoPos = ate; else acumuladoNeg = ate;

          var a = posValor(de);
          var b = posValor(ate);
          var inicio = Math.min(a, b);
          var tamanho = Math.abs(b - a) - VAO;      // o vão sai daqui
          if (tamanho <= 0) return;

          var cor = corDaSerie(s, iSerie, series.length, paleta);
          var texto = cat + ' · ' + s.label + ': ' + formatar(valor);
          var d = horizontal
            ? (iSerie === ultimoComValor
                ? caminhoBarra(inicio, offset, tamanho, espessura, RAIO_PONTA)
                : retanguloSimples(inicio, offset, tamanho, espessura))
            : (iSerie === ultimoComValor
                ? caminhoColuna(offset, inicio, espessura, tamanho, RAIO_PONTA)
                : retanguloSimples(offset, inicio, espessura, tamanho));

          if (d) svg += '<path class="chart__mark" d="' + d + '" fill="' + cor + '"' + dica(texto) + '/>';
        });
        return;
      }

      series.forEach(function (s, iSerie) {
        var valor = Number((s.valores || [])[iCat]) || 0;
        var pos = posValor(valor);
        var cor = corDaSerie(s, iSerie, series.length, paleta);
        var x = offset + iSerie * (espessura + VAO);
        var texto = cat + (series.length > 1 ? ' · ' + s.label : '') + ': ' + formatar(valor);

        var d;
        if (horizontal) {
          d = caminhoBarra(Math.min(zero, pos), x, Math.abs(pos - zero), espessura, RAIO_PONTA);
        } else {
          d = caminhoColuna(x, Math.min(zero, pos), espessura, Math.abs(pos - zero), RAIO_PONTA);
        }
        if (!d) return;

        svg += '<path class="chart__mark" d="' + d + '" fill="' + cor + '"' + dica(texto) + '/>';

        if (rotular) {
          svg += horizontal
            ? '<text class="chart__value" x="' + (pos + 6) + '" y="' + (x + espessura / 2 + 4) +
              '">' + e(formatar(valor)) + '</text>'
            : '<text class="chart__value" x="' + (x + espessura / 2) + '" y="' + (pos - 6) +
              '" text-anchor="middle">' + e(formatar(valor)) + '</text>';
        }
      });
    });

    // Linha de base sobre a grade, quando o zero não é a borda.
    if (vMin < 0) {
      svg += horizontal
        ? '<line class="chart__axis" x1="' + zero + '" y1="' + pad.topo + '" x2="' + zero +
          '" y2="' + (pad.topo + plotA) + '"/>'
        : '<line class="chart__axis" x1="' + pad.esq + '" y1="' + zero + '" x2="' +
          (largura - pad.dir) + '" y2="' + zero + '"/>';
    }

    var corpo = '<svg viewBox="0 0 ' + largura + ' ' + altura + '" role="img" ' +
                'preserveAspectRatio="xMidYMid meet" aria-label="' +
                e(p.titulo || 'Gráfico de barras') + '">' + svg + '</svg>';

    return moldura(p, corpo, series, paleta);
  }

  // --- Linha -----------------------------------------------------------------

  /**
   * Série temporal. Sem segundo eixo Y, por construção: duas medidas de
   * escalas diferentes viram dois gráficos.
   */
  function Linha(props) {
    var p = props || {};
    var paleta = p.paleta || 'categorica';
    var categorias = p.categorias || [];
    var series = dobrarExcedente(p.series || [], paleta);
    var formatar = p.formatarValor || formatarPadrao;

    if (!series.length || categorias.length < 2) {
      return moldura(p, '<div class="chart__empty">Sem dados no período</div>', [], paleta);
    }

    var lim = extremos(series, false);
    var marcas = ticks(Math.min(0, lim.min), Math.max(0, lim.max), 4);
    var vMin = marcas[0];
    var vMax = marcas[marcas.length - 1];

    var largura = 640;
    var altura = p.altura || 240;
    var pad = { topo: 14, dir: 16, base: 28, esq: 56 };
    var plotL = largura - pad.esq - pad.dir;
    var plotA = altura - pad.topo - pad.base;

    function x(i) {
      return pad.esq + (categorias.length === 1 ? plotL / 2 : (i / (categorias.length - 1)) * plotL);
    }
    function y(v) {
      return pad.topo + (1 - ((v - vMin) / (vMax - vMin || 1))) * plotA;
    }

    var svg = '';

    marcas.forEach(function (t) {
      svg += '<line class="chart__grid" x1="' + pad.esq + '" y1="' + y(t) +
             '" x2="' + (largura - pad.dir) + '" y2="' + y(t) + '"/>' +
             '<text class="chart__tick" x="' + (pad.esq - 8) + '" y="' + (y(t) + 4) +
             '" text-anchor="end">' + e(formatar(t)) + '</text>';
    });

    // Rótulos do eixo de categoria — desbastados para não colidirem.
    var salto = Math.max(1, Math.ceil(categorias.length / 12));
    categorias.forEach(function (cat, i) {
      if (i % salto !== 0 && i !== categorias.length - 1) return;
      svg += '<text class="chart__cat" x="' + x(i) + '" y="' + (altura - 10) +
             '" text-anchor="middle">' + e(App.format.truncar(cat, 10)) + '</text>';
    });

    series.forEach(function (s, iSerie) {
      var cor = corDaSerie(s, iSerie, series.length, paleta);
      var valores = s.valores || [];
      var pontos = [];

      valores.forEach(function (v, i) {
        if (v === null || v === undefined) return;
        pontos.push({ x: x(i), y: y(Number(v) || 0), v: Number(v) || 0, i: i });
      });
      if (!pontos.length) return;

      var d = pontos.map(function (pt, i) {
        return (i ? 'L' : 'M') + pt.x + ' ' + pt.y;
      }).join(' ');

      // Área só faz sentido com uma série; com várias vira sobreposição opaca.
      if (p.area && series.length === 1) {
        svg += '<path class="chart__area" d="' + d +
               ' L' + pontos[pontos.length - 1].x + ' ' + y(Math.max(0, vMin)) +
               ' L' + pontos[0].x + ' ' + y(Math.max(0, vMin)) + ' Z" fill="' + cor + '"/>';
      }

      svg += '<path class="chart__line" d="' + d + '" stroke="' + cor + '"/>';

      // Ponto final com anel na cor da superfície, e o valor ao lado —
      // rótulo seletivo: a ponta, não todos os pontos.
      var fim = pontos[pontos.length - 1];
      svg += '<circle class="chart__dot" cx="' + fim.x + '" cy="' + fim.y +
             '" r="' + RAIO_PONTO + '" fill="' + cor + '"/>';
    });

    // Faixas invisíveis por categoria: alvo de hover largo, com todas as
    // séries daquele ponto na mesma dica.
    var faixa = plotL / Math.max(1, categorias.length - 1);
    categorias.forEach(function (cat, i) {
      var texto = cat + '\n' + series.map(function (s) {
        return s.label + ': ' + formatar((s.valores || [])[i] || 0);
      }).join('\n');

      svg += '<rect class="chart__hit" x="' + (x(i) - faixa / 2) + '" y="' + pad.topo +
             '" width="' + faixa + '" height="' + plotA + '"' + dica(texto) + '/>';
    });

    var corpo = '<svg viewBox="0 0 ' + largura + ' ' + altura + '" role="img" ' +
                'preserveAspectRatio="xMidYMid meet" aria-label="' +
                e(p.titulo || 'Gráfico de linha') + '">' + svg + '</svg>';

    return moldura(p, corpo, series, paleta);
  }

  // --- Donut -----------------------------------------------------------------

  /**
   * Composição de um todo. Aceita no máximo 8 fatias — acima disso a 9ª vira
   * "Outros", pelo mesmo motivo das séries.
   *
   * @param {Array} p.fatias  [{ id, label, valor, cor? }]
   */
  function Donut(props) {
    var p = props || {};
    var paleta = p.paleta || 'categorica';
    var formatar = p.formatarValor || formatarPadrao;

    var fatias = (p.fatias || []).filter(function (f) { return (Number(f.valor) || 0) > 0; });
    var series = dobrarExcedente(fatias.map(function (f) {
      return { id: f.id, label: f.label, valores: [Number(f.valor) || 0], cor: f.cor };
    }), paleta);

    var total = series.reduce(function (s, f) { return s + f.valores[0]; }, 0);

    if (!total) {
      return moldura({ titulo: p.titulo, subtitulo: p.subtitulo, tabela: false },
                     '<div class="chart__empty">Sem dados no período</div>', [], paleta);
    }

    var tamanho = 200;
    var centro = tamanho / 2;
    var raio = 74;
    var espessura = 22;
    var circunferencia = 2 * Math.PI * raio;

    var svg = '<circle cx="' + centro + '" cy="' + centro + '" r="' + raio +
              '" fill="none" stroke="var(--chart-grid)" stroke-width="' + espessura + '"/>';

    var acumulado = 0;
    series.forEach(function (f, i) {
      var valor = f.valores[0];
      var fracao = valor / total;
      // O vão de 2px vira arco: é a mesma separação das barras, em ângulo.
      var comprimento = Math.max(0, fracao * circunferencia - VAO);
      var cor = corDaSerie(f, i, series.length, paleta);
      var pct = Math.round(fracao * 1000) / 10;

      svg += '<circle class="chart__arc" cx="' + centro + '" cy="' + centro + '" r="' + raio +
             '" fill="none" stroke="' + cor + '" stroke-width="' + espessura +
             '" stroke-dasharray="' + comprimento + ' ' + (circunferencia - comprimento) +
             '" stroke-dashoffset="' + (-acumulado * circunferencia) +
             '" transform="rotate(-90 ' + centro + ' ' + centro + ')"' +
             dica(f.label + ': ' + formatar(valor) + ' (' + pct + '%)') + '/>';

      acumulado += fracao;
    });

    // Miolo: o número que o donut existe para dizer.
    svg += '<text class="chart__donut-value" x="' + centro + '" y="' + (centro - 2) +
           '" text-anchor="middle">' + e(p.valorCentral || formatar(total)) + '</text>' +
           '<text class="chart__donut-label" x="' + centro + '" y="' + (centro + 16) +
           '" text-anchor="middle">' + e(p.rotuloCentral || 'total') + '</text>';

    var corpo = '<svg viewBox="0 0 ' + tamanho + ' ' + tamanho + '" role="img" ' +
                'class="chart__donut" preserveAspectRatio="xMidYMid meet" aria-label="' +
                e(p.titulo || 'Composição') + '">' + svg + '</svg>';

    var comTabela = Object.assign({}, p, { categorias: ['Total'] });
    return moldura(comTabela, corpo, series, paleta);
  }

  // --- Sparkline -------------------------------------------------------------

  /**
   * Tendência dentro de um KPI. Sem eixo, sem grade, sem legenda: é uma
   * forma, não um gráfico — e é a única forma que dispensa a tabela, porque
   * o número que ela acompanha já está escrito ao lado.
   */
  function Sparkline(props) {
    var p = props || {};
    var valores = (p.valores || []).map(function (v) { return Number(v) || 0; });
    if (valores.length < 2) return '';

    var largura = p.largura || 96;
    var altura = p.altura || 24;
    var pad = RAIO_PONTO + 1;

    var min = Math.min.apply(null, valores);
    var max = Math.max.apply(null, valores);
    var faixa = max - min || 1;

    function x(i) { return pad + (i / (valores.length - 1)) * (largura - pad * 2); }
    function y(v) { return pad + (1 - (v - min) / faixa) * (altura - pad * 2); }

    var d = valores.map(function (v, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(v); }).join(' ');
    var fim = { x: x(valores.length - 1), y: y(valores[valores.length - 1]) };
    var cor = p.cor || 'var(--chart-1)';

    return '<svg class="sparkline" viewBox="0 0 ' + largura + ' ' + altura + '" ' +
             'width="' + largura + '" height="' + altura + '" role="img" aria-label="' +
             e(p.rotulo || 'Tendência') + '">' +
             '<path class="sparkline__line" d="' + d + '" stroke="var(--chart-neutro)"/>' +
             '<circle class="sparkline__dot" cx="' + fim.x + '" cy="' + fim.y +
               '" r="3" fill="' + cor + '"/>' +
           '</svg>';
  }

  // --- Tooltip ---------------------------------------------------------------

  /**
   * Um listener por container, por delegação — segue a regra 6.1 do projeto
   * (ligar no render, nunca a cada desenho) e sobrevive à troca de innerHTML.
   */
  function mount(root) {
    if (!root) return function () {};

    var balao = document.createElement('div');
    balao.className = 'chart__tooltip';
    balao.setAttribute('role', 'tooltip');
    balao.hidden = true;
    root.appendChild(balao);

    function mostrar(evento, alvo) {
      var texto = alvo.getAttribute('data-tooltip');
      if (!texto) return;

      balao.textContent = texto;
      balao.hidden = false;

      var caixa = root.getBoundingClientRect();
      var x = evento.clientX - caixa.left;
      var y = evento.clientY - caixa.top;

      // Vira para dentro quando encosta na borda direita.
      balao.style.left = Math.min(x + 12, caixa.width - balao.offsetWidth - 8) + 'px';
      balao.style.top = Math.max(4, y - balao.offsetHeight - 10) + 'px';
    }

    function esconder() { balao.hidden = true; }

    var offOver = App.dom.delegate(root, 'mouseover', '[data-tooltip]', mostrar);
    var offMove = App.dom.delegate(root, 'mousemove', '[data-tooltip]', mostrar);
    var offOut = App.dom.delegate(root, 'mouseout', '[data-tooltip]', esconder);

    return function desmontar() {
      offOver(); offMove(); offOut();
      if (balao.parentNode) balao.parentNode.removeChild(balao);
    };
  }

  App.components.Chart = {
    Barras: Barras,
    Linha: Linha,
    Donut: Donut,
    Sparkline: Sparkline,
    mount: mount,
    // Expostos para os testes e para quem precisar da mesma escala fora daqui.
    ticks: ticks,
    corCategorica: corCategorica,
    corOrdinal: corOrdinal,
    dobrarExcedente: dobrarExcedente,
    MAX_SLOTS: MAX_SLOTS
  };
})(window.App = window.App || {});
