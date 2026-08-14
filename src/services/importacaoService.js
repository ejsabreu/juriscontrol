/* ==========================================================================
   services/importacaoService.js — carga inicial por CSV

   Nenhum escritório migra 400 processos digitando. Sem importação, o
   sistema é bonito e inutilizável no primeiro dia.

   A REGRA QUE ORGANIZA O ARQUIVO: valida TUDO antes de gravar QUALQUER
   COISA. Uma importação que grava 300 linhas e para na 301 deixa o banco
   num estado que ninguém sabe desfazer — e o usuário sem saber se recomeça
   ou se continua. Aqui a conferência é uma passada inteira; a gravação é
   outra, e só acontece se o usuário mandar depois de ver o relatório.

   Erro de linha aponta o NÚMERO DA LINHA do arquivo (`utils/csv.js` já
   devolve isso), porque corrigir CSV sem saber onde doeu é adivinhação.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  /* Cada layout descreve as colunas esperadas, quais são obrigatórias e
     como cada campo é validado. Acrescentar um layout é acrescentar uma
     entrada aqui — a tela é genérica. */
  var LAYOUTS = {
    processos: {
      nome: 'Processos',
      colecao: 'processos',
      exemplo: 'numeroCnj;numeroInterno;clienteCpfCnpj;clienteNome;areaId;assunto;' +
               'classeProcessual;tribunalId;comarca;vara;valorCausa;papelCliente',
      campos: [
        { campo: 'numeroCnj', titulo: 'Número CNJ', obrigatorio: false, validar: validarCnj },
        { campo: 'numeroInterno', titulo: 'Número interno' },
        { campo: 'clienteCpfCnpj', titulo: 'CPF/CNPJ do cliente', validar: validarDocumento },
        { campo: 'clienteNome', titulo: 'Nome do cliente', obrigatorio: true },
        { campo: 'areaId', titulo: 'Área', validar: validarEnum('AREAS') },
        { campo: 'assunto', titulo: 'Assunto', obrigatorio: true },
        { campo: 'classeProcessual', titulo: 'Classe' },
        { campo: 'tribunalId', titulo: 'Tribunal', validar: validarEnum('TRIBUNAIS') },
        { campo: 'comarca', titulo: 'Comarca' },
        { campo: 'vara', titulo: 'Vara' },
        { campo: 'valorCausa', titulo: 'Valor da causa', validar: validarMoeda },
        { campo: 'papelCliente', titulo: 'Papel do cliente',
          validar: validarEnum('PAPEIS_CLIENTE') }
      ]
    },

    clientes: {
      nome: 'Clientes',
      colecao: 'pessoas',
      exemplo: 'nome;cpfCnpj;tipo;email;telefone;cidade;uf',
      campos: [
        { campo: 'nome', titulo: 'Nome', obrigatorio: true },
        { campo: 'cpfCnpj', titulo: 'CPF/CNPJ', validar: validarDocumento },
        { campo: 'tipo', titulo: 'Tipo (PF/PJ)' },
        { campo: 'email', titulo: 'E-mail', validar: validarEmail },
        { campo: 'telefone', titulo: 'Telefone' },
        { campo: 'cidade', titulo: 'Cidade' },
        { campo: 'uf', titulo: 'UF' }
      ]
    }
  };

  // --- Validadores ------------------------------------------------------------

  function validarCnj(valor) {
    if (!valor) return null;
    var r = App.domain.cnj.validar(valor);
    return r.valido ? null : 'número CNJ inválido (dígito verificador não confere)';
  }

  function validarDocumento(valor) {
    if (!valor) return null;
    var d = String(valor).replace(/\D/g, '');
    if (d.length === 11) {
      return App.domain.validators.cpf(d).valido ? null : 'CPF inválido';
    }
    if (d.length === 14) {
      return App.domain.validators.cnpj(d).valido ? null : 'CNPJ inválido';
    }
    return 'CPF/CNPJ com quantidade de dígitos inválida';
  }

  function validarEmail(valor) {
    if (!valor) return null;
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor) ? null : 'e-mail inválido';
  }

  /* `moeda.deReais` devolve 0 para qualquer coisa que não entenda — o que é
     bom para exibir e péssimo para validar: "abc" viraria R$ 0,00 calado.
     Aqui a conferência é da FORMA do texto, antes da conversão. */
  function validarMoeda(valor) {
    if (!valor) return null;
    var texto = String(valor).trim().replace(/[R$\s]/gi, '');
    if (!/^\(?-?[\d.,]+\)?$/.test(texto)) return 'valor não parece um número';
    if (!/\d/.test(texto)) return 'valor não parece um número';
    return null;
  }

  function validarEnum(nomeEnum) {
    return function (valor) {
      if (!valor) return null;
      var lista = App.domain.enums[nomeEnum] || [];
      if (lista.some(function (i) { return String(i.id) === String(valor); })) return null;
      return 'valor não reconhecido — use um de: ' +
             lista.map(function (i) { return i.id; }).slice(0, 6).join(', ') + '…';
    };
  }

  // --- Conferência ------------------------------------------------------------

  /**
   * Lê o CSV e devolve o RELATÓRIO — sem gravar nada.
   *
   * @returns {{ layout, cabecalho, validas, erros, avisos, colunasFaltando }}
   */
  function conferir(layoutId, texto) {
    return http().requisicao(function () {
      var layout = LAYOUTS[layoutId];
      if (!layout) throw http().ErroApi('Layout de importação desconhecido.', 400);

      var lido = App.csv.ler(texto);
      if (!lido.cabecalho.length) {
        throw http().ErroApi('O arquivo está vazio ou não é um CSV.', 400);
      }

      var esperados = layout.campos.map(function (c) { return c.campo; });
      var colunasFaltando = layout.campos
        .filter(function (c) {
          return c.obrigatorio && lido.cabecalho.indexOf(c.campo) === -1;
        })
        .map(function (c) { return c.campo; });

      var colunasIgnoradas = lido.cabecalho.filter(function (c) {
        return esperados.indexOf(c) === -1;
      });

      var validas = [];
      // Erros estruturais do próprio CSV já vêm de `utils/csv.js`.
      var erros = lido.erros.map(function (e) {
        return { linha: e.linha, campo: null, motivo: e.motivo };
      });

      lido.linhas.forEach(function (linha) {
        var problemas = [];

        layout.campos.forEach(function (definicao) {
          var valor = linha[definicao.campo];

          if (definicao.obrigatorio && !String(valor || '').trim()) {
            problemas.push({ campo: definicao.campo, motivo: 'campo obrigatório vazio' });
            return;
          }
          if (definicao.validar) {
            var erro = definicao.validar(valor);
            if (erro) problemas.push({ campo: definicao.campo, motivo: erro });
          }
        });

        if (problemas.length) {
          problemas.forEach(function (p) {
            erros.push({ linha: linha.__linha, campo: p.campo, motivo: p.motivo });
          });
          return;
        }
        validas.push(linha);
      });

      // Duplicidade contra o que JÁ existe — F2.8 faz o trabalho.
      var avisos = [];
      if (layoutId === 'processos') {
        var processos = db().get('processos');
        validas.forEach(function (l) {
          if (!l.numeroCnj) return;
          if (App.domain.assistente.detectarDuplicidadeProcesso(l.numeroCnj, processos).length) {
            avisos.push({ linha: l.__linha, campo: 'numeroCnj',
                          motivo: 'já existe processo com este número — será ignorado' });
          }
        });
      } else {
        var pessoas = db().get('pessoas');
        validas.forEach(function (l) {
          var achados = App.domain.assistente.detectarDuplicidadePessoa(
            { nome: l.nome, cpfCnpj: l.cpfCnpj }, pessoas);
          var certeza = achados.filter(function (a) { return a.confianca === 'certeza'; })[0];
          if (certeza) {
            avisos.push({ linha: l.__linha, campo: 'cpfCnpj',
                          motivo: 'já cadastrado como "' + certeza.registro.nome +
                                  '" — será ignorado' });
          }
        });
      }

      return {
        layoutId: layoutId,
        layout: { nome: layout.nome, campos: layout.campos, exemplo: layout.exemplo },
        cabecalho: lido.cabecalho,
        totalLinhas: lido.linhas.length + lido.erros.length,
        validas: validas,
        erros: erros,
        avisos: avisos,
        colunasFaltando: colunasFaltando,
        colunasIgnoradas: colunasIgnoradas,
        podeImportar: colunasFaltando.length === 0 && validas.length > 0
      };
    });
  }

  // --- Gravação ---------------------------------------------------------------

  function importar(layoutId, conferencia) {
    return http().requisicao(function () {
      var layout = LAYOUTS[layoutId];
      if (!layout) throw http().ErroApi('Layout de importação desconhecido.', 400);
      if (!conferencia || !conferencia.podeImportar) {
        throw http().ErroApi('Confira o arquivo antes de importar.', 409);
      }

      var usuario = App.store.getState().usuarioAtual;
      var ignoradas = conferencia.avisos.map(function (a) { return a.linha; });

      var criados = 0;
      var pulados = 0;

      conferencia.validas.forEach(function (linha) {
        if (ignoradas.indexOf(linha.__linha) !== -1) { pulados++; return; }

        if (layoutId === 'clientes') {
          db().insert('pessoas', {
            nome: linha.nome,
            tipo: (linha.tipo || '').toUpperCase() === 'PJ' ? 'PJ' : 'PF',
            cpfCnpj: String(linha.cpfCnpj || '').replace(/\D/g, ''),
            email: linha.email || '',
            telefone: String(linha.telefone || '').replace(/\D/g, ''),
            endereco: linha.cidade
              ? { cidade: linha.cidade, uf: (linha.uf || '').toUpperCase() } : null,
            ehCliente: true,
            observacoes: 'Importado por CSV.'
          }, 'PES');
          criados++;
          return;
        }

        // Processos: o cliente é criado junto quando ainda não existe.
        var documento = String(linha.clienteCpfCnpj || '').replace(/\D/g, '');
        var cliente = documento
          ? db().get('pessoas').filter(function (p) {
              return String(p.cpfCnpj || '').replace(/\D/g, '') === documento;
            })[0]
          : null;

        if (!cliente) {
          cliente = db().insert('pessoas', {
            nome: linha.clienteNome,
            tipo: documento.length === 14 ? 'PJ' : 'PF',
            cpfCnpj: documento,
            ehCliente: true,
            observacoes: 'Criado na importação de processos.'
          }, 'PES');
        }

        db().insert('processos', {
          numeroCnj: linha.numeroCnj || '',
          numeroInterno: linha.numeroInterno ||
            ('ADV-' + new Date().getFullYear() + '-' +
             String(db().get('processos').length + 1).padStart(4, '0')),
          tipo: 'judicial',
          clienteId: cliente.id,
          papelCliente: linha.papelCliente || 'autor',
          areaId: linha.areaId || 'civel',
          classeProcessual: linha.classeProcessual || '',
          assunto: linha.assunto,
          tribunalId: linha.tribunalId || 'tjsp',
          comarca: linha.comarca || '',
          vara: linha.vara || '',
          instancia: 1,
          faseId: 'distribuicao',
          status: 'ativo',
          segredoJustica: false,
          dataDistribuicao: App.domain.prazos.hojeISO(),
          valorCausa: App.moeda.deReais(linha.valorCausa),
          valorProvisao: 0,
          risco: 'possivel',
          responsavelId: usuario ? usuario.id : null,
          equipeIds: [],
          processoPaiId: null,
          tags: ['importado']
        }, 'PRO');
        criados++;
      });

      App.services.auditoriaService.registrar({
        acao: 'criar',
        colecao: layout.colecao,
        resumo: 'Importação por CSV: ' + criados + ' registro(s) criado(s)'
      });

      return {
        criados: criados,
        pulados: pulados,
        erros: conferencia.erros.length
      };
    });
  }

  /** Arquivo de exemplo com o cabeçalho correto — evita adivinhação. */
  function baixarModelo(layoutId) {
    var layout = LAYOUTS[layoutId];
    if (!layout) return Promise.resolve(false);

    var exemplo = {};
    layout.campos.forEach(function (c) { exemplo[c.campo] = ''; });

    return App.csv.baixar('modelo-importacao-' + layoutId, [exemplo],
      layout.campos.map(function (c) { return { campo: c.campo, titulo: c.campo }; }));
  }

  App.services.importacaoService = {
    LAYOUTS: LAYOUTS,
    conferir: conferir,
    importar: importar,
    baixarModelo: baixarModelo
  };
})(window.App = window.App || {});
