/* ==========================================================================
   utils/csv.js — geração e LEITURA de CSV

   A leitura não é luxo: F2.10 importa processos em massa, e escritório nenhum
   digita 400 processos. Um `split(';')` quebraria em qualquer campo com
   ponto e vírgula dentro de aspas — daí o parser de estado abaixo.

   Convenção pt-BR/Excel: separador ';' e BOM UTF-8. Sem o BOM, o Excel
   brasileiro abre 'José' como 'JosÃ©'.
   ========================================================================== */

(function (App) {
  'use strict';

  var BOM = '﻿';

  function escaparCampo(valor, separador) {
    if (valor === null || valor === undefined) return '';
    var texto = String(valor);
    var precisaAspas = texto.indexOf('"') !== -1 ||
                       texto.indexOf(separador) !== -1 ||
                       texto.indexOf('\n') !== -1 ||
                       texto.indexOf('\r') !== -1;
    if (!precisaAspas) return texto;
    return '"' + texto.replace(/"/g, '""') + '"';
  }

  /**
   * Gera o CSV a partir de uma lista de objetos.
   *
   * @param {object[]} linhas
   * @param {Array}    colunas  [{ campo, titulo, formatar? }] — se omitido,
   *                            usa as chaves do primeiro registro
   * @param {object}   opcoes   { separador, bom }
   */
  function gerar(linhas, colunas, opcoes) {
    var op = opcoes || {};
    var sep = op.separador || ';';
    var lista = linhas || [];

    var cols = colunas && colunas.length ? colunas : Object.keys(lista[0] || {}).map(function (c) {
      return { campo: c, titulo: c };
    });

    var saida = cols.map(function (c) {
      return escaparCampo(c.titulo !== undefined ? c.titulo : c.campo, sep);
    }).join(sep);

    lista.forEach(function (registro) {
      saida += '\r\n' + cols.map(function (c) {
        var bruto = registro[c.campo];
        return escaparCampo(c.formatar ? c.formatar(bruto, registro) : bruto, sep);
      }).join(sep);
    });

    return (op.bom === false ? '' : BOM) + saida;
  }

  /** Descobre o separador contando ocorrências fora de aspas na 1ª linha. */
  function detectarSeparador(texto) {
    var candidatos = [';', ',', '\t'];
    var primeiraLinha = String(texto).split(/\r?\n/)[0] || '';
    var melhor = ';';
    var maior = -1;

    candidatos.forEach(function (sep) {
      var fora = 0;
      var aspas = false;
      for (var i = 0; i < primeiraLinha.length; i++) {
        if (primeiraLinha[i] === '"') aspas = !aspas;
        else if (primeiraLinha[i] === sep && !aspas) fora++;
      }
      if (fora > maior) { maior = fora; melhor = sep; }
    });
    return melhor;
  }

  /**
   * Lê CSV em array de objetos.
   *
   * Parser de estado, campo a campo: respeita aspas, aspas escapadas ("")
   * e quebra de linha DENTRO do campo — que é justamente o caso de um
   * endereço ou de uma descrição de processo colada de outro sistema.
   *
   * @returns {{ cabecalho: string[], linhas: object[], erros: object[] }}
   */
  function ler(texto, opcoes) {
    var op = opcoes || {};
    var bruto = String(texto || '').replace(/^﻿/, '');
    if (!bruto.trim()) return { cabecalho: [], linhas: [], erros: [] };

    var sep = op.separador || detectarSeparador(bruto);

    var registros = [];
    var campoAtual = '';
    var linhaAtual = [];
    var dentroAspas = false;

    for (var i = 0; i < bruto.length; i++) {
      var ch = bruto[i];

      if (dentroAspas) {
        if (ch === '"') {
          if (bruto[i + 1] === '"') { campoAtual += '"'; i++; }   // "" → "
          else dentroAspas = false;
        } else {
          campoAtual += ch;
        }
        continue;
      }

      if (ch === '"') { dentroAspas = true; }
      else if (ch === sep) { linhaAtual.push(campoAtual); campoAtual = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && bruto[i + 1] === '\n') i++;
        linhaAtual.push(campoAtual);
        registros.push(linhaAtual);
        linhaAtual = [];
        campoAtual = '';
      } else {
        campoAtual += ch;
      }
    }
    if (campoAtual !== '' || linhaAtual.length) {
      linhaAtual.push(campoAtual);
      registros.push(linhaAtual);
    }

    // Descarta linhas totalmente vazias (rodapé em branco é comum no Excel).
    registros = registros.filter(function (linha) {
      return linha.some(function (c) { return String(c).trim() !== ''; });
    });
    if (!registros.length) return { cabecalho: [], linhas: [], erros: [] };

    var cabecalho = registros[0].map(function (c) { return String(c).trim(); });
    var erros = [];
    var linhas = [];

    registros.slice(1).forEach(function (colunas, indice) {
      // A linha do arquivo, para o relatório de importação apontar onde doeu.
      var numeroLinha = indice + 2;

      if (colunas.length !== cabecalho.length) {
        erros.push({
          linha: numeroLinha,
          motivo: 'A linha tem ' + colunas.length + ' campo(s) e o cabeçalho tem ' +
                  cabecalho.length + '.'
        });
        return;
      }

      var objeto = {};
      cabecalho.forEach(function (nome, c) {
        objeto[nome] = String(colunas[c]).trim();
      });
      objeto.__linha = numeroLinha;
      linhas.push(objeto);
    });

    return { cabecalho: cabecalho, linhas: linhas, erros: erros };
  }

  /** Gera e dispara o download, sem sair da página. */
  function baixar(nomeArquivo, linhas, colunas, opcoes) {
    var conteudo = gerar(linhas, colunas, opcoes);
    var nome = /\.csv$/i.test(nomeArquivo) ? nomeArquivo : nomeArquivo + '.csv';

    if (typeof window.Blob === 'undefined') return Promise.resolve(false);
    var blob = new window.Blob([conteudo], { type: 'text/csv;charset=utf-8' });
    return App.dom.baixar(nome, blob);
  }

  App.csv = {
    gerar: gerar,
    ler: ler,
    baixar: baixar,
    detectarSeparador: detectarSeparador
  };
})(window.App = window.App || {});
