# Relatório de Execução de QA e Testes Unitários

**Data de Execução:** 09/11/2026  
**Responsável QA:** Samuel Souza Ferreira  
**Ambiente:** Local (WSL2 Ubuntu / `extractive_demo`)

---

## 1. Testes Automatizados (Backend, API e Cognition)

Comando executado: `npm test`

- **Total de testes rodados:** 121
- **Passaram:** 121 (100%)
- **Falhas:** 0

### Detalhamento por Módulo:
* **API Node.js/TypeScript (`@atlas/api`):** 50 testes passados (`PASS`)
  * Cofre de provedores, isolamento por tenant, criptografia e políticas do Dreamer/Eve.
* **Módulo de Cognição (Python `unittest`):** 66 testes passados (`PASS`)
  * Ingestão de documentos, ciclo de vida/remoção no Qdrant/Mongo, validação de XP e trilhas.
* **Validação de Ambiente (Scripts Node.js):** 5 testes passados (`PASS`)
  * Verificação de chaves e variáveis em `env-loader.test.mjs` e `check-env.test.mjs`.

---

## 2. Testes Manuais de Interface (UI)

* **UI-01 (Responsividade):** PASSOU — Layout adapta corretamente sem quebras.
* **UI-02 (Painéis e Modais):** PASSOU — Transições e fechamento de gavetas operacionais.
* **UI-03 (Tema Claro/Escuro):** NÃO IMPLEMENTADO — Recurso ausente na versão atual.
* **UI-04 (Indicador de Carregamento):** PASSOU — Exibe "extraindo e indexando" durante upload.
* **UI-05 (Notificações de Erro):** PASSOU — Alerta *inline* exibido ("O arquivo deve ter até 10 MiB").

---

## 3. Issues Registradas

* **UPL-09 (Bug de Upload 9MB):** Registrado em Issue no GitHub. Arquivo de 9 MiB dentro do limite travou a renderização da interface.

---
*Planilha completa atualizada em: `docs/qa/Casos_de_Teste_NovaMente_Atlas.xlsx`*

## Resumo Executivo da Validação (Rodada Final — 17/11/2026)

A validação de qualidade do **NovaMente Atlas (v0.6)** foi concluída combinando execução manual exploratória, validação com provedores reais de LLM/pesquisa web, demonstração gravada de integração com OCI Object Storage e suítes automatizadas do repositório (121 testes unitários, 81 testes de API, 78 testes Python e 26 testes E2E Playwright).

### Métricas Consolidadas (`Casos_de_Teste_NovaMente_Atlas.xlsx`)

| Status | Quantidade | Percentual | Observação |
| :--- | :---: | :---: | :--- |
| **Passou** | 113 | 85,6% | Fluxos funcionais, IA adaptativa, contratos JSON, segurança, repetibilidade e demo OCI (`OCI-01` a `OCI-04`, `DEM-02`). |
| **Falhou** | 1 | 0,8% | `UPL-09` — travamento de interface em upload de arquivo de 9 MiB (Issue aberta no GitHub e registrada na aba `Bugs`). |
| **Bloqueado** | 9 | 6,8% | Casos dependentes de infraestrutura pública em nuvem (`OCI-06` a `OCI-09`, `PER-01`, `PER-03`, `GER-13`, `DRM-06`, `DRM-07`). |
| **N/A** | 5 | 3,8% | Verificações fora do escopo desta entrega (`UI-03` tema claro/escuro, `UI-13` cross-browser, `ACE-03` a `ACE-05`). |
| **Não testado** | 0 | 0,0% | 100% dos casos mapeados foram avaliados ou justificados. |
| **Total Mapeado** | **132** | **100%** | *(129 casos nas áreas 1–15 + 3 casos na área 16 de Repetibilidade)* |

### Destaques da Execução
- **Geração Adaptativa e Provedores de IA:** Validada em ambiente local com chaves ativas (`OPENROUTER_API_KEY`, `ATLAS_OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY` e `FIRECRAWL_API_KEY`), confirmando adaptação por perfis (Iniciante, Desenvolvedor, Gestor), formatos (Tutorial, Flashcards, Quiz, Resumo), nichos, citações ancoradas e avaliação (`judge`).
- **Integração OCI Object Storage & Demo:** Fluxos de envio de documento original, pacote JSON, conferência por hash SHA-256 e status `verified` (`OCI-01` a `OCI-04`) validados e entregues no vídeo demo oficial (`DEM-02`).
- **Pendências de Infraestrutura:** Apenas verificações de console/custos e carga em VM Oracle (`OCI-06` a `OCI-09`, `PER-01`, `PER-03`) permanecem bloqueadas aguardando a publicação final no domínio público em nuvem.
