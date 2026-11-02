QA — NovaMente Atlas

Esta pasta registra como o projeto está sendo testado.

Conteúdo
Arquivo	Para que serve
ESTADO-DOS-TESTES.md	Situação atual: o que foi testado, o que passou, falhou ou está bloqueado
review-AAAA-MM-DD.md	Um relatório por rodada, com achados, riscos e recomendações
Casos_de_Teste_NovaMente_Atlas.xlsx	Planilha com os casos de teste, o registro de bugs e o histórico de rodadas
Tipos de teste
Smoke: verificação rápida de que o básico funciona.
Unitários: testes das peças de código, que ficam em apps/api/test e services/cognition/tests.
Integração: conferência da comunicação entre web, API, serviço Python e, depois, OCI.
End-to-end (E2E): fluxo completo como usuária.
Regressão: repetição dos casos de prioridade Alta a cada versão nova.
Como rodar os testes automáticos

Com os serviços instalados (bash scripts/setup.sh), na raiz do projeto:

bash
npm test             # testes Node e Python
npm run typecheck    # verificação de tipos
npm run smoke        # fluxo completo via HTTP (o sistema precisa estar rodando com npm run dev)
Como reportar um problema
Registre na aba Bugs da planilha.
Abra uma issue no GitHub com: título, passos para reproduzir, resultado esperado, resultado obtido e ambiente.
Nunca inclua chaves, tokens ou o conteúdo do arquivo .env.
Regras
Os testes de interface são feitos em janela anônima, para evitar interferência de extensões do navegador.
Os resultados de integrações externas (IA, OCI) só são considerados validados quando executados com credenciais reais.