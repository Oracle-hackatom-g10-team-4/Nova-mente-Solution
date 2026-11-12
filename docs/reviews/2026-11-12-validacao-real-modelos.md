# Validação real de modelos e agentes — 12/11/2026

Testes locais em fonte sintética do Projeto Aurora. As credenciais foram injetadas pelo ambiente; valores de chaves, cabeçalhos e dados de conta não fazem parte deste relatório. Não foi usado provedor simulado para anunciar os resultados reais abaixo.

## O que foi exercitado

| Caminho | Resultado observado |
| --- | --- |
| NVIDIA · `minimaxai/minimax-m3.1-flash` | Chamada autenticada HTTP 200 e geração no perfil direto do Atlas |
| Fluxo HTTP completo | 15 requisições aprovadas: upload, quatro formatos, chat, citações, quiz/XP, abstenção e remoção |
| Tutorial, flashcards, quiz e resumo | `mode=remote`, material pronto e Jev `supported` nos quatro formatos |
| Chat individual | Resposta remota, citações e Jev `supported` |
| Decisão Jev | Escolha real de método/RAG; na interface também selecionou o tutor automaticamente |
| Controle negativo Jev | Aprovou retenção de 35 dias e classificou a afirmação de 999 dias como contraditória |
| Firecrawl | Busca real retornou documentação oficial da Oracle; a Action Engine também devolveu resultados HTTPS |
| Eve + OpenRouter · `openai/gpt-4.1-mini` | Runtime compilado real: Guia e Trama propuseram alternativas, Jev comparou e Guia sintetizou |
| Times de agentes | Três turnos reais, duas propostas sustentadas e síntese final `supported` |
| Interface Chromium | Upload, geração automática, material remoto e abertura da citação original; sem erro JavaScript observado |
| Quiz | Gabarito ausente da resposta pública; acerto concedeu 15 XP e repetição não concedeu XP adicional |
| Remoção | Documento removido da biblioteca após confirmação do fluxo de exclusão |

O caminho NVIDIA direto e o caminho Eve/OpenRouter foram testes separados. O segundo usa API do OpenRouter, não créditos de uma assinatura pessoal do ChatGPT. A API de pesquisa interna retorna seu contrato público de resultados; os veredictos intermediários de relevância não são campos desse contrato.

## Falhas encontradas e tratamento

1. **Proxy de rede:** o SDK Node não estava usando o proxy injetado. Com `NODE_USE_ENV_PROXY=1` desde a inicialização, o Jev respondeu às avaliações reais. A variável está documentada no `.env.example`; TLS permanece verificado.
2. **Reserva de saída excessiva:** o Eve enviava pedidos OpenRouter com 32768/65536 tokens, apesar do limite acumulado da sessão. O provedor recusou a reserva com HTTP 402. O adapter OpenAI-compatible agora limita o pedido a 4000 tokens, inclusive campos específicos de fornecedor, sem elevar limites menores. Não foi necessário aumentar créditos para esse caso.
3. **Flashcards:** ocorreu um erro de geração numa execução inicial. A resposta causadora não foi capturada; a causa permanece indeterminada. O diagnóstico separado e a repetição integral passaram. Essa ocorrência não foi apagada nem considerada prova de estabilidade.
4. **Modelo gratuito OpenRouter:** uma sondagem recebeu HTTP 429. O ensaio Eve foi realizado separadamente com o modelo identificado na tabela; não há fallback pago novo no código do produto.

Os observadores de diagnóstico apenas registraram status, tempo, tipo de erro e limites de tokens e devolveram as respostas reais sem modificação. Eles ficaram em `artifacts/`, fora do produto. Os testes temporários foram corrigidos quando presumiam um campo de resposta não previsto no schema; os critérios de suporte, citações e orçamento não foram afrouxados.

## Limites observados

- No fluxo HTTP NVIDIA, as quatro gerações levaram aproximadamente **10 a 28 segundos**, e o chat aproximadamente **23 segundos**. Uma geração adicional pela interface levou cerca de **53 segundos** na chamada do modelo. São amostras, não percentis ou SLA.
- No perfil Eve, repetições locais de três turnos levaram aproximadamente **10 a 19 segundos**, incluindo avaliação e síntese. As chamadas OpenRouter observadas no runtime compilado enviaram `max_tokens=4000` e retornaram HTTP 200.
- A busca lexical sem embeddings acertou o resultado esperado em **7 de 8 cenários sintéticos**. Uma pergunta por paráfrase não recuperou o trecho RPO. Reordenar candidatos com Jev não recupera, por si só, um trecho que ficou fora da seleção inicial.
- Citações existentes e um veredicto do judge não provam eficácia pedagógica geral. Há espaço para melhorar concisão, formulação dos flashcards e apresentação de identificadores técnicos eventualmente escritos pelo modelo.
- Não foram concluídos aqui carga concorrente em 4 GB, ingestão generativa de um PDF real de 80 MiB, OCR, implantação Oracle, readback OCI, OAuth pessoal nem ciclos completos de promoção Dreamer com usuários reais.

## Reproduzir com segurança

Siga o [guia de configuração](../CONFIGURACAO_E_DEPLOY.md#rede-com-proxy-e-orçamento-de-geração). Use um workspace isolado, documentos sintéticos e somente os provedores desejados. Configure chaves pelo painel/cofre ou injeção de segredos, nunca no código ou em `NEXT_PUBLIC_`.

No perfil NVIDIA direto, confirme `mode=remote`, veredito real do Jev e correspondência das citações ao texto original. No perfil Eve, compile novamente o runtime e confirme as propostas/síntese e o limite no pedido ao fornecedor. O smoke extrativo e os testes unitários continuam úteis, mas não substituem essas verificações reais.

O aceite de MVP mantém os gates existentes de segurança, qualidade, semântica e OCI. Este relatório não declara o produto pronto para acesso público nem relê resultados simulados como chamadas reais.

## Verificações da correção

Três novos testes de contrato exercitam o SDK com transporte sintético, sem usar chaves reais: saída normal/streaming, sinal de cancelamento e metadados, limite menor, limite omitido, orçamento inválido e campos específicos tentando ampliar o teto. O teste compilado com OpenRouter é a evidência separada de que o caminho atual também aplica o limite com um fornecedor real.

A regressão local, a checagem de ambiente, os tipos, os builds Nest/Next/Eve, os 26 E2E e os quality gates passaram. A dívida de complexidade anterior continua explicitamente identificada pelo ratchet; nenhuma baseline, expectativa crítica ou limite de qualidade foi reduzido.
