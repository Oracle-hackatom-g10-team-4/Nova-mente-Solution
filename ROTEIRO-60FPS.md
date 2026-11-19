# Atlas — roteiro da keynote do Demo Day

**4min45s · 60 fps · 14 cenas.** Uma pergunta sobre redes guia a demonstração das decisões técnicas e pedagógicas do Atlas em um percurso aplicável a outros assuntos.

| Tempo | Tela | Narração sugerida |
|---|---|---|
| 00:00–00:15 | O desafio | Quando uma explicação parece convincente, como eu confiro de onde ela veio? E como descubro se entendi o assunto? Essas duas perguntas guiaram o Atlas. Hoje vamos acompanhar uma dúvida, da leitura até a prática. |
| 00:15–00:30 | A solução | A ideia é partir do material que a pessoa já tem, seja uma apostila de história, um artigo de biologia ou um guia técnico. O Atlas reúne esse material, a explicação e o exercício no mesmo espaço. |
| 00:30–00:42 | Método pedagógico | O objetivo orienta o método. Uma explicação no estilo Feynman usa linguagem simples. O método socrático usa perguntas. Tutor, método e formato são escolhas separadas. |
| 00:42–01:07 | O papel dos agentes | Cada agente tem identidade, papel e instruções próprias no catálogo. Um organiza a explicação. Outro conecta ideias. Há quem revise evidências, prepare exercícios e ajude a manter o ritmo. Um faz perguntas para testar o raciocínio. Outro simplifica conceitos. O estudante pode trocar de perspectiva com o mesmo material. |
| 01:07–01:27 | Como o Eve executa um agente | No modo Eve, a fábrica do Atlas abre uma sessão para executar a persona escolhida, com suas instruções, limites e ferramentas autorizadas. Na tela, criamos a identidade visual do Órion e escolhemos como base a tutora que simplifica conceitos. |
| 01:27–01:47 | Da pergunta às fontes | Começo com um PDF sobre redes. O Atlas extrai o texto por página. Minha pergunta sobre rede virtual e NAT Gateway orienta a recuperação de passagens das fontes escolhidas. Essa é a etapa de recuperação do RAG, a geração aumentada por recuperação. |
| 01:47–02:12 | LM RAG, Jev e busca na web | O Atlas pode enviar seções relevantes ou o documento inteiro quando cabe no limite de contexto. Aqui, o Jev escolheu o LM RAG. A IA recebeu o texto do PDF com passagens mapeadas para citações. O Jev avaliou o respaldo da resposta. Com o Firecrawl habilitado, agentes também podem pesquisar na web. |
| 02:12–02:47 | Diferencial: leitura e evidência | Aqui, seleciono no leitor a definição de rede virtual. Quando abro uma citação da explicação, o Atlas destaca o trecho correspondente. Isso funciona porque o servidor só aceita referências para passagens que ele recuperou. Posso ler o contexto e comparar a fonte com o que a IA escreveu. A aba de proveniência mostra a estratégia de recuperação e a avaliação do suporte documental. |
| 02:47–03:12 | Prática e feedback | A partir da mesma fonte, a IA também gera um quiz. As alternativas aparecem na tela e o gabarito fica no servidor. Quando respondo, o servidor confere a escolha e registra o progresso. O feedback traz um trecho da fonte para eu revisar o conceito. |
| 03:12–03:37 | Equipe e aprendizado | Essa divisão exigiu que a equipe trabalhasse junto. André integrou arquitetura e full stack. Jadeilton cuidou da cloud com Oracle, Taylam do backend, Samuel dos testes e Ebenezer do frontend. Aprendemos a combinar o que cada parte entrega e a testar o percurso completo, da fonte até o progresso. |
| 03:37–03:57 | Trilha e colaboração entre agentes | A trilha na tela organiza a prática em etapas. A gravação usa geração direta. Num teste separado com Eve, dois agentes produziram propostas em sessões distintas. O Jev comparou as respostas e outra sessão sintetizou a proposta escolhida. |
| 03:57–04:15 | Dreamer | Com autorização do estudante, o Dreamer pode registrar experiências de aprendizagem e propor ajustes na abordagem. Uma proposta passa por avaliação antes de virar uma mudança ativa. Nesta tela dá para ver os controles e as versões da política. |
| 04:15–04:27 | Controle das fontes | O controle também vale para o material de origem. Ao remover uma fonte, o Atlas informa o que será afetado, incluindo os materiais gerados a partir dela. |
| 04:27–04:45 | Impacto e fechamento | Voltemos à primeira pergunta. Agora eu tenho como explicar o conceito, abrir a passagem que sustenta a resposta e praticar com retorno. É esse percurso que queremos levar de uma matéria da escola a qualquer novo assunto que alguém queira explorar. |

## Notas para a equipe

- Novos agentes são definidos no código e no catálogo com identidade, papel e instruções. O Eve abre sessões para executar a persona. Órion é a personalização visual de uma persona já existente no catálogo.
- No RAG da demonstração, a recuperação partiu das fontes selecionadas e da representação lexical local. O LM RAG incluiu o texto integral do PDF e um mapa de passagens citáveis. O fluxo volta a enviar seções quando o documento excede o limite de contexto. A busca híbrida combina os rankings de similaridade e de termos. Embeddings semânticos são opcionais.
- O modo Eve com propostas e síntese foi validado separadamente. A gravação de 60 fps usa geração direta com OpenRouter. A seleção de tutor, método e RAG e a avaliação de suporte usaram o Jev no material gravado.
- No trecho de 00:42 a 01:07, a ordem das funções acompanha os destaques do vídeo. Guia organiza, Faísca conecta, Prisma confere, Trama cria exercícios, Elo acompanha o ritmo, Ágora faz perguntas e Clara simplifica. Os nomes aparecem na tela.
- A busca na web usa Firecrawl quando a integração está habilitada e o agente tem acesso à ferramenta. A ação foi verificada em um teste separado. A explicação gravada usa o PDF selecionado.
- A gravação mostra uma fonte didática sintética no aplicativo local. As esperas da IA foram encurtadas e o acerto do quiz foi preparado para demonstrar o feedback e os pontos.
- A seleção manual dura enquanto o texto está selecionado. O destaque da passagem citada é uma função do leitor. Ponteiro, pulsos, aproximações e cartões são efeitos editoriais.
- As cenas mostram a integração do percurso de estudo e os controles do Dreamer. O impacto pedagógico é o objetivo da proposta.
- O vídeo converte a captura de 25 fps para 60 fps por interpolação. Os centros das transições acompanham as marcações do roteiro.
