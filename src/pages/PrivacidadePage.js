/* ==========================================================================
   pages/PrivacidadePage.js — LGPD

   Três abas, três obrigações:
     Titulares     — dossiê, portabilidade e anonimização (arts. 18 e 16, III)
     Solicitações  — o relógio de 15 dias do art. 18 correndo à vista
     Consentimentos— base legal registrada (arts. 7º e 8º)

   Mais o backup, que é a válvula de escape da decisão de não ter migração.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var aba = 'titulares';
  var dados = { pessoas: [], solicitacoes: [], consentimentos: [] };
  var busca = '';

  function esc(v) { return App.dom.esc(v); }

  function render(elemento) {
    container = elemento;
    container.innerHTML = App.components.ui.Skeleton({ linhas: 6 });
    ligarEventos();
    carregar();
  }

  function carregar() {
    Promise.all([
      App.services.privacidadeService.solicitacoes(),
      App.services.privacidadeService.consentimentos()
    ]).then(function (r) {
      dados.solicitacoes = r[0];
      dados.consentimentos = r[1];
      dados.pessoas = App.services.db.get('pessoas');
      desenhar();
    }).catch(function (erro) {
      container.innerHTML = App.components.ui.EmptyState({
        icone: '⚠', titulo: 'Erro ao carregar', texto: erro.message
      });
    });
  }

  // --- Aba: titulares --------------------------------------------------------

  function filtrarPessoas() {
    var termo = busca.toLowerCase().trim();
    return dados.pessoas.filter(function (p) {
      if (!termo) return true;
      return (p.nome + ' ' + (p.cpfCnpj || '') + ' ' + (p.email || ''))
        .toLowerCase().indexOf(termo) !== -1;
    }).slice(0, 40);
  }

  function linhaTitular(pessoa) {
    var ui = App.components.ui;
    var anonimizado = !!pessoa.anonimizadoEm;

    return '<tr>' +
      '<td>' +
        '<div class="u-bold">' + esc(pessoa.nome) + '</div>' +
        '<div class="u-xs u-subtle">' + esc(App.format.documento(pessoa.cpfCnpj)) + '</div>' +
      '</td>' +
      '<td class="u-sm">' + esc(pessoa.email || '—') + '</td>' +
      '<td>' +
        (anonimizado
          ? ui.Badge({ rotulo: 'Anonimizado', variante: 'neutral' })
          : ui.Badge({ rotulo: 'Ativo', variante: 'success' })) +
      '</td>' +
      '<td class="u-right">' +
        ui.Button({ rotulo: 'Dossiê', tamanho: 'sm', acao: 'dossie',
                    valor: pessoa.id, titulo: 'Ver tudo que o sistema guarda' }) +
        ' ' +
        ui.Button({ rotulo: 'JSON', tamanho: 'sm', acao: 'baixar-json',
                    valor: pessoa.id, titulo: 'Portabilidade (art. 18, V)' }) +
        ' ' +
        ui.Button({ rotulo: 'CSV', tamanho: 'sm', acao: 'baixar-csv', valor: pessoa.id }) +
        ' ' +
        ui.Button({
          rotulo: 'Anonimizar', tamanho: 'sm', variante: 'ghost',
          acao: 'anonimizar', valor: pessoa.id, desabilitado: anonimizado
        }) +
      '</td>' +
    '</tr>';
  }

  function abaTitulares() {
    var ui = App.components.ui;
    var lista = filtrarPessoas();

    var tabela = lista.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Titular</th><th>E-mail</th><th>Situação</th><th class="u-right">Direitos do titular</th>' +
        '</tr></thead><tbody>' + lista.map(linhaTitular).join('') + '</tbody></table></div>'
      : ui.EmptyState({ icone: '🔍', titulo: 'Nenhum titular encontrado' });

    return '<div class="filter-bar">' +
             '<input class="input" type="search" data-filtro="busca" value="' + esc(busca) + '"' +
               ' placeholder="Buscar titular por nome, CPF/CNPJ ou e-mail…">' +
           '</div>' +
           ui.Card({ conteudo: tabela, semPadding: true }) +
           '<p class="u-xs u-subtle" style="margin-top:var(--space-3)">' +
             'Anonimizar preserva o registro e remove a identificação — o processo não pode ' +
             'perder a identificação da parte, e a própria LGPD ressalva a guarda para ' +
             'exercício regular de direito (art. 16, III).' +
           '</p>';
  }

  // --- Aba: solicitações -----------------------------------------------------

  function linhaSolicitacao(s) {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var tipo = enums.achar(enums.TIPOS_SOLICITACAO_TITULAR, s.tipo);
    var atendida = s.status === 'atendida';

    return '<tr>' +
      '<td class="u-bold">' + esc(s.pessoaNome) + '</td>' +
      '<td>' + esc(tipo ? tipo.label : s.tipo) + '</td>' +
      '<td class="u-sm">' + esc(App.format.data(s.solicitadoEm)) + '</td>' +
      '<td>' +
        (atendida
          ? ui.Badge({ rotulo: 'Atendida', variante: 'success' })
          : ui.Badge({
              rotulo: s.atrasada ? 'Vencida' : 'Vence ' + App.format.dataRelativa(s.prazoAtendimento),
              variante: s.atrasada ? 'danger' : 'warning'
            })) +
      '</td>' +
      '<td class="u-right">' +
        (atendida ? '<span class="u-xs u-subtle">' + esc(App.format.data(s.respondidoEm)) + '</span>'
                  : ui.Button({ rotulo: 'Atender', tamanho: 'sm', variante: 'primary',
                                acao: 'atender', valor: s.id })) +
      '</td>' +
    '</tr>';
  }

  function abaSolicitacoes() {
    var ui = App.components.ui;
    var abertas = dados.solicitacoes.filter(function (s) { return s.status !== 'atendida'; });
    var vencidas = abertas.filter(function (s) { return s.atrasada; });

    var tabela = dados.solicitacoes.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Titular</th><th>Pedido</th><th>Recebido em</th><th>Prazo (15 dias)</th>' +
          '<th class="u-right">Ação</th>' +
        '</tr></thead><tbody>' + dados.solicitacoes.map(linhaSolicitacao).join('') +
        '</tbody></table></div>'
      : ui.EmptyState({
          icone: '📨', titulo: 'Nenhuma solicitação registrada',
          texto: 'Pedidos de acesso, correção, eliminação ou portabilidade entram aqui.',
          acao: ui.Button({ rotulo: 'Registrar solicitação', variante: 'primary',
                            acao: 'nova-solicitacao' })
        });

    return '<div class="grid grid--kpi" style="margin-bottom:var(--space-4)">' +
             ui.Kpi({ rotulo: 'Em aberto', valor: abertas.length, icone: '📨',
                      cor: 'var(--color-primary-400)' }) +
             ui.Kpi({ rotulo: 'Fora do prazo', valor: vencidas.length, icone: '⚠',
                      cor: 'var(--color-danger)',
                      dica: vencidas.length ? 'Art. 18: resposta em 15 dias' : '' }) +
             ui.Kpi({ rotulo: 'Atendidas', valor: dados.solicitacoes.length - abertas.length,
                      icone: '✓', cor: 'var(--color-success)' }) +
           '</div>' +
           ui.Card({
             titulo: 'Solicitações de titulares',
             acoes: ui.Button({ rotulo: 'Registrar', tamanho: 'sm', variante: 'primary',
                                acao: 'nova-solicitacao' }),
             conteudo: tabela,
             semPadding: true
           });
  }

  // --- Aba: consentimentos ---------------------------------------------------

  function abaConsentimentos() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    function nome(pessoaId) {
      var p = dados.pessoas.filter(function (x) { return x.id === pessoaId; })[0];
      return p ? p.nome : '—';
    }

    var linhas = dados.consentimentos.map(function (c) {
      var revogado = !!c.revogadoEm;
      return '<tr>' +
        '<td class="u-bold">' + esc(nome(c.pessoaId)) + '</td>' +
        '<td>' + esc(c.finalidade) + '</td>' +
        '<td class="u-sm">' + esc(enums.rotulo(enums.BASES_LEGAIS, c.base)) + '</td>' +
        '<td class="u-sm">' + esc(App.format.dataHora(c.concedidoEm)) + '</td>' +
        '<td>' + (revogado
          ? ui.Badge({ rotulo: 'Revogado', variante: 'neutral' })
          : ui.Badge({ rotulo: 'Ativo', variante: 'success' })) + '</td>' +
        '<td class="u-right">' +
          (revogado ? '' : ui.Button({ rotulo: 'Revogar', tamanho: 'sm', variante: 'ghost',
                                       acao: 'revogar', valor: c.id })) +
        '</td>' +
      '</tr>';
    }).join('');

    var tabela = dados.consentimentos.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Titular</th><th>Finalidade</th><th>Base legal</th><th>Concedido em</th>' +
          '<th>Situação</th><th></th>' +
        '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : ui.EmptyState({
          icone: '📝', titulo: 'Nenhum consentimento registrado',
          texto: 'Nem todo tratamento depende de consentimento — execução de contrato e ' +
                 'obrigação legal também são bases válidas, e ficam registradas aqui.',
          acao: ui.Button({ rotulo: 'Registrar', variante: 'primary', acao: 'novo-consentimento' })
        });

    return ui.Card({
      titulo: 'Bases legais e consentimentos',
      acoes: ui.Button({ rotulo: 'Registrar', tamanho: 'sm', variante: 'primary',
                         acao: 'novo-consentimento' }),
      conteudo: tabela,
      semPadding: true
    });
  }

  // --- Aba: backup -----------------------------------------------------------

  function abaBackup() {
    var ui = App.components.ui;
    var diag = App.services.db.diagnostico();

    var maiores = diag.porColecao.slice(0, 6).map(function (c) {
      return '<tr><td>' + esc(c.colecao) + '</td>' +
             '<td class="u-right u-tabular">' + App.format.numero(c.registros) + '</td>' +
             '<td class="u-right u-tabular">' + esc(App.format.bytes(c.bytes)) + '</td></tr>';
    }).join('');

    return ui.Card({
      titulo: 'Backup e restauração',
      conteudo:
        App.components.SeloSimulado({
          forma: 'linha',
          oque: 'não há backup automático nem criptografia em repouso — os dados ficam ' +
                'em claro no localStorage do navegador.',
          naFase3: 'backup agendado no servidor e cifragem em repouso no banco.'
        }) +
        '<p class="u-sm u-muted">O protótipo não tem migração de banco: subir a versão da ' +
        'chave descarta os dados. Este arquivo é a válvula de escape.</p>' +
        '<div class="u-row" style="gap:var(--space-2);margin:var(--space-4) 0">' +
          ui.Button({ rotulo: 'Baixar backup (JSON)', variante: 'primary', icone: '↓',
                      acao: 'baixar-backup' }) +
          ui.Button({ rotulo: 'Restaurar de arquivo', icone: '↑', acao: 'restaurar-backup' }) +
          '<input type="file" id="arquivo-backup" accept=".json,application/json" class="u-hidden">' +
        '</div>' +
        '<h4 class="u-sm u-bold">Ocupação do armazenamento</h4>' +
        ui.Progress({
          percentual: diag.percentual,
          cor: diag.alerta ? 'var(--color-danger)' : 'var(--color-success)'
        }) +
        '<p class="u-xs u-subtle" style="margin-top:var(--space-2)">' +
          diag.mb + ' MB de ' + diag.limiteMb + ' MB (' + diag.percentual + '%) · ' +
          'o teto do localStorage é do navegador, não do sistema' +
        '</p>' +
        '<div class="table-wrap" style="margin-top:var(--space-3)">' +
          '<table class="table table--compact"><thead><tr><th>Coleção</th>' +
          '<th class="u-right">Registros</th><th class="u-right">Tamanho</th></tr></thead>' +
          '<tbody>' + maiores + '</tbody></table>' +
        '</div>'
    });
  }

  // --- Desenho ---------------------------------------------------------------

  function desenhar() {
    var ui = App.components.ui;
    var abertas = dados.solicitacoes.filter(function (s) { return s.status !== 'atendida'; });

    var corpo = aba === 'titulares' ? abaTitulares()
              : aba === 'solicitacoes' ? abaSolicitacoes()
              : aba === 'consentimentos' ? abaConsentimentos()
              : abaBackup();

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Privacidade e proteção de dados</h1>' +
          '<p class="page-header__subtitle">LGPD · direitos do titular, bases legais e retenção</p>' +
        '</div>' +
      '</div>' +
      ui.Tabs({
        ativa: aba,
        abas: [
          { id: 'titulares', label: 'Titulares' },
          { id: 'solicitacoes', label: 'Solicitações', contador: abertas.length || null },
          { id: 'consentimentos', label: 'Consentimentos', contador: dados.consentimentos.length || null },
          { id: 'backup', label: 'Backup e retenção' }
        ]
      }) +
      '<div class="page-section">' + corpo + '</div>';
  }

  // --- Ações -----------------------------------------------------------------

  function verDossie(pessoaId) {
    App.services.privacidadeService.dossie(pessoaId).then(function (d) {
      var linhas = [
        ['Processos como cliente', d.processosComoCliente.length],
        ['Participações em processos', d.participacoesEmProcessos.length],
        ['Documentos vinculados', d.documentosVinculados.length],
        ['Consentimentos', d.consentimentos.length],
        ['Solicitações', d.solicitacoes.length],
        ['Eventos na trilha de auditoria', d.trilhaAuditoria.length]
      ].map(function (l) {
        return '<tr><td>' + esc(l[0]) + '</td>' +
               '<td class="u-right u-tabular u-bold">' + l[1] + '</td></tr>';
      }).join('');

      App.components.Modal.abrir({
        titulo: 'Dossiê de ' + d.titular.nome,
        conteudo:
          '<p class="u-sm u-muted">Tudo o que o sistema guarda sobre este titular. ' +
          'É a resposta ao pedido de acesso do art. 18, II.</p>' +
          '<div class="table-wrap" style="margin-top:var(--space-3)">' +
            '<table class="table table--compact"><tbody>' + linhas + '</tbody></table>' +
          '</div>' +
          '<dl class="def-list" style="margin-top:var(--space-4)">' +
            '<div><dt class="def-list__term">Documento</dt>' +
            '<dd class="def-list__desc">' + esc(App.format.documento(d.titular.cpfCnpj)) + '</dd></div>' +
            '<div><dt class="def-list__term">Gerado em</dt>' +
            '<dd class="def-list__desc">' + esc(App.format.dataHora(d.geradoEm)) + '</dd></div>' +
          '</dl>',
        acoes: [
          { rotulo: 'Baixar JSON', variante: 'primary', acao: 'json', fechar: true },
          { rotulo: 'Fechar', variante: 'secondary', acao: 'fechar', fechar: true }
        ],
        aoAcao: function (acao) {
          if (acao === 'json') App.services.privacidadeService.baixarDossieJson(pessoaId);
        }
      });
    }).catch(function (erro) {
      App.components.Toast.erro('Erro ao montar o dossiê', erro.message);
    });
  }

  function anonimizar(pessoaId) {
    var pessoa = dados.pessoas.filter(function (p) { return p.id === pessoaId; })[0];
    if (!pessoa) return;

    App.components.Modal.confirmar({
      titulo: 'Anonimizar ' + pessoa.nome,
      mensagem: 'O nome, o documento, o e-mail e o telefone serão mascarados. ' +
                'O registro e os vínculos processuais permanecem.',
      detalhe: 'Isto atende ao pedido de eliminação do art. 18, VI sem violar a guarda ' +
               'para exercício regular de direito em processo (art. 16, III).',
      rotuloConfirmar: 'Anonimizar',
      variante: 'danger'
    }).then(function (confirmado) {
      if (!confirmado) return;
      App.services.privacidadeService.anonimizarTitular(pessoaId, false).then(function () {
        App.components.Toast.sucesso('Titular anonimizado',
          'O registro foi preservado sem a identificação.');
        carregar();
      }).catch(function (erro) {
        App.components.Toast.erro('Não foi possível anonimizar', erro.message);
      });
    });
  }

  function novaSolicitacao() {
    var enums = App.domain.enums;
    var ui = App.components.ui;
    var pessoas = dados.pessoas.slice(0, 200).map(function (p) {
      return { id: p.id, label: p.nome };
    });

    App.components.Modal.abrir({
      titulo: 'Registrar solicitação de titular',
      conteudo:
        '<form id="form-solicitacao">' +
          ui.Field({ nome: 'pessoaId', rotulo: 'Titular', tipo: 'select', obrigatorio: true,
                     opcoes: enums.opcoes(pessoas, '', 'Selecione…') }) +
          ui.Field({ nome: 'tipo', rotulo: 'Pedido', tipo: 'select', obrigatorio: true,
                     opcoes: enums.opcoes(enums.TIPOS_SOLICITACAO_TITULAR, 'acesso'),
                     dica: 'O prazo de resposta de 15 dias é contado a partir de hoje.' }) +
          ui.Field({ nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', linhas: 3 }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Registrar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-solicitacao', corpo));
        if (!d.pessoaId) {
          App.components.Toast.aviso('Escolha o titular');
          return;
        }
        App.services.privacidadeService.criarSolicitacao(d).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Solicitação registrada', 'Prazo de 15 dias iniciado.');
          aba = 'solicitacoes';
          carregar();
        });
      }
    });
  }

  function novoConsentimento() {
    var enums = App.domain.enums;
    var ui = App.components.ui;
    var pessoas = dados.pessoas.slice(0, 200).map(function (p) {
      return { id: p.id, label: p.nome };
    });

    App.components.Modal.abrir({
      titulo: 'Registrar base legal',
      conteudo:
        '<form id="form-consentimento">' +
          ui.Field({ nome: 'pessoaId', rotulo: 'Titular', tipo: 'select', obrigatorio: true,
                     opcoes: enums.opcoes(pessoas, '', 'Selecione…') }) +
          ui.Field({ nome: 'finalidade', rotulo: 'Finalidade do tratamento', obrigatorio: true,
                     placeholder: 'Ex.: representação processual, contato para cobrança…' }) +
          ui.Field({ nome: 'base', rotulo: 'Base legal', tipo: 'select',
                     opcoes: enums.opcoes(enums.BASES_LEGAIS, 'contrato'),
                     dica: 'Nem todo tratamento depende de consentimento.' }) +
        '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Registrar', variante: 'primary', acao: 'salvar' }
      ],
      aoAcao: function (acao, corpo, fecharModal) {
        if (acao !== 'salvar') return;
        var d = App.dom.formToObject(App.dom.qs('#form-consentimento', corpo));
        if (!d.pessoaId || !d.finalidade) {
          App.components.Toast.aviso('Preencha titular e finalidade');
          return;
        }
        App.services.privacidadeService.registrarConsentimento(d).then(function () {
          fecharModal();
          App.components.Toast.sucesso('Base legal registrada');
          aba = 'consentimentos';
          carregar();
        });
      }
    });
  }

  function restaurarBackup() {
    var campo = document.getElementById('arquivo-backup');
    if (!campo) return;

    campo.onchange = function () {
      var arquivo = campo.files && campo.files[0];
      if (!arquivo) return;

      var leitor = new window.FileReader();
      leitor.onload = function () {
        App.components.Modal.confirmar({
          titulo: 'Restaurar backup',
          mensagem: 'O banco atual será substituído pelo conteúdo do arquivo.',
          detalhe: 'Todas as alterações feitas depois do backup serão perdidas.',
          rotuloConfirmar: 'Restaurar',
          variante: 'danger'
        }).then(function (confirmado) {
          campo.value = '';
          if (!confirmado) return;

          App.services.privacidadeService.restaurarBackup(String(leitor.result))
            .then(function (r) {
              if (r.incompativel) {
                App.components.Toast.aviso('Backup de outra versão',
                  'Gerado na versão ' + r.versaoArquivo + '. Confira os dados.');
              }
              App.components.Toast.sucesso('Banco restaurado',
                r.processos + ' processo(s) recuperado(s).');
              carregar();
            })
            .catch(function (erro) {
              App.components.Toast.erro('Não foi possível restaurar', erro.message);
            });
        });
      };
      leitor.readAsText(arquivo);
    };

    campo.click();
  }

  function ligarEventos() {
    App.dom.delegate(container, 'click', '[data-action="trocar-aba"]', function (evento, alvo) {
      aba = alvo.getAttribute('data-value');
      desenhar();
    });

    App.dom.delegate(container, 'input', 'input[data-filtro="busca"]',
      App.dom.debounce(function (evento, alvo) {
        busca = alvo.value;
        desenhar();
      }, 250));

    App.dom.delegate(container, 'click', '[data-action="dossie"]', function (evento, alvo) {
      verDossie(alvo.getAttribute('data-value'));
    });

    App.dom.delegate(container, 'click', '[data-action="baixar-json"]', function (evento, alvo) {
      App.services.privacidadeService.baixarDossieJson(alvo.getAttribute('data-value'));
      App.components.Toast.sucesso('Dossiê exportado', 'Arquivo JSON de portabilidade gerado.');
    });

    App.dom.delegate(container, 'click', '[data-action="baixar-csv"]', function (evento, alvo) {
      App.services.privacidadeService.baixarDossieCsv(alvo.getAttribute('data-value'));
    });

    App.dom.delegate(container, 'click', '[data-action="anonimizar"]', function (evento, alvo) {
      anonimizar(alvo.getAttribute('data-value'));
    });

    App.dom.delegate(container, 'click', '[data-action="nova-solicitacao"]', novaSolicitacao);
    App.dom.delegate(container, 'click', '[data-action="novo-consentimento"]', novoConsentimento);

    App.dom.delegate(container, 'click', '[data-action="atender"]', function (evento, alvo) {
      App.services.privacidadeService
        .atenderSolicitacao(alvo.getAttribute('data-value'), 'Atendida pelo painel de privacidade.')
        .then(function () {
          App.components.Toast.sucesso('Solicitação atendida');
          carregar();
        });
    });

    App.dom.delegate(container, 'click', '[data-action="revogar"]', function (evento, alvo) {
      App.services.privacidadeService.revogarConsentimento(alvo.getAttribute('data-value'))
        .then(function () {
          App.components.Toast.sucesso('Consentimento revogado');
          carregar();
        });
    });

    App.dom.delegate(container, 'click', '[data-action="baixar-backup"]', function () {
      App.services.privacidadeService.baixarBackup().then(function () {
        App.components.Toast.sucesso('Backup gerado', 'O arquivo JSON foi baixado.');
      });
    });

    App.dom.delegate(container, 'click', '[data-action="restaurar-backup"]', restaurarBackup);
  }

  App.pages.PrivacidadePage = { render: render };
})(window.App = window.App || {});
