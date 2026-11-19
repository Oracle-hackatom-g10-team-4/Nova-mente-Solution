# Configurar e operar o Atlas — guia para a equipe

Atualizado em 24/10/2026. O objetivo é desenvolver com o mínimo de infraestrutura e deixar claro quais passos ainda dependem das contas da equipe. A configuração não contrata serviços nem torna o estúdio apto a acesso público.

## 1. Abrir o app no ambiente virtual

Na raiz do checkout:

```bash
bash scripts/setup.sh
npm run dev
```

Em outro terminal, confirme com `npm run smoke`. A landing está em `http://127.0.0.1:3000`, o estúdio em `/workspace` (alias `/studio`) e o novo painel em `/workspace/settings` (alias `/studio/settings`). Em uma máquina remota, use a prévia/encaminhamento privado da porta 3000 oferecida pela plataforma. Não altere para exposição pública sem autenticação.

O script usa `.venv/bin/uvicorn` para Python e inicia Nest/Next. Sem chaves, a demonstração usa passagens reais, recuperação lexical e marca que não houve geração por LLM. Ela permite ver e testar o produto, mas não encerra o checklist do edital.

O setup também prepara a chave mestra do cofre. Em um checkout existente, basta `npm run init:vault` e reiniciar os serviços. Esse comando não imprime a chave e não substitui uma chave existente. `.env` permanece ignorado e com permissão 0600. Nunca versionar esse arquivo.

## 2. Escolher as fontes de credenciais

### Ambiente ou arquivos de um cofre

O operador injeta as chaves no processo ou aponta `NOME_DA_CHAVE_FILE` para um arquivo montado. Exemplo sem valores reais:

```dotenv
EVE_MODEL_PROVIDER=openrouter
EVE_MODEL=ID_DO_MODELO_DISPONIVEL
EVE_MODEL_CONTEXT_WINDOW=32768
OPENROUTER_API_KEY_FILE=/run/secrets/openrouter_api_key
TYPESAFE_API_KEY_FILE=/run/secrets/typesafe_api_key
FIRECRAWL_API_KEY_FILE=/run/secrets/firecrawl_api_key
ATLAS_CREDENTIAL_MASTER_KEY_FILE=/run/secrets/atlas_master_key
```

`*_FILE` tem prioridade. Arquivo configurado mas ausente não usa outra credencial silenciosamente. A chave mestra precisa conter 32 bytes codificados em base64. Provedores independentes aceitos no Eve: OpenRouter/OpenAI-compatible e Anthropic; AI Gateway continua disponível como opção. O identificador do modelo precisa pertencer ao caminho escolhido. Para OpenAI gerenciado, use `ATLAS_OPENAI_API_KEY` ou `ATLAS_OPENAI_API_KEY_FILE`, evitando a variável reservada do ambiente de ferramentas.

Um Secret Manager ou agente externo pode entregar os arquivos. O Atlas não cria OCI Vault, não acessa um Vault arbitrário e não promete que esse serviço esteja no Always Free. Se o serviço de cofre disponível gerar custo, use injeção de ambiente/arquivos compatível com o orçamento.

### Chave manual no painel

1. Entre em **Conexões e modelos** no estúdio.
2. Escolha **Minha chave de API** e a finalidade: geração, decisão, pesquisa ou embeddings opcionais.
3. Escolha o provedor e, quando houver, o ID de modelo. Não use uma chave no campo de modelo.
4. Cole a chave e salve. O navegador limpa o campo após confirmação.
5. A chave vai para o cofre AES-256-GCM no servidor. O painel mostra configuração, nunca o segredo salvo.
6. Para apagar a preferência manual, escolha **Gerenciado pelo servidor** → **Usar configuração do servidor**.

As chaves manuais têm prioridade por finalidade. Não é preciso substituir geração para configurar Jev ou Firecrawl. O teste de catálogo não gera conteúdo nem manda documentos, mas também não comprova ferramentas/JSON/qualidade. Jev e Firecrawl são validados nas operações reais correspondentes.

