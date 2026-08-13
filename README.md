# JurisControl — protótipo

Software de controle de processos judiciais para escritório de advocacia.
HTML, CSS e JavaScript puro. Sem framework, sem build, sem backend.

O planejamento completo (modelo de dados, regras, arquitetura e roadmap) está em
[PLANEJAMENTO.md](PLANEJAMENTO.md). O plano dos módulos que ainda faltam — financeiro,
portal do cliente, publicações, CRM, BI, segurança/LGPD e assistente — está em
[PLANEJAMENTO-FASE2.md](PLANEJAMENTO-FASE2.md).

---

## Como abrir

**Duplo clique em `index.html`.** É só isso — não precisa de servidor.

O protótipo evita `type="module"` e `fetch` de JSON justamente para funcionar sob
`file://`, onde ambos são bloqueados por CORS. Ver seção 5.1 do planejamento.

Os dados ficam no `localStorage`. Para voltar ao conjunto original, use o botão **↺**
na barra superior.

---

## Telas

| Rota | Tela |
|------|------|
| `#/entrar` | Entrada — escolha do usuário (sem casca, sem senha) |
| `#/` | Dashboard — prazos críticos, compromissos, distribuição da carteira |
| `#/processos` | Lista de processos em **tabela** ou **kanban** |
| `#/processos/novo` | Cadastro com validação do número CNJ |
| `#/processos/:id` | Detalhe — Dados · Partes · Andamentos · Prazos · Documentos · Tarefas |
| `#/agenda` | Calendário forense + prazos e compromissos |
| `#/clientes` | Lista e ficha de clientes |
| `#/tarefas` | Kanban de tarefas |
| `#/simulador` | Simulador de contagem de prazo com memória de cálculo |
| `#/notificacoes` | Central de notificações do usuário |
| `#/configuracoes` | Usuários, matriz de permissões e regras de alerta *(só administrador)* |
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

---

## Testes

```bash
npm install      # instala jsdom (só para as suítes de interface)
npm test
```

941 verificações em 7 suítes:

| Suíte | O que cobre |
|-------|-------------|
| `dominio.test.js` | CNJ, feriados, motor de prazos, validadores, máscaras, integridade do seed. **Não precisa de jsdom.** |
| `fundacoes.test.js` | Fase 2: aritmética de centavos, CSV, tokens/anonimização, escala e paleta dos gráficos, enums novos e banco v3. **Não precisa de jsdom.** |
| `seguranca.test.js` | Matriz de permissões, segredo de justiça, sessão, trilha de auditoria, LGPD e backup. **Não precisa de jsdom.** |
| `alertas.test.js` | Avaliador de alertas (incluindo idempotência), notificações, e-mail simulado, dupla conferência e prazo perdido. **Não precisa de jsdom.** |
| `telas.test.js` | Renderização e navegação de todas as rotas |
| `interacoes.test.js` | Drag & drop (kanban, pastas e envio de arquivo), modais, criação de prazo/tarefa/cliente/pasta, criação/envio/visor/edição/exportação de documentos, baixa de prazo |
| `listeners.test.js` | Regressão: listeners não vazam entre rotas nem acumulam no re-render |

Sem `jsdom` instalado, `npm test` roda só a suíte de domínio e pula as demais com aviso.

---

## Estrutura

```
index.html              Único HTML — carrega os scripts na ordem de dependência
assets/css/             tokens · base · layout · components · pages
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
