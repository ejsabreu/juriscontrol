/* ==========================================================================
   data/seed.js — dados fictícios do protótipo
   Embutido como .js (e não .json) para o index.html abrir por file://
   sem servidor — fetch de arquivo local seria bloqueado por CORS.

   Gerador DETERMINÍSTICO: o mesmo PRNG semeado produz sempre o mesmo
   conjunto, então bugs são reproduzíveis. As datas, porém, são relativas
   a HOJE — o protótipo nunca fica com prazos "todos vencidos".
   ========================================================================== */

(function (App) {
  'use strict';

  // --- PRNG determinístico (mulberry32) -------------------------------------
  function criarRandom(semente) {
    var a = semente;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Vocabulário ----------------------------------------------------------
  var NOMES = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela',
    'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nathan', 'Olívia',
    'Paulo', 'Renata', 'Rafael', 'Sofia', 'Thiago', 'Vanessa', 'William', 'Beatriz',
    'Caio', 'Débora', 'Fernando', 'Helena', 'Igor', 'Juliana', 'Marcelo'];

  var SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira',
    'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
    'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias',
    'Nunes', 'Moreira', 'Cardoso', 'Teixeira', 'Correia', 'Mendes'];

  var EMPRESAS = [
    'Construtora Horizonte', 'Metalúrgica Vale Verde', 'Transportes Andrade',
    'Supermercados Bom Preço', 'Tecno Solutions Sistemas', 'Indústria Têxtil Paulista',
    'Distribuidora Central', 'Clínica Vida Plena', 'Agropecuária Santa Rita',
    'Editora Panorama', 'Logística Expressa', 'Alimentos Nutri Mais',
    'Engenharia Estrutural', 'Comercial Rio Claro', 'Farmacêutica Bioativa'];

  var SUFIXOS_PJ = ['Ltda.', 'S.A.', 'ME', 'EIRELI'];

  var CIDADES = [
    { nome: 'São Paulo', uf: 'SP' }, { nome: 'Campinas', uf: 'SP' },
    { nome: 'Santo André', uf: 'SP' }, { nome: 'Guarulhos', uf: 'SP' },
    { nome: 'Rio de Janeiro', uf: 'RJ' }, { nome: 'Niterói', uf: 'RJ' },
    { nome: 'Belo Horizonte', uf: 'MG' }, { nome: 'Curitiba', uf: 'PR' }];

  var LOGRADOUROS = ['Rua das Acácias', 'Av. Paulista', 'Rua XV de Novembro',
    'Av. Brasil', 'Rua Sete de Setembro', 'Al. Santos', 'Rua Barão de Itapetininga',
    'Av. Rio Branco', 'Rua Augusta', 'Travessa São Bento'];

  var ASSUNTOS = {
    civel: ['Indenização por danos morais', 'Rescisão contratual', 'Cobrança',
            'Responsabilidade civil', 'Obrigação de fazer', 'Usucapião'],
    trabalhista: ['Verbas rescisórias', 'Horas extras', 'Reconhecimento de vínculo',
                  'Adicional de insalubridade', 'Assédio moral', 'Equiparação salarial'],
    tributario: ['Execução fiscal', 'Repetição de indébito', 'Anulatória de débito fiscal',
                 'Compensação tributária', 'ICMS na base do PIS/COFINS'],
    consumidor: ['Vício do produto', 'Cobrança indevida', 'Negativação indevida',
                 'Cancelamento de voo', 'Plano de saúde — negativa de cobertura'],
    familia: ['Divórcio consensual', 'Alimentos', 'Guarda compartilhada',
              'Inventário e partilha', 'Reconhecimento de união estável'],
    previdenciario: ['Aposentadoria por tempo de contribuição', 'Auxílio-doença',
                     'Revisão da vida toda', 'Benefício assistencial — LOAS'],
    penal: ['Ação penal — estelionato', 'Habeas corpus', 'Apuração de crime tributário'],
    empresarial: ['Dissolução parcial de sociedade', 'Recuperação judicial',
                  'Concorrência desleal', 'Marca — uso indevido']
  };

  var CLASSES = ['Procedimento Comum Cível', 'Execução de Título Extrajudicial',
    'Cumprimento de Sentença', 'Reclamação Trabalhista', 'Execução Fiscal',
    'Procedimento do Juizado Especial Cível', 'Ação Civil Pública', 'Monitória'];

  var VARAS = ['1ª Vara Cível', '2ª Vara Cível', '3ª Vara Cível', '5ª Vara Cível',
    '1ª Vara do Trabalho', '3ª Vara do Trabalho', '2ª Vara da Fazenda Pública',
    '1ª Vara de Família', 'Juizado Especial Cível', '4ª Vara Federal'];

  var TITULOS_ANDAMENTO = {
    movimentacao: ['Conclusos para despacho', 'Autos remetidos ao arquivo provisório',
      'Juntada de petição', 'Redistribuído por competência', 'Ato ordinatório praticado',
      'Autos com vista ao Ministério Público'],
    peticao: ['Petição inicial protocolada', 'Contestação protocolada',
      'Réplica apresentada', 'Manifestação sobre documentos', 'Alegações finais',
      'Petição de juntada de procuração'],
    despacho: ['Cite-se a parte requerida', 'Especifiquem as partes as provas que pretendem produzir',
      'Manifeste-se o autor sobre a contestação', 'Designe-se audiência de conciliação'],
    decisao: ['Deferida a tutela de urgência', 'Indeferido o pedido liminar',
      'Saneado o processo', 'Deferida a produção de prova pericial'],
    sentenca: ['Julgado procedente o pedido', 'Julgado parcialmente procedente',
      'Julgado improcedente o pedido', 'Homologado acordo entre as partes'],
    publicacao: ['Disponibilizado no DJe', 'Intimação das partes',
      'Publicada decisão interlocutória'],
    nota_interna: ['Cliente informado por e-mail sobre o andamento',
      'Reunião de alinhamento realizada com o cliente',
      'Aguardando documentos complementares do cliente',
      'Estratégia revista após decisão interlocutória']
  };

  var TITULOS_TAREFA = ['Elaborar minuta de contestação', 'Revisar cálculo de liquidação',
    'Solicitar documentos ao cliente', 'Protocolar petição de juntada',
    'Preparar cliente para audiência', 'Analisar sentença e avaliar recurso',
    'Fazer levantamento jurisprudencial', 'Atualizar planilha de provisão',
    'Agendar reunião de alinhamento', 'Conferir procuração e substabelecimento',
    'Redigir parecer sobre risco', 'Contatar correspondente na comarca',
    'Diligenciar certidão no cartório', 'Revisar contrato de honorários'];

  var CORES_AVATAR = ['#2d5580', '#b8873f', '#2f855a', '#c05621', '#8b5cf6',
                      '#0891b2', '#c53030', '#4f74a0'];

  /* Pastas de documentos: nomes de raiz e subpastas típicos de uma pasta física
     de escritório — é assim que o advogado já organiza o processo em papel. */
  var PASTAS_RAIZ = ['Petições', 'Documentos do cliente', 'Decisões e sentenças',
    'Provas e comprovantes', 'Perícia', 'Correspondências'];

  var SUBPASTAS = ['Recebidos', 'Protocolados', 'Rascunhos', 'Digitalizados'];

  // --- Helpers de geração ---------------------------------------------------
  function criarFabrica(rand) {
    function inteiro(min, max) {
      return Math.floor(rand() * (max - min + 1)) + min;
    }
    function escolher(lista) {
      return lista[Math.floor(rand() * lista.length)];
    }
    function talvez(probabilidade) {
      return rand() < probabilidade;
    }
    function embaralhar(lista) {
      var copia = lista.slice();
      for (var i = copia.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var tmp = copia[i]; copia[i] = copia[j]; copia[j] = tmp;
      }
      return copia;
    }
    return { inteiro: inteiro, escolher: escolher, talvez: talvez, embaralhar: embaralhar };
  }

  function iso(date) {
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + d;
  }

  function deslocar(base, dias) {
    var d = new Date(base.getTime());
    d.setDate(d.getDate() + dias);
    return d;
  }

  /** CPF sintético com dígitos verificadores corretos. */
  function gerarCPF(f) {
    var base = [];
    for (var i = 0; i < 9; i++) base.push(f.inteiro(0, 9));
    for (var t = 9; t < 11; t++) {
      var soma = 0;
      for (var k = 0; k < t; k++) soma += base[k] * ((t + 1) - k);
      base.push(((soma * 10) % 11) % 10);
    }
    return base.join('');
  }

  /** CNPJ sintético com dígitos verificadores corretos. */
  function gerarCNPJ(f) {
    var base = [];
    for (var i = 0; i < 8; i++) base.push(f.inteiro(0, 9));
    base = base.concat([0, 0, 0, 1]);

    function dv(nums) {
      var peso = nums.length - 7;
      var soma = 0;
      for (var i = 0; i < nums.length; i++) {
        soma += nums[i] * peso--;
        if (peso < 2) peso = 9;
      }
      var resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    }

    base.push(dv(base));
    base.push(dv(base));
    return base.join('');
  }

  // --- Geração --------------------------------------------------------------

  function gerar() {
    var cnj = App.domain.cnj;
    var prazos = App.domain.prazos;
    var enums = App.domain.enums;

    var rand = criarRandom(20240815);
    var f = criarFabrica(rand);

    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    var agora = new Date().toISOString();

    var id = 0;
    function proximoId(prefixo) {
      id++;
      return prefixo + '-' + String(id).padStart(5, '0');
    }

    function nomePessoa() {
      return f.escolher(NOMES) + ' ' + f.escolher(SOBRENOMES) + ' ' + f.escolher(SOBRENOMES);
    }

    // ----- Usuários ---------------------------------------------------------
    var usuariosBase = [
      // O administrador existe desde F2.1: sem ele, Configurações, Auditoria
      // e Privacidade seriam telas que ninguém consegue abrir.
      { nome: 'Helena Duarte Campos',      perfil: 'admin',      oab: '' },
      { nome: 'Ricardo Menezes Advogados', perfil: 'socio',      oab: '148522' },
      { nome: 'Cláudia Ferraz Lopes',      perfil: 'socio',      oab: '162310' },
      { nome: 'André Tavares Pinto',       perfil: 'advogado',   oab: '284917' },
      { nome: 'Patrícia Nogueira Reis',    perfil: 'advogado',   oab: '301244' },
      { nome: 'Marcos Vinícius Aguiar',    perfil: 'advogado',   oab: '327880' },
      { nome: 'Letícia Ramos Duarte',      perfil: 'advogado',   oab: '345190' },
      { nome: 'Gustavo Prado Lima',        perfil: 'estagiario', oab: '' },
      { nome: 'Simone Batista Cruz',       perfil: 'financeiro', oab: '' }
    ];

    var usuarios = usuariosBase.map(function (u, i) {
      var partesNome = u.nome.split(' ');
      return {
        id: proximoId('USR'),
        nome: u.nome,
        email: partesNome[0].toLowerCase() + '@escritorio.adv.br',
        oab: u.oab ? { numero: u.oab, uf: 'SP' } : null,
        perfil: u.perfil,
        iniciais: (partesNome[0][0] + partesNome[partesNome.length - 1][0]).toUpperCase(),
        cor: CORES_AVATAR[i % CORES_AVATAR.length],
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora
      };
    });

    var advogados = usuarios.filter(function (u) {
      return u.perfil === 'socio' || u.perfil === 'advogado';
    });

    // ----- Pessoas ----------------------------------------------------------
    var pessoas = [];

    function novaPessoa(ehCliente) {
      var pj = f.talvez(ehCliente ? 0.4 : 0.35);
      var cidade = f.escolher(CIDADES);
      var nome = pj
        ? f.escolher(EMPRESAS) + ' ' + f.escolher(SUFIXOS_PJ)
        : nomePessoa();

      var pessoa = {
        id: proximoId('PES'),
        tipo: pj ? 'PJ' : 'PF',
        nome: nome,
        nomeFantasia: pj ? nome.split(' ').slice(0, 2).join(' ') : '',
        documento: pj ? gerarCNPJ(f) : gerarCPF(f),
        rg: pj ? '' : String(f.inteiro(10000000, 49999999)),
        dataNascimento: pj ? null : iso(deslocar(hoje, -f.inteiro(8000, 22000))),
        email: (pj ? 'contato' : 'contato') + f.inteiro(10, 99) + '@exemplo.com.br',
        telefone: '11' + f.inteiro(30000000, 39999999),
        celular: '119' + f.inteiro(10000000, 99999999),
        endereco: {
          cep: String(f.inteiro(1000000, 9999999)).padStart(8, '0'),
          logradouro: f.escolher(LOGRADOUROS),
          numero: String(f.inteiro(10, 3200)),
          complemento: f.talvez(0.3) ? 'Conj. ' + f.inteiro(11, 220) : '',
          bairro: f.escolher(['Centro', 'Jardim América', 'Vila Nova', 'Bela Vista',
                              'Santa Cecília', 'Moema', 'Pinheiros']),
          cidade: cidade.nome,
          uf: cidade.uf
        },
        ehCliente: ehCliente,
        origem: ehCliente ? f.escolher(['Indicação', 'Site', 'Cliente antigo', 'Parceria']) : '',
        observacoes: '',
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora
      };

      pessoas.push(pessoa);
      return pessoa;
    }

    var clientes = [];
    for (var c = 0; c < 25; c++) clientes.push(novaPessoa(true));

    var contrarios = [];
    for (var k = 0; k < 40; k++) contrarios.push(novaPessoa(false));

    // ----- Processos --------------------------------------------------------
    var processos = [];
    var partesProcesso = [];
    var andamentos = [];
    var listaPrazos = [];
    var compromissos = [];
    var documentos = [];
    var pastasDocumento = [];

    var FASES = enums.FASES.map(function (x) { return x.id; });
    var AREAS = enums.AREAS.map(function (x) { return x.id; });

    // Distribuição de fases pensada para o kanban não ficar plano.
    var pesosFase = ['distribuicao', 'distribuicao', 'citacao', 'citacao', 'citacao',
      'instrucao', 'instrucao', 'instrucao', 'instrucao', 'instrucao',
      'sentenca', 'sentenca', 'recurso', 'recurso', 'execucao', 'arquivado'];

    for (var p = 0; p < 40; p++) {
      var area = f.escolher(AREAS);
      var fase = f.escolher(pesosFase);
      var cliente = f.escolher(clientes);
      var tribunal = f.escolher(
        area === 'trabalhista' ? enums.TRIBUNAIS.filter(function (t) { return t.segmento === 5; })
        : area === 'tributario' && f.talvez(0.4) ? enums.TRIBUNAIS.filter(function (t) { return t.segmento === 4; })
        : enums.TRIBUNAIS.filter(function (t) { return t.segmento === 8; })
      );

      var anoDist = f.inteiro(hoje.getFullYear() - 3, hoje.getFullYear());
      var diasAtras = f.inteiro(30, 1100);
      var dataDist = deslocar(hoje, -diasAtras);
      anoDist = dataDist.getFullYear();

      var numeroCnj = cnj.montar(
        f.inteiro(1, 9999999),
        anoDist,
        tribunal.segmento,
        tribunal.codigo,
        f.inteiro(1, 9999)
      );

      var papel = f.escolher(enums.PAPEIS_CLIENTE.slice(0, 2));
      var arquivadoOuEncerrado = fase === 'arquivado';

      var processo = {
        id: proximoId('PRO'),
        numeroCnj: numeroCnj,
        numeroInterno: 'ADV-' + anoDist + '-' + String(p + 1).padStart(4, '0'),
        tipo: 'judicial',
        clienteId: cliente.id,
        papelCliente: papel.id,
        areaId: area,
        classeProcessual: f.escolher(CLASSES),
        assunto: f.escolher(ASSUNTOS[area]),
        tribunalId: tribunal.id,
        comarca: f.escolher(CIDADES).nome,
        vara: f.escolher(VARAS),
        juiz: 'Dr(a). ' + nomePessoa(),
        instancia: fase === 'recurso' ? 2 : 1,
        faseId: fase,
        status: arquivadoOuEncerrado ? 'arquivado' : (f.talvez(0.08) ? 'suspenso' : 'ativo'),
        segredoJustica: f.talvez(0.08),
        dataDistribuicao: iso(dataDist),
        dataEncerramento: arquivadoOuEncerrado ? iso(deslocar(hoje, -f.inteiro(10, 200))) : null,
        valorCausa: f.inteiro(500, 250000) * 100,
        valorProvisao: null,
        risco: f.escolher(['provavel', 'possivel', 'possivel', 'remoto']),
        responsavelId: f.escolher(advogados).id,
        equipeIds: f.embaralhar(usuarios).slice(0, f.inteiro(1, 3)).map(function (u) { return u.id; }),
        processoPaiId: null,
        tags: f.talvez(0.3) ? [f.escolher(['prioritário', 'acordo em negociação', 'cliente estratégico'])] : [],
        descricao: '',
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora
      };

      processo.valorProvisao = processo.risco === 'provavel'
        ? Math.round(processo.valorCausa * (0.4 + rand() * 0.5))
        : processo.risco === 'possivel'
          ? Math.round(processo.valorCausa * (0.1 + rand() * 0.3))
          : 0;

      processos.push(processo);

      // ----- Partes ---------------------------------------------------------
      var poloCliente = papel.polo;
      partesProcesso.push({
        id: proximoId('PTE'),
        processoId: processo.id,
        pessoaId: cliente.id,
        polo: poloCliente,
        tipoParticipacao: papel.id === 'autor' ? 'autor' : 'reu',
        principal: true,
        ativo: true, criadoEm: agora, atualizadoEm: agora
      });

      var contrario = f.escolher(contrarios);
      partesProcesso.push({
        id: proximoId('PTE'),
        processoId: processo.id,
        pessoaId: contrario.id,
        polo: poloCliente === 'ativo' ? 'passivo' : 'ativo',
        tipoParticipacao: papel.id === 'autor' ? 'reu' : 'autor',
        principal: true,
        ativo: true, criadoEm: agora, atualizadoEm: agora
      });

      if (f.talvez(0.3)) {
        partesProcesso.push({
          id: proximoId('PTE'),
          processoId: processo.id,
          pessoaId: f.escolher(contrarios).id,
          polo: 'terceiro',
          tipoParticipacao: f.escolher(['testemunha', 'perito', 'assistente']),
          principal: false,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      }

      // ----- Andamentos -----------------------------------------------------
      var qtdAndamentos = f.inteiro(3, 9);
      var cursorData = new Date(dataDist.getTime());
      var passo = Math.max(3, Math.floor(diasAtras / (qtdAndamentos + 1)));

      andamentos.push({
        id: proximoId('AND'),
        processoId: processo.id,
        data: iso(dataDist),
        tipo: 'peticao',
        titulo: 'Petição inicial protocolada',
        descricao: 'Distribuída a ação perante a ' + processo.vara + ' da comarca de ' +
                   processo.comarca + '.',
        origem: 'manual',
        visivelCliente: true,
        autorId: processo.responsavelId,
        documentosIds: [],
        ativo: true, criadoEm: agora, atualizadoEm: agora
      });

      for (var a = 0; a < qtdAndamentos; a++) {
        cursorData = deslocar(cursorData, f.inteiro(Math.max(2, passo - 8), passo + 12));
        if (cursorData > hoje) break;

        var tipoAnd = f.escolher(['movimentacao', 'movimentacao', 'peticao', 'despacho',
                                  'decisao', 'publicacao', 'nota_interna']);
        andamentos.push({
          id: proximoId('AND'),
          processoId: processo.id,
          data: iso(cursorData),
          tipo: tipoAnd,
          titulo: f.escolher(TITULOS_ANDAMENTO[tipoAnd]),
          descricao: '',
          origem: tipoAnd === 'nota_interna' ? 'manual'
                  : f.talvez(0.6) ? 'tribunal' : 'publicacao',
          visivelCliente: tipoAnd !== 'nota_interna',
          autorId: f.escolher(usuarios).id,
          documentosIds: [],
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      }

      // ----- Documentos -----------------------------------------------------
      var qtdDocs = f.inteiro(0, 3);

      /* Pastas do processo: só faz sentido gerar quando há documento para
         guardar. Uma delas ganha subpasta, para o explorador nascer com
         hierarquia de verdade (e não só um nível). */
      var pastasDoProcesso = [];
      if (qtdDocs > 0) {
        var nomesRaiz = f.embaralhar(PASTAS_RAIZ).slice(0, f.inteiro(1, 3));
        nomesRaiz.forEach(function (nomePasta, indicePasta) {
          var pasta = {
            id: proximoId('PST'),
            processoId: processo.id,
            nome: nomePasta,
            paiId: null,
            criadoPorId: processo.responsavelId,
            ativo: true, criadoEm: agora, atualizadoEm: agora
          };
          pastasDocumento.push(pasta);
          pastasDoProcesso.push(pasta);

          if (indicePasta === 0 && f.talvez(0.5)) {
            var subpasta = {
              id: proximoId('PST'),
              processoId: processo.id,
              nome: f.escolher(SUBPASTAS),
              paiId: pasta.id,
              criadoPorId: processo.responsavelId,
              ativo: true, criadoEm: agora, atualizadoEm: agora
            };
            pastasDocumento.push(subpasta);
            pastasDoProcesso.push(subpasta);
          }
        });
      }

      for (var dcount = 0; dcount < qtdDocs; dcount++) {
        var categoria = f.escolher(enums.CATEGORIAS_DOCUMENTO);
        // Parte dos documentos fica na raiz — o explorador precisa mostrar
        // pastas e arquivos convivendo no mesmo nível.
        var pastaDoDoc = pastasDoProcesso.length && f.talvez(0.65)
          ? f.escolher(pastasDoProcesso) : null;

        documentos.push({
          id: proximoId('DOC'),
          processoId: processo.id,
          clienteId: cliente.id,
          pastaId: pastaDoDoc ? pastaDoDoc.id : null,
          nome: categoria.label.toLowerCase().replace(/\s+/g, '-') + '-' +
                processo.numeroInterno.toLowerCase() + '.pdf',
          categoria: categoria.id,
          extensao: 'pdf',
          tamanhoBytes: f.inteiro(40000, 5200000),
          versao: 1,
          documentoPaiId: null,
          uploadPorId: f.escolher(usuarios).id,
          uploadEm: iso(deslocar(dataDist, f.inteiro(0, Math.max(1, diasAtras - 1)))),
          visivelCliente: f.talvez(0.7),
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      }

      // ----- Compromissos ---------------------------------------------------
      if ((fase === 'instrucao' || fase === 'citacao') && f.talvez(0.55)) {
        var tipoComp = f.escolher(enums.TIPOS_COMPROMISSO);
        var quandoComp = deslocar(hoje, f.inteiro(-20, 45));
        var horaComp = f.inteiro(9, 17);
        compromissos.push({
          id: proximoId('CMP'),
          processoId: processo.id,
          tipo: tipoComp.id,
          titulo: tipoComp.label + ' — ' + processo.assunto,
          dataHora: iso(quandoComp) + 'T' + String(horaComp).padStart(2, '0') + ':' +
                    f.escolher(['00', '30']),
          duracaoMin: f.escolher([30, 60, 90, 120]),
          local: processo.vara + ' — Fórum de ' + processo.comarca,
          endereco: f.escolher(LOGRADOUROS) + ', ' + f.inteiro(100, 2000),
          participantesIds: [processo.responsavelId],
          responsavelId: processo.responsavelId,
          status: quandoComp < hoje ? 'realizado' : 'agendado',
          observacoes: '',
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      }
    }

    // ----- Prazos -----------------------------------------------------------
    // Espalhados de propósito entre vencidos, críticos, em atenção e no prazo,
    // para o semáforo e o dashboard terem o que mostrar.
    var processosAtivos = processos.filter(function (x) { return x.status !== 'arquivado'; });
    var offsets = [-42, -35, -30, -28, -26, -25, -24, -23, -22, -21, -20, -19, -18,
                   -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4,
                   -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
                   -33, -27, -19, -13, -8, -5, -2, 1, 4, 7, 10, 13, -45, -38];

    for (var pr = 0; pr < 60; pr++) {
      var proc = processosAtivos[pr % processosAtivos.length];
      var tipoPrazo = f.escolher(enums.TIPOS_PRAZO.filter(function (t) { return t.id !== 'custom'; }));
      var disponibilizacao = iso(deslocar(hoje, offsets[pr % offsets.length]));

      var calculo = prazos.calcular({
        dataDisponibilizacao: disponibilizacao,
        dias: tipoPrazo.dias,
        tipoContagem: tipoPrazo.contagem,
        diasAntecedencia: 3,
        dobro: f.talvez(0.1)
      });

      if (!calculo) continue;

      // Prazos antigos em geral já foram baixados. Uma fração fica em aberto
      // com a data fatal no passado — é o "vencido sem baixa", o caso que o
      // dashboard e a agenda precisam gritar. Sem ele o protótipo não mostra
      // o pior cenário real de um escritório. A fração é deliberadamente
      // generosa (nem toda maioria some em "cumprido") para o card "Vencidos
      // sem baixa" da agenda ter itens o bastante pra exercitar a rolagem
      // interna no dia a dia, não só num mês excepcionalmente ruim.
      var venceu = calculo.dataFatal < iso(hoje);
      var sorteio = rand();
      var status;

      if (venceu) {
        if (sorteio < 0.55) status = 'cumprido';
        else if (sorteio < 0.86) status = 'pendente';      // vencido sem baixa
        else status = 'perdido';
      } else {
        status = sorteio < 0.15 ? 'em_andamento' : 'pendente';
      }

      listaPrazos.push({
        id: proximoId('PRZ'),
        processoId: proc.id,
        titulo: tipoPrazo.label,
        tipoPrazoId: tipoPrazo.id,
        tipoContagem: calculo.tipoContagem,
        quantidadeDias: calculo.diasEfetivos,
        dataDisponibilizacao: calculo.dataDisponibilizacao,
        dataPublicacao: calculo.dataPublicacao,
        dataInicioContagem: calculo.dataInicioContagem,
        dataFatal: calculo.dataFatal,
        dataInterna: calculo.dataInterna,
        diasAntecedencia: calculo.diasAntecedencia,
        responsavelId: proc.responsavelId,
        prioridade: tipoPrazo.dias <= 5 ? 'alta' : f.escolher(['media', 'media', 'alta', 'baixa']),
        status: status,
        dataCumprimento: status === 'cumprido' ? calculo.dataFatal : null,
        observacoes: '',
        andamentoOrigemId: null,
        // F2.3: o portal do cliente mostra o prazo como "aguardando
        // manifestação até X". Nem todo prazo é do interesse do cliente —
        // parte é movimentação interna do escritório.
        visivelCliente: f.talvez(0.6),
        conferidoPorId: null,
        conferidoEm: null,
        cumpridoPorId: null,
        motivoPerda: null,
        ativo: true, criadoEm: agora, atualizadoEm: agora
      });
    }

    // ----- Tarefas ----------------------------------------------------------
    var tarefas = [];
    for (var t = 0; t < 35; t++) {
      var procTarefa = f.escolher(processosAtivos);
      var statusTarefa = f.escolher(['a_fazer', 'a_fazer', 'em_andamento', 'em_andamento',
                                     'em_revisao', 'concluida', 'concluida']);
      var venc = deslocar(hoje, f.inteiro(-10, 30));

      var checklistSize = f.talvez(0.4) ? f.inteiro(2, 4) : 0;
      var checklist = [];
      for (var ci = 0; ci < checklistSize; ci++) {
        checklist.push({
          texto: f.escolher(['Reunir documentos', 'Conferir prazo', 'Revisar texto',
                             'Validar com o sócio', 'Protocolar']),
          feito: statusTarefa === 'concluida' ? true : f.talvez(0.4)
        });
      }

      tarefas.push({
        id: proximoId('TRF'),
        titulo: f.escolher(TITULOS_TAREFA),
        descricao: '',
        processoId: procTarefa.id,
        clienteId: procTarefa.clienteId,
        responsavelId: f.escolher(advogados).id,
        criadorId: f.escolher(advogados).id,
        status: statusTarefa,
        prioridade: f.escolher(['baixa', 'media', 'media', 'alta', 'critica']),
        dataVencimento: iso(venc),
        checklist: checklist,
        concluidoEm: statusTarefa === 'concluida' ? iso(deslocar(hoje, -f.inteiro(1, 15))) : null,
        ativo: true, criadoEm: agora, atualizadoEm: agora
      });
    }

    // ----- Publicações do diário (F2.4) -------------------------------------
    /* Textos no formato do DJe: cabeçalho de vara, número CNJ, partes,
       advogados com OAB e o corpo do ato. É por eles que o classificador é
       exercitado de verdade — texto genérico faria a triagem parecer mais
       fácil do que é. */
    var MODELOS_PUBLICACAO = [
      { tipo: 'contestacao', texto:
        'Fica a parte requerida CITADA para, querendo, apresentar contestação no prazo ' +
        'de 15 (quinze) dias úteis, sob pena de revelia e confissão quanto à matéria de ' +
        'fato, nos termos do art. 344 do CPC. Intime-se.' },

      { tipo: 'manifestacao', texto:
        'Manifeste-se a parte autora, no prazo de 5 (cinco) dias, sobre o laudo pericial ' +
        'juntado aos autos. Após, tornem conclusos para deliberação.' },

      { tipo: 'recurso_ape', texto:
        'Publicada a sentença de improcedência. Intimadas as partes, fluindo o prazo de ' +
        '15 (quinze) dias úteis para eventual interposição de recurso de apelação.' },

      { tipo: 'embargos', texto:
        'Intimadas as partes do acórdão, com prazo de 5 (cinco) dias para embargos de ' +
        'declaração, caso haja omissão, contradição ou obscuridade a sanar.' },

      { tipo: 'reptreplica', texto:
        'Intime-se a parte autora para apresentar réplica à contestação no prazo de ' +
        '15 (quinze) dias úteis.' },

      { tipo: 'cumprimento', texto:
        'Intimado o executado para cumprimento voluntário da obrigação no prazo de ' +
        '15 (quinze) dias, sob pena de multa de 10% e honorários, nos termos do ' +
        'art. 523 do CPC.' },

      { tipo: 'contrarrazoes', texto:
        'Intimada a parte apelada para apresentar contrarrazões ao recurso de apelação ' +
        'no prazo de 15 (quinze) dias úteis.' },

      { tipo: 'alegacoes', texto:
        'Encerrada a instrução, ficam as partes intimadas para apresentar alegações ' +
        'finais por memoriais, no prazo sucessivo de 15 (quinze) dias.' },

      { tipo: 'agravo', texto:
        'Intimadas as partes da decisão interlocutória de fls., com prazo de 15 (quinze) ' +
        'dias úteis para eventual agravo de instrumento.' },

      // Sem prazo: o classificador precisa saber reconhecer também o que
      // NÃO exige ato — publicação de expediente é a maior parte do diário.
      { tipo: null, texto:
        'Ciência às partes do desarquivamento dos autos. Cumpra-se, publique-se. ' +
        'Trata-se de despacho de mero expediente, sem prazo a ser observado.' },

      { tipo: null, texto:
        'Homologo por sentença, para que produza seus efeitos jurídicos e legais, o ' +
        'acordo entabulado entre as partes. Transitado em julgado, arquivem-se os autos.' }
    ];

    var CADERNOS = ['Caderno 1 — Capital', 'Caderno 2 — Interior',
                    'Caderno 3 — Judicial', 'Caderno Eletrônico'];

    var publicacoes = [];
    var processosParaPublicar = f.embaralhar(processosAtivos).slice(0, 22);

    processosParaPublicar.forEach(function (proc, indice) {
      var modelo = MODELOS_PUBLICACAO[indice % MODELOS_PUBLICACAO.length];
      var advogado = usuarios.filter(function (u) {
        return u.id === proc.responsavelId;
      })[0] || advogados[0];

      var cliente = pessoas.filter(function (pp) { return pp.id === proc.clienteId; })[0];
      var tribunal = App.domain.enums.achar(App.domain.enums.TRIBUNAIS, proc.tribunalId);

      // Disponibilização recente: a fila de triagem precisa estar viva.
      var disponibilizacao = deslocar(hoje, -f.inteiro(0, 12));

      var texto =
        proc.vara + ' da Comarca de ' + proc.comarca + '\n' +
        'Processo n. ' + proc.numeroCnj + ' — ' + proc.classeProcessual + '\n' +
        'Requerente: ' + (cliente ? cliente.nome.toUpperCase() : 'AUTOR') + '\n' +
        'Advogado: ' + advogado.nome + ' - OAB/' +
          (advogado.oab ? advogado.oab.uf + ' ' + advogado.oab.numero : 'SP 000000') + '\n\n' +
        modelo.texto;

      /* Uma parte da fila já nasce triada e outra descartada: uma fila em
         que tudo está pendente não mostra como a tela se comporta depois
         do trabalho feito. */
      var situacao = indice < 12 ? 'nova'
                   : indice < 18 ? 'triada'
                   : 'descartada';

      publicacoes.push({
        id: proximoId('PUB'),
        tribunalId: proc.tribunalId,
        diario: tribunal ? 'DJe ' + tribunal.label : 'DJe',
        caderno: f.escolher(CADERNOS),
        pagina: f.inteiro(120, 4800),
        dataDisponibilizacao: iso(disponibilizacao),
        textoIntegral: texto,
        numeroCnjDetectado: proc.numeroCnj,
        processoId: situacao === 'nova' ? null : proc.id,
        monitoramentoId: null,
        status: situacao,
        prazoGeradoId: null,
        andamentoGeradoId: null,
        triadaPorId: situacao === 'nova' ? null : advogado.id,
        triadaEm: situacao === 'nova' ? null : agora,
        hashConteudo: App.token.hashLongo(texto),
        ativo: true, criadoEm: agora, atualizadoEm: agora
      });
    });

    // ----- Monitoramentos (F2.4) --------------------------------------------
    /* Um por advogado com OAB: é assim que escritório se cadastra no
       serviço de recorte — pela OAB de quem assina as peças. */
    var monitoramentos = advogados
      .filter(function (u) { return u.oab && u.oab.numero; })
      .map(function (u) {
        return {
          id: proximoId('MON'),
          tipo: 'oab',
          valor: u.oab.numero,
          uf: u.oab.uf,
          tribunais: ['tjsp', 'trt2', 'trf3'],
          usuarioId: u.id,
          ultimaSincronizacaoEm: null,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        };
      });

    // ----- Financeiro (F2.5) ------------------------------------------------
    /* Contratos para ~60% dos processos e 18 meses de lançamentos. A
       inadimplência é deliberada e proporcional à realidade: sem título
       atrasado, o aging e o indicador de inadimplência nasceriam zerados e
       as telas do módulo não teriam o que mostrar. */
    var contratos = [];
    var lancamentos = [];
    var boletos = [];
    var repasses = [];
    var apontamentos = [];

    var VALORES_HORA = [18000, 25000, 32000, 45000];
    var MODALIDADES = ['fixo', 'fixo', 'exito', 'misto', 'hora', 'mensal'];

    function competencia(data) { return iso(data).slice(0, 7); }

    function diaUtil(data) {
      return iso(App.domain.prazos.diaUtilOuSeguinte(iso(data)));
    }

    var processosComContrato = f.embaralhar(processos).slice(0, Math.round(processos.length * 0.6));

    processosComContrato.forEach(function (proc, indice) {
      var modalidade = MODALIDADES[indice % MODALIDADES.length];
      var valorHora = f.escolher(VALORES_HORA);

      // Honorário proporcional ao valor da causa, com piso — causa pequena
      // não significa trabalho pequeno.
      var valorFixo = Math.max(250000, Math.round((proc.valorCausa || 0) * 0.08));
      var parcelas = f.escolher([1, 3, 6, 12]);
      var inicio = deslocar(hoje, -f.inteiro(30, 540));   // até 18 meses atrás

      var contrato = {
        id: proximoId('CTR'),
        clienteId: proc.clienteId,
        processoId: proc.id,
        modalidade: modalidade,
        descricao: 'Honorários — ' + proc.assunto,
        valorFixoCentavos: (modalidade === 'exito' || modalidade === 'hora') ? 0 : valorFixo,
        percentualExito: (modalidade === 'exito' || modalidade === 'misto')
          ? f.escolher([10, 15, 20, 30]) : 0,
        valorHoraCentavos: (modalidade === 'hora') ? valorHora : 0,
        valorMensalCentavos: (modalidade === 'mensal') ? f.escolher([150000, 250000, 400000]) : 0,
        numParcelas: (modalidade === 'exito' || modalidade === 'hora') ? 1 : parcelas,
        diaVencimento: f.escolher([5, 10, 15, 20]),
        dataInicio: iso(inicio),
        dataFim: null,
        status: 'ativo',
        ativo: true, criadoEm: agora, atualizadoEm: agora
      };
      contratos.push(contrato);

      // Parcelas do contrato, pelas mesmas funções puras que o service usa.
      if (contrato.valorFixoCentavos > 0) {
        App.domain.financeiro.gerarParcelas(contrato).forEach(function (p, iParcela) {
          var vencida = p.dataVencimento < iso(hoje);
          /* 78% dos vencidos pagam. O restante é a inadimplência que faz o
             aging existir — e uma parte dela é antiga de propósito, para as
             faixas de 60 e 90 dias não ficarem vazias. */
          var pagou = vencida ? f.talvez(0.78) : false;
          var atraso = pagou ? f.inteiro(-3, 12) : 0;

          lancamentos.push({
            id: proximoId('LAN'),
            tipo: 'receita',
            origem: 'honorario',
            contratoId: contrato.id,
            processoId: proc.id,
            clienteId: proc.clienteId,
            descricao: 'Honorários ' + p.numero + '/' + p.de + ' — ' + proc.numeroInterno,
            valorCentavos: p.valorCentavos,
            valorPagoCentavos: pagou ? p.valorCentavos : 0,
            dataCompetencia: p.dataCompetencia,
            dataVencimento: p.dataVencimento,
            dataPagamento: pagou
              ? iso(deslocar(App.format.parseISO(p.dataVencimento), atraso))
              : null,
            status: pagou ? 'pago' : (vencida ? 'em_aberto' : 'previsto'),
            formaPagamento: pagou ? f.escolher(['pix', 'boleto', 'transferencia']) : null,
            reembolsavel: false,
            comprovanteDocumentoId: null,
            boletoId: null,
            parcela: { n: p.numero, de: p.de },
            ativo: true, criadoEm: agora, atualizadoEm: agora
          });
        });
      }

      // Custas e despesas reembolsáveis — todo processo tem.
      var quantasDespesas = f.inteiro(1, 4);
      for (var idx = 0; idx < quantasDespesas; idx++) {
        var dataDespesa = deslocar(inicio, f.inteiro(0, 400));
        if (dataDespesa > hoje) dataDespesa = deslocar(hoje, -f.inteiro(1, 60));

        lancamentos.push({
          id: proximoId('LAN'),
          tipo: 'despesa',
          origem: f.escolher(['custa', 'custa', 'reembolso']),
          contratoId: contrato.id,
          processoId: proc.id,
          clienteId: proc.clienteId,
          descricao: f.escolher(['Custas iniciais', 'Guia de preparo', 'Diligência de oficial',
                                 'Cópias e autenticações', 'Honorários periciais',
                                 'Deslocamento para audiência']),
          valorCentavos: f.inteiro(8000, 180000),
          valorPagoCentavos: 0,
          dataCompetencia: competencia(dataDespesa),
          dataVencimento: diaUtil(dataDespesa),
          dataPagamento: iso(dataDespesa),
          status: 'pago',
          formaPagamento: 'transferencia',
          reembolsavel: f.talvez(0.6),
          comprovanteDocumentoId: null,
          boletoId: null,
          parcela: null,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
        // A despesa paga registra o valor de fato desembolsado.
        lancamentos[lancamentos.length - 1].valorPagoCentavos =
          lancamentos[lancamentos.length - 1].valorCentavos;
      }

      // Apontamentos de hora — em todo processo, faturáveis ou não.
      var quantasHoras = f.inteiro(2, 9);
      for (var ih = 0; ih < quantasHoras; ih++) {
        var dataHora = deslocar(hoje, -f.inteiro(0, 180));
        apontamentos.push({
          id: proximoId('APT'),
          processoId: proc.id,
          tarefaId: null,
          usuarioId: f.escolher(advogados).id,
          data: iso(dataHora),
          minutos: f.escolher([30, 45, 60, 90, 120, 180, 240]),
          descricao: f.escolher(['Análise de documentos', 'Elaboração de peça',
                                 'Reunião com cliente', 'Audiência', 'Pesquisa de jurisprudência',
                                 'Despacho com o juiz', 'Diligência']),
          faturavel: f.talvez(0.75),
          valorHoraCentavos: valorHora,
          lancamentoId: null,
          aprovadoPorId: null,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      }
    });

    // Despesas do escritório — não pertencem a processo nenhum.
    var DESPESAS_FIXAS = [
      { nome: 'Aluguel do escritório', valor: 850000 },
      { nome: 'Folha de pagamento', valor: 4200000 },
      { nome: 'Software jurídico', valor: 89000 },
      { nome: 'Contabilidade', valor: 180000 },
      { nome: 'Energia e internet', valor: 120000 }
    ];

    for (var mes = 17; mes >= 0; mes--) {
      var refMes = new Date(hoje.getFullYear(), hoje.getMonth() - mes, 10);
      DESPESAS_FIXAS.forEach(function (d) {
        var jaVenceu = refMes <= hoje;
        lancamentos.push({
          id: proximoId('LAN'),
          tipo: 'despesa',
          origem: 'despesa_escritorio',
          contratoId: null, processoId: null, clienteId: null,
          descricao: d.nome,
          valorCentavos: d.valor + f.inteiro(-20000, 20000),
          valorPagoCentavos: 0,
          dataCompetencia: competencia(refMes),
          dataVencimento: diaUtil(refMes),
          dataPagamento: jaVenceu ? iso(refMes) : null,
          status: jaVenceu ? 'pago' : 'previsto',
          formaPagamento: jaVenceu ? 'transferencia' : null,
          reembolsavel: false,
          comprovanteDocumentoId: null, boletoId: null, parcela: null,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
        var ultimo = lancamentos[lancamentos.length - 1];
        if (jaVenceu) ultimo.valorPagoCentavos = ultimo.valorCentavos;
      });
    }

    // Repasses a correspondentes sobre parte das receitas já pagas.
    var receitasPagas = lancamentos.filter(function (l) {
      return l.tipo === 'receita' && l.status === 'pago';
    });
    f.embaralhar(receitasPagas).slice(0, Math.min(12, receitasPagas.length))
      .forEach(function (receita) {
        var percentual = f.escolher([10, 15, 20]);
        var valorRepasse = Math.round(receita.valorCentavos * percentual / 100);
        var repasseId = proximoId('REP');
        var lancamentoId = proximoId('LAN');

        repasses.push({
          id: repasseId,
          lancamentoOrigemId: receita.id,
          lancamentoId: lancamentoId,
          beneficiarioId: f.escolher(usuarios).id,
          tipo: f.escolher(['correspondente', 'parceiro', 'socio']),
          percentual: percentual,
          valorCentavos: valorRepasse,
          dataPrevista: receita.dataVencimento,
          dataPagamento: receita.dataPagamento,
          status: 'pago',
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });

        lancamentos.push({
          id: lancamentoId,
          tipo: 'despesa',
          origem: 'repasse',
          contratoId: receita.contratoId,
          processoId: receita.processoId,
          clienteId: null,
          descricao: 'Repasse — ' + receita.descricao,
          valorCentavos: valorRepasse,
          valorPagoCentavos: valorRepasse,
          dataCompetencia: receita.dataCompetencia,
          dataVencimento: receita.dataVencimento,
          dataPagamento: receita.dataPagamento,
          status: 'pago',
          formaPagamento: 'transferencia',
          reembolsavel: false,
          comprovanteDocumentoId: null, boletoId: null,
          repasseId: repasseId, parcela: null,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      });

    // ----- CRM e prospecção (F2.6) ------------------------------------------
    /* 30 leads espalhados pelo funil. A distribuição é deliberadamente
       afunilada — muitos "novo", poucos "negociação" —, senão o quadro
       pareceria um retângulo e a taxa de conversão não teria sentido. */
    var leads = [];
    var interacoes = [];
    var propostas = [];

    var DISTRIBUICAO_FUNIL = [
      'novo', 'novo', 'novo', 'novo', 'novo', 'novo', 'novo',
      'contato', 'contato', 'contato', 'contato', 'contato',
      'reuniao', 'reuniao', 'reuniao', 'reuniao',
      'proposta', 'proposta', 'proposta',
      'negociacao', 'negociacao',
      'ganho', 'ganho', 'ganho', 'ganho', 'ganho',
      'perdido', 'perdido', 'perdido', 'perdido'
    ];

    var MOTIVOS_PERDA = [
      'Cliente achou o honorário alto.',
      'Contratou outro escritório.',
      'Desistiu de ajuizar a ação.',
      'Não retornou os contatos.',
      'Caso fora da área de atuação.'
    ];

    var RESUMOS_CASO = [
      'Demissão sem justa causa com verbas em aberto',
      'Cobrança indevida em fatura de cartão',
      'Rescisão de contrato de prestação de serviços',
      'Inventário com quatro herdeiros',
      'Ação de alimentos',
      'Negativação indevida no SPC',
      'Execução fiscal de ICMS',
      'Acidente de trânsito com danos materiais',
      'Revisão de aposentadoria',
      'Disputa societária entre dois sócios'
    ];

    var PROXIMOS_PASSOS = [
      'Enviar minuta da procuração', 'Agendar reunião presencial',
      'Levantar documentos com o cliente', 'Retornar ligação',
      'Preparar proposta de honorários'
    ];

    for (var iLead = 0; iLead < DISTRIBUICAO_FUNIL.length; iLead++) {
      var etapaLead = DISTRIBUICAO_FUNIL[iLead];
      var encerrado = etapaLead === 'ganho' || etapaLead === 'perdido';
      var criadoEmLead = deslocar(hoje, -f.inteiro(3, 180));
      var responsavelLead = f.escolher(advogados);

      /* Cerca de um terço dos leads em andamento fica com follow-up
         vencido: é o que faz o alerta de F2.6 disparar e a fila ter o que
         mostrar. */
      var proximoContato = encerrado ? null
        : iso(deslocar(hoje, f.talvez(0.35) ? -f.inteiro(1, 20) : f.inteiro(1, 25)));

      var nomeLead = f.talvez(0.4)
        ? f.escolher(EMPRESAS) + ' ' + f.escolher(SUFIXOS_PJ)
        : f.escolher(NOMES) + ' ' + f.escolher(SOBRENOMES);

      var leadId = proximoId('LED');

      leads.push({
        id: leadId,
        nome: nomeLead,
        pessoaId: null,
        contato: {
          telefone: '11' + f.inteiro(900000000, 999999999),
          email: nomeLead.toLowerCase().replace(/[^a-z]+/g, '.').slice(0, 20) + '@exemplo.com'
        },
        origem: f.escolher(['indicacao', 'indicacao', 'site', 'redes', 'evento', 'retorno']),
        indicadoPorId: null,
        areaId: f.escolher(App.domain.enums.AREAS).id,
        resumoCaso: f.escolher(RESUMOS_CASO),
        etapa: etapaLead,
        valorEstimadoCentavos: f.inteiro(300000, 8000000),
        probabilidade: null,
        responsavelId: responsavelLead.id,
        proximoContatoEm: proximoContato,
        motivoPerda: etapaLead === 'perdido' ? f.escolher(MOTIVOS_PERDA) : null,
        convertidoEm: etapaLead === 'ganho' ? iso(deslocar(hoje, -f.inteiro(1, 60))) : null,
        ativo: true, criadoEm: agora, atualizadoEm: agora
      });

      // Interações: quanto mais avançada a etapa, mais conversa houve.
      var quantasInteracoes = etapaLead === 'novo' ? f.inteiro(0, 1)
                            : etapaLead === 'contato' ? f.inteiro(1, 3)
                            : f.inteiro(2, 6);

      for (var iInt = 0; iInt < quantasInteracoes; iInt++) {
        var quandoInt = deslocar(criadoEmLead, f.inteiro(0, 60));
        if (quandoInt > hoje) quandoInt = hoje;

        interacoes.push({
          id: proximoId('INT'),
          leadId: leadId,
          pessoaId: null,
          processoId: null,
          tipo: f.escolher(['ligacao', 'ligacao', 'email', 'reuniao', 'whatsapp', 'visita']),
          quando: iso(quandoInt) + 'T' + String(f.inteiro(8, 18)).padStart(2, '0') + ':' +
                  f.escolher(['00', '15', '30', '45']),
          duracaoMin: f.escolher([5, 10, 15, 30, 45, 60]),
          resumo: f.escolher([
            'Cliente explicou a situação e enviou documentos por e-mail.',
            'Retornei a ligação; ficou de confirmar os valores.',
            'Reunião para entender o caso e alinhar expectativas.',
            'Enviei a relação de documentos necessários.',
            'Cliente pediu prazo para decidir.',
            'Conversamos sobre a forma de pagamento dos honorários.'
          ]),
          usuarioId: responsavelLead.id,
          proximoPasso: f.talvez(0.5) ? f.escolher(PROXIMOS_PASSOS) : null,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      }

      // Propostas para quem já chegou à etapa de proposta.
      var chegouNaProposta = ['proposta', 'negociacao', 'ganho', 'perdido']
        .indexOf(etapaLead) !== -1;

      if (chegouNaProposta && f.talvez(0.8)) {
        var enviadaEm = deslocar(criadoEmLead, f.inteiro(5, 40));
        if (enviadaEm > hoje) enviadaEm = deslocar(hoje, -f.inteiro(1, 10));

        var statusProposta = etapaLead === 'ganho' ? 'aceita'
                           : etapaLead === 'perdido' ? 'recusada'
                           : 'enviada';

        var valorProposta = leads[leads.length - 1].valorEstimadoCentavos;
        var modalidadeProposta = f.escolher(['fixo', 'fixo', 'exito', 'misto']);

        propostas.push({
          id: proximoId('PRP'),
          leadId: leadId,
          numero: String(propostas.length + 1).padStart(3, '0') + '/' + hoje.getFullYear(),
          dataEnvio: iso(enviadaEm),
          // Parte das propostas enviadas já venceu — é o que exercita a
          // expiração calculada na leitura.
          validadeAte: iso(deslocar(enviadaEm, f.escolher([10, 15, 30, 45]))),
          escopo: leads[leads.length - 1].resumoCaso,
          honorarios: {
            modalidade: modalidadeProposta,
            valorFixoCentavos: modalidadeProposta === 'exito' ? 0 : Math.round(valorProposta * 0.12),
            percentualExito: (modalidadeProposta === 'exito' || modalidadeProposta === 'misto')
              ? f.escolher([10, 15, 20, 30]) : 0,
            valorHoraCentavos: 0,
            numParcelas: f.escolher([1, 3, 6])
          },
          status: statusProposta,
          documentoId: null,
          motivoRecusa: statusProposta === 'recusada'
            ? leads[leads.length - 1].motivoPerda : null,
          ativo: true, criadoEm: agora, atualizadoEm: agora
        });
      }
    }

    // ----- Modelos de peça (F2.7) -------------------------------------------
    /* Os modelos usam as MESMAS variáveis do catálogo de `domain/modelos.js`.
       Um modelo com variável inventada seria pior que modelo nenhum: o campo
       nunca resolveria e o advogado descobriria no protocolo. */
    var MODELOS_BASE = [
      { nome: 'Procuração ad judicia', tipo: 'procuracao', categoria: 'procuracao',
        areaId: null, html:
        '<h1>PROCURAÇÃO AD JUDICIA ET EXTRA</h1>' +
        '<p><strong>OUTORGANTE:</strong> {{cliente.nome}}, inscrito(a) no CPF/CNPJ sob o ' +
        'n. {{cliente.cpfCnpj}}, residente e domiciliado(a) em {{cliente.endereco}}.</p>' +
        '<p><strong>OUTORGADO:</strong> {{advogado.nome}}, advogado(a) inscrito(a) na ' +
        '{{advogado.oab}}, integrante de {{escritorio.nome}}.</p>' +
        '<p><strong>PODERES:</strong> os da cláusula ad judicia et extra, para o foro em ' +
        'geral, podendo propor e acompanhar a presente demanda, receber citação, confessar, ' +
        'reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre ' +
        'o qual se funda a ação, receber, dar quitação e firmar compromisso.</p>' +
        '<p>{{processo.comarca}}, {{data.extenso}}.</p>' +
        '<p style="margin-top:3em">_______________________________<br>{{cliente.nome}}</p>' },

      { nome: 'Contrato de honorários — valor fixo', tipo: 'contrato', categoria: 'contrato',
        areaId: null, html:
        '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1>' +
        '<p><strong>CONTRATANTE:</strong> {{cliente.nome}}, CPF/CNPJ {{cliente.cpfCnpj}}.</p>' +
        '<p><strong>CONTRATADO:</strong> {{escritorio.nome}}, por {{advogado.nome}}, ' +
        '{{advogado.oab}}.</p>' +
        '<h2>Cláusula 1ª — Do objeto</h2>' +
        '<p>Prestação de serviços advocatícios em {{processo.assunto}}, perante a ' +
        '{{processo.vara}} da comarca de {{processo.comarca}}.</p>' +
        '<h2>Cláusula 2ª — Dos honorários</h2>' +
        '<p>Os honorários são fixados em {{honorarios.valor}} ' +
        '({{honorarios.extenso}}).</p>' +
        '<h2>Cláusula 3ª — Das despesas</h2>' +
        '<p>Custas, diligências e demais despesas processuais correm por conta do ' +
        'CONTRATANTE, mediante prestação de contas.</p>' +
        '<p>{{processo.comarca}}, {{data.extenso}}.</p>' },

      { nome: 'Petição inicial — cobrança', tipo: 'peticao', categoria: 'inicial',
        areaId: 'civel', html:
        '<p>EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {{processo.vara|maiuscula}} DA ' +
        'COMARCA DE {{processo.comarca|maiuscula}}</p>' +
        '<p style="margin-top:2em">{{cliente.nome|maiuscula}}, inscrito(a) no CPF/CNPJ sob ' +
        'o n. {{cliente.cpfCnpj}}, por seu advogado que esta subscreve ({{advogado.oab}}), ' +
        'vem respeitosamente à presença de Vossa Excelência propor</p>' +
        '<h1>AÇÃO DE COBRANÇA</h1>' +
        '<p>em face de {{parte.contraria|maiuscula}}, pelos fatos e fundamentos a seguir.</p>' +
        '<h2>I — DOS FATOS</h2>' +
        '<p>[descrever os fatos]</p>' +
        '<h2>II — DO DIREITO</h2>' +
        '<p>[fundamentação]</p>' +
        '<h2>III — DOS PEDIDOS</h2>' +
        '<p>Requer a citação da parte ré e, ao final, a procedência do pedido.</p>' +
        '<p>Dá-se à causa o valor de {{processo.valorCausa}}.</p>' +
        '<p>{{processo.comarca}}, {{data.hoje}}.</p>' +
        '<p>{{advogado.nome}}<br>{{advogado.oab}}</p>' },

      { nome: 'Contestação', tipo: 'peticao', categoria: 'contestacao',
        areaId: 'civel', html:
        '<p>EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {{processo.vara|maiuscula}}</p>' +
        '<p style="margin-top:2em">Processo n. {{processo.numeroCnj}}</p>' +
        '<p>{{cliente.nome|maiuscula}}, já qualificado(a) nos autos, vem apresentar</p>' +
        '<h1>CONTESTAÇÃO</h1>' +
        '<p>à ação que lhe move {{parte.contraria|maiuscula}}, pelas razões a seguir.</p>' +
        '<h2>I — DAS PRELIMINARES</h2><p>[preliminares]</p>' +
        '<h2>II — DO MÉRITO</h2><p>[mérito]</p>' +
        '<h2>III — DOS PEDIDOS</h2>' +
        '<p>Requer a improcedência total dos pedidos.</p>' +
        '<p>{{processo.comarca}}, {{data.hoje}}.</p>' +
        '<p>{{advogado.nome}} — {{advogado.oab}}</p>' },

      { nome: 'Recurso de apelação', tipo: 'peticao', categoria: 'recurso',
        areaId: null, html:
        '<p>EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {{processo.vara|maiuscula}}</p>' +
        '<p style="margin-top:2em">Processo n. {{processo.numeroCnj}}</p>' +
        '<p>{{cliente.nome|maiuscula}}, inconformado(a) com a r. sentença, vem interpor</p>' +
        '<h1>RECURSO DE APELAÇÃO</h1>' +
        '<p>requerendo o recebimento e a remessa ao {{processo.tribunal}}.</p>' +
        '<h2>RAZÕES DE APELAÇÃO</h2><p>[razões]</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Embargos de declaração', tipo: 'peticao', categoria: 'recurso',
        areaId: null, html:
        '<p>Processo n. {{processo.numeroCnj}} — {{processo.vara}}</p>' +
        '<h1>EMBARGOS DE DECLARAÇÃO</h1>' +
        '<p>{{cliente.nome|maiuscula}} vem opor embargos de declaração, apontando ' +
        '[omissão / contradição / obscuridade] na decisão de fls.</p>' +
        '<p>Requer o acolhimento com efeitos infringentes.</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Réplica', tipo: 'peticao', categoria: 'outro', areaId: 'civel', html:
        '<p>Processo n. {{processo.numeroCnj}}</p>' +
        '<h1>RÉPLICA</h1>' +
        '<p>{{cliente.nome|maiuscula}} vem impugnar a contestação apresentada por ' +
        '{{parte.contraria|maiuscula}}, reiterando os termos da inicial.</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Reclamação trabalhista', tipo: 'peticao', categoria: 'inicial',
        areaId: 'trabalhista', html:
        '<p>EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DO TRABALHO DA {{processo.vara|maiuscula}} ' +
        'DE {{processo.comarca|maiuscula}}</p>' +
        '<p style="margin-top:2em">{{cliente.nome|maiuscula}}, CPF {{cliente.cpfCnpj}}, ' +
        'vem propor</p>' +
        '<h1>RECLAMAÇÃO TRABALHISTA</h1>' +
        '<p>em face de {{parte.contraria|maiuscula}}.</p>' +
        '<h2>DOS FATOS</h2><p>[período do contrato, função e salário]</p>' +
        '<h2>DOS PEDIDOS</h2><p>[verbas postuladas]</p>' +
        '<p>Valor da causa: {{processo.valorCausa}}.</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Alegações finais por memoriais', tipo: 'peticao', categoria: 'outro',
        areaId: null, html:
        '<p>Processo n. {{processo.numeroCnj}} — {{processo.vara}}</p>' +
        '<h1>ALEGAÇÕES FINAIS</h1>' +
        '<p>{{cliente.nome|maiuscula}} apresenta suas alegações finais por memoriais.</p>' +
        '<h2>DA PROVA PRODUZIDA</h2><p>[síntese]</p>' +
        '<h2>DO PEDIDO</h2><p>[pedido final]</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Notificação extrajudicial', tipo: 'notificacao', categoria: 'outro',
        areaId: null, html:
        '<h1>NOTIFICAÇÃO EXTRAJUDICIAL</h1>' +
        '<p><strong>De:</strong> {{cliente.nome}}, CPF/CNPJ {{cliente.cpfCnpj}}<br>' +
        '<strong>Para:</strong> {{parte.contraria}}</p>' +
        '<p>Por meio desta, o(a) notificante vem constituir o(a) notificado(a) em mora, ' +
        'concedendo o prazo de [X] dias para regularização, sob pena das medidas judiciais ' +
        'cabíveis.</p>' +
        '<p>{{data.extenso}}</p>' +
        '<p>{{advogado.nome}} — {{advogado.oab}}</p>' },

      { nome: 'Petição de juntada', tipo: 'peticao', categoria: 'outro', areaId: null, html:
        '<p>Processo n. {{processo.numeroCnj}} — {{processo.vara}}</p>' +
        '<h1>PETIÇÃO DE JUNTADA</h1>' +
        '<p>{{cliente.nome|maiuscula}} requer a juntada dos documentos anexos.</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Manifestação sobre laudo pericial', tipo: 'peticao', categoria: 'outro',
        areaId: null, html:
        '<p>Processo n. {{processo.numeroCnj}}</p>' +
        '<h1>MANIFESTAÇÃO SOBRE O LAUDO</h1>' +
        '<p>{{cliente.nome|maiuscula}} vem manifestar-se sobre o laudo pericial ' +
        'apresentado nos autos.</p>' +
        '<p>[concordância ou impugnação fundamentada]</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Impugnação ao cumprimento de sentença', tipo: 'peticao',
        categoria: 'outro', areaId: 'civel', html:
        '<p>Processo n. {{processo.numeroCnj}}</p>' +
        '<h1>IMPUGNAÇÃO AO CUMPRIMENTO DE SENTENÇA</h1>' +
        '<p>{{cliente.nome|maiuscula}} apresenta impugnação, nos termos do art. 525 do ' +
        'CPC, apontando excesso de execução.</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' },

      { nome: 'Proposta de honorários', tipo: 'proposta', categoria: 'outro',
        areaId: null, html:
        '<h1>PROPOSTA DE HONORÁRIOS</h1>' +
        '<p><strong>Interessado:</strong> {{cliente.nome}}</p>' +
        '<p><strong>Objeto:</strong> {{processo.assunto}}</p>' +
        '<h2>Honorários</h2>' +
        '<p>Valor de {{honorarios.valor}} ({{honorarios.extenso}}), acrescido de ' +
        '{{honorarios.exito}} sobre o proveito econômico.</p>' +
        '<h2>Despesas</h2>' +
        '<p>Custas e diligências por conta do contratante.</p>' +
        '<p>{{data.extenso}} — {{escritorio.nome}}</p>' },

      { nome: 'Requerimento de gratuidade de justiça', tipo: 'peticao',
        categoria: 'outro', areaId: null, html:
        '<p>Processo n. {{processo.numeroCnj}}</p>' +
        '<h1>REQUERIMENTO DE GRATUIDADE DE JUSTIÇA</h1>' +
        '<p>{{cliente.nome|maiuscula}}, CPF/CNPJ {{cliente.cpfCnpj}}, requer os ' +
        'benefícios da gratuidade da justiça, declarando não ter condições de arcar com ' +
        'as custas processuais sem prejuízo do próprio sustento.</p>' +
        '<p>{{data.hoje}} — {{advogado.nome}}, {{advogado.oab}}</p>' }
    ];

    var modelosPeca = MODELOS_BASE.map(function (m) {
      return {
        id: proximoId('MOD'),
        nome: m.nome,
        categoria: m.categoria,
        areaId: m.areaId,
        tipo: m.tipo,
        conteudoHtml: m.html,
        criadoPorId: usuarios[0].id,
        publico: true,
        ativo: true, criadoEm: agora, atualizadoEm: agora
      };
    });

    return {
      usuarios: usuarios,
      pessoas: pessoas,
      modelosPeca: modelosPeca,
      leads: leads,
      interacoes: interacoes,
      propostas: propostas,
      contratos: contratos,
      lancamentos: lancamentos,
      boletos: boletos,
      repasses: repasses,
      apontamentos: apontamentos,
      processos: processos,
      partesProcesso: partesProcesso,
      andamentos: andamentos,
      prazos: listaPrazos,
      compromissos: compromissos,
      documentos: documentos,
      pastasDocumento: pastasDocumento,
      tarefas: tarefas,
      publicacoes: publicacoes,
      monitoramentos: monitoramentos,
      usuarioAtualId: usuarios[0].id
    };
  }

  App.seed = { gerar: gerar };
})(window.App = window.App || {});