O cofre precisa do mesmo volume e chave mestra nos leitores API, Python e Eve. Os containers usam UID 10001 para esse volume; Next não o monta. Na migração de containers 0.3, o volume de workflows Eve pode pertencer ao UID 1000 antigo. Faça backup, pare os serviços e ajuste a propriedade desse volume para 10001 antes da primeira subida; não apague o volume para contornar permissões. Volumes novos usam os UIDs das imagens. Guarde a chave mestra fora do backup criptografado. Perder a chave impede recuperar os segredos; restaurar só o banco não resolve.

### Login com assinatura ChatGPT

O Eve 0.80.1 instalado oferece o helper oficial `chatgpt()`. Ele funciona em desenvolvimento local e não funciona em deployment de produção. Assinatura ChatGPT não vira chave da API OpenAI, login de usuário do Atlas ou direito genérico de revender acesso.

Se quiser experimentar, o operador deve:

1. Usar uma conta de sistema dedicada ao Atlas, sem copiar autenticação deste ambiente de desenvolvimento ou do Codex que mantém o projeto.
2. Definir `ATLAS_ALLOW_LOCAL_CHATGPT=1` somente para dev e reiniciar Nest/Python/Eve.
3. Abrir `bash scripts/eve.sh dev`; no TUI, usar `/login` → ChatGPT Subscription e concluir o fluxo oficial.
4. No painel, selecionar **Login com ChatGPT**, informar o modelo autorizado na conta e salvar. Também é possível configurar `EVE_MODEL_PROVIDER=chatgpt_local` e `EVE_MODEL` no ambiente.
5. Executar uma geração real e conferir o resultado. Salvar a preferência não confirma que o login terminou.

Não há botão de OAuth fictício no navegador do Atlas. Cookies, senhas e tokens de sessão não são pedidos no formulário. Em produção, use uma chave de API ou outro mecanismo documentado pelo fornecedor.

## 3. Iniciar Eve com SDKs independentes

Primeiro construa o runtime; depois inicie-o em outro terminal:

```bash
bash scripts/eve.sh build
bash scripts/eve.sh start
```

Configure `EVE_URL=http://127.0.0.1:2000` no `.env` dos serviços locais e reinicie `npm run dev`. Para Docker, o endereço interno é `http://eve:2000`. `npm run check:eve` verifica health/autorização/prewarm sem chamar um modelo; health não comprova inferência.

O modelo é resolvido por passo no runtime confiável do Eve, com contexto reservado por perfil e limites da factory. Os SDKs não recebem o token administrativo do Atlas em prompts. O debate continua no backend. O modo `ATLAS_AGENT_RUNTIME=direct` é apenas diagnóstico explícito; Anthropic usa o SDK Eve, sem fingir compatibilidade OpenAI.

## 4. RAG sem serviço de embeddings obrigatório no cotidiano

Deixe as variáveis `EMBEDDING_*` vazias para a experiência lexical, com seções/documentos e reranking Jev quando configurado. Isso não baixa modelo pesado nem cria outro serviço.

O PDF do hackathon exige embeddings e busca vetorial. Para essa prova, pode ser usado um endpoint compatível com `/embeddings`, inclusive de um provedor gratuito se a oferta atual atender os limites e a política de dados. Não há garantia de gratuidade ou disponibilidade; confirme modelo, dimensão, termos e quotas na conta. Jev não produz esses vetores.

Depois de trocar ou remover um modelo de embeddings, reindexe:

```bash
bash scripts/reindex.sh
```

O comando mantém as fontes/IDs e refaz os vetores. Não misture modelos no mesmo índice. Qdrant só é necessário se escolhido pelo operador; SQLite serve ao primeiro corte vetorial. Limites de consultas e incompatibilidade de índice falham de forma explícita.

## 5. Provar o requisito OCI

O edital exige Object Storage Always Free, não exige uma VM Oracle. Confirme na conta os limites gratuitos antes de criar recursos. Use bucket privado. Credenciais e arquivos PEM ficam fora do Git e das imagens Docker.

