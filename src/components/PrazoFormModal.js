/* ==========================================================================
   components/PrazoFormModal.js — modal "Novo prazo"

   Extraído de ProcessoDetalhePage (onde nasceu) porque a Agenda também
   precisa dele: clicar num dia vago oferece prazo E compromisso, e prazo
   não é um campo livre — pede processo, disponibilização e a forma de
   contagem, pro motor do CPC calcular a data fatal de verdade.

   Duas formas de abrir:
     - com `processoId` fixo (ficha do processo): sem seletor, como sempre foi.
     - sem `processoId` (Agenda): ganha um campo "Processo" obrigatório,
       porque prazoService.criar() não aceita prazo sem processo — um prazo
       processual sem processo não é um caso de uso, é um dado quebrado.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  /**
   * @param {Object}   props
   * @param {string}   [props.processoId]           fixo — omitir mostra o seletor
   * @param {string}   [props.responsavelPadrao]     id do usuário pré-selecionado
   * @param {string}   [props.dataDisponibilizacao]  ISO — padrão: hoje
   * @param {Function} [props.aoCriar]                (prazo) => void, depois de salvar
   */
  function abrir(props) {
    var p = props || {};
    var ui = App.components.ui;
    var enums = App.domain.enums;
    var usuarios = App.services.db.get('usuarios').filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    var processoFixo = !!p.processoId;
    var opcoesProcesso = [];
    if (!processoFixo) {
      var pessoas = App.services.db.get('pessoas');
      opcoesProcesso = App.services.db.get('processos')
        .filter(function (proc) { return proc.status === 'ativo'; })
        .map(function (proc) {
          var cliente = pessoas.filter(function (x) { return x.id === proc.clienteId; })[0];
          return { id: proc.id, label: proc.numeroInterno + ' — ' + (cliente ? cliente.nome : '') };
        });
    }

    App.components.Modal.abrir({
      titulo: 'Novo prazo',
      tamanho: 'lg',
      conteudo: '<form id="form-prazo" class="form-grid">' +
        (processoFixo ? '' : ui.Field({
          nome: 'processoId', rotulo: 'Processo', tipo: 'select', largura: 12,
          obrigatorio: true, opcoes: enums.opcoes(opcoesProcesso, '', 'Selecione o processo')
        })) +
        ui.Field({ nome: 'tipoPrazoId', rotulo: 'Tipo de prazo', tipo: 'select', largura: 6,
                   opcoes: enums.opcoes(enums.TIPOS_PRAZO, 'contestacao'),
                   dica: 'Preenche automaticamente os dias e a forma de contagem' }) +
        ui.Field({ nome: 'titulo', rotulo: 'Título', largura: 6, valor: 'Contestação', obrigatorio: true }) +
        ui.Field({ nome: 'dataDisponibilizacao', rotulo: 'Disponibilização no DJe', tipo: 'date',
                   largura: 4, valor: p.dataDisponibilizacao || App.domain.prazos.hojeISO(), obrigatorio: true,
                   dica: 'A publicação é o 1º dia útil seguinte' }) +
        ui.Field({ nome: 'quantidadeDias', rotulo: 'Prazo (dias)', tipo: 'number',
                   largura: 4, valor: 15, obrigatorio: true }) +
        ui.Field({ nome: 'tipoContagem', rotulo: 'Contagem', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes([
                     { id: 'uteis', label: 'Dias úteis (art. 219)' },
                     { id: 'corridos', label: 'Dias corridos' }
                   ], 'uteis') }) +
        ui.Field({ nome: 'diasAntecedencia', rotulo: 'Antecedência interna (dias úteis)',
                   tipo: 'number', largura: 4, valor: 3,
                   dica: 'Folga de segurança do escritório' }) +
        ui.Field({ nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes(
                     usuarios.map(function (u) { return { id: u.id, label: u.nome }; }),
                     p.responsavelPadrao) }) +
        ui.Field({ nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', largura: 4,
                   opcoes: enums.opcoes(enums.PRIORIDADES, 'media') }) +
        ui.Field({ nome: 'dobro', rotulo: 'Prazo em dobro (art. 229 — litisconsortes com procuradores distintos)',
                   tipo: 'checkbox' }) +
        '<div class="field" id="previa-prazo"></div>' +
      '</form>',
      acoes: [
        { rotulo: 'Cancelar', variante: 'secondary', acao: 'cancelar', fechar: true },
        { rotulo: 'Criar prazo', variante: 'primary', acao: 'salvar' }
      ],
      aoAbrir: function (corpo) {
        var form = App.dom.qs('#form-prazo', corpo);
        var previa = App.dom.qs('#previa-prazo', corpo);

        function atualizarPrevia() {
          var dados = App.dom.formToObject(form);
          var calculo = App.services.prazoService.simular({
            dataDisponibilizacao: dados.dataDisponibilizacao,
            dias: Number(dados.quantidadeDias),
            tipoContagem: dados.tipoContagem,
            diasAntecedencia: Number(dados.diasAntecedencia),
            dobro: dados.dobro
          });

          previa.innerHTML = calculo
            ? App.pages.SimuladorPage.renderResultado(calculo)
            : '<p class="u-sm u-muted">Preencha a data e a quantidade de dias para ver o cálculo.</p>';
        }

        // Escolher o tipo preenche dias, contagem e título.
        form.addEventListener('change', function (evento) {
          if (evento.target.name === 'tipoPrazoId') {
            var tipo = enums.achar(enums.TIPOS_PRAZO, evento.target.value);
            if (tipo) {
              form.elements.quantidadeDias.value = tipo.dias;
              form.elements.tipoContagem.value = tipo.contagem;
              if (tipo.id !== 'custom') form.elements.titulo.value = tipo.label;
            }
          }
          atualizarPrevia();
        });

        form.addEventListener('input', App.dom.debounce(atualizarPrevia, 200));
        atualizarPrevia();
      },
      aoAcao: function (acao, corpo, fechar) {
        if (acao !== 'salvar') return;

        var dados = App.dom.formToObject(App.dom.qs('#form-prazo', corpo));
        var processoId = p.processoId || dados.processoId;

        if (!processoId) {
          App.components.Toast.aviso('Selecione o processo.');
          return;
        }
        if (!dados.titulo || !dados.dataDisponibilizacao || !dados.quantidadeDias) {
          App.components.Toast.aviso('Preencha título, data e quantidade de dias.');
          return;
        }

        App.services.prazoService.criar({
          processoId: processoId,
          titulo: dados.titulo.trim(),
          tipoPrazoId: dados.tipoPrazoId,
          dataDisponibilizacao: dados.dataDisponibilizacao,
          quantidadeDias: Number(dados.quantidadeDias),
          tipoContagem: dados.tipoContagem,
          diasAntecedencia: Number(dados.diasAntecedencia),
          dobro: dados.dobro,
          responsavelId: dados.responsavelId,
          prioridade: dados.prioridade
        }).then(function (prazo) {
          fechar();
          App.components.Toast.sucesso('Prazo criado',
            'Data fatal: ' + App.format.data(prazo.dataFatal));
          if (p.aoCriar) p.aoCriar(prazo);
        }).catch(function (erro) {
          App.components.Toast.erro('Erro ao criar o prazo', erro.message);
        });
      }
    });
  }

  App.components.PrazoFormModal = { abrir: abrir };
})(window.App = window.App || {});
