/* ==========================================================================
   pages/LeadDetalhePage.js — ficha do interessado

   Dados à esquerda, histórico de contato à direita. O histórico é o ativo:
   quem ligou, quando, o que ficou combinado. É o que permite retomar uma
   conversa de três semanas atrás sem começar do zero.

   A CONVERSÃO usa o `Stepper` de F2.0 e acontece numa passagem só: cliente,
   contrato e (opcional) processo, com os dados que já foram digitados aqui.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var lead = null;
  var etapaConversao = 0;
  var dadosConversao = null;
  var convertendo = false;
  var desmontarStepper = null;

  function esc(v) { return App.dom.esc(v); }

  function render(elemento, params, query) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    etapaConversao = 0;
    dadosConversao = null;
    ligarEventos();
    carregar(params.id, query && query.converter);
  }

  function destroy() {
    if (desmontarStepper) { desmontarStepper(); desmontarStepper = null; }
  }

  function carregar(id, abrirConversao) {
    App.services.leadService.obter(id).then(function (l) {
      lead = l;
      desenhar();
      if (abrirConversao && !l.convertidoEm) abrirConverter();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Interessado não encontrado', texto: erro.message,
        acao: App.components.ui.Button({ rotulo: 'Voltar ao funil', variante: 'primary',
                                         href: '#/crm' })
      });
    });
  }

  // --- Painéis -------------------------------------------------------------------

  function cabecalho() {
    var ui = App.components.ui;
    var podeConverter = !lead.convertidoEm && lead.etapa !== 'perdido';

    return '<div class="page-header">' +
      '<div>' +
        '<div class="u-row" style="gap:var(--space-2)">' +
          '<h1 class="page-header__title">' + esc(lead.nome) + '</h1>' +
          ui.Badge({ rotulo: lead.etapaLabel, cor: lead.etapaCor, ponto: true }) +
        '</div>' +
        '<p class="page-header__subtitle">' +
          esc(lead.rotuloOrigem) + ' · ' +
          esc(App.domain.enums.rotulo(App.domain.enums.AREAS, lead.areaId)) +
          ' · responsável ' + esc(lead.responsavelNome) +
        '</p>' +
      '</div>' +
      '<div class="page-header__actions">' +
        ui.Button({ rotulo: 'Registrar contato', acao: 'nova-interacao' }) +
        (podeConverter
          ? ui.Button({ rotulo: 'Converter em cliente', variante: 'primary',
                        acao: 'converter' })
          : '') +
      '</div>' +
    '</div>';
  }

  function painelDados() {
    var ui = App.components.ui;
    var fmt = App.format;

    function item(rotulo, valor) {
      return '<div><dt class="def-list__term">' + esc(rotulo) + '</dt>' +
             '<dd class="def-list__desc">' + (valor || '—') + '</dd></div>';
    }

    var alerta = '';
    if (lead.followUpAtrasado) {
      alerta = '<p class="lead__alerta">⏰ Follow-up previsto para ' +
               esc(fmt.data(lead.proximoContatoEm)) + ' — já passou.</p>';
    }
    if (lead.convertidoEm) {
      alerta = '<p class="lead__convertido">✓ Convertido em cliente em ' +
               esc(fmt.data(lead.convertidoEm)) +
               (lead.pessoaId
                 ? ' · <a href="#/clientes/' + esc(lead.pessoaId) + '">abrir ficha</a>'
                 : '') + '</p>';
    }
    if (lead.etapa === 'perdido' && lead.motivoPerda) {
      alerta = '<p class="lead__perdido">✕ Perdido — ' + esc(lead.motivoPerda) + '</p>';
    }

    return ui.Card({
      titulo: 'Dados',
      conteudo: alerta +
        '<dl class="def-list">' +
          item('Telefone', esc(fmt.telefone((lead.contato || {}).telefone))) +
          item('E-mail', esc((lead.contato || {}).email || '')) +
          item('Valor estimado', esc(fmt.moeda(lead.valorEstimadoCentavos))) +
          item('Probabilidade', lead.probabilidade + '%') +
          item('Valor ponderado', esc(fmt.moeda(lead.valorPonderadoCentavos))) +
          item('Próximo contato', lead.proximoContatoEm
            ? esc(fmt.data(lead.proximoContatoEm)) : 'não agendado') +
          item('Último contato', lead.diasSemContato !== null
            ? 'há ' + lead.diasSemContato + ' dia(s)' : 'nenhum registrado') +
        '</dl>' +
        (lead.resumoCaso
          ? '<h4 class="u-sm u-bold" style="margin-top:var(--space-4)">O caso</h4>' +
            '<p class="u-sm">' + esc(lead.resumoCaso) + '</p>'
          : '')
    });
  }

  function painelPropostas() {
    var ui = App.components.ui;

    var linhas = (lead.propostas || []).map(function (p) {
      var situacao = App.services.propostaService.situacao(p);
      var variante = situacao === 'aceita' ? 'success'
                   : situacao === 'recusada' ? 'danger'
                   : situacao === 'expirada' ? 'warning' : 'primary';

      return '<tr>' +
        '<td class="u-mono u-sm">' + esc(p.numero) + '</td>' +
        '<td class="u-sm">' + esc(App.domain.enums.rotulo(
          App.domain.enums.MODALIDADES_HONORARIO, p.honorarios.modalidade)) + '</td>' +
        '<td class="u-right u-tabular">' +
          (p.honorarios.valorFixoCentavos
            ? esc(App.format.moeda(p.honorarios.valorFixoCentavos)) : '—') +
          (p.honorarios.percentualExito
            ? '<div class="u-xs u-subtle">+ ' + p.honorarios.percentualExito + '% êxito</div>'
            : '') +
        '</td>' +
        '<td class="u-sm">' + esc(App.format.data(p.validadeAte)) + '</td>' +
        '<td>' + ui.Badge({ rotulo: App.domain.enums.rotulo(
          App.domain.enums.STATUS_PROPOSTA, situacao), variante: variante }) + '</td>' +
        '<td class="u-right">' +
          ui.Button({ rotulo: 'Ver', tamanho: 'sm', acao: 'ver-proposta', valor: p.id }) +
          (p.status === 'rascunho'
            ? ' ' + ui.Button({ rotulo: 'Enviar', tamanho: 'sm', variante: 'primary',
                                acao: 'enviar-proposta', valor: p.id })
            : '') +
        '</td>' +
      '</tr>';
    }).join('');

    return ui.Card({
      titulo: 'Propostas',
      acoes: lead.convertidoEm ? '' : ui.Button({
        rotulo: 'Nova proposta', tamanho: 'sm', variante: 'primary', acao: 'nova-proposta'
      }),
      conteudo: (lead.propostas || []).length
        ? '<div class="table-wrap"><table class="table table--compact"><thead><tr>' +
            '<th>Número</th><th>Modalidade</th><th class="u-right">Valor</th>' +
            '<th>Válida até</th><th>Situação</th><th></th>' +
          '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : '<p class="u-sm u-muted">Nenhuma proposta enviada.</p>',
      semPadding: false
    });
  }

  function painelHistorico() {
    var ui = App.components.ui;

    if (!lead.interacoes.length) {
      return ui.Card({
        titulo: 'Histórico de contato',
        conteudo: ui.EmptyState({
          icone: '💬', titulo: 'Nenhum contato registrado',
          texto: 'Registre ligações, reuniões e e-mails para retomar a conversa depois ' +
                 'sem começar do zero.',
          acao: ui.Button({ rotulo: 'Registrar contato', variante: 'primary',
                            acao: 'nova-interacao' })
        })
      });
    }

    var itens = lead.interacoes.map(function (i) {
      var enriquecida = App.services.interacaoService.enriquecer(i);
      return '<li class="inter">' +
        '<span class="inter__icone" aria-hidden="true">' + enriquecida.icone + '</span>' +
        '<div class="inter__corpo">' +
          '<div class="inter__topo">' +
            '<strong>' + esc(enriquecida.rotuloTipo) + '</strong>' +
            '<span class="u-xs u-subtle">' + esc(App.format.dataHora(i.quando)) +
              (i.duracaoMin ? ' · ' + i.duracaoMin + 'min' : '') + '</span>' +
          '</div>' +
          '<p class="inter__resumo">' + esc(i.resumo || '') + '</p>' +
          (i.proximoPasso
            ? '<p class="inter__passo">→ ' + esc(i.proximoPasso) + '</p>' : '') +
          '<div class="u-xs u-subtle">' + esc((i.usuario && i.usuario.nome) || '') + '</div>' +
        '</div>' +
      '</li>';
    }).join('');

    return ui.Card({
      titulo: 'Histórico de contato',
      subtitulo: lead.interacoes.length + ' registro(s)',
      acoes: ui.Button({ rotulo: 'Registrar', tamanho: 'sm', acao: 'nova-interacao' }),
      conteudo: '<ul class="inter-list">' + itens + '</ul>',
      semPadding: false
    });
  }

  function desenhar() {
    container.innerHTML =
      cabecalho() +
      '<div class="grid grid--main-aside">' +
        '<div>' + painelHistorico() + '</div>' +
        '<div>' + painelDados() +
          '<div class="page-section">' + painelPropostas() + '</div>' +
        '</div>' +
      '</div>';
  }

  // --- Conversão ------------------------------------------------------------------

  var ETAPAS_CONVERSAO = [
    { id: 'cliente',  label: 'Cliente',  descricao: 'Dados cadastrais' },
    { id: 'contrato', label: 'Contrato', descricao: 'Honorários' },
    { id: 'processo', label: 'Processo', descricao: 'Opcional' },
    { id: 'revisao',  label: 'Revisão',  descricao: 'Conferir e criar' }
  ];

  function corpoEtapa() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var d = dadosConversao;
    var etapa = ETAPAS_CONVERSAO[etapaConversao].id;

    if (etapa === 'cliente') {
      return '<form id="form-conv-cliente">' +
        ui.Field({ nome: 'nome', rotulo: 'Nome completo / razão social',
                   obrigatorio: true, valor: d.pessoa.nome }) +
        '<div class="form-grid">' +
          ui.Field({ nome: 'tipo', rotulo: 'Tipo', tipo: 'select', largura: 4,
                     opcoes: enums.opcoes([
                       { id: 'PF', label: 'Pessoa física' },
                       { id: 'PJ', label: 'Pessoa jurídica' }
                     ], d.pessoa.tipo) }) +
          ui.Field({ nome: 'cpfCnpj', rotulo: 'CPF / CNPJ', largura: 8,
                     valor: d.pessoa.cpfCnpj,
                     dica: 'Conferido pelo dígito verificador. Se já houver cliente com ' +
                           'este documento, ele é reaproveitado em vez de duplicado.' }) +
          ui.Field({ nome: 'email', rotulo: 'E-mail', largura: 6, valor: d.pessoa.email }) +
          ui.Field({ nome: 'telefone', rotulo: 'Telefone', largura: 6,
                     valor: d.pessoa.telefone }) +
        '</div>' +
      '</form>';
    }

    if (etapa === 'contrato') {
      return '<form id="form-conv-contrato">' +
        '<div class="form-grid">' +
          ui.Field({ nome: 'modalidade', rotulo: 'Modalidade', tipo: 'select', largura: 6,
                     opcoes: enums.opcoes(enums.MODALIDADES_HONORARIO,
                                          d.contrato.modalidade) }) +
          ui.Field({ nome: 'valorFixo', rotulo: 'Valor fixo', largura: 6,
                     valor: d.contrato.valorFixo, placeholder: 'R$ 0,00' }) +
          ui.Field({ nome: 'percentualExito', rotulo: 'Êxito (%)', tipo: 'number',
                     largura: 4, valor: d.contrato.percentualExito }) +
          ui.Field({ nome: 'numParcelas', rotulo: 'Parcelas', tipo: 'number', largura: 4,
                     valor: d.contrato.numParcelas }) +
          ui.Field({ nome: 'diaVencimento', rotulo: 'Dia do vencimento', tipo: 'number',
                     largura: 4, valor: d.contrato.diaVencimento }) +
        '</div>' +
        '<p class="u-xs u-subtle">As parcelas entram no contas a receber ao concluir.</p>' +
      '</form>';
    }

    if (etapa === 'processo') {
      return '<form id="form-conv-processo">' +
        ui.Field({ nome: 'criar', tipo: 'checkbox', valor: d.processo.criar,
                   rotulo: 'Cadastrar o processo agora',
                   dica: 'Deixe desmarcado se a ação ainda não foi distribuída — o ' +
                         'contrato e o cliente são criados de qualquer forma.' }) +
        '<div class="form-grid">' +
          ui.Field({ nome: 'assunto', rotulo: 'Assunto', largura: 12,
                     valor: d.processo.assunto }) +
          ui.Field({ nome: 'numeroCnj', rotulo: 'Número CNJ', largura: 6,
                     valor: d.processo.numeroCnj, placeholder: 'opcional' }) +
          ui.Field({ nome: 'tribunalId', rotulo: 'Tribunal', tipo: 'select', largura: 6,
                     opcoes: enums.opcoes(enums.TRIBUNAIS, d.processo.tribunalId) }) +
          ui.Field({ nome: 'comarca', rotulo: 'Comarca', largura: 6,
                     valor: d.processo.comarca }) +
          ui.Field({ nome: 'vara', rotulo: 'Vara', largura: 6, valor: d.processo.vara }) +
        '</div>' +
      '</form>';
    }

    // Revisão
    var parcelas = App.domain.financeiro.gerarParcelas({
      valorFixoCentavos: App.moeda.deReais(d.contrato.valorFixo),
      numParcelas: parseInt(d.contrato.numParcelas, 10) || 1,
      diaVencimento: parseInt(d.contrato.diaVencimento, 10) || null,
      dataInicio: App.domain.prazos.hojeISO()
    });

    return '<dl class="def-list">' +
      '<div><dt class="def-list__term">Cliente</dt>' +
        '<dd class="def-list__desc">' + esc(d.pessoa.nome) +
        (d.pessoa.cpfCnpj ? ' · ' + esc(App.format.documento(d.pessoa.cpfCnpj)) : '') +
        '</dd></div>' +
      '<div><dt class="def-list__term">Contrato</dt>' +
        '<dd class="def-list__desc">' +
          esc(enums.rotulo(enums.MODALIDADES_HONORARIO, d.contrato.modalidade)) +
          (App.moeda.deReais(d.contrato.valorFixo)
            ? ' · ' + esc(App.format.moeda(App.moeda.deReais(d.contrato.valorFixo)))
            : '') +
          (Number(d.contrato.percentualExito)
            ? ' · ' + d.contrato.percentualExito + '% de êxito' : '') +
        '</dd></div>' +
      '<div><dt class="def-list__term">Parcelas</dt>' +
        '<dd class="def-list__desc">' +
          (parcelas.length
            ? parcelas.length + ' parcela(s), a primeira em ' +
              esc(App.format.data(parcelas[0].dataVencimento))
            : 'nenhuma (modalidade sem valor fixo)') +
        '</dd></div>' +
      '<div><dt class="def-list__term">Processo</dt>' +
        '<dd class="def-list__desc">' +
          (d.processo.criar ? esc(d.processo.assunto || '—') : 'não será cadastrado agora') +
        '</dd></div>' +
    '</dl>';
  }

  function guardarEtapaAtual(corpo) {
    var etapa = ETAPAS_CONVERSAO[etapaConversao].id;

    if (etapa === 'cliente') {
      Object.assign(dadosConversao.pessoa,
        App.dom.formToObject(App.dom.qs('#form-conv-cliente', corpo)));
    } else if (etapa === 'contrato') {
      Object.assign(dadosConversao.contrato,
        App.dom.formToObject(App.dom.qs('#form-conv-contrato', corpo)));
    } else if (etapa === 'processo') {
      Object.assign(dadosConversao.processo,
        App.dom.formToObject(App.dom.qs('#form-conv-processo', corpo)));
    }
  }

  function abrirConverter() {
    var proposta = (lead.propostas || []).filter(function (p) {
      return p.status === 'aceita' || p.status === 'enviada';
    })[0];
    var h = (proposta && proposta.honorarios) || {};

    etapaConversao = 0;
    dadosConversao = {
      pessoa: {
        nome: lead.nome, tipo: 'PF', cpfCnpj: '',
        email: (lead.contato || {}).email || '',
        telefone: (lead.contato || {}).telefone || ''
      },
      // A proposta aceita já traz os honorários combinados — redigitar é
      // onde o desconto some e o contrato deixa de bater com o que foi
      // oferecido.
      contrato: {
        modalidade: h.modalidade || 'fixo',
        valorFixo: h.valorFixoCentavos ? App.format.moeda(h.valorFixoCentavos) : '',
        percentualExito: h.percentualExito || 0,
        numParcelas: h.numParcelas || 1,
        diaVencimento: 10
      },
      processo: {
        criar: false, assunto: lead.resumoCaso || lead.nome,
        numeroCnj: '', tribunalId: 'tjsp', comarca: '', vara: ''
      }
    };

    var estado = App.components.Modal.abrir({
      titulo: 'Converter em cliente',
      conteudo: App.components.Stepper({
        etapas: ETAPAS_CONVERSAO,
        atual: etapaConversao,
        conteudo: corpoEtapa(),
        rotuloConcluir: 'Criar cliente e contrato'
      }),
      acoes: [],
      aoAbrir: function (corpo) {
        function redesenhar() {
          App.dom.render(corpo, App.components.Stepper({
            etapas: ETAPAS_CONVERSAO,
            atual: etapaConversao,
            conteudo: corpoEtapa(),
            rotuloConcluir: 'Criar cliente e contrato',
            ocupado: convertendo
          }));
        }

        desmontarStepper = App.components.Stepper.mount(corpo, {
          aoAvancar: function () {
            guardarEtapaAtual(corpo);
            if (etapaConversao === 0 && !dadosConversao.pessoa.nome) {
              App.components.Toast.aviso('Informe o nome do cliente');
              return;
            }
            etapaConversao = Math.min(etapaConversao + 1, ETAPAS_CONVERSAO.length - 1);
            redesenhar();
          },
          aoVoltar: function () {
            guardarEtapaAtual(corpo);
            etapaConversao = Math.max(0, etapaConversao - 1);
            redesenhar();
          },
          aoConcluir: function () {
            if (convertendo) return;
            convertendo = true;
            redesenhar();

            App.services.leadService.converter(lead.id, {
              pessoa: dadosConversao.pessoa,
              contrato: {
                modalidade: dadosConversao.contrato.modalidade,
                valorFixoCentavos: App.moeda.deReais(dadosConversao.contrato.valorFixo),
                percentualExito: Number(dadosConversao.contrato.percentualExito) || 0,
                numParcelas: parseInt(dadosConversao.contrato.numParcelas, 10) || 1,
                diaVencimento: parseInt(dadosConversao.contrato.diaVencimento, 10) || null
              },
              processo: dadosConversao.processo
            }).then(function (r) {
              convertendo = false;
              estado.fechar();
              App.components.Toast.sucesso('Convertido em cliente',
                r.parcelasGeradas + ' parcela(s) no contas a receber' +
                (r.processoId ? ' · processo cadastrado' : ''));
              if (r.processoId) App.router.ir('#/processos/' + r.processoId);
              else carregar(lead.id);
            }).catch(function (erro) {
              convertendo = false;
              redesenhar();
              App.components.Toast.erro('Não foi possível converter', erro.message);
            });
          }
        });
      }
    });
  }

  // --- Outras ações ---------------------------------------------------------------

  function abrirNovaInteracao() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    App.components.Modal.abrir({
      titulo: 'Registrar contato',
      conteudo:
        '<form id="form-interacao">' +
          '<div class="form-grid">' +
            ui.Field({ nome: 'tipo', rotulo: 'Tipo', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(enums.TIPOS_INTERACAO, 'ligacao') }) +
            ui.Field({ nome: 'duracaoMin', rotulo: 'Duração (min)', tipo: 'number',
                       largura: 6, valor: 15 }) +
          '</div>' +
          ui.Field({ nome: 'resumo', rotulo: 'O que foi conversado', tipo: 'textarea',
                     linhas: 3, obrigatorio: true }) +
          ui.Field({ nome: 'proximoPasso', rotulo: 'Próximo passo' }) +
          ui.Field({ nome: 'proximoContatoEm', rotulo: 'Retornar em', tipo: 'date',
                     dica: 'Registrar o contato reagenda o follow-up — sem isso, o lead ' +
                           'continuaria marcado como atrasado logo após ser atendido.' }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Registrar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-interacao', corpo));

        App.services.interacaoService.criar({
          leadId: lead.id,
          tipo: d.tipo,
          duracaoMin: parseInt(d.duracaoMin, 10) || 0,
          resumo: d.resumo,
          proximoPasso: d.proximoPasso || null,
          proximoContatoEm: d.proximoContatoEm || null
        }).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Contato registrado');
          carregar(lead.id);
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível registrar', erro.message);
        });
      }
    });
  }

  function abrirNovaProposta() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    App.components.Modal.abrir({
      titulo: 'Nova proposta de honorários',
      conteudo:
        '<form id="form-proposta">' +
          ui.Field({ nome: 'escopo', rotulo: 'Objeto da proposta', tipo: 'textarea',
                     linhas: 3, valor: lead.resumoCaso || '' }) +
          '<div class="form-grid">' +
            ui.Field({ nome: 'modalidade', rotulo: 'Modalidade', tipo: 'select', largura: 6,
                       opcoes: enums.opcoes(enums.MODALIDADES_HONORARIO, 'fixo') }) +
            ui.Field({ nome: 'validadeDias', rotulo: 'Validade (dias)', tipo: 'number',
                       largura: 6, valor: 15 }) +
            ui.Field({ nome: 'valorFixo', rotulo: 'Valor fixo', largura: 4,
                       placeholder: 'R$ 0,00' }) +
            ui.Field({ nome: 'percentualExito', rotulo: 'Êxito (%)', tipo: 'number',
                       largura: 4, valor: 0 }) +
            ui.Field({ nome: 'numParcelas', rotulo: 'Parcelas', tipo: 'number',
                       largura: 4, valor: 1 }) +
          '</div>' +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Criar proposta', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-proposta', corpo));

        App.services.propostaService.criar({
          leadId: lead.id,
          escopo: d.escopo,
          validadeDias: parseInt(d.validadeDias, 10) || 15,
          honorarios: {
            modalidade: d.modalidade,
            valorFixoCentavos: App.moeda.deReais(d.valorFixo),
            percentualExito: Number(d.percentualExito) || 0,
            numParcelas: parseInt(d.numParcelas, 10) || 1
          }
        }).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Proposta criada', 'Ainda em rascunho — envie quando quiser.');
          carregar(lead.id);
        }).catch(function (erro) {
          App.components.Toast.erro('Não foi possível criar', erro.message);
        });
      }
    });
  }

  function verProposta(id) {
    App.services.propostaService.gerarTexto(id).then(function (r) {
      App.components.Modal.abrir({
        titulo: 'Proposta ' + r.proposta.numero,
        conteudo: '<div class="proposta-previa">' + r.html + '</div>',
        acoes: [
          { rotulo: 'Fechar', variante: 'secondary', acao: 'fechar', fechar: true },
          { rotulo: 'Imprimir', variante: 'primary', acao: 'imprimir' }
        ],
        aoAcao: function (acao) {
          if (acao === 'imprimir') {
            App.exportar.imprimir({
              nome: 'proposta-' + r.proposta.numero.replace('/', '-'),
              modo: 'rico',
              conteudo: r.html
            });
          }
        }
      });
    });
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="nova-interacao"]', abrirNovaInteracao);
    App.dom.delegate(container, 'click', '[data-action="nova-proposta"]', abrirNovaProposta);
    App.dom.delegate(container, 'click', '[data-action="converter"]', abrirConverter);

    App.dom.delegate(container, 'click', '[data-action="ver-proposta"]', function (evento, alvo) {
      verProposta(alvo.getAttribute('data-value'));
    });

    App.dom.delegate(container, 'click', '[data-action="enviar-proposta"]',
      function (evento, alvo) {
        App.services.propostaService.enviar(alvo.getAttribute('data-value'))
          .then(function () {
            App.components.Toast.sucesso('Proposta enviada',
              'O lead foi movido para a etapa de proposta.');
            carregar(lead.id);
          })
          .catch(function (erro) {
            App.components.Toast.erro('Não foi possível enviar', erro.message);
          });
      });
  }

  App.pages.LeadDetalhePage = { render: render, destroy: destroy };
})(window.App = window.App || {});
