# Revisão independente — fontes removíveis e tutor automático

Data: 29/10/2026. Revisor: agente independente solicitado pelo usuário.

**PASS de engenharia local para o worktree revisado.** Os bloqueadores
identificados foram corrigidos e as regressões relevantes passaram. O parecer
permite preparar os commits e PRs autorizados; não aprova release público nem
dispensa os checks dos SHAs publicados.

## Identificação do candidato

- Branch: `feat/source-lifecycle-auto-atlas`.
- HEAD/base antes dos commits:
  `0af65d43b513430ef279a3dc3081137c967e5262`.
- Digest das fontes/testes revisados:
  `1e50c331b5b2b4e36a4c72d09301dbb94819e1a7962104113de66b065ef2a180`.
- Digest da política, sem alteração:
  `fc97002c0917206cb568e9157b85e2e99ae7b492490357ae0fb5b92dd48330bc`.

Recalculei o digest a partir de todos os caminhos de `evidenceFiles` e confirmei
igualdade com `artifacts/quality/report.json`. O campo candidate aponta o HEAD
anterior aos commits; a aprovação vincula o conteúdo ao digest acima, incluindo
arquivos novos. Documentação não integra esse digest. O relatório automatizado
é evidência local, não aprovação humana ou de produção.

## Achados corrigidos e revalidação

1. **Escritores em voo.** Reproduzi uma trilha persistida depois de DELETE
   concluído, com referências órfãs e título da fonte removida. Também reproduzi
   geração concorrente no domínio recriando pacote/blob com texto apagado;
   qualifiquei esse segundo caso porque o semáforo HTTP de um processo já
   serializava geração e exclusão. A proteção agora está no domínio: ingestão,
   geração, trilhas, reindexação, publicação remota e limpeza usam filelock por
   tenant, reentrante na thread e compartilhado entre processos no mesmo volume
   Linux. Contenção retorna 429; o worker trata a negativa sem morrer.
2. **Dreamer antigo restaurando histórico.** Reproduzi um registro evaluating
   atrasado reaparecendo depois da limpeza, mantendo polling indefinido. Os
   registros e a promoção agora revalidam epoch/revisão na transação. A divisão
   do ciclo em funções preserva consentimento, treino/heldout, cobertura,
   ausência de regressão e margem de promoção; não troca avaliação por aceite.
3. **Destino externo incorreto.** Reproduzi OCI declarando deleted após consultar
   bucket B vazio enquanto o objeto original permanecia no bucket A. Recibos
   novos guardam namespace/bucket originais; recibos sem identidade falham
   fechados. Qdrant/Mongo guardam fingerprints de origem. Reindexação registra
   destinos anteriores e tentativas antes do upsert. Memória remota registra
   destinos antes do envio e acompanha o histórico mesmo após desabilitar a
   configuração. Trocar o endpoint não confirma exclusão no destino antigo.
4. **Fila sem progresso justo.** Os três primeiros erros permanentes podiam
   impedir qualquer trabalho posterior. O outbox agora persiste tentativas,
   backoff e ordenação por última tentativa, mantendo lotes de três objetos.
   A regressão exige que o quarto trabalho avance apesar de três falhas antigas.
   A guarda por arquivo impede dois escritores de regredirem o progresso.
5. **Regeneração de escopo incorreto.** A UI podia substituir a fonte removida
   por um documento qualquer e usar alterações recentes do formulário. Agora
   a receita vem do servidor, exclui decisão/contexto interno e é capturada
   antes da remoção. O usuário precisa marcar a opção; somente referências
   originais restantes entram na nova geração. Sem referências restantes ou
   receita legada, não há regeneração automática. O snapshot sobrevive ao
   refresh intermediário de cleanup_pending.
6. **Modal pendente aprisionava o usuário.** O estado pendente permite fechar
   e abrir outra fonte; fechar cancela a intenção de refazer. Reload mantém
   aviso e bloqueio de geração. A confirmação explica a perda de materiais,
   trilhas, XP e de todo o histórico/memória pedagógica, preservando consentimento.