- Em OCI Compute, prefira Instance Principal com permissão mínima de gravar/ler os objetos do bucket escolhido.
- Fora da OCI, use configuração de desenvolvimento OCI em arquivo privado. `OCI_AUTH_MODE=config_file`, `OCI_CONFIG_FILE` e `OCI_CONFIG_PROFILE` selecionam a identidade. Não cole PEM no `.env`.
- Configure `STORAGE_PROVIDER=oci`, `OCI_NAMESPACE`, `OCI_BUCKET` e `OCI_REGION` nos processos do serviço Python.
- Envie um documento novo ou use um workspace de demonstração OCI. Um documento já deduplicado/local não é migrado automaticamente para o bucket.
- Confira recibo `provider: oci` e `status: verified` tanto no original quanto no pacote. O código faz readback e compara SHA-256; não fabrica recibos quando falta acesso.

Não há permissão ampla de tenancy, criação automática de bucket ou provisionamento pago neste incremento. Antes da entrega, execute também uma restauração de backup e revise retenção/privacidade.

## 6. Usar GitHub Actions para aliviar a VPS

O workflow **Atlas checks** roda testes, tipos, builds Next/Nest/Eve e smoke sem chaves reais. **Atlas container images** verifica os quatro Dockerfiles/targets em PRs e permite publicação manual em GHCR.

Para publicar imagens:

1. Escolha um dos dois repositórios como origem do registry. Não é necessário publicar os dois.
2. Em **Actions → Atlas container images → Run workflow**, selecione `main` e marque `publish`.
3. O GitHub usa `GITHUB_TOKEN` com `packages:write`. Não coloque chaves de LLM, OCI ou SSH no workflow.
4. Espere os quatro jobs terminarem. Cada serviço recebe tag pelo SHA completo e um relatório de digest.
5. Revise a visibilidade dos packages e as cotas da conta/organização. Pacotes privados precisam de autenticação de leitura na VPS; um repositório público não torna todo package automaticamente público.

Apenas as definições e contratos foram validados localmente; a primeira execução nos runners e a publicação real precisam ser acompanhadas no GitHub. GitHub Actions/GHCR têm regras próprias de uso, armazenamento e cotas. O PDF não exige OCIR e não autoriza custo adicional na Oracle.

## 7. Fazer deploy por pull, sem build na VPS

Na VPS, instale Docker/Compose e prepare um `.env` privado. Use o prefixo do repositório que publicou as imagens e o SHA indicado pelo workflow:

```bash
export ATLAS_IMAGE_PREFIX=ghcr.io/oracle-hackatom-g10-team-4/nova-mente-solution
export ATLAS_IMAGE_TAG=SHA_COMPLETO_PUBLICADO_COM_40_CARACTERES
bash scripts/deploy-pull.sh
```

O exemplo de SHA é um marcador: substitua-o pelo valor real. O script recusa `latest`/`main`, faz `pull` e `up --no-build --wait`. O Compose não contém `build`. Para incluir Eve, configure `EVE_URL=http://eve:2000` no `.env` da VM e use:

```bash
bash scripts/deploy-pull.sh --profile agents
```

Next fica em `127.0.0.1:3000`, Nest/Python/Eve internos. Não há abertura automática de portas ou SSH por Actions. Para acesso privado a partir do seu computador, encaminhe a porta por um mecanismo autenticado. Exposição pública do estúdio ainda depende de autenticação/isolamento multiusuário.

Os limites de operação somam 2560 MiB com Eve; não são benchmark sob carga. Build/cache ficam no runner, não nos 4 GB disponíveis da VPS. Volumes persistem em atualizações. Rollback seleciona o SHA anterior e repete o pull, após conferir compatibilidade de dados e backups. Não use `down -v` para atualizar.

## 8. Guardar cada coisa no lugar certo

