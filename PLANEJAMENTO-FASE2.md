# JurisControl — Planejamento da Fase 2

Companheiro de [PLANEJAMENTO.md](PLANEJAMENTO.md). Aquele documento descreve o que
existe; este descreve o que falta para o protótipo cobrir **todos** os pilares de um
software jurídico de mercado — inclusive os que dependem de backend, que entram como
**simulação declarada**.

As convenções da fase 1 continuam valendo sem exceção: IIFE registrando em `window.App`,
services `async` mesmo sem rede, soft delete em tudo, dinheiro em centavos inteiros, datas
em ISO `YYYY-MM-DD`, um nó de conteúdo novo por rota, `ligarEventos()` só no `render()`.

---

## 0. As três regras da simulação

O protótipo já tinha uma postura sobre isso na aba de documentos ("o binário não é
persistido — é a mentira mínima necessária"). A fase 2 transforma essa postura em regra,
porque agora 5 dos 9 módulos dependem de coisas que não existem sem servidor.

**Regra 1 — nada finge ser real.** Todo recurso simulado exibe o selo de simulação na
própria tela, dizendo o que é falso e o que entra no lugar na fase 3. Componente novo:
`ui.SeloSimulado({ oque, naFase3 })`.

**Regra 2 — a simulação mora num lugar só.** Tudo que na fase 3 vira chamada de rede fica
sob `src/services/simulado/`, com a **assinatura final já correta**. Trocar por `fetch` é
apagar o corpo, não redesenhar a chamada.

```js
// services/simulado/iaService.js — HOJE
async function gerarPeca(p) { await http.delay(1200); return montarPorTemplate(p); }

// services/iaService.js — FASE 3
async function gerarPeca(p) { return http.post('/api/ia/peca', p); }
```

**Regra 3 — a lógica que pode ser real, é real.** Cálculo de honorário de êxito, dígito
verificador de boleto, aging de recebíveis, classificação de publicação por palavra-chave,
matriz de permissões, contagem de prazo de alerta — tudo isso é matemática e regra, não
depende de servidor, e vai para `src/domain/` como código puro e testado. Só o
*transporte* é simulado.

---

## 1. Ordem de execução

A ordem abaixo é de **dependência**, não de valor. Segurança vem cedo porque replumba
todas as telas existentes; relatórios vêm por último porque consomem os dados de todos os
outros módulos.

| # | Módulo | Depende de | Peso |
|---|--------|-----------|------|
| **F2.0** | Fundações (banco v3, enums, auditoria, selo, gráficos) ✅ | — | P |
| **F2.1** | Segurança, perfis e LGPD ✅ | F2.0 | G |
| **F2.2** | Alertas e notificações ✅ | F2.0 | M |
| **F2.3** | Portal do cliente e link compartilhado ✅ | F2.0, F2.1 | M |
| **F2.4** | Publicações e integração com tribunais ✅ | F2.0, F2.2 | G |
| **F2.5** | Módulo financeiro ✅ | F2.0, F2.1 | G |
| **F2.6** | CRM e prospecção ✅ | F2.0, F2.5 | M |
| **F2.7** | Documentos avançados (modelos, busca, assinatura) ✅ | F2.0 | M |
| **F2.8** | Assistente (IA) ✅ | F2.4, F2.7 | M |
| **F2.9** | Relatórios e BI ✅ | F2.2, F2.5, F2.6 | M |
| **F2.10** | Administração e complementos | F2.1 | M |

**Atalho possível:** se a prioridade for demonstrar valor rápido, **F2.3 (portal)** pode
saltar para logo depois de F2.0 — ele só precisa de permissões rudimentares, e os campos
`visivelCliente` já existem em documentos, andamentos e prazos.

---

## F2.0 — Fundações ✅ concluída

Sem isso, cada módulo seguinte reinventaria a mesma peça.

### O que entra

**Banco v3.** `db.js` sobe `CHAVE` de `jurisctrl.db.v2` para `jurisctrl.db.v3`, o que
descarta o banco antigo e regenera o seed (o protótipo não tem migração — decisão da fase 1).
Coleções novas registradas de uma vez, mesmo que vazias até o módulo chegar:

```
publicacoes · monitoramentos · sincronizacoes
contratos · lancamentos · boletos · repasses · apontamentos
leads · interacoes · propostas
notificacoes · regrasAlerta · caixaSaida
linksCompartilhados · acessosPortal
logsAuditoria · consentimentos · solicitacoesTitular
modelosPeca · assinaturas · acessosDocumento
feriadosEscritorio · configuracoes
```

**Auditoria por baixo.** `db.js` ganha um gancho: toda escrita passa por
`registrarAuditoria(colecao, acao, antes, depois)`. Fica desligado por padrão e é ativado
em F2.1 — mas o ponto de entrada nasce agora, senão vira retrofit em 12 services.

**Enums novos** em `domain/enums.js`, seguindo o formato existente
(`{ id, label, cor|variante }`): `MODALIDADES_HONORARIO`, `STATUS_LANCAMENTO`,
`ORIGENS_LANCAMENTO`, `ETAPAS_FUNIL`, `ORIGENS_LEAD`, `TIPOS_INTERACAO`,
`STATUS_PUBLICACAO`, `TIPOS_MONITORAMENTO`, `TIPOS_NOTIFICACAO`, `ACOES_AUDITORIA`,
`TIPOS_SOLICITACAO_TITULAR`, `RECURSOS_PERMISSAO`.

**Utilitários:**
- `utils/moeda.js` — centavos ⇄ string, soma, percentual, extenso. Nunca `float`
  (decisão arquitetural 7 da fase 1).
- `utils/csv.js` — gera e **lê** CSV (a leitura é para a importação em massa de F2.10).
- `utils/token.js` — gera token opaco de compartilhamento e hash simples para
  anonimização.

**Componentes base novos:**
- `components/SeloSimulado.js` — a etiqueta da Regra 1.
- `components/Chart.js` — SVG puro, sem biblioteca: barras, linhas, donut e sparkline.
  Cores vindas de `tokens.css`, legendas acessíveis, `<title>` em cada série. Usado por
  F2.5, F2.9 e pelo dashboard.
- `components/Stepper.js` — fluxos de várias etapas (conversão de lead, emissão de boleto).
- `components/DateRangePicker.js` — período, usado por todo relatório.

### Passos — todos executados

1. ✅ `CHAVE` em `jurisctrl.db.v3`, 24 coleções da fase 2 declaradas vazias
2. ✅ `db.configurarAuditoria(fn)` — gancho plugável, nasce desligado, e uma
   auditoria com defeito **não derruba** a operação auditada (há teste para isso)
3. ✅ 16 enums novos em `domain/enums.js`
4. ✅ `utils/moeda.js`, `utils/csv.js`, `utils/token.js`
5. ✅ `SeloSimulado`, `Chart`, `Stepper`, `DateRangePicker` + tokens e CSS
6. ✅ Scripts registrados em `index.html`
7. ✅ `testes/fundacoes.test.js` — 206 verificações, sem jsdom

### Medição do teto de armazenamento

Feita com `db.diagnostico()`, que ficou no código como ferramenta permanente:

```
ocupação atual: 0,52 MB de 5 MB (10,4%)
maiores coleções: andamentos 177 KB · pessoas 68 KB · prazos 64 KB
```

**Conclusão: há folga.** A fase 1 usa um décimo do teto, então o seed
financeiro pode entrar com os 18 meses previstos em F2.5 sem redução. O
`diagnostico()` volta a ser rodado ao fim de F2.5 e de F2.9, que são os dois
módulos que mais geram registro.

### Decisões tomadas durante a implementação

- **A paleta de gráfico é validada, não escolhida.** Os 8 slots categóricos em
  `tokens.css` passaram por simulação de protanopia e deuteranopia contra as
  superfícies reais do sistema (`#ffffff` e `#17212f`): pior par adjacente
  ΔE 9,1 no claro e 8,4 no escuro; em visão normal, 19,6 e 19,3. A **ordem** dos
  slots é o mecanismo de segurança — por isso `Chart.js` atribui em sequência e
  **dobra a 9ª série em "Outros"** em vez de ciclar cores.
- **Não existe segundo eixo Y.** Não é convenção: não há prop para isso, e há um
  teste que falha se alguém acrescentar uma. Duas medidas de escalas diferentes
  viram dois gráficos.
- **A visão de tabela do gráfico é obrigatória.** Três slots ficam abaixo de 3:1
  de contraste no tema claro, e a regra é que isso exige um canal de alívio.
  Além de acessibilidade, é o que o advogado quer: o número.
- **`ratear()` fecha a conta.** Parcelamento distribui o resto nas primeiras
  parcelas; o teste percorre ~700 combinações conferindo que a soma bate. É a
  base do gerador de parcelas de F2.5.
- **Máscara de CPF na convenção brasileira** (`***.456.789-**`) — a primeira
  versão escondia o miolo e mostrava o verificador, que é o contrário do que se
  usa e do que o titular reconhece.

---

## F2.1 — Segurança, perfis e LGPD ✅ concluída

Hoje `Usuario.perfil` é um rótulo na topbar e `segredoJustica` é um campo que não restringe
nada. Este módulo transforma campos mortos em comportamento.

### Real × simulado

| Real | Simulado |
|------|----------|
| Matriz de permissões e sua aplicação em toda a UI | Autenticação (seleção de usuário, sem senha) |
| Regra de segredo de justiça | "Criptografia em repouso" (indicador, não cifra) |
| Trilha de auditoria completa | Backup automático (botão que baixa JSON) |
| Exportação e anonimização de dados do titular | Envio de e-mail ao titular |

### Modelo

```js
// Sessao (só em memória + store, não persiste)
{ usuarioId, iniciadaEm, expiraEm, perfil, permissoes: [] }

// LogAuditoria
{ id, quando, usuarioId, acao, colecao, entidadeId,
  antes, depois, origem: 'ui'|'sistema'|'portal', ip }

// ConsentimentoLGPD
{ id, pessoaId, finalidade, base: 'consentimento'|'contrato'|'obrigacao_legal',
  concedidoEm, revogadoEm, textoVersao }

// SolicitacaoTitular
{ id, pessoaId, tipo: 'acesso'|'correcao'|'eliminacao'|'portabilidade',
  solicitadoEm, prazoAtendimento, status, respondidoEm, respostaTexto, arquivoGeradoId }
```

### Domínio — `domain/permissoes.js` (puro, testável)

```js
pode(usuario, 'financeiro.ver')            // matriz perfil × recurso × ação
podeVerProcesso(usuario, processo)         // segredo de justiça: equipe + responsável + admin
filtrarPorPermissao(usuario, lista, tipo)  // devolve só o que o usuário pode ver
nivelDocumento(usuario, documento)         // 'editar' | 'ver' | 'negado'
```

Matriz inicial:

| Recurso | admin | socio | advogado | estagiario | financeiro |
|---------|:---:|:---:|:---:|:---:|:---:|
| processos.ver / editar | ✔✔ | ✔✔ | ✔✔ | ✔✖ | ✔✖ |
| processos.segredo | ✔ | ✔ | equipe | ✖ | ✖ |
| financeiro.ver / lançar | ✔✔ | ✔✔ | ✖✖ | ✖✖ | ✔✔ |
| relatorios.ver | ✔ | ✔ | próprios | ✖ | financeiros |
| configuracoes / auditoria | ✔ | ✖ | ✖ | ✖ | ✖ |
| portal.compartilhar | ✔ | ✔ | ✔ | ✖ | ✖ |

### Telas

| Rota | Tela |
|------|------|
| `#/entrar` | Seleção de usuário — **sem casca**, com o selo dizendo que não há senha |
| `#/configuracoes/usuarios` | Usuários, perfis, OAB, ativar/desativar |
| `#/auditoria` | Trilha filtrável por usuário, período, coleção e ação; diff antes/depois |
| `#/privacidade` | Consentimentos, solicitações de titular, política de retenção |

### Passos — todos executados

1. ✅ `domain/permissoes.js` — matriz pura, com teste que trava a divergência entre ela
   e `enums.RECURSOS_PERMISSAO` (a tela de perfis lê da mesma fonte que o sistema aplica)
2. ✅ `sessaoService.js` + `LoginPage.js` (rota pública e **sem casca**)
3. ✅ `auditoriaService.js` plugado no gancho de F2.0
4. ✅ `pode()` aplicado na `Sidebar` e — **decisão diferente da planejada** — no
   **roteador**, não no `AppShell` (ver abaixo)
5. ✅ `podeVerProcesso` dentro de `processoService`: lista, detalhe **e estatísticas**
6. ✅ `AuditoriaPage` com o diff campo a campo e exportação CSV
7. ✅ `PrivacidadePage` — dossiê, portabilidade JSON/CSV, anonimização, consentimentos,
   solicitações com o prazo do art. 18
8. ✅ Backup e restauração em JSON, com validação do arquivo
9. ✅ `ConfiguracoesPage` — usuários e a matriz em grade *(não estava no plano; sem ela,
   `PERFIS` continuaria sendo um enum que ninguém vê)*
10. ✅ `testes/seguranca.test.js` — 125 verificações, sem jsdom, mais a guarda de acesso
    exercitada de ponta a ponta em `telas.test.js`

### Decisões tomadas durante a implementação

- **A guarda de rota mora no roteador, não no `AppShell`.** O plano dizia AppShell; ao
  implementar ficou claro que a decisão de entrar ou desviar precisa acontecer **antes**
  de a página ser instanciada, e o roteador é quem sabe disso. O roteador continua
  genérico: `App.router.definirGuarda(fn)` recebe a regra de fora, e quem a escreve é o
  `main.js`. `registrar()` ganhou `{ permissao, publica, semCasca }`.
- **Rota "sem casca" nasceu aqui e serve a F2.3.** A entrada esvazia os slots da sidebar
  e da topbar de verdade, não os esconde por CSS — a topbar traz busca global e troca de
  tema, e nada disso pode existir para quem ainda não entrou. O portal do cliente vai
  reusar o mesmo mecanismo.
- **Recusa de processo em segredo é 404, não 403.** Responder "sem permissão" já revelaria
  que o processo existe. Para quem não pode vê-lo, ele não existe.
- **"Eliminar" é anonimizar, e a tela diz isso.** O art. 18, VI convive com o art. 16, III
  (guarda para exercício regular de direito em processo) e com a decisão nº 2 do projeto.
  Um processo não pode perder a identificação da parte; prometer um DELETE que seria
  ilegal cumprir é pior que explicar a regra.
- **A trilha guarda o diff, não o objeto inteiro.** Antes/depois completos estourariam o
  localStorage em poucas centenas de edições — e o diff é exatamente o que a tela mostra.
- **Duas barreiras contra recursão na auditoria**: a coleção `logsAuditoria` é ignorada
  pelo gancho e há trava de reentrância. Gravar o log é uma escrita; sem isso, a primeira
  alteração viraria laço infinito.

### Dois defeitos encontrados pelos testes

**1. O seed não tinha administrador.** Os perfis do seed iam de sócio a financeiro, sem
`admin`. Com as telas de Configurações, Auditoria e Privacidade restritas ao
administrador, elas seriam **inalcançáveis no protótipo real**. O seed passou a ter 9
usuários, com um administrador, e há teste travando os cinco perfis povoados.

**2. `db.init()` regenerava o banco a cada chamada.** Quatro telas chamam `db.init()`
defensivamente ao renderizar. Sem storage — o caso comum sob `file://` — `carregar()`
devolve `null` e o seed inteiro era **regerado**, descartando tudo o que existia em
memória. O bug é da fase 1 e passou despercebido porque o seed é determinístico:
regenerar produzia dados idênticos. A trilha de auditoria, que nasce em tempo de execução
e não no seed, foi o primeiro dado a sumir de forma visível. `init()` agora é idempotente,
e há teste para isso.

### Limite novo, registrado

Sob `file://` o `localStorage` costuma estar indisponível, e nesse caso **a sessão não
sobrevive ao recarregamento** — é preciso entrar de novo a cada F5. O banco já tinha
fallback em memória; a sessão herda a mesma limitação.

---

## F2.2 — Alertas e notificações ✅ concluída

O motor de prazo é o melhor pedaço do protótipo e hoje ele não avisa ninguém.

### Real × simulado

| Real | Simulado |
|------|----------|
| Cálculo de quais alertas existem hoje (dias úteis, via `domain/prazos.js`) | Envio de e-mail / push |
| Central de notificações in-app | Agendamento em servidor (roda no bootstrap e a cada 5 min) |
| Dupla conferência de prazo | |

### Modelo

```js
// RegraAlerta
{ id, usuarioId,                      // null = regra do escritório
  gatilho: 'prazo'|'compromisso'|'tarefa'|'publicacao'|'financeiro',
  antecedenciaDias: [5, 3, 1, 0],     // em dias ÚTEIS para prazo, corridos para o resto
  canais: ['app', 'email'], horaEnvio, ativo }

// Notificacao
{ id, usuarioId, tipo, titulo, mensagem, entidadeColecao, entidadeId,
  gravidade: 'info'|'atencao'|'critica', quando, lidaEm, arquivadaEm }

// CaixaSaida  (o e-mail que teria sido enviado)
{ id, para, assunto, corpoHtml, geradaEm, notificacaoIds: [], status: 'simulada' }
```

### Domínio — `domain/alertas.js`

Função pura `avaliar(estado, hoje)` → lista de notificações que **deveriam** existir.
Idempotente: rodar duas vezes no mesmo dia não duplica. Reusa `prazos.diasUteisEntre`.

### Mudanças no que já existe

- `Prazo` ganha `conferidoPorId`, `conferidoEm`, `motivoPerda`
- Baixar prazo passa a exigir conferência de um segundo usuário quando a regra do
  escritório estiver ligada; marcar `perdido` exige `motivoPerda` preenchido
- `Topbar` ganha o sino com badge e o painel `NotificationCenter.js`

### Passos — todos executados

1. ✅ `domain/alertas.js` — puro, com a data injetável (nenhum teste depende do relógio)
2. ✅ `notificacaoService.js`, `regraAlertaService.js`, `simulado/emailService.js`
3. ✅ `NotificationCenter.js` no `Topbar`
4. ✅ Avaliação no bootstrap, **a cada troca de rota** e a cada 5 min
5. ✅ `#/notificacoes` e a aba **Alertas e prazos** em `#/configuracoes`
6. ✅ `#/caixa-de-saida` com a prévia do e-mail renderizada
7. ✅ Dupla conferência e motivo de perda no `PrazoCard` e no `ProcessoDetalhePage`
8. ✅ Resumo do dia, gerado a partir das 8h
9. ✅ `testes/alertas.test.js` — 88 verificações, mais as telas em `telas.test.js`

### Decisões tomadas durante a implementação

- **A idempotência vem da CHAVE, não de um controle de "já rodei hoje".** Cada aviso
  carrega `tipo:entidade:marco`, e o marco é o que distingue "faltam 5 dias" de "faltam
  3 dias" no mesmo prazo. Onde a repetição diária É desejada — prazo vencido, resumo do
  dia — o marco vira a data. Assim o avaliador pode rodar quantas vezes quiser.
- **Duas unidades de contagem, e a tela diz qual é qual.** Prazo processual conta em dias
  **úteis**, pelo mesmo motor do art. 219; compromisso, tarefa e financeiro contam em dias
  **corridos** — audiência não adia por cair no sábado.
- **Os gatilhos de F2.4, F2.5 e F2.6 já estão escritos** e ficam quietos enquanto as
  coleções estiverem vazias. Publicação nova, título a vencer e follow-up de lead vão
  funcionar assim que os módulos donos existirem, sem tocar em `alertas.js`.
- **Publicação nova gera UM aviso por dia para o lote**, não um por publicação: trinta
  avisos idênticos no sino equivalem a nenhum.
- **A dupla conferência é uma trava, não um botão escondido.** `prazoService.conferir()`
  recusa com 409 quem executou a baixa e com 403 quem não tem o recurso. `cumprir()` passou
  a gravar `cumpridoPorId` — sem isso não haveria como saber quem não pode conferir.
- **O resumo do dia só é gerado a partir das 8h.** Antes disso ele estaria incompleto, e um
  resumo incompleto é pior que resumo nenhum.
- **`regraAlertaService.salvar()` materializa TODAS as regras na primeira gravação.** Salvar
  só a alterada deixaria o escritório com uma regra sua e cinco inexistentes, e
  `alertas.regraDe()` não acharia as demais.

### Um defeito encontrado pelos testes

**O sino nascia vazio.** `AppShell.montar()` roda antes do login — não há usuário, e a
sincronização não gerava nada. Depois disso, nada reavaliava: o sino só se atualizaria de
5 em 5 minutos ou ao ser clicado. A avaliação passou a rodar também **a cada troca de
rota**, o que é barato justamente porque `sincronizar()` é idempotente.

### Observação de custo

As suítes de interface ficaram mais lentas (o conjunto passou de ~2 min), porque agora
cada navegação em jsdom dispara uma avaliação de alertas. É o preço de exercitar o
caminho real; se incomodar, o gancho de rota pode ganhar um intervalo mínimo.

---

## F2.3 — Portal do cliente e link compartilhado ✅ concluída

Metade já existe: `visivelCliente` é editável em documentos, andamentos e prazos. Falta o
outro lado do link.

### Real × simulado

| Real | Simulado |
|------|----------|
| Geração e revogação de token, validade, escopo | O link só abre **na mesma máquina** — sem servidor, o banco é o `localStorage` local |
| Filtro por `visivelCliente` e por escopo | Envio do link por e-mail/WhatsApp (vai para a caixa de saída) |
| Registro de acesso | Senha do portal (compara em claro, não há hash real) |

A limitação do link fora da máquina é declarada no próprio modal de compartilhamento, e não
no rodapé — o usuário precisa saber antes de mandar o link para o cliente.

### Modelo

```js
// LinkCompartilhado
{ id, processoId, token, criadoPorId, criadoEm, expiraEm, revogadoEm,
  senha,                                  // opcional
  escopo: { andamentos, documentos, prazos, compromissos, financeiro },  // booleans
  totalAcessos, ultimoAcessoEm }

// AcessoPortal
{ id, linkId, quando, sucesso, motivoFalha }
```

### Telas

| Rota | Tela |
|------|------|
| `#/portal/:token` | **Sem sidebar e sem topbar** — cabeçalho próprio com a marca do escritório |
| `#/processos/:id` → aba **Compartilhamento** | Links ativos, criar, revogar, ver acessos |

O portal mostra: capa do processo (número, vara, fase, responsável — nunca valor de
provisão nem risco), linha do tempo só com `visivelCliente`, documentos visíveis com
download, próximos compromissos, e prazos apenas como "aguardando manifestação até X".
Sem nada editável. Nenhuma rota do sistema é alcançável de dentro dele.

**Bloqueios:** processo em segredo de justiça não pode ser compartilhado; token expirado,
revogado ou de processo arquivado cai numa tela de link inválido que não revela se o
processo existe.

### Passos — todos executados

1. ✅ `compartilhamentoService.js` (criar, decodificar, abrir, revogar, registrar acesso)
2. ✅ Rota `#/portal/:token` pública e sem casca, usando o mecanismo criado em F2.1
3. ✅ `PortalClientePage.js` + `assets/css/portal.css`
4. ✅ Modal de compartilhamento com escopo e validade — **sem senha**, ver abaixo
5. ✅ Aba **Compartilhamento** no processo, com acessos e revogação
6. ✅ **"Revisar visibilidade"** em vez de ação em massa cega, ver abaixo
7. ✅ `testes/portal.test.js` — 62 verificações, mais o fluxo completo em `telas.test.js`
   (gerar link → abrir o portal pelo link → conferir o que não aparece → revogar)

### Duas decisões que mudaram em relação ao plano

**1. O token passou a ser autocontido.** O plano previa token opaco, com o servidor
consultando a tabela de links. Só que o protótipo está publicado no GitHub Pages e o
"banco" é o `localStorage` de cada navegador: um token opaco produziria um link que **só
abre na máquina de quem gerou** — um recurso de compartilhamento que não compartilha. O
token virou `processo.escopo.validade.nonce.verificação`, a mesma forma de um JWT, e o
portal se monta sozinho em qualquer navegador contra o seed determinístico.

O que se perde, e está escrito no código e no modal:
- o token revela o id interno do processo (o opaco não revelaria);
- a soma de verificação **não é assinatura** — sem servidor não há segredo para assinar.
  Ela detecta link truncado, não falsificação. Na fase 3 vira HMAC conferido no servidor;
- revogação só vale onde existe o registro local. É o problema real de JWT, resolvido na
  fase 3 com lista de revogação no servidor.

**2. Não há senha de portal.** O plano previa o campo. Ao implementar ficou claro que uma
senha conferida no cliente, com o banco visível no mesmo navegador, não protege nada —
seria teatro. A proteção honesta possível é o token longo e a validade curta.

**3. "Revisar visibilidade" no lugar da ação em massa.** O plano pedia "marcar todos como
visíveis". Um botão desses é perigoso num processo que tem nota interna, estratégia e
documento sigiloso. A tela mostra andamento por andamento, documento por documento, com o
que já está exposto — a ação em massa acontece com a lista à vista, e grava a cada clique.

### Decisões de conteúdo

- **A capa do portal é deliberadamente reduzida.** Sem valor da causa, provisão, risco,
  equipe interna, tags ou número interno. A provisão, em especial, seria constrangedora na
  tela do cliente. Há teste conferindo que nenhum desses campos sai do service.
- **O prazo vira "aguardando manifestação até X"** — sem semáforo, dias restantes,
  responsável ou prazo interno. Para o cliente é uma data-limite, não um indicador de
  gestão do escritório.
- **Link inválido, expirado e revogado caem todos na MESMA tela.** Distinguir os casos já
  contaria ao visitante que o processo existe.
- **O filtro de visibilidade mora no service.** Se ficasse na tela, bastaria um `desenhar()`
  novo para vazar.
- **O advogado logado consegue abrir o portal** para conferir exatamente o que o cliente vê
  — a guarda deixa a rota pública passar mesmo com sessão ativa.

### Ajuste no seed

Os prazos não tinham `visivelCliente`, então a seção do portal nasceria sempre vazia.
O campo entrou no seed (60% visíveis), junto dos campos de conferência de F2.2.

---

## F2.4 — Publicações e integração com tribunais ✅ concluída

O ciclo que justifica o sistema inteiro: publicação no diário → prazo calculado → tarefa
atribuída. O motor da ponta final já existe; falta a ponta inicial.

### Real × simulado

| Real | Simulado |
|------|----------|
| Triagem, vínculo por número CNJ, geração de prazo pelo motor CPC | Consulta ao DJe / Datajud / PJe / e-SAJ |
| Classificação do texto por palavra-chave → tipo e dias de prazo | "Sincronizar agora" gera publicações do gerador determinístico |
| Detecção de publicação duplicada | Certificado digital A1/A3 |

### Modelo

```js
// Publicacao
{ id, tribunalId, diario, caderno, dataDisponibilizacao, pagina,
  textoIntegral, numeroCnjDetectado, processoId,
  monitoramentoId,
  status: 'nova'|'vinculada'|'triada'|'descartada'|'sem_vinculo',
  sugestao: { tipoPrazoId, dias, confianca, termosEncontrados: [] },
  prazoGeradoId, andamentoGeradoId, triadaPorId, triadaEm, hashConteudo }

// Monitoramento
{ id, tipo: 'oab'|'nome'|'cnpj'|'processo', valor, uf,
  tribunais: [], usuarioId, ativo, ultimaSincronizacaoEm }

// Sincronizacao
{ id, iniciadaEm, concluidaEm, tribunais: [], encontradas, novas,
  duplicadas, status, mensagemErro }
```

### Domínio — `domain/classificador.js` (puro)

```js
classificar(texto)   // → { tipoPrazoId, dias, confianca, termos }
extrairCnj(texto)    // → número CNJ validado por domain/cnj.js
extrairPrazoTexto()  // "no prazo de 15 (quinze) dias" → 15
extrairPartes(texto) // nomes em caixa alta e "advogado(a):"
```

Dicionário de termos por tipo de prazo ("intime-se para contestar" → contestação/15,
"embargos de declaração" → 5, "manifeste-se sobre o laudo" → manifestação/5…). Regra pura,
testável, e é o alicerce honesto do que F2.8 chama de assistente.

### Fluxo da triagem

```
publicação nova
   ├── CNJ detectado e processo existe → vincula automaticamente
   ├── CNJ detectado sem processo      → oferece "cadastrar processo a partir da publicação"
   └── sem CNJ                         → busca por nome da parte, ou triagem manual
                     ↓
        classificador sugere tipo e dias
                     ↓
   "Gerar prazo"  → prazos.calcular({ dataDisponibilizacao, dias, tipoContagem })
                  → cria Prazo com andamentoOrigemId preenchido
                  → cria Andamento tipo 'publicacao' com o texto integral
                  → notifica o responsável (F2.2)
```

`dataDisponibilizacao` já é exatamente o campo de entrada do motor de prazos da fase 1 —
o encaixe é direto, sem adaptador.

### Telas

| Rota | Tela |
|------|------|
| `#/publicacoes` | Fila de triagem: não lidas, vinculadas, descartadas. Texto integral ao lado |
| `#/publicacoes/:id` | Detalhe com o texto, a sugestão e as ações |
| `#/integracoes` | Monitoramentos (OAB, nome, CNPJ), tribunais, histórico e status de sincronização |

### Passos — todos executados

1. ✅ `domain/classificador.js` — dicionário ponderado, puro e auditável
2. ✅ 22 publicações no seed, com texto no formato do DJe
3. ✅ `publicacaoService.js`, `monitoramentoService.js`, `simulado/sincronizacaoService.js`
4. ✅ `PublicacoesPage.js` — fila em duas colunas, no formato de caixa de e-mail
5. ✅ Vínculo automático por CNJ e deduplicação por `hashConteudo`
6. ✅ "Gerar prazo": classificador → motor do CPC → prazo → andamento → notificação
7. ✅ "Cadastrar processo a partir da publicação", com o CNJ pré-preenchido e o
   vínculo refeito ao salvar
8. ✅ `IntegracoesPage.js` com monitoramentos, histórico e as integrações da fase 3
9. ✅ Badge de publicações pendentes na sidebar
10. ✅ `testes/publicacoes.test.js` — 100 verificações, mais o fluxo em `telas.test.js`

### O encaixe que a fase 1 já tinha preparado

Três campos existiam desde o começo e só agora ganharam uso:

- **`dataDisponibilizacao`** é exatamente o campo de entrada de `prazos.calcular()`. O
  motor já sabia contar a partir da disponibilização no DJe (art. 224 §2º); faltava quem
  lhe entregasse a data. Não houve adaptador nenhum.
- **`Prazo.andamentoOrigemId`** era a rastreabilidade prevista na seção 14 do
  `PLANEJAMENTO.md` e nunca preenchida. Agora todo prazo gerado por publicação aponta
  para o andamento que traz o texto integral do ato.
- **`Andamento.origem`** passou a distinguir `'publicacao'` de `'manual'`.

### Decisões tomadas durante a implementação

- **A sugestão nunca decide sozinha.** A tela mostra o tipo sugerido, o prazo, **os termos
  que sustentaram a conclusão** e o grau de confiança — e o modal de geração vem editável.
  Um classificador que decide escondido é pior que nenhum: quando erra, ninguém percebe.
- **Reconhecer o que NÃO abre prazo é metade do trabalho.** Mero expediente, homologação
  e trânsito em julgado são a maior parte do diário. Sugerir prazo neles encheria a agenda
  de prazo fantasma, e o usuário passaria a ignorar a fila inteira — que é o pior desfecho
  possível para um sistema cuja função é lembrar de prazo.
- **O prazo dito no texto vence a tabela.** O juiz pode fixar prazo diferente do legal
  ("30 dias, por se tratar da Fazenda Pública"), e é o que ele escreveu que vale.
- **Deduplicação por hash do conteúdo** — o problema prático nº 1 de quem integra recorte:
  o mesmo ato sai em dois cadernos e a consulta de hoje se sobrepõe à de ontem.
- **A sincronização falha de propósito** quando pedida (`forcarErro`), porque na vida real
  o tribunal cai e a tela precisa saber lidar com isso.
- **As publicações fabricadas pertencem a processos reais do escritório.** Sem isso, o
  vínculo automático por CNJ nunca casaria e o passo mais importante do módulo ficaria
  sem exercício.

### Dois defeitos do classificador encontrados pelos testes

**1. Dupla contagem de termos sobrepostos.** "Contrarrazões ao recurso de apelação" era
classificado como *apelação*: a regra da apelação somava `apelação` **e** `recurso de
apelação`, contando a mesma evidência duas vezes. Agora um termo contido em outro termo
achado não pontua de novo.

**2. Apelação e contrarrazões não eram incompatíveis.** Mesmo sem a dupla contagem, o
empate persistia. As regras ganharam `exclui`: quem responde ao recurso não o interpõe, e
ninguém faz as duas coisas na mesma intimação. Sem isso, **o prazo nasceria na pessoa
errada** — o erro mais caro que este módulo pode cometer.

Um terceiro ajuste veio junto: "apresente contestação" (imperativo) não era reconhecido,
só "apresentar contestação". A palavra `contestação` sozinha entrou com peso médio,
sugerindo sem decidir — ela também aparece em "réplica à contestação".

### Três problemas que só a suíte COMPLETA revelou

As suítes individuais passavam; rodar tudo junto expôs o que estava frouxo:

1. **O seed passou a depender de `utils/token.js`** (o hash de conteúdo da publicação) e
   `dominio.test.js` não o carregava. A dependência é legítima — o hash é dado da
   publicação —, então o arquivo entrou na lista da suíte.
2. **Dois testes de F2.0 ficaram desatualizados**: a chave subiu para v4, e "toda coleção
   da fase 2 nasce vazia" deixou de valer para publicações e monitoramentos.
3. **Integrações estava na seção errada do menu.** Eu a pus em *Administração*, mas quem
   cuida dos monitoramentos é quem tria publicação — e o advogado tem essa permissão.
   O resultado era um advogado vendo uma seção "Administração" inteira com um item só.
   Foi para *Ferramentas*, ao lado do simulador de prazo. O teste que pegou isso é o que
   confere que nenhuma seção do menu fica órfã.

### Nota sobre o banco

A chave subiu para `jurisctrl.db.v4`: o seed passou a **povoar** publicações e
monitoramentos, e sem regerar a fila de triagem nasceria vazia para quem já tinha banco.
Quem tiver dados a preservar deve exportar o backup em `#/privacidade` antes de atualizar.

---

## F2.5 — Módulo financeiro ✅ concluída

Nada existe hoje. O perfil `financeiro` está em `PERFIS` e não leva a lugar nenhum.

### Real × simulado

| Real | Simulado |
|------|----------|
| Todo o cálculo: êxito, parcelamento, juros/multa, aging, fluxo de caixa, rentabilidade | Registro do boleto no banco |
| Dígito verificador e linha digitável FEBRABAN (matemática correta, banco fictício) | Conciliação bancária / retorno CNAB |
| Timesheet e faturamento por hora | Emissão de NF-e |
| PDF do boleto (pelo diálogo de impressão, como já faz `exportar.js`) | Gateway de pagamento |

### Modelo

```js
// ContratoHonorarios
{ id, clienteId, processoId,            // processoId null = contrato guarda-chuva
  modalidade: 'fixo'|'exito'|'hora'|'mensal'|'misto',
  valorFixoCentavos, percentualExito, valorHoraCentavos, valorMensalCentavos,
  numParcelas, diaVencimento, dataInicio, dataFim,
  reajuste: { indice, periodicidade },
  status: 'ativo'|'encerrado'|'inadimplente'|'cancelado', documentoId }

// Lancamento
{ id, tipo: 'receita'|'despesa',
  origem: 'honorario'|'exito'|'custa'|'reembolso'|'repasse'|'despesa_escritorio',
  contratoId, processoId, clienteId, descricao,
  valorCentavos, valorPagoCentavos,
  dataCompetencia, dataVencimento, dataPagamento,
  status: 'previsto'|'em_aberto'|'pago'|'parcial'|'atrasado'|'cancelado',
  formaPagamento, reembolsavel, comprovanteDocumentoId, boletoId, parcela: { n, de } }

// Boleto
{ id, lancamentoId, nossoNumero, linhaDigitavel, codigoBarras,
  dataVencimento, valorCentavos, juros, multa,
  status: 'emitido'|'pago'|'vencido'|'cancelado', emitidoEm, pagoEm }

// Repasse
{ id, lancamentoOrigemId, beneficiarioId, tipo: 'correspondente'|'parceiro'|'socio',
  percentual, valorCentavos, dataPrevista, dataPagamento, status }

// ApontamentoHora
{ id, processoId, tarefaId, usuarioId, data, minutos, descricao,
  faturavel, valorHoraCentavos, lancamentoId, aprovadoPorId }
```

### Domínio — `domain/financeiro.js` (puro)

```js
gerarParcelas(contrato)              // → lançamentos previstos, com vencimento em dia útil
calcularExito(contrato, valorGanho)  // percentual sobre o proveito econômico
jurosMulta(lancamento, hoje)         // 2% multa + 1% a.m. pro rata die (configurável)
aging(lancamentos, hoje)             // 0–30 / 31–60 / 61–90 / 90+
fluxoCaixa(lancamentos, de, ate)     // regime de caixa e de competência, série mensal
rentabilidade(processo)              // honorários − horas − despesas
```

E `domain/boleto.js`: nosso número, DV por módulo 11, código de barras de 44 posições e
linha digitável de 47 — **formato FEBRABAN correto**, banco fictício (código 999). A regra é
real e testável; só não existe banco que o receba.

### Telas

| Rota | Tela |
|------|------|
| `#/financeiro` | Fluxo de caixa (gráfico), KPIs, aging, inadimplência |
| `#/financeiro/receber` · `/pagar` | Listas filtráveis, baixa individual e em lote |
| `#/financeiro/contratos` · `/contratos/novo` · `/:id` | Contratos de honorários |
| `#/financeiro/repasses` | Repasses a correspondentes e sócios |
| `#/timesheet` | Apontamento de horas — semanal, com cronômetro |
| aba **Financeiro** no processo e no cliente | Contrato, lançamentos, despesas, rentabilidade |

### Passos — executados

1. ✅ `utils/moeda.js` de F2.0 reusado (`ratear` é a base do parcelamento)
2. ✅ `domain/financeiro.js` e `domain/boleto.js`, ambos puros
3. ✅ Seed com contratos em 60% dos processos e 18 meses de lançamentos
4. ✅ `contratoService`, `lancamentoService`, `boletoService`, `repasseService`,
   `timesheetService`
5. ✅ `FinanceiroPage.js` — painel, a receber, a pagar, contratos e repasses
6. ✅ `ContratoFormPage.js` com prévia das parcelas em tempo real
7. ✅ Emissão de boleto com linha digitável válida e impressão
8. ✅ `TimesheetPage.js` com cronômetro
9. ⏳ **Abas financeiras no processo e no cliente ficaram para depois** — ver abaixo
10. ✅ Permissões aplicadas (o advogado não vê o financeiro do escritório)
11. ✅ `testes/financeiro.test.js` — 151 verificações

### O que é real e o que é simulado, com precisão

**A linha digitável é real.** Código de barras de 44 posições, três DVs de campo por
módulo 10, DV geral por módulo 11 e fator de vencimento — tudo no padrão FEBRABAN. O teste
confere com um caso documentado (`341910900` → 8) e ainda troca um dígito em 20 posições
diferentes para provar que todas são detectadas.

**O registro no banco é que não existe.** O código 999 não é instituição real e nenhum
título é registrado — registrar exige convênio bancário e troca por CNAB ou API. O modal e
a impressão dizem isso.

Fazer a conta certa e o registro não é a escolha honesta: uma linha digitável **plausível
mas inválida** seria a mentira que só se descobre no caixa.

### Decisões tomadas durante a implementação

- **O painel lidera com o FLUXO DE CAIXA, não com o faturamento.** A pergunta de segunda-
  feira é "dá para pagar a folha?", não "quanto vendemos". Faturamento sem caixa é o que
  quebra escritório. Os dois regimes estão lado a lado, com uma frase explicando o que cada
  um responde.
- **A situação do título envelhece na leitura**, em `financeiro.situacao()`. Um "em aberto"
  cujo vencimento passou está atrasado — e depender de um job noturno para atualizar isso
  significaria que o sistema mente durante o dia inteiro em que o job falhar.
- **Juros pro rata die.** Cobrar o mês cheio por três dias de atraso é prática que não se
  sustenta em discussão. A multa, essa sim, incide uma vez só.
- **Pagamento parcial é aceito.** Na vida real o cliente paga metade e combina o resto; um
  sistema que só admite "pago" ou "em aberto" força o usuário a mentir num dos dois lados.
- **O tipo do lançamento vem do enum, não do formulário.** Custa é despesa por natureza —
  deixar a tela decidir permitiria lançar custa como receita e inverter o sinal do caixa.
- **Repasse nasce de uma receita e vira despesa vinculada a ela**, com trava para a soma
  não passar do que entrou. Repasse solto quebraria a conta: o dinheiro sairia sem se saber
  de qual entrada.
- **Hora não faturável também é apontada.** É ela que explica por que um contrato de valor
  fixo deu prejuízo, e um sistema que só registra o que pode cobrar esconde justamente o
  que interessa saber.
- **O faturamento de horas cria UM lançamento**, não um por apontamento — dezenas de
  títulos de R$ 80 entupiriam o contas a receber.
- **Contrato de êxito e por hora não geram parcela prevista**, e a tela explica por quê:
  lançar previsão de dinheiro que talvez nunca entre poluiria o fluxo de caixa.
- **Vencimento sempre em dia útil.** Boleto que vence no domingo é boleto pago na segunda
  com multa indevida.
- **Custo de hora com valor de referência** quando o contrato não define: valor-hora zero
  faria todo processo parecer lucrativo, e o relatório de rentabilidade serviria para nada.

### Duas correções de expectativa nos testes

Ambas minhas, e a segunda revelou um comportamento que vale registrar: **estornar uma baixa
não devolve o título para "em aberto"** — devolve para o que a data mandar. Parcela cujo
vencimento já passou volta como **atrasada**. O estorno desfaz o pagamento, não o
calendário.

### O que ficou de fora

As **abas financeiras dentro do processo e do cliente** não entraram. A informação existe e
está acessível (`rentabilidadeDoProcesso` está implementado e testado), mas a tela de
detalhe do processo já tem sete abas, e enfiar a oitava sem repensar a navegação deixaria
a tela pior. Fica para F2.10, junto do resto do trabalho de navegação.

### O mesmo defeito de F2.4, e a correção definitiva

Em F2.4 o `seed.js` passou a depender de `utils/token.js` e quebrou uma suíte. Em F2.5
passou a depender de `domain/financeiro.js` e quebrou **seis** — todas as que não conheciam
o arquivo novo. E, nas duas vezes, as suítes individuais passavam: o defeito só aparecia
ao rodar o conjunto.

Acrescentar o arquivo em seis listas resolveria o sintoma e garantiria a repetição em
F2.6. A correção foi extrair **`testes/ambiente.js`**, com a ordem canônica de carregamento
de tudo que não depende de DOM, mais um placar compartilhado. Cada suíte passou de ~50
linhas de andaime a três:

```js
const { App, janela } = criarAmbiente();
const { ok, secao, encerrar } = criarPlacar();
```

Quando um módulo novo entrar no seed, ele entra **em um lugar só** e nenhuma suíte quebra.
`dominio.test.js` mantém lista própria de propósito: ela existe para exercitar o domínio
isolado, e herdar o núcleo inteiro apagaria essa distinção.

### Nota sobre o banco

A chave subiu para `jurisctrl.db.v5`: o seed passou a povoar contratos, lançamentos,
repasses e apontamentos. **Exporte o backup em `#/privacidade` antes de atualizar** se
houver dados locais a preservar.

---

## F2.6 — CRM e prospecção ✅ concluída

Hoje um cliente só existe **depois** de virar processo. Falta o antes.

### Real × simulado

| Real | Simulado |
|------|----------|
| Funil, conversão lead → cliente → contrato → processo | Integração com e-mail e WhatsApp |
| Histórico de interações e agenda de follow-up | Captura de lead pelo site |
| Proposta gerada a partir de modelo (usa F2.7) | Assinatura eletrônica da proposta |

### Modelo

```js
// Lead
{ id, nome, pessoaId,                    // preenchido quando vira cliente
  contato: { telefone, email },
  origem: 'indicacao'|'site'|'redes'|'evento'|'retorno'|'outro',
  indicadoPorId, areaId, resumoCaso,
  etapa: 'novo'|'contato'|'reuniao'|'proposta'|'negociacao'|'ganho'|'perdido',
  valorEstimadoCentavos, probabilidade, responsavelId,
  proximoContatoEm, motivoPerda, convertidoEm }

// Interacao
{ id, leadId, pessoaId, processoId,
  tipo: 'ligacao'|'email'|'reuniao'|'whatsapp'|'visita'|'nota',
  quando, duracaoMin, resumo, usuarioId, proximoPasso }

// Proposta
{ id, leadId, numero, dataEnvio, validadeAte, escopo,
  honorarios: { modalidade, valorFixoCentavos, percentualExito, valorHoraCentavos },
  status: 'rascunho'|'enviada'|'aceita'|'recusada'|'expirada',
  documentoId, motivoRecusa }
```

### Telas

| Rota | Tela |
|------|------|
| `#/crm` | Funil em kanban — **reusa `KanbanBoard.js` sem alteração**, arrastar muda a etapa |
| `#/crm/:id` | Lead: dados, interações, propostas, ações |
| aba **Interações** no cliente | Histórico unificado (lead + cliente) |

### Conversão (o fluxo que dá sentido ao módulo)

`Stepper` de 4 etapas: **Lead ganho → Pessoa (cliente) → Contrato de honorários (F2.5) →
Processo (opcional)**. Uma passagem só, com os dados já preenchidos do lead e da proposta
aceita. Marcar `perdido` exige `motivoPerda` (alimenta o relatório de F2.9).

### Passos — todos executados

1. ✅ `leadService`, `interacaoService`, `propostaService`
2. ✅ Seed com 30 leads, interações proporcionais à etapa e propostas
3. ✅ `CrmPage.js` sobre o `KanbanBoard` — **zero componente novo**
4. ✅ `LeadDetalhePage.js` com o histórico de contato
5. ✅ Proposta com texto e impressão *(modelo embutido — em F2.7 passa a vir
   da biblioteca de modelos, e a assinatura de `gerarTexto` já prevê isso)*
6. ✅ `Stepper` de conversão em quatro etapas
7. ✅ Histórico de contato na ficha do cliente
8. ✅ Follow-up vencido dispara o aviso escrito em F2.2
9. ✅ `testes/crm.test.js` — 86 verificações

### O gatilho que estava esperando desde F2.2

`domain/alertas.js` já tinha o avaliador de `follow_up` escrito e testado, ficando quieto
porque a coleção `leads` estava vazia. Com o funil povoado, **ele passou a disparar sem que
uma linha de `alertas.js` fosse tocada** — que era exatamente a aposta feita lá atrás. O
teste de F2.6 confirma o encaixe.

### Decisões tomadas durante a implementação

- **O funil soma o PIPELINE PONDERADO, não o valor cheio.** Somar integralmente todo mundo
  que ligou uma vez daria um número grande e falso. Cada etapa tem uma probabilidade, e a
  do lead — quando preenchida — vence a da etapa: a régua é do escritório, a leitura é de
  quem está conduzindo.
- **A taxa de conversão só considera o que FECHOU.** Incluir o que está em andamento faria
  a taxa despencar sem que nada tivesse dado errado.
- **Perder exige motivo.** Um funil cheio de "perdido" sem justificativa não ensina nada;
  com o motivo, vira o relatório que diz se o escritório perde por preço, por prazo ou por
  não ter respondido a tempo.
- **Marcar "ganho" à mão é recusado.** Ganhar sem converter deixaria um cliente que não
  existe em lugar nenhum — arrastar para *ganho* abre a conversão.
- **Enviar a proposta move o lead de etapa.** O envio *é* o fato; obrigar a arrastar o card
  depois só cria a chance de esquecer.
- **A proposta expira na leitura**, como os títulos de F2.5. Proposta de 2023 aberta no
  funil não é oportunidade, é ruído.
- **Registrar contato reagenda o follow-up.** Sem isso, o lead continuaria marcado como
  atrasado logo depois de ter sido atendido — e o alerta perderia a credibilidade.
- **A conversão puxa os honorários da proposta aceita.** Redigitar é onde o desconto some e
  o contrato deixa de bater com o que foi oferecido. Há teste conferindo justamente isso.
- **Cliente com o mesmo CPF/CNPJ é reaproveitado, não duplicado** — e o documento passa
  pelo validador antes.
- **A interação do lead NÃO é reescrita na conversão.** Ela mantém o `leadId` e passa a ser
  alcançável também pela pessoa. Reescrever apagaria a fronteira entre prospecção e
  atendimento, que é o que o funil precisa medir.

### Um defeito de contrato encontrado pelos testes

O `Stepper` de F2.0 expunha `onAvancar`/`onVoltar`/`onConcluir`, herdado do JSX, enquanto
**todo o resto do projeto usa o prefixo `ao`** (`aoMover`, `aoMudar`, `aoOrdenar`). A
divergência custou três handlers que nunca disparavam — a conversão abria e não avançava.
O componente foi uniformizado.

### Dois testes que envelheciam a cada módulo

`fundacoes.test.js` prendia a versão da chave (`=== 'jurisctrl.db.v5'`) e mantinha uma
lista à mão das coleções povoadas pelo seed. Foram **três edições** — v4 em F2.4, v5 em
F2.5, v6 em F2.6 — e nenhuma delas descobriu defeito: só acusavam que um módulo tinha
nascido.

Os dois viraram verificações duráveis: a chave é conferida pelo **formato** (versionada), e
a divisão vazia/povoada é **derivada do banco**, com asserções que continuam valendo a pena
— toda coleção é array, nenhum registro sem `id`, nenhum sem carimbo de criação. O número
da versão vive no comentário de `db.js`, onde a razão de cada subida está registrada.

### Nota sobre o banco

Chave em `jurisctrl.db.v6`: o seed passou a povoar leads, interações e propostas.
**Exporte o backup em `#/privacidade` antes de atualizar** se houver dados a preservar.

---

## F2.7 — Documentos avançados ✅ concluída

O explorador, o visor e o editor já são fortes. Falta o que transforma o editor em
ferramenta de trabalho.

### Real × simulado

| Real | Simulado |
|------|----------|
| Modelos com variáveis substituídas por dados do processo | Assinatura digital ICP-Brasil |
| Busca full-text no conteúdo editado | OCR de PDF/imagem (índice vem do seed) |
| Log de visualização e download | Carimbo do tempo |

### Modelo

```js
// ModeloPeca
{ id, nome, categoria, areaId, tipo: 'peticao'|'contrato'|'procuracao'|'notificacao'|'proposta',
  conteudoHtml, variaveis: [], criadoPorId, publico }

// Assinatura
{ id, documentoId, signatarioId, tipo: 'eletronica_simulada',
  assinadoEm, hash, certificado, valida }

// AcessoDocumento
{ id, documentoId, usuarioId, linkCompartilhadoId, acao: 'ver'|'baixar'|'editar', quando }
```

### Variáveis do modelo

`{{cliente.nome}}` · `{{cliente.cpfCnpj}}` · `{{processo.numeroCnj}}` · `{{processo.vara}}`
· `{{processo.comarca}}` · `{{processo.valorCausa}}` · `{{parte.contraria}}` ·
`{{advogado.nome}}` · `{{advogado.oab}}` · `{{data.extenso}}` · `{{honorarios.valor}}`

`domain/modelos.js`: `listarVariaveis(html)`, `preencher(html, contexto)`,
`variaveisNaoResolvidas(html, contexto)` — o editor destaca em amarelo o que não foi
preenchido em vez de deixar `{{...}}` cru no documento final.

### Passos — todos executados

1. ✅ `domain/modelos.js` — catálogo, preenchimento, filtros e detecção de pendências
2. ✅ `modeloPecaService.js` e 15 modelos no seed
3. ✅ `#/modelos` — biblioteca com prévia e catálogo de variáveis
4. ✅ "A partir de modelo" ao lado de "Novo documento" no explorador
5. ✅ Prévia de preenchimento (quantas resolvem, quais ficam pendentes) **antes** de criar
6. ✅ `domain/busca.js` + `buscaService.js` — índice invertido ligado à busca global
7. ✅ Assinatura simulada com hash e conferência na leitura
8. ✅ `AcessoDocumento` gravado ao abrir o visor
9. ✅ `testes/documentos.test.js` — 104 verificações

### A decisão central: variável sem valor não some

Um modelo preenchido com dados incompletos tem três destinos possíveis, e dois deles são
ruins:

- **apagar o campo em silêncio** → petição com lacuna que ninguém percebe;
- **deixar `{{cliente.nome}}` cru** → constrangimento no protocolo;
- **marcar visivelmente** → é o que o sistema faz.

A variável sem valor vira `<span class="var-pendente">[cliente.nome]</span>`: destacada em
âmbar no editor, listada no retorno da geração e contada na prévia **antes** de o documento
ser criado. Descobrir a lacuna no editor já é tarde; descobrir no protocolo é pior.

### Decisões tomadas durante a implementação

- **Índice invertido, e não `indexOf` no acervo.** Varrer tudo a cada tecla custa
  proporcionalmente ao tamanho do acervo; o índice é construído uma vez e consultado em
  tempo proporcional à consulta — que é o que permite buscar enquanto se digita.
- **Busca com interseção (AND).** Procurar "dano moral" e receber tudo que fala de "dano"
  tornaria a busca inútil num acervo jurídico, onde as palavras isoladas são frequentes.
- **O título pesa 3× o corpo.** Quem procura "procuração" quer o documento chamado
  procuração antes daquele que a menciona de passagem.
- **O segredo de justiça vale na busca.** O filtro roda no service, com a mesma função de
  `domain/permissoes.js`. Busca que ignora a regra é o vazamento mais fácil de cometer —
  basta esquecer. Há teste conferindo que conteúdo de processo em segredo alheio não
  aparece, e que aparece para quem pode vê-lo.
- **O índice é invalidado a cada escrita.** Para isso, `db.js` ganhou
  `observarEscrita(fn)`: a auditoria tinha slot único desde F2.0, e um segundo interessado
  não cabia. Sem a invalidação, a busca mostraria resultado obsoleto logo depois de salvar.
- **A assinatura é honesta sobre o que entrega.** Não há ICP-Brasil nem carimbo do tempo —
  mas o **hash do conteúdo é real**: alterar o texto quebra a conferência, que é
  exatamente a propriedade que uma assinatura oferece. Falta o que prova QUEM assinou, não
  o que prova que o texto não mudou. A conferência acontece na leitura, não numa flag.
- **Modelo com variável fora do catálogo é avisado antes de salvar**, e há teste garantindo
  que nenhum dos 15 modelos do seed usa variável inventada — um campo que nunca resolve
  seria descoberto no protocolo.

### Um defeito real encontrado pelo teste

O destaque do trecho na busca procurava o termo **sem acento** dentro do texto **com
acento**: "negativacao" nunca casava com "negativação", e o resultado saía sem marcação. A
correção calcula as faixas no texto normalizado e as aplica **por índice** no original —
`normalizar` preserva o comprimento, então os índices coincidem. O escapamento continua
sendo feito pedaço a pedaço, antes de virar HTML.

### O que ficou de fora

O **painel de variáveis dentro do `DocumentEditor`** não entrou. A informação está na
prévia (antes de criar) e as pendências ficam destacadas no texto (depois), então o
essencial está coberto — mas um painel lateral no editor, listando cada variável com seu
valor, seria melhor. Fica registrado para F2.10.

### Nota sobre o banco

Chave em `jurisctrl.db.v7`: o seed passou a povoar a biblioteca de modelos.
**Exporte o backup em `#/privacidade` antes de atualizar.**

---

## F2.8 — Assistente (IA) ✅ concluída

Sem backend não há modelo de linguagem. A postura aqui é a mesma dos documentos: entregar
de verdade o que é regra, simular o que é rede — e dizer qual é qual, na cara.

### Camada A — real, determinística (`domain/assistente.js`)

Isto **funciona de verdade**, é puro e testável:

- **Classificação de publicação** → tipo e dias de prazo (reusa `domain/classificador.js`)
- **Extração de entidades** do texto: CNJ, datas, valores, prazos, nomes de partes
- **Resumo estruturado do processo**: da timeline sai "distribuído em X, contestado em Y,
  atualmente em instrução, 3 prazos cumpridos, 1 perdido, próxima audiência em Z"
- **Próxima ação sugerida** por fase, status e prazos em aberto
- **Detecção de duplicidade** de processo (CNJ) e de cliente (CPF/CNPJ, nome aproximado)
- **Risco sugerido** por área + fase + histórico de desfechos do próprio seed
- **Revisão de peça**: prazos citados que não batem com o cadastro, valores divergentes,
  variáveis de modelo não substituídas, número CNJ inválido no corpo do texto

### Camada B — simulada (`services/simulado/iaService.js`)

Assinatura **idêntica à de um cliente de API real**, para a fase 3 ser troca de corpo:

```js
async function gerarPeca({ tipo, processoId, instrucoes, modeloId })
async function resumirPublicacao({ publicacaoId })
async function sugerirDesfecho({ processoId })
async function perguntar({ processoId, pergunta })
```

Hoje o corpo monta o texto a partir de **modelo (F2.7) + dados reais do processo**, com
latência e escrita token a token no editor. O painel diz, sem rodeio: *"Texto montado por
modelo e regras locais. Não há modelo de linguagem neste protótipo — na fase 3 esta mesma
chamada vira `POST /api/ia/peca`."*

### Telas

- Painel **Assistente** no `ProcessoDetalhePage`: resumo, próximas ações, alertas de
  inconsistência, risco sugerido
- **"Gerar minuta"** no editor → tipo de peça → instruções → texto preenchido com o
  processo
- **"Explicar publicação"** na triagem de F2.4: resumo em linguagem simples + prazo sugerido
- **Assistente de busca** na topbar: "prazos do Dr. Silva vencendo esta semana" resolvido
  por gramática de intenções (regra, não modelo)

### Passos — todos executados

1. ✅ `domain/assistente.js` — resumo, próxima ação, duplicidade, risco, revisor, intenções
2. ✅ Revisor de peça sobre `modelos.js`, `cnj.js` e `classificador.js`
3. ✅ `simulado/iaService.js` com as assinaturas da fase 3 e latência
4. ✅ Aba **Assistente** no processo, com pergunta livre
5. ✅ `gerarPeca()` monta a partir dos modelos de F2.7
6. ✅ **"Explicar"** na fila de triagem
7. ✅ Gramática de 8 intenções na busca, com queda para o índice de F2.7
8. ✅ Selo em toda superfície + campo `origem` em **toda** resposta
9. ✅ `testes/assistente.test.js` — 90 verificações

### A regra que organiza o módulo: não inventar

O ponto não é acertar sempre — é **nunca produzir uma resposta convincente e errada**, que
é indistinguível de uma correta para quem pergunta. Três mecanismos garantem isso:

1. **Toda conclusão vem com o porquê.** "Risco provável" sozinho é palpite; "risco provável
   porque 62% dos encerrados nesta área tiveram perda e há um prazo perdido aqui" é
   argumento — e o advogado pode discordar com base.
2. **Sem base, o sistema diz que não sabe.** Risco com menos de 5 processos encerrados na
   área devolve `null` com a justificativa, em vez de chutar.
3. **Pergunta fora do repertório é recusada explicitamente**, antes de qualquer outra regra.

### O defeito que o teste pegou, e que resume o módulo

A pergunta *"qual a probabilidade de o STF mudar o entendimento sobre isso?"* era respondida
com o **resumo do processo** — porque continha a palavra "sobre", que era gatilho do ramo de
resumo. O assistente respondia com aparência total de ter entendido a pergunta.

Era exatamente o desfecho que o módulo existe para evitar. A correção tem duas partes: uma
**barreira de fora-do-repertório** conferida antes de tudo (jurisprudência, STF, chance,
previsão, estratégia, opinião) e a remoção de "sobre" como gatilho genérico.

### Decisões tomadas durante a implementação

- **As instruções do usuário viram uma ANOTAÇÃO no topo da minuta, não texto redigido.**
  Fingir que foram "compreendidas" seria a mentira central que este módulo recusa.
- **`gerarPeca` diz de qual modelo saiu.** O texto vem da biblioteca de F2.7 preenchida com
  os dados do processo — não há redação, e a tela informa isso.
- **Toda resposta carrega `origem: 'regras-locais'`.** Na fase 3 o campo vira `'modelo'`, e
  a tela pode dizer ao usuário de onde veio o texto — informação que ele merece ter. Há
  teste conferindo que nenhuma resposta esconde a origem.
- **A gramática de intenções é regex, não modelo.** "Prazos vencendo" não é busca por
  documentos com essas palavras: é pedido de navegação. Quando nenhum padrão casa, cai no
  índice de F2.7 — inventar uma intenção seria pior que não ter nenhuma.
- **O revisor de peça confere contra o CADASTRO**, e cada achado é um erro que já aconteceu
  em escritório real: variável não substituída, marcador de rascunho esquecido, CNJ inválido
  no corpo, peça citando outro processo, prazo divergente do cadastrado.
- **Duplicidade separa certeza de suspeita.** Documento igual é certeza; nome parecido é
  suspeita, com o grau de similaridade à vista. Tratar as duas do mesmo jeito faria o
  usuário ignorar as duas.
- **A análise só é buscada quando a aba abre.** Quem não usa o assistente não paga por ele.

### Um ajuste em `interpretarBusca`

Os padrões casavam contra o texto acentuado, e `\w` não alcança `õ` nem `á` em expressão
regular de JavaScript — "publicações do diário" não era reconhecido. A entrada passou a ser
normalizada antes do casamento, com os padrões escritos sem acento.

---

## F2.9 — Relatórios e BI ✅ concluída

Nenhuma entidade nova. Tudo é derivação — e por isso quase tudo já está a um passo dos
`selectors.js` existentes.

### Catálogo

| Relatório | Fonte | Corte |
|-----------|-------|-------|
| Produtividade por advogado | prazos, tarefas, apontamentos | período, equipe |
| Prazos: cumpridos × perdidos × no prazo | prazos | mês, responsável, área |
| **Contingência** (provisão por risco) | `valorProvisao`, `risco` | área, cliente, fase |
| Carteira e tempo médio por fase | processos, andamentos | área, tribunal |
| Taxa de êxito | processos encerrados | área, advogado |
| Faturamento e inadimplência | lançamentos | competência, cliente |
| Aging de recebíveis | lançamentos | faixa, cliente |
| Rentabilidade por processo | contratos, horas, despesas | cliente, área |
| Funil de conversão | leads, propostas | origem, responsável |
| Publicações: volume e tempo de triagem | publicações | tribunal, usuário |

O de **contingência** é o que o cliente corporativo exige e o modelo da fase 1 já previa
(seção 14 do `PLANEJAMENTO.md`) — sai praticamente de graça.

### Domínio — `domain/indicadores.js`

Funções puras que recebem coleções e devolvem séries prontas para o `Chart`. Nenhuma
consulta ao store, nenhum DOM. É o módulo mais fácil de testar do projeto inteiro.

### Telas

| Rota | Tela |
|------|------|
| `#/relatorios` | Catálogo em cartões, agrupado por tema |
| `#/relatorios/:chave` | Filtros (`DateRangePicker`, área, responsável) + gráfico + tabela |

Toda tela exporta **CSV** (`utils/csv.js`) e **PDF** (impressão, com `@media print` já
usada pelo `exportar.js`). O dashboard ganha links "ver relatório completo" nos cartões.

### Passos — todos executados

1. ✅ `domain/indicadores.js` — dez funções puras, uma por relatório
2. ✅ `RelatoriosPage.js` (catálogo) e `RelatorioDetalhePage.js` (**uma tela para os dez**)
3. ✅ `Chart.js` de F2.0 ligado, com a paleta validada desde o começo
4. ✅ Filtros de período, área e responsável, com o recorte no hash
5. ✅ Exportação CSV e impressão
6. ✅ Permissão por relatório + escopo próprio
7. ✅ Links do dashboard para carteira e contingência
8. ✅ `testes/relatorios.test.js` — 129 verificações

### Uma tela para dez relatórios

`RelatorioDetalhePage` não sabe o que está desenhando: lê um **contrato** devolvido pelo
domínio — título, gráfico, tabela, totais, nota — e monta. Acrescentar um relatório novo é
acrescentar uma função a `indicadores.js` e uma linha ao catálogo; **nenhuma linha da tela
muda**. O teste percorre o catálogo inteiro conferindo que todos respeitam o contrato — sem
isso, um relatório fora do padrão só quebraria quando alguém o abrisse.

### As duas famílias de verificação que importam

**Coerência.** Total geral com lista filtrada é o jeito clássico de um relatório mentir. O
teste confere, relatório a relatório, que a soma da tabela bate com o total exibido: as
provisões por risco somam o provisionado, as fases somam os ativos, os meses somam o
recebido, os percentuais somam 100.

**Acesso.** O escopo próprio é aplicado **na coleta**, não na tela — o advogado que abre
"produtividade" recebe um recorte em que o total e a lista vêm do mesmo lugar. E processo em
segredo de justiça não entra em conta nenhuma: se sumisse da lista mas continuasse no total,
**o número denunciaria a existência dele**.

### Decisões tomadas durante a implementação

- **Ordem que é significado usa a rampa ordinal.** Fase do processo, faixa de aging e etapa
  do funil são ordinais — a rampa de um matiz só mostra a progressão na própria cor.
  Identidade (advogado, área) usa a paleta categórica validada em F2.0.
- **Produtividade conta o que foi ENTREGUE**, não o que caiu na mesa: prazo cumprido e
  tarefa concluída, com a data da entrega — não a da criação.
- **"Cumprido com folga" é até a data INTERNA**, não a fatal. Cumprir na data fatal é
  cumprir, mas é o sinal de que o processo está sendo tocado no limite — e o relatório
  separa os dois.
- **A taxa de conversão do funil só considera o que fechou**, e a taxa de êxito só considera
  encerrados. Incluir o que está em andamento derrubaria os números sem nada ter dado errado.
- **A taxa de êxito é declaradamente uma APROXIMAÇÃO.** O modelo não tem campo de desfecho,
  então "favorável" é inferido do risco final. A nota do relatório diz isso — um número com
  ressalva vale mais que um número que finge precisão.
- **O CSV leva o valor formatado**, não o centavo cru: quem abre no Excel quer ler
  "R$ 1.250,00".
- **Todo relatório tem uma nota explicando o critério.** Número sem critério é número que
  vira discussão na reunião.

### Um defeito real que o teste pegou

`history.replaceState` **lança sob `file://`** em vários navegadores — e abrir com duplo
clique é decisão do projeto desde a fase 1. O relatório inteiro caía na tela de erro por
causa da tentativa de escrever o filtro no endereço. A falha passou a ser absorvida:
perde-se o link compartilhável sob `file://`, nunca a tela. Sob GitHub Pages, o link com o
recorte funciona normalmente.

### Nota sobre o banco

**Nenhuma coleção nova** — relatório é derivação. A chave continua em `jurisctrl.db.v7`.

---

## F2.10 — Administração e complementos

Os buracos que não estavam na lista original mas que qualquer escritório cobra na primeira
semana de uso.

| Item | Por quê |
|------|---------|
| `#/configuracoes` — usuários, perfis, escritório | Não existe nenhuma tela de administração |
| **Feriados do escritório** | O motor calcula os nacionais; ponto facultativo de comarca é manual |
| Tipos de prazo e categorias personalizáveis | Hoje `TIPOS_PRAZO` é constante em código |
| **Importação em massa (CSV)** | Ninguém migra 400 processos digitando |
| **Processos vinculados / apensos** | `processoPaiId` está no modelo e é sempre `null` |
| **Busca global ampliada** | Hoje só alcança processos e clientes |
| Backup e restauração | Botão de exportar/importar o banco em JSON |
| Preferências por usuário | Tela inicial, colunas da tabela, densidade |

### Passos

1. `#/configuracoes` com abas (escritório, usuários, prazos, feriados, alertas, integrações)
2. `feriadoEscritorioService` + injeção no `domain/feriados.js` (a função pura passa a
   aceitar uma lista extra — sem quebrar a assinatura atual)
3. Importação CSV com prévia, validação linha a linha (CNJ, CPF/CNPJ) e relatório de erros
4. Vínculo de processos: campo `processoPaiId` no formulário, árvore de apensos no detalhe
5. Busca global sobre andamentos, documentos, prazos, publicações e leads
6. Backup/restauração em JSON
7. Preferências por usuário
8. Testes: importação com linha inválida, árvore de apensos, busca por tipo

---

## 2. Arquivos novos — mapa consolidado

```
assets/css/
  portal.css                      F2.3
  print.css                       F2.5, F2.9

src/domain/                       ⭐ tudo puro, migra sem alteração
  permissoes.js                   F2.1
  alertas.js                      F2.2
  classificador.js                F2.4
  financeiro.js  boleto.js        F2.5
  modelos.js                      F2.7
  assistente.js                   F2.8
  indicadores.js                  F2.9

src/services/
  sessaoService.js  auditoriaService.js  privacidadeService.js       F2.1
  notificacaoService.js  regraAlertaService.js                        F2.2
  compartilhamentoService.js                                          F2.3
  publicacaoService.js  monitoramentoService.js                       F2.4
  contratoService.js  lancamentoService.js  boletoService.js
  repasseService.js  timesheetService.js                              F2.5
  leadService.js  interacaoService.js  propostaService.js             F2.6
  modeloPecaService.js  assinaturaService.js                          F2.7
  simulado/
    emailService.js               F2.2   → SMTP / provedor de push
    sincronizacaoService.js       F2.4   → Datajud, PJe, e-SAJ, Projudi
    gatewayService.js             F2.5   → registro de boleto / PIX
    iaService.js                  F2.8   → POST /api/ia/*

src/components/
  SeloSimulado.js  Chart.js  Stepper.js  DateRangePicker.js           F2.0
  NotificationCenter.js                                               F2.2
  FunilBoard.js (fino sobre KanbanBoard)                              F2.6
  VariaveisPanel.js                                                   F2.7
  AssistentePanel.js                                                  F2.8

src/pages/                        ~22 páginas novas (ver cada módulo)

testes/
  permissoes.test.js  alertas.test.js  classificador.test.js
  financeiro.test.js  boleto.test.js  modelos.test.js
  assistente.test.js  indicadores.test.js  portal.test.js
  crm.test.js  integracao-fase2.test.js
```

**`index.html`** cresce para ~90 scripts. Ao passar de 60, o bloco ganha subcomentários por
módulo — a ordem continua sendo conveniência de leitura, não exigência (nenhum arquivo
depende de outro em tempo de definição).

---

## 3. Limites conhecidos e assumidos

Registrados aqui para não serem redescobertos como defeito no meio da implementação:

1. ~~**O link do portal não sai da máquina.**~~ **Resolvido em F2.3** com token
   autocontido: o link abre em qualquer navegador. O que continua valendo é que a soma de
   verificação **não é assinatura**, e que a revogação só surte efeito onde existe o
   registro local.
2. **Não há autenticação.** Trocar de usuário é escolher da lista. As permissões são
   aplicadas de verdade, mas a identidade não é provada — e a checagem roda só no
   navegador. Permissão conferida apenas no cliente não é permissão; na fase 3 a mesma
   matriz roda no servidor. Sob `file://`, a sessão também não sobrevive ao F5.
3. **Não há modelo de linguagem.** O assistente é regra e modelo de texto. A assinatura da
   chamada já é a da fase 3.
4. **Boleto não é registrado em banco.** A linha digitável é matematicamente válida no
   formato FEBRABAN; o banco 999 não existe.
5. **Assinatura digital é simulada.** Hash do conteúdo, sem ICP-Brasil, sem carimbo do tempo.
6. **`localStorage` tem teto de ~5 MB.** ~~Pode apertar com 9 módulos.~~ **Medido em
   F2.0: 0,52 MB (10,4%).** Há folga; o seed financeiro entra com os 18 meses previstos.
   `db.diagnostico()` ficou no código para remedir ao fim de F2.5 e F2.9.
7. **Sem migração de banco.** Subir a versão da chave descarta os dados. Continua sendo a
   decisão da fase 1, e o backup em JSON de F2.1 é a válvula de escape.

---

## 4. Como cada módulo é dado por pronto

Um módulo só fecha quando:

- a lógica que **pode** ser real está em `src/domain/`, pura, com teste;
- os services têm a **assinatura final** (`listar`/`obter`/`criar`/`atualizar`/`remover`),
  mesmo que o corpo leia do `localStorage`;
- toda superfície simulada exibe o `SeloSimulado`;
- as permissões de F2.1 são aplicadas nas telas e nos services do módulo;
- há suíte em `testes/` e `npm test` passa inteiro;
- `README.md` ganha a linha da tela nova na tabela de rotas.