7. **Contrato HTTP e isolamento dos testes.** Nest preserva 202 para pendência
   e 200 para conclusão. O novo teste exercita HTTP real e não lê o .env pessoal
   nem encaminha DELETE a um serviço externo herdado: usa ambiente isolado,
   destino reservado e recusa outbound inesperado. As expectativas foram
   preservadas e ampliadas, sem skips/retries para obter aprovação.

A remoção canônica e o outbox são transacionais. Materiais dependentes,
tentativas, XP, trilhas, passagens e memória são removidos com escopo de tenant;
fontes e materiais independentes permanecem. A checagem do material na transação
de quiz preserva o contrato de XP único sem rejeitar a concorrência válida.
Receipts anteriores são invalidados antes do DELETE; aliases preservam IDs,
e a repetição não refaz efeitos. Tombstones impedem a volta do demo no reinício.

## Evidências finais

Execuções independentes deste revisor:

- **65 testes Python PASS**, incluindo concorrência, rollback, reinício,
  proveniência, reconciliação, destinos históricos e limpeza externa simulada.
- **Seis testes API PASS** de routing e adaptador HTTP, zero skips/retries.
- **Cinco controles do gate PASS**, mais medição estrutural de **741 símbolos**;
  grafo TypeScript com **107 arestas, zero ciclos/imports não resolvidos**,
  nenhuma falha de
  parsing/fronteira ou regressão bloqueante. Limites e baseline não mudaram;
  dívidas legadas explicitamente registradas continuam existindo.
- Digest confirmado e `git diff --check` limpo.

Logs próprios: `/tmp/atlas-lifecycle-independent-final-python.log`,
`/tmp/atlas-lifecycle-independent-final-api.log` e
`/tmp/atlas-lifecycle-independent-final-quality.log`.

Também li os logs finais do implementador: **50 API + 65 Python + cinco
scripts**, tipos, builds Next/Nest/Eve, contrato de ambiente de 62 referências
e smoke com dependências de produção passaram. **20 E2E desktop/mobile
passaram em 37,3 s**, sem retries: remoção real local e seus efeitos, replay,
reenvio, escolha automática, receita preservada e ausência de substituição
por fonte alheia. O cenário de UI para pendência administrativa usa route
fulfill explicitamente; não comprova um provedor externo real.

Referências: `/tmp/atlas-lifecycle-final-unit.log`,
`/tmp/atlas-lifecycle-types.log`, `/tmp/atlas-lifecycle-quality.log`,
`/tmp/atlas-lifecycle-e2e.log`, `/tmp/atlas-lifecycle-build.log`,
`/tmp/atlas-lifecycle-eve-build.log`, `/tmp/atlas-lifecycle-env.log` e
`/tmp/atlas-lifecycle-runtime.log`. O smoke amostra processos e árvore de
dependências; não prova pico sob carga de 4 GiB ou inferência Eve real.

## Operação e limites obrigatórios

Dados legados sem proveniência exigem reconciliação administrativa explícita.
A CLI valida tenant/operação, preserva identidades conhecidas e não marca
deleted: o worker ainda precisa confirmar a limpeza real. Nenhuma reconciliação
foi usada para afrouxar o gate ou declarar um serviço externo testado. O operador
precisa conferir os destinos históricos e restaurar suas configurações quando
necessário; pendência continua visível e bloqueia novas gerações.

Routing Jev usa somente IDs permitidos, timeout de 2.500 ms e zero retries
nesse classificador. Override manual prevalece, fontes são autorizadas antes
da consulta e o principal efetivo enviado ao Invokta é o tutor resolvido.
Fallback é identificado como política local. SDKs simulados não comprovam
disponibilidade, latência real ou qualidade pedagógica dos fornecedores.

**Release público continua bloqueado** por autenticação/isolamento multiusuário,
OCI/Jev/fornecedores reais, políticas de retenção, carga de 4 GiB,
backup/restauração, avaliação pedagógica, checks remotos no SHA publicado e
aceite humano. A limpeza não promete apagamento forense de WAL, backups,
snapshots, logs de fornecedores ou streams históricos do Eve; esses limites
estão explicitados na spec. SAST/SBOM e mutation testing não foram executados.

O revisor não alterou implementação, testes, dependências ou política, não
executou exclusão de dados em serviços reais e não fez commit, push ou review
formal no GitHub. O único arquivo escrito nesta revisão é este parecer.
