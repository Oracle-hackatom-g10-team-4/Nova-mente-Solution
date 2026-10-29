# Fontes removíveis e tutor automático

A biblioteca precisa permitir remover uma fonte e os resultados que dependem dela,
sem deixar citações quebradas ou reutilizar seu conteúdo em memória/recibos.
O estúdio começa por fontes e objetivo; o tutor é escolhido no servidor.

## Regras e contratos

- GET documents/:id/deletion: prévia com número de materiais/trilhas afetados,
  XP vinculado e aviso de limpeza do histórico de conversas e memória pedagógica.
- DELETE documents/:id: tenant obrigatório, ID validado e recibo idempotente.
  A remoção lógica e seu trabalho de limpeza são persistidos juntos. Materiais,
  tentativas, XP e trilhas dependentes são removidos. Outros documentos permanecem.
- Memórias e conversas antigas não têm proveniência suficiente para exclusão
  seletiva: a confirmação explicita limpeza de todo esse histórico do workspace.
  O consentimento é preservado; versões e escritores pendentes são invalidados.
- Objetos locais/OCI, Qdrant e projeção Mongo configurada são limpos com escopo
  de tenant. Falha externa resulta em cleanup_pending, nunca sucesso fictício;
  o worker leve tenta novamente. Fonte some imediatamente do acervo ativo.
  Geração fica bloqueada enquanto há limpeza pendente para não reutilizar memória.
- GET documents/:id/removal acompanha a limpeza, inclusive após reinício.
  Tombstones sem conteúdo impedem repetir efeitos e reintroduzir o demo removido.
  Reenviar o mesmo arquivo após concluir cria uma nova fonte e refaz a indexação.
- Recibos de geração/quiz/chat anteriores são invalidados antes da exclusão.
  Não se promete apagar backups ou registros de fornecedores fora do controle
  do produto; suas políticas de retenção exigem operação própria.

## Escolha de tutor

- Geração aceita agent_id=auto (padrão do estúdio) ou um dos cinco IDs existentes.
- Validar fontes antes de consultar memória/Jev. Jev escolhe somente um ID
  permitido a partir de objetivo, perfil e formato. Não concede capacidades.
- Escolha manual prevalece. Falta/falha do Jev usa política local identificada;
  nunca reportar avaliação remota sem executá-la. Limitar timeout/retries.
- Python/Invokta recebem somente o agente resolvido. A decisão persistida informa
  agente, origem e razão da escolha; chat individual mantém o tutor escolhido.
- UI: fonte + objetivo + ação principal. Opções avançadas guardam ajustes de
  perfil/formato/setor/método/busca/tutor. Remover exige confirmação do impacto.
  Recriar o material aberto é opção explícita com fontes restantes, sem gerar
  automaticamente toda a biblioteca nem cobrar por ciclos inesperados.

## Verificação

Tenant, remoção transacional, falha externa/retry/reinício, idempotência, upload
novamente, memória/XP/citações antigas inacessíveis e seed não reaparece.
Routing automático com SDK simulado, falha e override manual; ferramentas negadas
continuam negadas. E2E desktop/mobile com confirmação, escolha automática,
refazer material e recarregar. Mesmos gates rígidos e commits até400 linhas.

## Consistência e operação

Ingestão, geração, trilhas, reindexação e limpeza compartilham um lock de arquivo
por tenant, reentrante na thread e válido entre processos no mesmo volume Linux.
Contenção retorna 429; não há transação SQLite aberta durante chamadas de IA.
Tentativas de quiz revalidam a existência do material dentro da transação.
Escritores Dreamer validam revisão e epoch antes de registrar ou promover resultados;
exclusão durante replay cancela o resultado antigo, mantendo os gates de aprendizado.

O outbox usa lotes de três objetos, seleção justa e backoff persistido até cinco
minutos. OCI exige namespace/bucket originais e confirmação de ausência por HEAD;
Qdrant/Mongo/memória usam fingerprints dos destinos, sem credenciais no banco.
Reindexações preservam também destinos anteriores e escritas interrompidas.
Memória externa registra o destino antes de enviar experiências consentidas.
Trocar/desabilitar um endpoint não autoriza declarar apagados seus dados antigos.

Dados legados sem proveniência ficam pendentes com attention_required. A CLI
administrativa de reconciliação registra destinos verificados pelo operador, sem
marcar sucesso: o worker ainda precisa executar a exclusão real. Se houve múltiplos
serviços de memória, restaurar cada configuração original até esvaziar os destinos.
O runtime remoto de memória também precisa desta versão do contrato reset-sources.
Não há endpoint público de reconciliação nem novas variáveis de ambiente.

Refazer é desmarcado por padrão. A receita persistida contém objetivo, perfil,
formato, setor, método, modo RAG e agente solicitado, sem contexto interno ou decisão.
Usa somente fontes originais restantes; não troca por documento alheio nem usa
mudanças recentes do formulário. Material legado sem receita não é refeito sozinho.
Fechar uma limpeza pendente cancela a intenção de refazer; o usuário pode gerar
novamente quando a limpeza terminar. Reload mantém aviso e bloqueio de geração.

## Limites da exclusão

A limpeza cobre o acervo ativo e as projeções configuradas/rastreáveis, não um
apagamento forense de WAL, snapshots, backups, logs de provedores ou streams
históricos do Eve. Esses registros precisam de política de retenção e operação
próprias antes do uso público. SQLite secure_delete e invalidação de recibos
reduzem retenção ativa, mas não substituem essas políticas. Nenhum dado de serviço
real foi apagado para os testes: OCI, Jev e falhas externas usam doubles explícitos.
