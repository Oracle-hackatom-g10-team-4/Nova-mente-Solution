# Atlas — roteiro da keynote do Demo Day

**4min45s · 60 fps · 14 cenas.** Uma pergunta sobre redes guia a demonstração das decisões técnicas e pedagógicas do Atlas em um percurso aplicável a outros assuntos.

| Tempo | Tela | Narração sugerida |
|---|---|---|
| 00:00–00:15 | O desafio | Quando uma explicação parece convincente, como eu confiro de onde ela veio? E como descubro se entendi o assunto? Essas duas perguntas guiaram o Atlas. Hoje vamos acompanhar uma dúvida, da leitura até a prática. |
| 00:15–00:30 | A solução | A ideia é partir do material que a pessoa já tem, seja uma apostila de história, um artigo de biologia ou um guia técnico. O Atlas reúne esse material, a explicação e o exercício no mesmo espaço. |
| 00:30–00:42 | Métodos | A primeira decisão é pedagógica. Para entender um conceito, podemos começar com um exemplo. Para testar um raciocínio, uma pergunta pode ajudar mais. O objetivo orienta essa escolha. |
| 00:42–01:07 | Diferencial: personas | Por isso, os tutores têm papéis distintos. Um organiza a explicação em passos. Outro conecta ideias. Há quem confira as evidências, prepare exercícios e ajude a manter o ritmo. Um faz perguntas para testar o raciocínio. Outro explica em linguagem simples. O estudante pode mudar de perspectiva com o mesmo material. |
| 01:07–01:27 | Crie seu Atlas | Essa escolha aparece logo na entrada. Aqui, o nome é Órion e a perspectiva inicial é a de quem explica conceitos em linguagem simples. A pessoa pode trocar de tutor quando quiser explorar a mesma dúvida por outro caminho. |
| 01:27–01:47 | Material e objetivo | Vamos usar um PDF sobre redes na Oracle Cloud. O Atlas extrai o texto e o organiza por página. Eu escolho essa fonte e pergunto como uma rede virtual e um NAT Gateway se relacionam. A pergunta orienta quais passagens o sistema recupera. |
| 01:47–02:12 | Explicação e pesquisa | O Atlas envia à IA os trechos relevantes como contexto. O Jev avalia se a explicação tem respaldo nessas passagens. Quando a integração com o Firecrawl está habilitada, o Atlas também pode buscar referências na web. Nesta cena, a explicação se apoia no PDF. |
| 02:12–02:47 | Diferencial: leitura e evidência | Aqui, seleciono no leitor a definição de rede virtual. Quando abro uma citação da explicação, o Atlas destaca o trecho correspondente. Isso funciona porque o servidor só aceita referências para passagens que ele recuperou. Posso ler o contexto e comparar a fonte com o que a IA escreveu. A aba de proveniência mostra a estratégia de recuperação e a avaliação do suporte documental. |
| 02:47–03:12 | Prática e feedback | A partir da mesma fonte, a IA também gera um quiz. As alternativas aparecem na tela e o gabarito fica no servidor. Quando respondo, o servidor confere a escolha e registra o progresso. O feedback traz um trecho da fonte para eu revisar o conceito. |
| 03:12–03:37 | Equipe e aprendizado | Essa divisão exigiu que a equipe trabalhasse junto. André integrou arquitetura e full stack. Jadeilton cuidou da cloud com Oracle, Taylam do backend, Samuel dos testes e Ebenezer do frontend. Aprendemos a combinar o que cada parte entrega e a testar o percurso completo, da fonte até o progresso. |
| 03:37–03:57 | Avanços alcançados | O avanço técnico foi ligar essas partes. A interface mostra o material, o servidor valida as ações e a IA ajuda a adaptar a explicação. A trilha que vemos aqui organiza esse trabalho em etapas de estudo. Testes automatizados cobrem o fluxo. |
| 03:57–04:15 | Dreamer | Com autorização do estudante, o Dreamer pode registrar experiências de aprendizagem e propor ajustes na abordagem. Uma proposta passa por avaliação antes de virar uma mudança ativa. Nesta tela dá para ver os controles e as versões da política. |
| 04:15–04:27 | Controle das fontes | O controle também vale para o material de origem. Ao remover uma fonte, o Atlas informa o que será afetado, incluindo os materiais gerados a partir dela. |
| 04:27–04:45 | Impacto e fechamento | Voltemos à primeira pergunta. Agora eu tenho como explicar o conceito, abrir a passagem que sustenta a resposta e praticar com retorno. É esse percurso que queremos levar de uma matéria da escola a qualquer novo assunto que alguém queira explorar. |

## Notas para a equipe

- No trecho de 00:42 a 01:07, a ordem das funções acompanha os destaques do vídeo. Guia organiza, Faísca conecta, Prisma confere, Trama cria exercícios, Elo acompanha o ritmo, Ágora faz perguntas e Clara simplifica. Os nomes aparecem na tela.
- A busca na web usa Firecrawl quando a integração está habilitada e o agente tem acesso à ferramenta. A ação foi verificada em um teste separado. A explicação gravada usa o PDF selecionado.
- A gravação mostra uma fonte didática sintética no aplicativo local. As esperas da IA foram encurtadas e o acerto do quiz foi preparado para demonstrar o feedback e os pontos.
- A seleção manual dura enquanto o texto está selecionado. O destaque da passagem citada é uma função do leitor. Ponteiro, pulsos, aproximações e cartões são efeitos editoriais.
- As cenas mostram a integração do percurso de estudo e os controles do Dreamer. O impacto pedagógico é o objetivo da proposta.
- O vídeo converte a captura de 25 fps para 60 fps por interpolação. Os centros das transições acompanham as marcações do roteiro.