| Conteúdo | Destino |
| --- | --- |
| Código e documentação | GitHub |
| Build e testes | Runners GitHub Actions |
| Imagens Docker versionadas | GHCR; OCIR é alternativa sujeita a quota/custo |
| Ilustração pública da landing | Asset estático dentro da imagem web |
| Originais e JSONs educacionais | OCI Object Storage Always Free, com readback |
| Transações, XP, políticas e jobs | Volume SQLite com backup privado |
| Chaves manuais | Cofre criptografado no volume; chave mestra separada |
| Senhas/tokens do operador | Ambiente ou arquivos privados do mecanismo escolhido |

GHCR não substitui backup dos dados. O OCI Object Storage obrigatório não é substituído por GitHub Artifacts. Artifacts guardam só os pequenos relatórios de imagens/CI.

## 9. Encerrar o aceite do MVP

Depois de validar modelos, Jev, embeddings opcionais para o critério vetorial e OCI, escolha uma fonte e rode:

```bash
ATLAS_ACCEPTANCE_DOCUMENT_ID=ID_REAL_DA_FONTE node scripts/acceptance.mjs
```

O script recusa demonstração extrativa, falta de prova vetorial e recibos locais. Executa três cenários sobre a mesma fonte, exige suporte Jev e grava o relatório em `data/reports/mvp-acceptance.json`, ignorado pelo Git. Ele usa provedores reais e pode consumir créditos; ajuste as quotas antes de executar.

Esse relatório não substitui revisão humana, vídeo de demonstração, benchmark, autenticação pública ou avaliação de eficácia. Veja `docs/AUDITORIA_MVP_POS_MVP.md` para a matriz completa e as pendências do pós-MVP.


## Rede com proxy e orçamento de geração

Em ambientes que fornecem `HTTP_PROXY`/`HTTPS_PROXY`, os processos Node 24 precisam de `NODE_USE_ENV_PROXY=1` desde a inicialização. O loader do projeto propaga essa variável aos filhos. Preserve `NO_PROXY` para os serviços locais e a CA confiável fornecida pelo ambiente; não desabilite TLS. O Python/httpx já respeita as variáveis de proxy. Uma chave configurada não comprova que o SDK consegue acessar o fornecedor.

O perfil direto compatível com a NVIDIA foi validado com fonte sintética:

```dotenv
ATLAS_AGENT_RUNTIME=direct
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=minimaxai/minimax-m3.1-flash
```

A chave correspondente é `LLM_API_KEY`, injetada pelo gerenciador de segredos, ou seu arquivo `_FILE`. Não envie essa chave ao OpenRouter. Para o perfil de agentes, um exemplo validado separadamente é:

```dotenv
ATLAS_AGENT_RUNTIME=eve
EVE_MODEL_PROVIDER=openrouter
EVE_MODEL=openai/gpt-4.1-mini
EVE_MODEL_CONTEXT_WINDOW=32768
EVE_URL=http://127.0.0.1:2000
```

Esse perfil usa `OPENROUTER_API_KEY` e requer o runtime Eve ativo. Os endereços do exemplo são locais; em containers, use os nomes de serviço do Compose. A execução de três a cinco turnos pode consumir mais tokens que a geração direta. Modelos gratuitos também podem responder HTTP 429 por indisponibilidade ou limites do fornecedor.

Para OpenRouter e OpenAI-compatible no Eve, o Atlas limita cada pedido a **4000 tokens de saída**, preservando um teto menor já solicitado. Os campos específicos de fornecedor também não podem ampliar esse teto. Isso impede reservas de 32768/65536 tokens por padrão. Os limites acumulados de sessão, tempo e custo permanecem ativos. O perfil Anthropic e o AI Gateway conservam seus contratos anteriores; o novo limitador não é uma promessa sobre o orçamento de raciocínio desses fornecedores.

Veja o [relatório dos testes reais](reviews/2026-11-12-validacao-real-modelos.md) para os perfis exercitados, medidas e limitações. Teste local com fonte sintética não comprova deploy Oracle, OCI Object Storage, carga de 4 GB ou eficácia pedagógica em usuários reais.
