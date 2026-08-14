/* ==========================================================================
   pages/ProcessoFormPage.js — cadastro e edição de processo

   O campo do número CNJ valida ao vivo: máscara enquanto digita, dígito
   verificador conferido a cada 20 dígitos e decomposição exibida abaixo.
   Digitar errado o número é o erro de cadastro mais comum e mais caro.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;
  var processo = null;
  var clientes = [];
  var usuarios = [];
  var erros = {};
  var origem = {};   // query da rota — usada pelo cadastro vindo de publicação

  function esc(v) { return App.dom.esc(v); }
  function ehEdicao() { return !!(processo && processo.id); }

  function render(elemento, params, query) {
    container = elemento;
    erros = {};
    // F2.4: a fila de publicações manda para cá o número que não casou com
    // nenhum processo, e o cadastro já abre com ele preenchido.
    origem = query || {};
    container.innerHTML = App.components.ui.Skeleton({ linhas: 8 });

    App.services.db.init();
    clientes = App.services.db.get('pessoas').filter(function (p) { return p.ehCliente; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    usuarios = App.services.db.get('usuarios').filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    if (params && params.id) {
      App.services.processoService.obter(params.id).then(function (p) {
        processo = p;
        desenhar();
      }).catch(function (erro) {
        container.innerHTML = App.components.ui.EmptyState({
          icone: '⚠', titulo: 'Processo não encontrado', texto: erro.message
        });
      });
    } else {
      processo = valoresPadrao();
      desenhar();
    }
  }

  function valoresPadrao() {
    return {
      numeroCnj: origem.cnj || '',
      numeroInterno: 'ADV-' + new Date().getFullYear() + '-' +
                     String(App.services.db.get('processos').length + 1).padStart(4, '0'),
      clienteId: clientes.length ? clientes[0].id : '',
      papelCliente: 'autor',
      areaId: 'civel',
      classeProcessual: '',
      assunto: '',
      tribunalId: 'tjsp',
      comarca: '',
      vara: '',
      juiz: '',
      instancia: 1,
      faseId: 'distribuicao',
      status: 'ativo',
      segredoJustica: false,
      dataDistribuicao: App.domain.prazos.hojeISO(),
      valorCausa: 0,
      valorProvisao: 0,
      risco: 'possivel',
      responsavelId: usuarios.length ? usuarios[0].id : '',
      descricao: ''
    };
  }

  /* Candidatos a processo principal.
     Filtra pelo MESMO teste de segredo de justiça que o resto do sistema:
     oferecer na lista um processo que a pessoa não pode abrir já contaria
     que ele existe. E tira o próprio processo e os que já são apensos dele,
     porque escolher qualquer um dos dois criaria um ciclo. */
  function opcoesProcessoPai() {
    var eu = App.services.sessaoService.atual();
    var atual = processo.processoPaiId || '';

    var lista = App.services.db.get('processos').filter(function (p) {
      if (processo.id && (p.id === processo.id || p.processoPaiId === processo.id)) return false;
      return App.domain.permissoes.podeVerProcesso(eu, p);
    });

    return '<option value="">— nenhum (processo independente) —</option>' +
      lista.map(function (p) {
        return '<option value="' + esc(p.id) + '"' +
               (atual === p.id ? ' selected' : '') + '>' +
               esc((p.numeroCnj || p.numeroInterno) + ' — ' + p.assunto) +
               '</option>';
      }).join('');
  }

  function desenhar() {
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var fmt = App.format;

    var titulo = ehEdicao() ? 'Editar processo' : 'Novo processo';

    container.innerHTML =
      '<div class="breadcrumb">' +
        '<a href="#/processos">Processos</a>' +
        '<span class="breadcrumb__sep">/</span>' +
        (ehEdicao()
          ? '<a href="#/processos/' + esc(processo.id) + '">' + esc(processo.numeroInterno) + '</a>' +
            '<span class="breadcrumb__sep">/</span><span>Editar</span>'
          : '<span>Novo</span>') +
      '</div>' +

      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">' + titulo + '</h1>' +
          '<p class="page-header__subtitle">' +
            (ehEdicao() ? 'Alterando ' + esc(processo.numeroInterno)
                        : 'Os campos marcados com * são obrigatórios') +
          '</p>' +
        '</div>' +
      '</div>' +

      '<form id="form-processo" class="card form-page" novalidate>' +
        '<div class="card__body">' +

          '<fieldset class="fieldset">' +
            '<legend class="fieldset__legend">Identificação</legend>' +
            '<div class="form-grid">' +
              ui.Field({
                nome: 'numeroCnj', rotulo: 'Número CNJ', largura: 6, obrigatorio: true,
                valor: processo.numeroCnj, placeholder: '0000000-00.0000.0.00.0000',
                erro: erros.numeroCnj,
                dica: 'O dígito verificador é conferido automaticamente',
                atributos: ' inputmode="numeric" autocomplete="off"'
              }) +
              ui.Field({
                nome: 'numeroInterno', rotulo: 'Número interno (pasta)', largura: 3,
                valor: processo.numeroInterno, erro: erros.numeroInterno
              }) +
              ui.Field({
                nome: 'dataDistribuicao', rotulo: 'Distribuição', tipo: 'date', largura: 3,
                valor: processo.dataDistribuicao, obrigatorio: true, erro: erros.dataDistribuicao
              }) +
              '<div class="field" id="cnj-decomposto"></div>' +
            '</div>' +
          '</fieldset>' +

          '<fieldset class="fieldset">' +
            '<legend class="fieldset__legend">Objeto</legend>' +
            '<div class="form-grid">' +
              ui.Field({
                nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', largura: 6, obrigatorio: true,
                erro: erros.clienteId,
                opcoes: enums.opcoes(
                  clientes.map(function (c) {
                    return { id: c.id, label: c.nome + ' (' + fmt.documento(c.documento) + ')' };
                  }), processo.clienteId, 'Selecione o cliente')
              }) +
              ui.Field({
                nome: 'papelCliente', rotulo: 'Posição do cliente', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(enums.PAPEIS_CLIENTE, processo.papelCliente)
              }) +
              ui.Field({
                nome: 'areaId', rotulo: 'Área do direito', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(enums.AREAS, processo.areaId)
              }) +
              ui.Field({
                nome: 'assunto', rotulo: 'Assunto', largura: 6, obrigatorio: true,
                valor: processo.assunto, erro: erros.assunto,
                placeholder: 'Ex.: Indenização por danos morais'
              }) +
              ui.Field({
                nome: 'classeProcessual', rotulo: 'Classe processual', largura: 6,
                valor: processo.classeProcessual, placeholder: 'Ex.: Procedimento Comum Cível'
              }) +
            '</div>' +
          '</fieldset>' +

          '<fieldset class="fieldset">' +
            '<legend class="fieldset__legend">Foro</legend>' +
            '<div class="form-grid">' +
              ui.Field({
                nome: 'tribunalId', rotulo: 'Tribunal', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(
                  enums.TRIBUNAIS.map(function (t) { return { id: t.id, label: t.label + ' — ' + t.nome }; }),
                  processo.tribunalId)
              }) +
              ui.Field({ nome: 'comarca', rotulo: 'Comarca', largura: 3, valor: processo.comarca }) +
              ui.Field({ nome: 'vara', rotulo: 'Vara', largura: 3, valor: processo.vara }) +
              ui.Field({
                nome: 'instancia', rotulo: 'Instância', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(enums.INSTANCIAS, processo.instancia)
              }) +
              ui.Field({ nome: 'juiz', rotulo: 'Magistrado', largura: 6, valor: processo.juiz }) +
            '</div>' +
          '</fieldset>' +

          '<fieldset class="fieldset">' +
            '<legend class="fieldset__legend">Acompanhamento</legend>' +
            '<div class="form-grid">' +
              ui.Field({
                nome: 'faseId', rotulo: 'Fase processual', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(enums.FASES, processo.faseId)
              }) +
              ui.Field({
                nome: 'status', rotulo: 'Situação', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(enums.STATUS_PROCESSO, processo.status)
              }) +
              ui.Field({
                nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(
                  usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
                  processo.responsavelId)
              }) +
              ui.Field({
                nome: 'risco', rotulo: 'Classificação de risco', tipo: 'select', largura: 3,
                opcoes: enums.opcoes(enums.RISCOS, processo.risco),
                dica: 'Base da provisão contábil'
              }) +
              ui.Field({
                nome: 'valorCausa', rotulo: 'Valor da causa (R$)', largura: 4,
                valor: processo.valorCausa ? (processo.valorCausa / 100).toFixed(2).replace('.', ',') : '',
                placeholder: '0,00', atributos: ' inputmode="numeric"'
              }) +
              ui.Field({
                nome: 'valorProvisao', rotulo: 'Provisão de risco (R$)', largura: 4,
                valor: processo.valorProvisao ? (processo.valorProvisao / 100).toFixed(2).replace('.', ',') : '',
                placeholder: '0,00', atributos: ' inputmode="numeric"'
              }) +
              ui.Field({
                nome: 'segredoJustica', rotulo: 'Processo em segredo de justiça',
                tipo: 'checkbox', valor: processo.segredoJustica, largura: 4,
                dica: 'Restringe a visualização a quem tem permissão'
              }) +
              ui.Field({
                nome: 'processoPaiId', rotulo: 'Apenso a', tipo: 'select', largura: 6,
                opcoes: opcoesProcessoPai(),
                dica: 'Cautelar, execução e embargos têm número próprio e são o mesmo ' +
                      'caso — vincular faz os dois aparecerem juntos'
              }) +
              ui.Field({
                nome: 'descricao', rotulo: 'Observações internas', tipo: 'textarea',
                valor: processo.descricao, linhas: 3
              }) +
            '</div>' +
          '</fieldset>' +

        '</div>' +

        '<div class="form-actions">' +
          ui.Button({ rotulo: 'Cancelar', variante: 'secondary',
                      href: ehEdicao() ? '#/processos/' + processo.id : '#/processos' }) +
          ui.Button({ rotulo: ehEdicao() ? 'Salvar alterações' : 'Cadastrar processo',
                      variante: 'primary', tipo: 'submit', id: 'btn-salvar' }) +
        '</div>' +
      '</form>';

    ligarEventos();
  }

  // --- Validação ao vivo do número CNJ --------------------------------------

  function atualizarCnj(valor) {
    var painel = App.dom.qs('#cnj-decomposto', container);
    var campo = App.dom.qs('[name="numeroCnj"]', container);
    if (!painel || !campo) return;

    var grupo = campo.closest('.field');
    var caixaErro = App.dom.qs('[data-erro-de="numeroCnj"]', container);
    var digitos = App.domain.cnj.digitos(valor);

    grupo.classList.remove('field--invalid', 'field--valid');
    caixaErro.classList.add('u-hidden');
    caixaErro.textContent = '';

    if (!digitos.length) {
      painel.innerHTML = '';
      return;
    }

    if (digitos.length < 20) {
      painel.innerHTML = '<p class="u-xs u-subtle">' +
        digitos.length + ' de 20 dígitos informados.</p>';
      return;
    }

    var resultado = App.domain.cnj.validar(digitos);

    if (!resultado.valido) {
      grupo.classList.add('field--invalid');
      caixaErro.textContent = resultado.erro;
      caixaErro.classList.remove('u-hidden');
      painel.innerHTML = '';
      return;
    }

    grupo.classList.add('field--valid');
    var partes = resultado.partes;

    painel.innerHTML = '<div class="cnj-preview">' +
      item('Sequencial', partes.sequencial) +
      item('DV', partes.dv) +
      item('Ano', partes.ano) +
      item('Segmento', partes.segmento + ' — ' + partes.segmentoNome) +
      item('Tribunal', partes.tribunal) +
      item('Origem', partes.origem) +
    '</div>';

    function item(rotulo, texto) {
      return '<div>' +
               '<div class="cnj-preview__item-label">' + esc(rotulo) + '</div>' +
               '<div class="cnj-preview__item-value">' + esc(texto) + '</div>' +
             '</div>';
    }
  }

  function validar(dados) {
    var v = App.domain.validators;

    return v.validarFormulario(dados, {
      numeroCnj: function (valor) {
        var resultado = App.domain.cnj.validar(valor);
        return resultado.valido ? v.ok() : v.falha(resultado.erro);
      },
      numeroInterno: function (valor) { return v.obrigatorio(valor, 'Número interno'); },
      clienteId: function (valor) { return v.obrigatorio(valor, 'Cliente'); },
      assunto: function (valor) { return v.obrigatorio(valor, 'Assunto'); },
      dataDistribuicao: function (valor) { return v.dataISO(valor, 'Data de distribuição'); }
    });
  }

  // --- Eventos --------------------------------------------------------------

  function ligarEventos() {
    var campoCnj = App.dom.qs('[name="numeroCnj"]', container);
    if (campoCnj) {
      App.mask.aplicar(campoCnj, App.mask.cnj);
      campoCnj.addEventListener('input', function () { atualizarCnj(campoCnj.value); });
      atualizarCnj(campoCnj.value);
    }

    ['valorCausa', 'valorProvisao'].forEach(function (nome) {
      var campo = App.dom.qs('[name="' + nome + '"]', container);
      if (campo) App.mask.aplicar(campo, App.mask.moeda);
    });

    var form = App.dom.qs('#form-processo', container);
    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      salvar(form);
    });
  }

  function salvar(form) {
    var dados = App.dom.formToObject(form);
    var validacao = validar(dados);

    if (!validacao.valido) {
      erros = validacao.erros;
      mostrarErros(validacao.erros);
      App.components.Toast.aviso('Verifique os campos destacados',
        Object.keys(validacao.erros).length + ' campo(s) com problema.');
      return;
    }

    var payload = {
      numeroCnj: App.domain.cnj.formatar(dados.numeroCnj),
      numeroInterno: dados.numeroInterno.trim(),
      clienteId: dados.clienteId,
      papelCliente: dados.papelCliente,
      areaId: dados.areaId,
      assunto: dados.assunto.trim(),
      classeProcessual: dados.classeProcessual.trim(),
      tribunalId: dados.tribunalId,
      comarca: dados.comarca.trim(),
      vara: dados.vara.trim(),
      juiz: dados.juiz.trim(),
      instancia: dados.instancia === 'superior' ? 'superior' : Number(dados.instancia),
      faseId: dados.faseId,
      status: dados.status,
      responsavelId: dados.responsavelId,
      risco: dados.risco,
      segredoJustica: dados.segredoJustica,
      dataDistribuicao: dados.dataDistribuicao,
      valorCausa: App.mask.moedaParaCentavos(dados.valorCausa),
      valorProvisao: App.mask.moedaParaCentavos(dados.valorProvisao),
      processoPaiId: dados.processoPaiId || null,
      descricao: dados.descricao
    };

    var botao = App.dom.qs('#btn-salvar', container);
    if (botao) botao.disabled = true;

    var operacao = ehEdicao()
      ? App.services.processoService.atualizar(processo.id, payload)
      : App.services.processoService.criar(payload);

    operacao.then(function (salvo) {
      App.components.Toast.sucesso(
        ehEdicao() ? 'Processo atualizado' : 'Processo cadastrado',
        salvo.numeroInterno + ' — ' + salvo.clienteNome);
      App.layout.AppShell.atualizarBadges();

      /* Veio da fila de publicações (F2.4): fecha o ciclo vinculando a
         publicação ao processo recém-criado e devolvendo o usuário à fila,
         onde ele já pode gerar o prazo. Sem isso, ele teria de achar a
         publicação de novo à mão. */
      if (!ehEdicao() && origem.publicacaoId) {
        var idPublicacao = origem.publicacaoId;
        origem = {};
        App.services.publicacaoService.vincular(idPublicacao, salvo.id)
          .then(function () {
            App.components.Toast.sucesso('Publicação vinculada',
              'Volte à fila para gerar o prazo.');
            App.router.ir('#/publicacoes');
          })
          .catch(function () { App.router.ir('#/processos/' + salvo.id); });
        return;
      }

      App.router.ir('#/processos/' + salvo.id);
    }).catch(function (erro) {
      if (botao) botao.disabled = false;
      App.components.Toast.erro('Não foi possível salvar', erro.message);
    });
  }

  function mostrarErros(mapaErros) {
    App.dom.qsa('.field--invalid', container).forEach(function (campo) {
      campo.classList.remove('field--invalid');
    });
    App.dom.qsa('[data-erro-de]', container).forEach(function (caixa) {
      caixa.classList.add('u-hidden');
      caixa.textContent = '';
    });

    var primeiro = null;
    Object.keys(mapaErros).forEach(function (nome) {
      var campo = App.dom.qs('[name="' + nome + '"]', container);
      var caixa = App.dom.qs('[data-erro-de="' + nome + '"]', container);
      if (campo) {
        campo.closest('.field').classList.add('field--invalid');
        if (!primeiro) primeiro = campo;
      }
      if (caixa) {
        caixa.textContent = mapaErros[nome];
        caixa.classList.remove('u-hidden');
      }
    });

    if (primeiro) {
      primeiro.focus();
      primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  App.pages.ProcessoFormPage = { render: render };
})(window.App = window.App || {});
