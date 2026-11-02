# Estado dos testes — NovaMente Atlas

- **Última atualização:** 30/10/2026
- **Responsável:** Samuel Souza Ferreira
- **Versão testada:** `91d862d fix(images): carrega cognition sem índice de atestação local` 
- **Branch:** `main`
- **Ambiente:** Windows + WSL2 (Ubuntu 24.04), Node `v24.22.1`, npm `11.19.1`, Python `3.12.3`
- **Modo do sistema:** local (`extractive_demo`), sem chaves de IA e sem OCI

## Resultados da Rodada 1

| Tipo | O que foi executado | Resultado |
|---|---|---|
| Unitário (API Node) | `npm test`, parte API | 50 testes: 50 passaram, 0 falharam |
| Unitário (Python) | `npm test`, parte Python | 66 testes, resultado OK |
| Unitário (scripts de configuração) | `npm test`, parte final | 5 testes: 5 passaram, 0 falharam |
| Unitário (scripts de configuração) | `npm test`, parte final | 5 testes: 5 passaram, 0 falharam |
| Unitário (scripts de configuração) | `npm test`, parte final | 5 testes: 5 passaram, 0 falharam |
| Análise de tipos | `npm run typecheck` | Sem erros |
| Smoke | `npm run smoke` | Passou: upload, geração, citação, quiz/XP idempotente, Dreamer, grupo e chat |
| Integração e E2E manuais | Planilha `Casos_de_Teste_NovaMente_Atlas.xlsx` | Em andamento |
| Regressão | A cada versão nova, casos de prioridade Alta | A iniciar após as primeiras correções |

## Casos da planilha

Total de casos na aba Resumo: 129. Os casos de repetibilidade REP-01 a REP-03 foram adicionados à mão e ainda não entram nessa contagem.

| Status | Quantidade |
|---|---|
| Passou | `8` |
| Falhou | `0` |
| Bloqueado | `0` |
| Não testado | `121` |

## Bugs abertos

Nenhum até o momento.

## Observações

- O aviso de *hydration* do Next.js aparece no navegador normal, mas **não** em janela anônima. A causa é extensão do navegador, não o sistema. Os testes de interface são feitos em janela anônima.
- O README cita 11 testes Node e 14 Python "na versão documentada" e avisa que os números podem crescer. Esta rodada, no commit 91d862d, mostrou 50 testes na API Node, 66 em Python e 5 nos scripts de configuração.

## Bloqueios

- **Chaves de IA ausentes:** GER-06 a GER-09, DRM-06, DRM-07, SEG-11, DEM-01 e DEM-02.
- **Bucket da OCI não configurado:** OCI-01 a OCI-04 e OCI-06 a OCI-09. O caso OCI-05 (comportamento sem bucket) pode ser feito agora.
- **Autenticação ainda não implementada:** SEG-10 (isolamento entre usuários).
- **Dependem de ajuda de um dev ou da VM Oracle:** GER-13, PER-01 e PER-03.

## Próximos passos

1. Concluir o "primeiro estudo" e executar os casos de Upload e ingestão.
2. Registrar bugs como issues no GitHub.
3. Quando as chaves e o bucket forem liberados, executar os casos bloqueados.
4. Rodar regressão após cada correção e atualizar este arquivo.