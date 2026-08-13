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
      // o pior cenário real de um escritório.
      var venceu = calculo.dataFatal < iso(hoje);
      var sorteio = rand();
      var status;

      if (venceu) {
        if (sorteio < 0.72) status = 'cumprido';
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

    return {
      usuarios: usuarios,
      pessoas: pessoas,
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
