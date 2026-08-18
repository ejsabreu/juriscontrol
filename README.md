# JurisControl — protótipo

**No ar em [ejsabreu.github.io/juriscontrol](https://ejsabreu.github.io/juriscontrol/)** —
dados fictícios, tudo no `localStorage` do navegador.

Software de controle de processos judiciais para escritório de advocacia.
HTML, CSS e JavaScript puro. Sem framework, sem build, sem backend.

O planejamento completo (modelo de dados, regras, arquitetura e roadmap) está em
[PLANEJAMENTO.md](PLANEJAMENTO.md). A fase 2 está em
[PLANEJAMENTO-FASE2.md](PLANEJAMENTO-FASE2.md), **concluída**: fundações, segurança/LGPD,
alertas, portal do cliente, publicações/tribunais, financeiro, CRM, documentos avançados,
assistente, relatórios/BI e administração.

As convenções que valem para todo código novo — **responsividade**, arquitetura e as
três regras da simulação — estão em [CLAUDE.md](CLAUDE.md).

---

## Como abrir

**Duplo clique em `index.html`.** É só isso — não precisa de servidor.

O protótipo evita `type="module"` e `fetch` de JSON justamente para funcionar sob
`file://`, onde ambos são bloqueados por CORS. Ver seção 5.1 do planejamento.

Os dados ficam no `localStorage`. Para voltar ao conjunto original, use o botão **↺**
na barra superior.

---

## Publicação (GitHub Pages)

O protótipo é inteiramente estático, então o deploy é o próprio repositório: em
**Settings ▸ Pages**, origem `Deploy from a branch`, branch `main`, pasta `/ (root)`.
Cada `git push` para `main` republica o site.

Duas escolhas do protótipo tornam isso possível sem nenhuma configuração extra:

- **Roteamento por hash** (`#/processos/:id`) — funciona em subdiretório
  (`usuario.github.io/repo/`) sem regras de rewrite no servidor.
- **Caminhos relativos** em todos os `<script>` e `<link>` do `index.html`.

O arquivo `.nojekyll` desliga o processamento Jekyll do Pages, que serve os
arquivos como estão.

---

## Telas

| Rota | Tela |
|------|------|
| `#/entrar` | Entrada — escolha do usuário (sem casca, sem senha) |
| `#/portal/:token` | **Portal do cliente** — acompanhamento somente leitura, rota pública |
| `#/` | Dashboard — prazos críticos, compromissos, distribuição da carteira |
| `#/processos` | Lista de processos em **tabela** ou **kanban** |
| `#/processos/novo` | Cadastro com validação do número CNJ |
| `#/processos/:id` | Detalhe — Dados · Partes · Andamentos · Prazos · Documentos · Tarefas · Financeiro |
| `#/processos/:id` → aba Compartilhamento | Links do portal, acessos e revogação |
| `#/agenda` | Calendário forense + prazos e compromissos |
| `#/clientes` | Lista e ficha de clientes |
| `#/tarefas` | Kanban de tarefas |
| `#/relatorios` | **Relatórios** — catálogo por tema, filtrado pelo perfil |
| `#/relatorios/:id` | Relatório com gráfico, tabela, exportação e nota de critério |
| `#/modelos` | **Modelos de peça** — biblioteca com variáveis e catálogo |
| `#/crm` | **Funil de prospecção** — kanban de interessados, arrastar muda a etapa |
| `#/crm/:id` | Ficha do interessado: histórico de contato, propostas e conversão |
| `#/financeiro` | **Financeiro** — fluxo de caixa, a receber, a pagar, contratos e repasses |
| `#/financeiro/contratos/novo` | Contrato de honorários, com prévia das parcelas |
| `#/timesheet` | Apontamento de horas, com cronômetro |
| `#/publicacoes` | **Fila de triagem do diário** — texto, leitura do ato e geração do prazo |
| `#/integracoes` | Monitoramentos, histórico de captura e integrações previstas |
| `#/simulador` | Simulador de contagem de prazo com memória de cálculo |
| `#/configuracoes` | Escritório · Usuários · Permissões · Alertas e tipos de prazo · **Feriados locais** · **Importar dados** *(só administrador)* |
| `#/caixa-de-saida` | E-mails que teriam sido enviados *(só administrador)* |
| `#/auditoria` | Trilha de auditoria com diff campo a campo *(só administrador)* |
| `#/privacidade` | LGPD — titulares, solicitações, consentimentos e backup *(só administrador)* |

---

## O que o protótipo faz de verdade

Não é maquete estática. O que está implementado funciona:

- **Motor de prazos completo** — dias úteis (CPC art. 219), publicação no 1º dia útil
  seguinte à disponibilização (art. 224 §2º), prorrogação em dia sem expediente
  (art. 224 §1º), suspensão no recesso de 20/12 a 20/01 (art. 220) e prazo em dobro
  (art. 229). Feriados móveis são calculados a partir da Páscoa, não tabelados.
- **Validação do número CNJ** — dígito verificador por módulo 97 base 10, com
  decomposição em sequencial, ano, segmento, tribunal e origem.
- **Kanban com drag & drop** — arrastar altera fase, responsável ou área conforme o
  agrupamento, e registra andamento automático no processo.
- **Documentos em pastas** — a aba Documentos do processo é um explorador com
  caminho navegável: arrastar um documento sobre a pasta o move, e pastas podem ser
  aninhadas. Excluir pasta promove o conteúdo para a pasta-mãe (nada se perde).
  Há botão “Mover” em cada linha para quem não usa arrasto.
- **Envio de documentos (simulado)** — pelo modal ou arrastando arquivos do
  computador para a pasta. Nome, tamanho e tipo do arquivo são lidos de verdade,
  com barra de progresso e limite de 25 MB por arquivo; o binário **não é
  persistido** — fica em memória só durante a sessão. Sem backend, é a mentira
  mínima necessária.
- **Visor de documento no próprio sistema** — clicar no documento abre um modal
  com a ficha completa (categoria, pasta, versão, quem enviou, visibilidade no
  portal) e, quando o arquivo está na sessão, a prévia de imagem, PDF ou texto.
  **Ver** nunca abre nova aba: o usuário não sai do sistema para consultar um
  documento.
- **Editor de documentos** — o rodapé do visor (e a linha do explorador) oferece
  **Editar** nos formatos que admitem edição, e aí sim abre uma aba nova, de
  propósito: escrever é trabalho longo e o processo fica aberto ao lado. Texto puro
  (`.txt`, `.md`, `.csv`, `.json`…) edita em textarea monoespaçada; texto formatado
  (`.doc`, `.docx`, `.odt`, `.rtf`) abre um editor rich-text com negrito, títulos e
  listas. **Salva sozinho**, como o Docs, e “Nova versão” congela o texto em v2
  encadeada. A aba do processo se atualiza sozinha quando a outra grava.
  O protótipo não lê nem escreve o binário de um `.docx` — e o editor diz isso na
  cara, em vez de fingir que abriu o Word.
- **Novo documento em branco** — o botão fica ao lado de “Enviar documentos”, e o
  formato é escolhido na criação, com a mesma lista do Docs (`.docx`, `.odt`,
  `.rtf`, `.html`, `.txt`, `.md`). O documento nasce sem arquivo nenhum e vai
  direto para o editor. O modal já avisa, antes de escrever, quais formatos o
  protótipo consegue gerar de verdade.
- **Baixar como** — `.txt`, `.md`, `.html` e `.rtf` são gerados byte a byte
  (o RTF com negrito, títulos e listas preservados, abre no Word); o **PDF** sai
  pelo diálogo de impressão do navegador, que é quem sabe fazer PDF. `.docx` e
  `.odt` **não** são gerados — são pacotes ZIP e o projeto é zero-dependência; o
  menu diz isso em vez de entregar um arquivo com extensão mentirosa.
- **Download** na linha, no rodapé do visor ou no editor. Documento editado baixa o
  texto novo, no formato dele quando o sistema sabe gerá-lo; enviado na sessão baixa
  o arquivo real com o nome original; documento que só tem metadados baixa a **ficha
  em `.txt`** — melhor que gerar um PDF de mentira com o nome de uma procuração de
  verdade.
- **Validação de CPF e CNPJ** com dígitos verificadores.
- **Soft delete em tudo** — nenhum registro é apagado de verdade.
- **Controle de acesso aplicado** — cada um dos cinco perfis enxerga e faz apenas o
  que a matriz de permissões autoriza: o menu esconde o que não é dele, a rota é
  bloqueada antes de a tela montar, e **processo em segredo de justiça some da lista,
  da busca e até dos indicadores** de quem não é responsável nem está na equipe.
  A autenticação é que é fingida — entrar é escolher um usuário, sem senha.
- **Trilha de auditoria** — toda escrita no banco vira registro com quem, quando e o
  diff campo a campo.
- **Alertas de prazo que realmente avisam** — o avaliador roda ao abrir o sistema, a
  cada troca de tela e a cada 5 minutos, e é **idempotente**: reavaliar no mesmo dia não
  duplica aviso nenhum. A régua (D−5, D−3, D−1, no dia) e os canais são configuráveis por
  gatilho; prazo conta em dias úteis, o resto em dias corridos.
- **Dupla conferência** — prazo baixado fica *aguardando conferência* até que **outra
  pessoa** confirme, e o sistema **recusa** a conferência de quem executou a baixa em vez
  de só esconder o botão. Marcar um prazo como perdido exige justificativa, que vai para a
  timeline do processo.
- **LGPD** — dossiê do titular, portabilidade em JSON/CSV, anonimização que preserva o
  registro, consentimentos com base legal e o prazo de 15 dias do art. 18 à vista.
- **Backup e restauração em JSON** — a válvula de escape para a ausência de migração.
- **Dez relatórios, uma tela** — produtividade, prazos, carteira, contingência, taxa de
  êxito, faturamento, inadimplência, rentabilidade, funil e captura. A tela é genérica: lê
  um contrato do domínio e monta, então acrescentar relatório não a altera. Duas garantias
  que o teste cobre: **o total sempre bate com a soma da tabela** (total geral com lista
  filtrada é o jeito clássico de um relatório mentir) e **o escopo é aplicado na coleta** —
  o advogado vê os próprios números, e processo em segredo de justiça não entra em conta
  nenhuma, porque o total denunciaria a existência dele. Cada relatório traz a **nota do
  critério**: número sem critério vira discussão na reunião.
- **Assistente que não inventa** — resumo do processo, próximas ações, risco sugerido,
  revisão da peça antes do protocolo e pergunta livre. **Não há modelo de linguagem**, e a
  tela diz isso: é regra e dicionário auditável. Três garantias sustentam o módulo —
  **toda conclusão vem com o porquê**, **sem base histórica o sistema diz que não sabe** em
  vez de chutar, e **pergunta fora do repertório é recusada explicitamente**. Uma resposta
  convincente e errada é indistinguível de uma correta para quem pergunta, e é justamente
  esse risco que o assistente se recusa a correr. Toda resposta declara a origem.
- **Modelos de peça com variáveis** — `{{cliente.nome}}`, `{{processo.numeroCnj}}` e mais
  vinte, preenchidas com os dados do processo ao gerar o documento. A prévia diz **antes**
  quantas resolvem e quais ficam pendentes; a variável sem valor **nunca é apagada em
  silêncio nem sai como chave crua** — vira uma marca destacada no editor. Apagar produz
  petição com lacuna que ninguém nota; deixar `{{...}}` produz uma que envergonha no
  protocolo.
- **Busca no conteúdo, não só no nome** — índice invertido alcança o texto do documento, a
  descrição do andamento e o corpo da publicação, com trecho destacado no resultado.
  Processo em segredo de justiça fica de fora, pela mesma regra que vale no resto do
  sistema.
- **Assinatura com hash conferido na leitura** — não há ICP-Brasil nem carimbo do tempo,
  mas alterar o texto **quebra a assinatura**, que é a propriedade que uma assinatura
  entrega. Falta o que prova quem assinou, não o que prova que o texto não mudou. Junto vem
  a trilha de quem viu, baixou e editou cada documento.
- **CRM que fecha o ciclo** — o funil soma o **pipeline ponderado** (valor × probabilidade
  da etapa), não o valor cheio de todo mundo que ligou uma vez. Perder exige motivo, e a
  **conversão** cria cliente, contrato e processo numa passagem só, puxando os honorários
  da proposta aceita — redigitar é onde o desconto some. Cliente com o mesmo CPF/CNPJ é
  reaproveitado, não duplicado. O histórico de contato do cliente **começa antes de ele ser
  cliente**: as interações da fase de prospecção continuam alcançáveis pela ficha.
- **Financeiro com a conta certa** — fluxo de caixa nos dois regimes (caixa e competência,
  com a tela dizendo o que cada um responde), aging de recebíveis, juros **pro rata die**,
  pagamento parcial, repasses travados pelo valor da receita de origem e rentabilidade por
  processo. A **linha digitável do boleto é matematicamente válida** no padrão FEBRABAN —
  os três DVs de campo por módulo 10 e o verificador geral por módulo 11 conferem em
  qualquer validador. O que não existe é o registro em banco: o código 999 não é
  instituição real, e a tela diz isso. Linha plausível mas inválida seria a mentira que só
  se descobre no caixa.
- **Timesheet com cronômetro** — hora não faturável também é apontada, porque é ela que
  explica por que um contrato de valor fixo deu prejuízo.
- **Ciclo publicação → prazo → aviso** — a fila lê o texto do diário, sugere o ato e o
  prazo **mostrando os termos que sustentaram a conclusão** e o grau de confiança, vincula
  ao processo pelo número CNJ e entrega a data de disponibilização ao motor do CPC. O prazo
  criado aponta para o andamento que guarda o texto integral, e o responsável é notificado.
  Reconhecer o que **não** abre prazo (mero expediente, homologação, trânsito em julgado) é
  metade do trabalho — prazo fantasma faz o usuário abandonar a fila. Publicação repetida é
  descartada por hash do conteúdo. A consulta aos tribunais é que é simulada.
- **Portal do cliente** — a aba *Compartilhamento* do processo gera um link somente leitura
  com escopo e validade. O portal mostra **apenas** o que estiver marcado como visível ao
  cliente, e nunca valor da causa, provisão, risco, equipe interna ou nota interna. Link
  inválido, expirado e revogado caem todos na mesma tela, porque distinguir os casos já
  contaria que o processo existe. **O link abre em qualquer navegador** — o token carrega
  os dados do compartilhamento, como um JWT; a soma de verificação detecta link truncado,
  mas não é assinatura (sem servidor não há segredo para assinar).
- **Feriados locais do escritório** — o motor calcula os nacionais e os forenses a partir
  da Páscoa, mas **ponto facultativo de comarca, feriado municipal e suspensão de
  expediente por ato do tribunal não seguem regra nenhuma**: só existem no calendário
  daquele foro. Cadastrados em *Configurações ▸ Feriados locais*, passam a valer
  imediatamente em toda contagem de prazo, no calendário e na conferência — e sobrevivem à
  restauração de backup. Sem eles, o sistema contaria um dia útil que não houve e mostraria
  uma data errada com toda a confiança.
- **Importação em massa por CSV** — nenhum escritório migra a carteira digitando. A
  conferência valida o **arquivo inteiro antes de gravar qualquer linha**: CNJ pelo dígito
  verificador, CPF/CNPJ, enums e valores, com o relatório apontando o **número da linha** de
  cada erro. Registro que já existe é detectado e **pulado**, então reenviar o mesmo arquivo
  por engano não duplica o cadastro. Importar sem conferir é recusado.
- **Processos vinculados (apensos)** — cautelar, execução e embargos têm número próprio e
  são o mesmo caso; vinculá-los faz os dois aparecerem juntos. O vínculo passa pelo mesmo
  filtro de segredo de justiça do resto do sistema — um processo em segredo não vaza por
  ser apenso de outro — e um vínculo que criaria ciclo é recusado, porque a árvore de
  apensos recorreria para sempre.

---

## Responsividade

**Toda página é responsiva — é padrão do projeto, não preferência estética.**
Metade do trabalho de advocacia acontece com o celular na mão, no corredor do fórum,
e uma tela que empurra a página de lado esconde o menu e o cabeçalho.

A escala tem quatro degraus, cada um com um motivo físico: **600px** (telefone em pé),
**720px** (telefone deitado), **900px** (tablet — onde a sidebar vira gaveta) e
**1100px** (desktop estreito, onde dois painéis deixam de caber).

Grade de largura fixa colapsa; tabela rola dentro do próprio container e nunca na
página; linha que guarda botão quebra; nada declara largura mínima maior que um
telefone; e a meta viewport **não bloqueia zoom** — num sistema que exibe número de
processo com 20 dígitos, tirar o zoom de quem enxerga mal é barreira de acessibilidade.

`testes/responsivo.test.js` reprova quem sair da escala ou reintroduzir uma das
armadilhas. Ele verifica as **causas** na fonte, não o resultado: o `jsdom` não calcula
largura nenhuma, então medir estouro de verdade exigiria um navegador — e fingir que
mede seria pior que não medir. As regras completas estão em [CLAUDE.md](CLAUDE.md).

---

## Testes

```bash
npm install      # instala jsdom (só para as suítes de interface)
npm test
```

1.935 verificações em 16 suítes. As treze que não precisam de jsdom compartilham o
sandbox de `testes/ambiente.js`, que carrega o núcleo (utils, domínio, seed, store e
services) na ordem de dependência — assim um módulo novo no seed entra num lugar só.

| Suíte | O que cobre |
|-------|-------------|
| `dominio.test.js` | CNJ, feriados, motor de prazos, validadores, máscaras, integridade do seed. **Não precisa de jsdom.** |
| `fundacoes.test.js` | Fase 2: aritmética de centavos, CSV, tokens/anonimização, escala e paleta dos gráficos, enums novos e banco v3. **Não precisa de jsdom.** |
| `seguranca.test.js` | Matriz de permissões, segredo de justiça, sessão, trilha de auditoria, LGPD e backup. **Não precisa de jsdom.** |
| `alertas.test.js` | Avaliador de alertas (incluindo idempotência), notificações, e-mail simulado, dupla conferência e prazo perdido. **Não precisa de jsdom.** |
| `portal.test.js` | Token do portal, escopo, revogação e — sobretudo — o que **não** pode vazar para o cliente. **Não precisa de jsdom.** |
| `publicacoes.test.js` | Classificador com textos no formato do diário, extração de CNJ, vínculo, deduplicação e o prazo gerado com a data que o motor do CPC calcula. **Não precisa de jsdom.** |
| `financeiro.test.js` | Parcelamento que fecha ao centavo, êxito, juros pro rata die, aging, fluxo de caixa nos dois regimes, rentabilidade e a linha digitável FEBRABAN (com dígito trocado em 20 posições). **Não precisa de jsdom.** |
| `crm.test.js` | Funil, ponderação do pipeline, propostas que expiram na leitura e a conversão íntegra de lead em cliente + contrato + processo. **Não precisa de jsdom.** |
| `documentos.test.js` | Preenchimento de modelos (com ênfase na variável sem valor), índice invertido, busca com segredo de justiça aplicado, assinatura que quebra ao alterar o texto e trilha de acesso. **Não precisa de jsdom.** |
| `assistente.test.js` | Resumo, próxima ação, duplicidade, risco, revisor de peça e gramática de intenções — com ênfase nos casos em que o sistema **precisa admitir que não sabe**. **Não precisa de jsdom.** |
| `relatorios.test.js` | Contrato de retorno dos dez indicadores, coerência entre total e tabela, escopo próprio e segredo de justiça nas contas. **Não precisa de jsdom.** |
| `administracao.test.js` | Feriado local que **muda a contagem do prazo** (e sobrevive à restauração de backup), tipos de prazo, importação CSV que confere o arquivo inteiro antes de gravar qualquer linha, e apensos com segredo de justiça aplicado. **Não precisa de jsdom.** |
| `responsivo.test.js` | Padrão de responsividade: escala de breakpoints, colapso das grades de largura fixa, rolagem própria das tabelas e quebra das linhas de ação. **Não precisa de jsdom.** |
| `telas.test.js` | Renderização e navegação de todas as rotas |
| `interacoes.test.js` | Drag & drop (kanban, pastas e envio de arquivo), modais, criação de prazo/tarefa/cliente/pasta, criação/envio/visor/edição/exportação de documentos, baixa de prazo |
| `listeners.test.js` | Regressão: listeners não vazam entre rotas nem acumulam no re-render |

Sem `jsdom` instalado, `npm test` roda só a suíte de domínio e pula as demais com aviso.

---

## Estrutura

```
index.html              Único HTML — carrega os scripts na ordem de dependência
assets/css/             tokens · base · layout · components · pages · portal
data/seed.js            Gerador determinístico dos dados fictícios
src/
  domain/               ⭐ Lógica pura — migra para o React sem alteração
  services/             ⭐ Camada de dados — trocada por fetch na migração
  store/                Estado central + derivações
  components/           Componentes reutilizáveis
  layout/               Sidebar, Topbar, AppShell
  pages/                Uma por rota
  router.js  main.js
testes/
```

---

## Migração para React

O protótipo foi escrito para que a migração seja mecânica. A tabela completa de
equivalências está na seção 10 do [PLANEJAMENTO.md](PLANEJAMENTO.md). Em resumo:

- `src/domain/` é copiado **sem alteração** — só troca a IIFE por `export`
- `src/services/` mantém as assinaturas; só o corpo vira `fetch`
- componentes já recebem props em objeto único e emitem por callback
- `tokens.css` vira o tema do Tailwind ou do design system
- as rotas do hash router já têm a forma do `react-router`
