# NovaMente Atlas

**Uma biblioteca que pensa com você.** O Atlas transforma documentos em materiais de estudo com fontes verificáveis, tutoria e prática. Projeto ONE G10 — Oracle + Alura.

Este README foi escrito também para quem está começando. Siga a ordem abaixo; você não precisa configurar inteligência artificial paga para fazer a primeira execução.

> **Estado atual:** primeiro incremento funcional, em um workspace local. Ainda não é o MVP completo nem uma aplicação pronta para acesso público multiusuário. Sem chaves, o sistema usa trechos literais e busca lexical de demonstração. Isso é diferente de uma resposta gerada por LLM ou de embeddings semânticos.

Repositórios sincronizados: [Oracle](https://github.com/Oracle-hackatom-g10-team-4/Nova-mente-Solution) e [No Country](https://github.com/No-Country-simulation/nuevamente-g10-latam-Equipo-4).

Arquitetura atual: [Agent Factory 0.3](docs/SPEC_AGENT_FACTORY_V03.md) + [Conexões e entrega 0.4](docs/architecture/connections-and-delivery.md).

**Revisão de requisitos:** [Matriz MVP e pós-MVP](docs/AUDITORIA_MVP_POS_MVP.md), conferida com o PDF do hackathon. **Configuração:** [chaves, login local, SDKs e deploy por GitHub Actions/GHCR](docs/CONFIGURACAO_E_DEPLOY.md). O edital exige Object Storage e prova vetorial; OCI Compute é opcional.

## Entrega 0.5 em branch — 28/10/2026

A evolução está em `feat/andre-pos-mvp-quality-20261028`, sem atualizar `main`.
[Pacote da entrega](docs/entrega-2026-10-28/README.md): arquitetura modular,
recibos de comandos, trilhas persistentes, regras de progresso no backend,
novos nomes dos tutores preservando IDs e testes de interação/HTTP.

- [Suas ações pendentes](docs/entrega-2026-10-28/SUA_PARTE.md) e [roadmap de três semanas](docs/entrega-2026-10-28/ROADMAP_3_SEMANAS.md).
- [Specs do backlog](docs/entrega-2026-10-28/BACKLOG_E_SPECS.md) e [CSV para o board](docs/entrega-2026-10-28/BACKLOG.csv).
- [Arquitetura atualizada](docs/entrega-2026-10-28/ARQUITETURA.md), [guia técnico do código em PDF](docs/entrega-2026-10-28/Atlas_Guia_Tecnico_Codigo.pdf) e [pitch PDF](docs/entrega-2026-10-28/Atlas_Pitch.pdf).
- [Configuração completa](docs/entrega-2026-10-28/ENV.md), [quality gates](docs/quality/README.md) e [parecer independente](docs/entrega-2026-10-28/REVISAO_INDEPENDENTE.md).

Após `npm run build`, `npm run test:e2e` usa os artefatos de produção
em um workspace isolado, sem chamadas pagas.
`npm run test:runtime` verifica a árvore de dependências de produção e processos
Node/Python compilados. `npm run quality:setup` instala analisadores de
desenvolvimento; `npm run quality` bloqueia novas violações e regressões inclusive
na UI. [Regras e limites](docs/quality/README.md). Não reduzir gates para passar.
Para publicar esta entrega, use `bash scripts/push-branch-both.sh`; o script antigo
`push-both.sh` publica main e não deve ser usado nesta tarefa.

## Por onde começar

| Seu objetivo | Leitura recomendada |
| --- | --- |
| Quero abrir e experimentar | [Primeira execução](#primeira-execução-passo-a-passo) e [primeiro estudo](#seu-primeiro-estudo) |
| Quero entender como tudo se conecta | [Guia didático em PDF](docs/NovaMente_Atlas_Guia_Arquitetura_Iniciantes.pdf) |
| Quero editar o guia | [Fonte do guia em Markdown](docs/GUIA_ARQUITETURA.md) |
| Quero fazer minha primeira contribuição | [Onde alterar](#onde-alterar-cada-coisa) e [rotina Git](#rotina-git-para-a-equipe) |
| Quero conhecer os requisitos e pendências | [Especificação](docs/SPEC.md) e [estado real](docs/STATUS.md) |
| Quero aprofundar os brains e engines | [Arquitetura da orquestração](docs/architecture/brains-and-action-engines.md) |
| Quero configurar um fornecedor | [.env.example](.env.example) e [pesquisa de integrações](docs/research/integrations.md) |

## O que você consegue experimentar hoje

- Adicionar PDF textual, Markdown ou TXT e consultar o texto extraído por página.
- Selecionar fontes, objetivo, perfil, formato e persona; gerar tutorial, flashcards, quiz ou resumo.
- Abrir a evidência citada por um material e conferir o trecho original.
- Conversar nos canais de Nilo, Lumi, Prisma, Fio e Soma.
- Responder quiz com gabarito no servidor e XP que não se duplica pelo mesmo acerto.
- Criar grupo e mensagens em um workspace local de participante único.
- Usar o painel de memória/Dreamer: consentimento, ciclos, versões, rollback e exclusão.

As trilhas completas geradas por LLM, a comunidade multiusuário, a memória coletiva e o grafo físico editável ainda são evolução do produto. O grafo inicial representa fontes locais. A pesquisa web depende de Firecrawl configurado e da ferramenta de agente; ainda não existe um buscador web completo na interface. Sem provedores de geração e judge, o Dreamer não promove uma melhoria avaliada.

## Remover fontes e estudar com tutor automático

No estúdio, “Escolher tutor por mim” usa o Jev quando configurado, com fallback
local declarado. “Personalizar este estudo” permite escolher tutor, método,
formato e perfil manualmente. O chat individual continua com seu Atlas escolhido.

Cada fonte tem a ação “Remover fonte”. A confirmação mostra materiais, trilhas e XP
afetados e avisa que todo o histórico de conversas/memória pedagógica será limpo,
pois o legado não permite separar todos os trechos por origem. Outros documentos
e sua preferência de consentimento permanecem. Você pode optar por refazer o
material aberto usando somente as fontes originais restantes, com os mesmos ajustes.

Se um serviço externo estiver indisponível ou faltar proveniência antiga, aparece
uma pendência; geração aguarda a limpeza confirmada. Fechar a janela permite seguir
navegando. Reenviar o arquivo após concluir cria uma nova fonte. Guia administrativo,
limites da exclusão e mapa do código: [ciclo de vida das fontes](docs/architecture/source-lifecycle.md).

## Antes de abrir o terminal

**Terminal** é a janela em que você digita comandos. **Raiz do projeto** é a pasta que contém este README, `package.json`, `apps/` e `services/`.

O caminho documentado e testado usa **Linux AMD64, Node 24, npm 11 e Python 3.12**, com `venv` e `setsid`. No Windows, prefira WSL2 com Ubuntu 24.04 e mantenha os arquivos dentro do Linux, por exemplo em `~/projetos`. Os scripts atuais não têm suporte nativo validado para PowerShell ou macOS.

Confira as ferramentas:

```bash
node --version
npm --version
python3 --version
git --version
command -v setsid
```

Espere versões `v24.x`, `11.x` e `Python 3.12.x` nos três primeiros comandos. Se aparecer `command not found`, a ferramenta ainda precisa ser instalada. Para Node, siga a distribuição oficial em [nodejs.org](https://nodejs.org/); não instale uma versão diferente só porque ela é a padrão do sistema.

Em Ubuntu 24.04, se Git ou o módulo de ambiente virtual do Python estiverem faltando:

```bash
sudo apt update
sudo apt install -y git python3.12 python3.12-venv
```

Esses comandos são para esse sistema operacional; não os copie em outro sistema. `sudo` usa permissão de administrador. Peça apoio a alguém da equipe se não souber qual ambiente está usando. Docker é opcional para desenvolvimento e será explicado mais adiante.

## Primeira execução, passo a passo

### 1. Baixar e entrar na pasta

Se você ainda não tem uma cópia do projeto:

```bash
git clone https://github.com/Oracle-hackatom-g10-team-4/Nova-mente-Solution.git
cd Nova-mente-Solution
```

Se já está no ambiente cloud do projeto, entre na cópia existente; **não clone por cima nem crie um worktree**. Nesta configuração, a pasta é `/workspace/Nova-mente-Solution`.

### 2. Preparar dependências e configuração

Execute na raiz:

```bash
bash scripts/setup.sh
```

Esse script:

1. Cria `.env` a partir de `.env.example`, somente se ele ainda não existir.
2. Preenche o token interno vazio com um valor aleatório e restringe a leitura do arquivo.
3. Instala as dependências JavaScript usando `package-lock.json`.
4. Cria `.venv`, o ambiente isolado de pacotes Python, e instala `requirements.lock`.

Você não precisa ativar a `.venv` manualmente para usar os comandos da raiz. A primeira instalação pode demorar. O setup preserva um `.env` existente: novos campos acrescentados ao exemplo precisam ser comparados e incluídos manualmente quando necessários.

**Não cole o conteúdo de `.env` em chat, issue ou captura de tela.** Ele contém credenciais. O exemplo é público; o arquivo real fica fora do Git.

Os scripts preservam variáveis já injetadas pelo ambiente cloud; `.env` fornece apenas valores ausentes. Não imprima variáveis de credenciais para diagnosticar configuração.

### 3. Iniciar os três serviços

No **terminal A**, na raiz:

```bash
npm run dev
```

Mantenha esse terminal aberto. Espere mensagens de prontidão do Next, da API Atlas e do Uvicorn. Eles são três programas que trabalham juntos:

| Programa | Porta local | Função |
| --- | --- | --- |
| Next.js | 3000 | Mostra a interface e encaminha pedidos pelo proxy do servidor |
| NestJS | 4000 | Valida pedidos, executa brains e Action Engines |
| Python/FastAPI | 8000 | Extrai documentos, recupera evidências e mantém materiais/memória |
| Eve, necessário para agentes generativos | 2000 | Executa sessões de modelos e handoffs; não inicia com `npm run dev` |

No seu computador local, abra o navegador em `http://127.0.0.1:3000` para conhecer a landing Atlas. Clique em **Crie seu Atlas** para escolher nome, cor e tutor-base, ou em **Abrir estúdio** para ir direto a `http://127.0.0.1:3000/studio`. Em um ambiente remoto, use o mecanismo de acesso a portas fornecido pela plataforma, sem alterar o bind para expor os serviços publicamente. Não há autenticação pública pronta nesta versão.

### Conexões e modelos

Abra `/workspace/settings` (também disponível em `/studio/settings`) ou **Conexões e modelos** na barra lateral. O painel separa geração, Jev, Firecrawl e embeddings opcionais. Aceita chaves gerenciadas por ambiente/arquivos ou chaves manuais criptografadas no servidor. `npm run init:vault` prepara a chave mestra em um checkout existente; reinicie os serviços depois. Não há chaves salvas no navegador.

Eve pode chamar SDKs independentes OpenAI-compatible/OpenRouter e Anthropic, além do AI Gateway. O login por assinatura ChatGPT é opção de **desenvolvimento local**, mediante habilitação do operador e `/login` no terminal Eve; não é login de usuários do Atlas nem API de produção. Não há reutilização das credenciais do Codex desenvolvedor.

O uso cotidiano continua sem modelo dedicado de embeddings: lexical, contexto de documentos e reranking Jev opcional. O caminho semântico fica disponível para o critério obrigatório do edital. Ao trocar embeddings, reindexe; o classificador Jev não gera vetores.

### Seu Atlas: identidade pessoal

A landing segue o novo book: Instrument Serif nos títulos, Plus Jakarta Sans na interface, superfícies escuras, órbitas e laranja. Veja os tokens e limites em [Direção visual Atlas](docs/DESIGN_ATLAS.md).

1. Em **Crie seu próprio Atlas**, digite um nome de até 24 caracteres.
2. Escolha uma das quatro cores e um dos cinco tutores como perspectiva inicial.
3. Clique em **Criar meu Atlas e começar**. O estúdio abre com esse tutor selecionado.
4. Use **Personalizar [nome]** na barra lateral para editar ou restaurar os tutores originais. No celular, abra primeiro o menu de navegação.

Nome e aparência são preferências visuais neste navegador (`localStorage`), sem sincronização entre dispositivos. As chamadas ao backend preservam o ID da persona original; esta primeira etapa não renomeia prompts, treina modelos nem cria uma nova persona no servidor. A escolha não fixa método, não concede ferramentas e não ativa memória Dreamer. A memória continua exigindo consentimento separado. Não há conta ou plano pago criado pelo formulário.

### 4. Conferir se está funcionando

Abra o **terminal B**, também na raiz:

```bash
npm run smoke
```

O resultado esperado termina com `Smoke HTTP passou`. Esse teste cria um documento, material, grupo e mensagem de teste no workspace local e verifica citações, XP e Dreamer. Ele não é apenas uma consulta de saúde.

Se falhar imediatamente por conexão, aguarde a inicialização no terminal A e tente novamente. Se continuar falhando, vá para [Problemas comuns](#problemas-comuns). Não inicie uma segunda cópia do `npm run dev` sobre as mesmas portas.

### 5. Parar e voltar depois

No terminal A, pressione **Ctrl+C**. Isso encerra os processos iniciados pelo script. Os documentos permanecem em `data/`.

Para voltar outro dia:

```bash
cd Nova-mente-Solution
npm run dev
```

Depois de atualizar dependências do repositório, pare os serviços e execute o setup antes de reiniciar. Você não precisa reinstalar tudo a cada alteração de texto ou componente.

## Seu primeiro estudo

1. Abra **Estúdio de adaptação**. Há uma fonte demonstrativa da equipe quando o workspace está vazio e o seed está habilitado.
2. Clique em **Adicionar fonte** e envie o [exemplo de primeiro estudo](docs/examples/primeiro-estudo.md), um PDF com texto selecionável, um `.md` ou `.txt` UTF-8.
3. Selecione a fonte. Comece com um documento curto para entender o fluxo.
4. Escolha **Iniciante**, o formato desejado e um dos cinco tutores. Deixe o método automático no início.
5. Escreva um objetivo concreto, como “Explique os principais conceitos deste documento”. Gere o material.
6. Clique em uma citação e confira o trecho no painel de fontes. Citação é evidência; não é só decoração.
7. Experimente um quiz. A resposta correta é conferida no servidor; repetir o acerto da mesma atividade não gera XP novamente.
8. Abra **Canais dos agentes** para conversar sobre as fontes selecionadas.

Sem chaves, o material estará em `extractive_demo`: passagens literais organizadas, com exercícios de demonstração. Uma resposta `abstained` significa que o sistema preferiu não publicar conteúdo sem respaldo. Não desative esse comportamento para “sempre aparecer uma resposta”.

**Limites de upload:** 10 MiB por arquivo, até 100 páginas no PDF, até 300 mil caracteres extraídos e até 512 segmentos. Há timeout e limite de memória no parser PDF. PDFs escaneados sem texto e arquivos com senha não têm suporte neste incremento. Se um limite for excedido, divida o material em volumes menores.

## Times de agentes: colaboração nos bastidores

Com Eve e TypeSafe configurados, `ATLAS_TEAM_DEBATE=1` ativa o fluxo no backend:

1. Nilo propõe uma explicação; Fio recebe a proposta e apresenta uma alternativa prática.
2. Jev avalia as duas propostas nas mesmas evidências autorizadas.
3. Se a política pedir outra rodada e a qualidade inicial não atingir o critério
   de parada, Lumi e Soma trocam propostas e fazem revisões para seus times.
4. Jev compara as propostas sustentadas. A persona escolhida pelo usuário sintetiza
   o resultado; Python valida suas citações e executa o gate final.

São três a cinco turnos Eve sequenciais, com deadline global de 90 segundos na
factory, uma busca web e até três delegações nativas adicionais por execução.
A interface entrega a síntese e as fontes. Não mostra votação, ranking interno
ou raciocínio privado. Personas são consistentes e usam contexto consentido;
sem provedores, a interface declara o modo extrativo e não simula debate.

Jev também escolhe método/RAG, avalia a relevância das passagens e filtra resultados
Firecrawl. Decisão de relevância não equivale a comprovação factual: o gate final
continua necessário. Menos rodadas pode reduzir custo/latência; a rapidez real
precisa ser medida com os fornecedores configurados.

## Arquitetura em linguagem simples

Pense em uma biblioteca: a interface é o balcão; o proxy entrega o pedido; o Nest organiza o atendimento; o brain escolhe a abordagem; a Action Engine executa uma tarefa com regras; o Python localiza e organiza as evidências. O Dreamer revisa experiências autorizadas para propor um atendimento melhor no futuro.

![Mapa dos serviços Atlas](docs/diagrams/architecture.svg)

### Brain, agente, método, modelo e engine são diferentes

| Conceito | O que significa no Atlas | Exemplo |
| --- | --- | --- |
| Persona/agente | Forma de conversar e responsabilidade pedagógica | Nilo é tutor; Prisma é revisor |
| Brain | Coordenação de domínio: fontes, memória consentida, decisão e ação | Brain selecionado organiza o pedido antes da execução |
| Método | Técnica de aprendizagem | Feynman, socrático, primeiros princípios ou Warburg |
| Modelo/provedor | Serviço de inferência usado em uma função | TypeSafe decide/julga; outro LLM gera conteúdo |
| Action Engine | Resultado de domínio com contrato, autorização e execução | Learning Engine entrega material citável |
| Eve | Runtime de sessões e delegação entre agentes | Nilo encaminha uma tarefa a um especialista |
| Dreamer | Ciclo de aperfeiçoamento pedagógico com avaliação e versões | Reduzir revisão redundante após replay sem regressão |

**Invokta não fornece uma classe `Brain`.** Essa abstração é do Atlas, construída sobre suas capacidades e regras. O projeto usa `@invokta/core@0.9.0` com `createEngine`, `defineCapability` e `engine.invoke`. As engines rodam dentro do Nest; não são três novas VMs.

| Engine / versão | Capacidades principais |
| --- | --- |
| `atlas-learning` / 0.2.0 | Listar fontes autorizadas, gerar, conversar e avaliar suporte |
| `atlas-research` / 0.2.0 | Pesquisar com Firecrawl hospedado |
| `atlas-memory` / 0.2.0 | Consultar estado, consentir, agendar ciclo, rollback e exclusão |

Os principals — identidades confiáveis de execução — são criados pelo servidor. Brains não podem conceder consentimento, apagar memória, iniciar ciclos administrativos ou reverter políticas. Uploads, quiz/XP e grupos ainda têm rotas próprias; nem toda a API foi migrada para engines.

### O percurso de um pedido

```text
Navegador → proxy Next → Nest → brain da persona
  → fontes autorizadas + política consentida do Dreamer
  → decisão TypeSafe ou política local
  → Learning Engine → Python → recuperação de evidências
  → LLM/Eve configurado ou demonstração extrativa
  → validação, citações, judge quando configurado e persistência
  → material de volta à interface
```

O browser não chama o Python diretamente nem recebe as chaves dos fornecedores. O gabarito do quiz também permanece no servidor. O endpoint interno autenticado `/v1/orchestration` permite inspecionar o catálogo de brains/engines; ele não está liberado no proxy Next.

## Mapa de pastas: onde procurar primeiro

```text
apps/web/                      Interface Next e proxy do servidor
  components/atlas.tsx         Telas e interações do primeiro incremento
  app/globals.css              Cores, espaços, tipografia e responsividade
  app/api/atlas/[...path]/      Fronteira entre navegador e Nest
apps/api/                      API Nest, Invokta e autoria Eve
  src/main.ts                  Rotas, adapters e montagem das dependências
  src/policy.ts                Contratos de entrada, decisão e judge
  src/orchestration/brains.ts  Registro e fluxo dos cinco brains
  src/orchestration/actions.ts Engines, capacidades, schemas e acesso
  agent/                       Instruções e configuração do runtime Eve
  test/                        Testes Node de política e orquestração
services/cognition/atlas/      Domínio Python
  main.py                      Endpoints, concorrência e agendamento
  rag.py / extract.py           Ingestão, recuperação e parser PDF isolado
  learning.py                  Materiais, personas, quiz e XP
  dreamer.py                   Replay, promoção, rollback e exclusão
  store.py                     SQLite, objetos e comunicação de memória
  providers.py                 Adapters LLM, embeddings e judge
  models.py                    Schemas Pydantic e pacote educacional
packages/contracts/            Tipos compartilhados com a interface
schemas/                       JSON Schema do pacote educacional
scripts/                       Setup, desenvolvimento, smoke e reindexação
infra/ + compose.yaml          Imagens e execução em containers
docs/                          Spec, arquitetura, PDF e estado real
.agents/skills/                 112 skills de apoio ao desenvolvimento
data/ e .env                   Dados/configuração locais; fora do Git
```

## Onde alterar cada coisa

| Quero mudar... | Comece aqui | Confira depois |
| --- | --- | --- |
| Cor, espaçamento ou layout | `apps/web/app/globals.css` | Desktop e celular, contraste e foco |
| Texto e interação de uma tela | `apps/web/components/atlas.tsx` | Fluxo no navegador e typecheck |
| Regra de escolha do método | `apps/api/src/policy.ts` | Override manual e teste de política |
| Coordenação de um brain | `apps/api/src/orchestration/brains.ts` | Fontes, consentimento e testes de orquestração |
| Nova ação de domínio | `apps/api/src/orchestration/actions.ts` | Schema, acesso, timeout e teste da capacidade |
| Persona generativa | `learning.py` e instruções em `apps/api/agent/` | Alinhamento com registro/UI; sem alegar mudança real no modo extrativo |
| Busca em documentos | `services/cognition/atlas/rag.py` | Citações, isolamento, abstenção e reindexação |
| Avaliação ou memória | `dreamer.py`, `store.py` e `models.py` | Consentimento, exclusão concorrente e rollback |
| Contrato de resposta | `models.py`, `packages/contracts/` e schemas | Python, TypeScript e interface concordando |

Antes de editar Next, leia [apps/web/AGENTS.md](apps/web/AGENTS.md) e a documentação da versão instalada. Um novo formato ou uma nova persona exige atualizar vários contratos; trocar apenas o botão deixa o sistema inconsistente. O guia PDF contém exercícios graduais para evitar esse erro.

## RAG: como o Atlas usa seus documentos

**RAG** significa recuperar informações relevantes e entregá-las à geração. Ele não treina automaticamente o modelo no seu PDF.

| Estratégia | Uso no projeto |
| --- | --- |
| `vector` | Recupera segmentos pelo índice vetorial configurado |
| `hybrid` | Combina ranking vetorial e busca textual FTS |
| `lm` | Injeta documento integral e mapa de evidências quando cabem no orçamento |

Sem chave, o vetor é um hash lexical de demonstração, não um embedding semântico. O modo `lm` tem orçamento padrão de 24.000 caracteres; acima dele, o sistema pode recorrer ao híbrido e registrar a mudança, em vez de cortar o documento silenciosamente.

Ao ativar ou trocar o modelo de embeddings, pare os serviços e execute:

```bash
bash scripts/reindex.sh
```

Esse comando é para a biblioteca local em `data/`, conforme o `.env`. Ele preserva IDs de fonte/citação e só grava a atualização após o cálculo completo. Uma falha do provedor preserva o índice anterior. Em containers, a biblioteca fica em outro volume: não use o comando local esperando alterar o volume Docker.

## Dreamer: memória e aperfeiçoamento são parte do núcleo

Dreamer é núcleo e implementa uma adaptação do **Dream-RSI**: o agente consolida
experiências e melhora sua política de exploração sobre um simulador de histórico.
O modelo gerador e o avaliador permanecem fixos. A implementação usa políticas
JSON tipadas, em lugar de executar código arbitrário produzido pelo modelo.

1. Com consentimento, a exploração online registra propostas, revisões, relações
   de parentesco e resultados reais do judge. Sem avaliação não há mundo elegível.
2. Três mundos com pelo menos duas rodadas avaliadas formam o pool mínimo. O
   treinamento usa parte dele; o terço mais recente fica separado para validação.
3. Soma, executada no Eve, propõe ordem de exploração, limite de rodadas e critério
   de parada. Não recebe resultados dos mundos reservados para validação.
4. O simulador revela apenas filhos registrados, na ordem histórica. **Não chama
   novamente o agente nem o judge**. Um ramo inexistente é marcado como sem cobertura.
5. A política precisa preservar a melhor qualidade observada em cada mundo,
   não regredir em utilidade e melhorar a média de validação em mais de 0,01.
   Utilidade = melhor score registrado menos 0,03 por tentativa representada.
6. A promoção é atômica, versionada e consumida pelas próximas execuções. Pode
   economizar uma revisão redundante. Preferências pedagógicas não podem mudar
   sem contrafactual observado; segurança e permissões nunca são autoalteradas.
7. Revogação, rollback e exclusão invalidam trabalhos e escritores antigos.

É uma adaptação limitada a duas rodadas e um worker, adequada ao orçamento de RAM.
Score de judge é um indicador de suporte/utilidade, não medição de aprendizado
humano. Não atribuímos ao Atlas os resultados experimentais do artigo.

| Estado | Significado para quem está usando |
| --- | --- |
| `awaiting_consent` | Falta consentimento explícito |
| `awaiting_events` | Faltam experiências ou casos elegíveis |
| `awaiting_evaluation` | Faltam provedores ou o limite diário de replay foi atingido |
| `queued` / `evaluating` | Ciclo aguardando ou executando avaliação |
| `promoted` / `rejected` | Candidata aprovada ou baseline preservada |
| `cancelled` / `failed` | Operação invalidada ou avaliação não concluída |

Há no máximo uma proposta remota de política por workspace/dia; o agendador verifica condições a cada hora por padrão. Testes com provedores controlados verificam o mecanismo, não eficácia pedagógica em pessoas. O compartilhamento de histórico entre personas no workspace depende de consentimento; conversar pode manter histórico local da persona mesmo sem consentir com o aperfeiçoamento. Apagar memória também limpa esse histórico, mas não remove documentos e materiais da biblioteca.

### Memória em outra VM Oracle ou Railway

Esse é um caminho preparado, ainda não validado em um serviço externo real:

- No Atlas principal, configure `MEMORY_SERVICE_URL` HTTPS e `MEMORY_SERVICE_TOKEN`.
- No serviço externo, use o mesmo domínio Python, `ATLAS_SEED_DEMO=0`, token interno próprio correspondente ao token de memória e credenciais de geração/judge server-side.
- No serviço externo que guarda os dados, deixe `MEMORY_SERVICE_URL` vazio: apontá-lo para si mesmo causaria encaminhamento recursivo.
- Configure o `ATLAS_API_URL` externo para alcançar o Nest que executa o judge, por rede privada/TLS; alinhe o token interno aceito por esse Nest. O contrato atual usa esse mesmo token para o judge, então não presuma suporte a credenciais diferentes por rota.
- Verifique consentimento, tenant, retenção, custos e exclusão nos dois lados antes de usar dados reais.

O browser permanece sem credenciais desses serviços. O Memory Engine tenta apagar a cópia remota e sempre limpa o histórico local; uma falha remota continua sendo reportada, não vira uma confirmação falsa de exclusão.

## Configurar integrações, uma por vez

Pare os processos antes de editar `.env` e reinicie depois. Mantenha a chave vazia quando não for usar o recurso. Não coloque credenciais em `NEXT_PUBLIC_*`, código, Git ou prompts. Segredos do ambiente cloud devem ser cadastrados pelo mecanismo seguro da plataforma quando disponível.

| Função | Variáveis principais | Resultado a validar |
| --- | --- | --- |
| Decision model e judge TypeSafe/Jev | `TYPESAFE_API_KEY` | Método/recuperação tipados e veredito real |
| Geração direta | `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | JSON válido, fontes autorizadas e dois formatos/perfis |
| Embeddings | `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_API_KEY` | Reindexação e recuperação semântica |
| Pesquisa | `FIRECRAWL_API_KEY` | Busca autenticada com resultados limitados |
| OCI Object Storage | `STORAGE_PROVIDER=oci`, `OCI_NAMESPACE`, `OCI_BUCKET`, modo de identidade | Original e JSON enviados e conferidos por readback |
| Eve | Painel ou `EVE_MODEL_PROVIDER`/`EVE_MODEL`/chave do SDK; `EVE_URL`, `EVE_SERVICE_TOKEN` | Runtime autenticado e turno real |
| Memória externa | `MEMORY_SERVICE_URL`, `MEMORY_SERVICE_TOKEN` | Consentimento e exclusão coordenados |

Os adapters diretos de geração/embeddings aceitam um contrato no formato OpenAI, com endpoints `/chat/completions` e `/embeddings`. Isso não comprova compatibilidade SubQ Snap: nome de modelo, base e contrato desse fornecedor continuam pendentes de confirmação. TypeSafe é decisão/judge, não embedding. Dream-RSI é inspiração para o mecanismo; não há SDK oficial dele presumido. A instalação oficial de Antigravity CLI continua não confirmada.

### Iniciar Eve quando o provedor estiver pronto

Escolha explicitamente o modelo e configure suas credenciais server-side. O script não escolhe um modelo pago silenciosamente.

```bash
bash scripts/eve.sh build
bash scripts/eve.sh start
```

São comandos separados: build prepara o runtime; start o mantém em execução em outro terminal. Configure `EVE_URL` no app principal somente quando o runtime estiver pronto e reinicie o app. O canal valida tickets assinados de curta duração emitidos pela factory. `EVE_SERVICE_TOKEN`
é o segredo de assinatura entre os servidores (fallback local: token interno), não uma
chave enviada ao modelo. Configure o mesmo segredo e tenant nos dois processos.
`ATLAS_AGENT_RUNTIME=eve` é o padrão. O modo direto requer seleção explícita
`ATLAS_AGENT_RUNTIME=direct`; falha de Eve não troca de provedor silenciosamente.
`npm run check:eve` confere health, recusa de ticket inválido e prewarm/reset autenticado sem solicitar um turno LLM; compile a API antes e configure `EVE_URL`. A geração real ainda precisa ser testada separadamente.
`EVE_MODEL_CONTEXT_WINDOW`, quando preenchido, deve corresponder a um teto válido
para o modelo; sem ele, o build consulta o catálogo do Gateway.

O build foi verificado anteriormente com um modelo de metadados embutidos no SDK; isso não seleciona o fornecedor final nem demonstra inferência real. O filesystem virtual JS e as ferramentas padrão desativadas reduzem o acesso do agente ao host. Não habilite shell/arquivos arbitrários para resolver uma falha de configuração.

## Verificações: qual comando responde a qual pergunta

Com os serviços ativos no terminal A, use o terminal B:

```bash
npm test
npm run typecheck
npm run smoke
npm run test:proxy -w @atlas/web
```

| Comando | O que verifica | Precisa dos serviços ativos? |
| --- | --- | --- |
| `npm test` | 11 testes Node e 14 Python na versão documentada | Não; Python usa diretórios temporários |
| `npm run typecheck` | Consistência de tipos, incluindo autoria Eve | Não |
| `npm run build` | Compilação Nest e Next | Não; prefira parar o Next dev ao gerar seu build |
| `npm run smoke` | Fluxo HTTP real com upload, citação, quiz, Dreamer e grupo | Sim; altera a biblioteca local com dados de teste |
| `npm run test:proxy -w @atlas/web` | Oito verificações da fronteira Next | Sim |

Para compilar o Next, pare o terminal A, rode o build e reinicie `npm run dev` antes dos testes HTTP. Os números de testes podem crescer; consulte a saída real e o [STATUS](docs/STATUS.md). Provedor controlado em teste não significa chamada remota real.

## Rotina Git para a equipe

Antes de começar, veja o estado:

```bash
git status
git switch main
git pull --ff-only
git switch -c feat/minha-primeira-alteracao
```

Se houver alterações locais antes de trocar de branch, pare e combine com a equipe como preservá-las. Não use `reset --hard` ou `clean` para “arrumar” algo que você não entende.

Faça uma alteração pequena, verifique, depois selecione **os arquivos específicos**:

```bash
git diff
git add caminho/do/arquivo
git diff --cached
git commit -m "docs: esclarece o primeiro estudo"
git push -u origin feat/minha-primeira-alteracao
```

Abra um pull request no GitHub e descreva o que mudou e como conferiu. `git add` prepara o commit; `commit` salva na sua cópia; `push` envia ao GitHub. Nenhum deles faz deploy da aplicação. Não copie a palavra `caminho/do/arquivo`: substitua pelo arquivo que você realmente alterou.

O repositório inclui os 112 skills instalados, mas eles são apoio ao desenvolvimento, não agentes do produto nem processos em produção. Escolha a skill relevante à tarefa; não aplique todos os packs simultaneamente.

## Docker e Oracle: 4 GB disponíveis para o Atlas

A VPS pode ter 8 GB totais, mas o Atlas só pode usar aproximadamente 4 GB.
Os outros 4 GB são de outras cargas. Construa imagens em CI ou em máquina de
build; os limites abaixo valem para operação, não para instalação/compilação.

```bash
docker compose up -d --build --wait
npm run smoke
docker compose down
```

Sem modelos, esses comandos usam demonstração extrativa. Para o runtime real,
configure o `.env` e acrescente o arquivo de agentes:

```bash
docker compose -f compose.yaml -f compose.agents.yaml up -d --build --wait
```

| Serviço | Limite |
| --- | --- |
| Next | 384 MiB |
| Nest | 384 MiB |
| Python/parser | 896 MiB |
| Eve | 896 MiB |
| Total com Eve | 2560 MiB |
| Qdrant local opcional | +512 MiB |
| Total com Eve e Qdrant | 3072 MiB |

Limites são metas de contenção, não garantia de capacidade sob qualquer carga.
Há uma geração/parser e uma factory ativa por vez, recusas 429 e fila de até oito
jobs pendentes. Use `docker stats --no-stream` e confira OOM/restarts sob carga.
O diretório `data/` local e o volume `atlas-data` do Compose são bibliotecas diferentes.
`docker compose down` preserva volumes; não use `down -v` para uma parada normal.

**Imagens na Oracle:** OCIR guarda imagens Docker; a VM executa os containers;
Object Storage guarda PDFs originais e pacotes JSON. Upload/readback OCI é obrigatório
para encerrar o MVP. Credenciais e documentos privados não entram nas imagens.
AMD não é automaticamente Always Free: confirmar SKU, cotas e preço da conta.

O volume `eve-workflow` preserva `.eve/.workflow-data`. Um proxy para Eve deve
encaminhar `/eve/` e `/.well-known/workflow/`. Mantenha tudo em loopback/rede interna
até implementar autenticação pública multiusuário.

## Qdrant, MongoDB e Trigger.dev: quando ativar

Os três conectores são opcionais. O perfil padrão usa SQLite WAL e scheduler local;
isso permite desenvolver sem abrir contas ou iniciar bancos que não serão usados.

| Serviço | Papel | Configuração e verificação |
| --- | --- | --- |
| Qdrant | Índice semântico filtrado por tenant/documento/modelo | `VECTOR_BACKEND=qdrant`, URL/chave e embeddings reais; reindexar antes de consultar |
| MongoDB externo | Projeção de metadados dos documentos | `MONGODB_URI`; instalar `requirements-mongo.lock`; sincronizar e conferir campos |
| Trigger.dev externo | Disparar jobs Dreamer por ID | Publicar task, configurar callback HTTPS exclusivo e chave de runner |

Qdrant não recebe texto integral, somente vetores e referências. A consulta
confere filtros e IDs novamente no Atlas. Erro de Qdrant configurado não vira
hashing lexical silenciosamente. Reindexação cria coleção nova e só depois troca
os ponteiros na transação SQLite. Coleções antigas exigem limpeza operacional
após conferir backups e ausência de leitores; nunca apagar por nome presumido.

Para Qdrant na própria VPS, acrescente `compose.qdrant.yaml` aos arquivos Compose.
O serviço é limitado a 512 MiB e não publica portas. Configure chave e embeddings
antes; esse perfil não funciona como demonstração lexical.

Para Mongo, instale somente no serviço que usar o conector:

```bash
.venv/bin/pip install -r services/cognition/requirements-mongo.lock
# Execute a partir de services/cognition com as variáveis do servidor carregadas:
../../.venv/bin/python -m atlas.projections
```

Mongo exige TLS e um pool de até duas conexões. As consultas usam tenant, projeção,
índice composto e paginação. A projeção contém apenas IDs, título, hash, versão,
quantidade de páginas/caracteres e data. Não armazena PDFs, texto, conversas ou
segredos. Falha deixa estado `pending`; SQLite continua sendo a fonte de verdade.
Em Docker, construa cognition com `--build-arg ATLAS_WITH_MONGO=1` se precisar.

Para Trigger.dev, o runner está em `integrations/trigger/`:

```bash
npm ci --prefix integrations/trigger
npm run typecheck --prefix integrations/trigger
```

Configure `TRIGGER_PROJECT_REF`, publique a task `atlas-dreamer` na sua conta pelo
CLI oficial e cadastre as variáveis de callback/runner nessa plataforma. Depois
configure `ATLAS_JOB_RUNNER=trigger` e `TRIGGER_SECRET_KEY` no Atlas. O callback
usa `ATLAS_JOB_RUNNER_TOKEN` próprio; não aceita o token de runner em outras rotas.
Exponha somente essa rota por rede privada/TLS ou proxy restrito ao runner, nunca
o serviço inteiro. Sem rota segura alcançável, mantenha runner local. Não há
conta/worker externo provisionado por este commit.

O contrato envia somente IDs de job/tenant. Idempotência e lease permanecem no
SQLite, inclusive após reinícios. O guia oficial Trigger self-host requer 6+ GB
para webapp e 8+ GB para worker; por isso não instalamos esse stack na VPS.

Em ambiente cloud com proxy, use os certificados e o proxy fornecidos pela plataforma. O BuildKit recebe a CA pública por secret; para chamadas HTTPS em containers de runtime também é necessário montar a CA e configurar a confiança de cada cliente. Não desative TLS. Serviços externos continuam sujeitos à allowlist e às credenciais configuradas.

## Problemas comuns

| Sintoma | Primeira verificação | Próximo passo seguro |
| --- | --- | --- |
| `git clone` diz que o repositório não existe | Conta e acesso à organização | Conferir URL e acesso com a equipe; não colar tokens em chat |
| `node`, `npm` ou `python3` não existe | Versões e instalação | Instalar a versão exigida; depois repetir o setup |
| Erro de `venv`/`ensurepip` | Módulo Python da distribuição | Em Ubuntu 24.04, instalar `python3.12-venv` |
| `tsx`/`next` não encontrado | Setup terminou sem falha? | Parar serviços, executar setup e conferir o primeiro erro |
| Porta já em uso | Outro terminal dev ou Compose ativo | Encerrar apenas a instância conhecida; não matar processos aleatórios |
| Interface abre, mas retorna 502/503 | Logs de Next, Nest e Python | Esperar prontidão; conferir portas, token e adapters |
| 401 ao abrir a API 4000 diretamente | API interna exige Bearer | Usar a interface; não remover a autenticação interna |
| Nenhum texto no PDF | É scan ou tem senha? | Enviar versão textual, Markdown ou transcrição |
| Arquivo rejeitado por limite | Tamanho, páginas, caracteres e segmentos | Dividir o documento; não aumentar limites sem teste |
| Índice/modelo de embedding mudou | Configuração foi trocada? | Reindexar a biblioteca correta com serviços parados |
| Dreamer não promove | Estado e motivo do ciclo | Conferir consentimento, casos, provedores e limite diário |
| Grupo mostra só você | Workspace único atual | Não há comunidade multiusuário pronta nesta versão |
| Falta disco no build | Espaço e caches do próprio projeto | Identificar artefatos descartáveis; preservar dados, volumes e `.env` |
| Alerta moderado em dependência | `npm audit` e STATUS | Revisar atualização compatível; não usar `audit fix --force` sem análise |

Ao pedir ajuda, informe comando executado, sistema/versões e a mensagem de erro **sem tokens, chaves ou documentos privados**. Um erro antigo no terminal pode não ser o atual: repita uma vez depois de corrigir a causa identificada.

## Gerar novamente o PDF da equipe

A versão pronta está em [docs/NovaMente_Atlas_Guia_Arquitetura_Iniciantes.pdf](docs/NovaMente_Atlas_Guia_Arquitetura_Iniciantes.pdf). A fonte editável é [docs/GUIA_ARQUITETURA.md](docs/GUIA_ARQUITETURA.md); o gerador está em `scripts/docs/build_guide.py`.

As dependências da documentação são separadas da aplicação:

```bash
python3 -m venv .venv-docs
.venv-docs/bin/python -m pip install -r docs/requirements.txt
.venv-docs/bin/python scripts/docs/build_guide.py
```

Os SVGs são saídas geradas: para mudar um diagrama, edite a função `diagrams()` do gerador, em vez de alterar somente o SVG. O gerador usa fontes TrueType DejaVu do sistema; em Ubuntu, instale `fonts-dejavu-core` se necessário. Ele produz PDF pesquisável, sumário com páginas, bookmarks e diagramas SVG. Depois de alterar a fonte, gere o PDF, abra as páginas afetadas e confira tabelas, acentos e blocos de código antes de enviar os dois arquivos no mesmo commit.

## Princípios para continuar o projeto

Leia [AGENTS.md](AGENTS.md), [SPEC](docs/SPEC.md), [STATUS](docs/STATUS.md) e a pesquisa de integrações antes de mudar arquitetura. A landing segue o [book Atlas](docs/DESIGN_ATLAS.md); o estúdio conserva o leitor de fontes, o foco e o baixo estímulo do Atelier. Mantenha segredos no servidor, citações reais, gabaritos privados e consentimento explícito. Rust e inferência local pesada não fazem parte deste incremento. Uma demonstração local que funciona é o começo da validação, não a conclusão automática do MVP Oracle.

## Publicar o mesmo commit nos dois repositórios

Depois de revisar e commitar, execute `bash scripts/push-both.sh`. O script envia
`HEAD` para `main` nos dois destinos, sem force, e confere o SHA remoto. Se o
segundo falhar, informa sincronização parcial; preserve os commits e corrija
acesso/divergência antes de repetir. Não há transação atômica entre dois GitHubs.


## Build e registry fora da VPS

O PDF permite GitHub Actions para build e GHCR para imagens Docker. OCI Compute é opcional; OCI Object Storage é obrigatório para originais e JSONs. Os workflows `Atlas checks` e `Atlas container images` não recebem chaves dos modelos nem da OCI. A publicação no GHCR é manual em `main`, com tags pelo SHA completo.

`compose.deploy.yaml` e `scripts/deploy-pull.sh` usam imagens prontas: pull e `up --no-build`. Isso evita compilação nos 4 GB disponíveis. Confira a configuração, permissões do registry, cotas, saúde e os passos em [CONFIGURACAO_E_DEPLOY.md](docs/CONFIGURACAO_E_DEPLOY.md). Não houve provisionamento de VM, cobrança Oracle nem publicação automática do estúdio.


A integração da equipe `ca87c9e` foi preservada: landing editorial preta/bege,
assets e entrada `/workspace`. `/studio` continua como alias funcional. O criador
**Seu Atlas** permanece na landing e os dois caminhos do estúdio levam ao painel
de conexões correspondente. Os mockups/textos promocionais da landing não são
prova de métricas de usuários nem substituem a auditoria do MVP.
