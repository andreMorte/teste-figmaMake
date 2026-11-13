// Raio-X da interface: repertório técnico do agente especialista (o "cérebro").
// Não aparece no sistema. É conhecimento consolidado de Product Design, UX, UI, arquitetura de conteúdo,
// UX writing e acessibilidade, reescrito em regras práticas, com peso para o contexto brasileiro.
// O sistema entrega ao agente só os blocos que se aplicam à tela analisada.
//
// Fontes de base (só para manutenção): Norman (design centrado no humano, design emocional), Nielsen
// (heurísticas, escala de severidade), Krug (autoexplicação, varredura), Shneiderman (regras de ouro),
// Bastien & Scapin (critérios ergonômicos), Cybis, Betiol & Faust (ergonomia e usabilidade no Brasil),
// Johnson e Weinschenk (psicologia aplicada), Yablonski (leis de UX), Cooper (design de interação),
// Garrett, Rosenfeld & Morville, Covert (arquitetura de informação), Wroblewski e Baymard (formulários),
// Yifrah e Podmajersky (UX writing), Refactoring UI, Müller-Brockmann, Bringhurst (tipografia e grid),
// Frost (sistemas de design), WCAG 2.2 (W3C), eMAG, Padrão Digital de Governo (gov.br),
// Lei 15.263/2025 (Política Nacional de Linguagem Simples), LGPD (Lei 13.709/2018),
// Receita Federal (CNPJ alfanumérico a partir de 31/07/2026), Bonsiepe e Cardoso (design no contexto brasileiro).

type Block = { id: string; title: string; when: (t: Traits) => boolean; text: string };

export interface Traits {
  fields: number;
  actions: number;
  dialog: boolean;
  mobile: boolean;
  confirmation: boolean;
  error: boolean;
  navigation: boolean;
  personalData: boolean;
  payment: boolean;
  insurance: boolean;
  longText: boolean;
  firstScreen: boolean;
}

const BLOCKS: Block[] = [
  {
    id: 'metodo',
    title: 'Como julgar',
    when: () => true,
    text: `- Julgue pelo que está na tela e pelo papel dela no fluxo. Toda crítica precisa de um elemento visível que a comprove.
- Gravidade (escala de Nielsen): 4 impede concluir a tarefa ou causa erro com prejuízo; 3 atrasa muito ou induz erro frequente; 2 gera hesitação ou retrabalho; 1 cosmético; 0 não é problema.
- Pondere frequência (todos passam por aqui?), impacto (bloqueia ou só incomoda?) e persistência (o usuário aprende a contornar?).
- Uma recomendação boa diz exatamente o que mudar: qual elemento, para quê, e, quando for texto, a frase sugerida em português.
- Não confunda gosto com problema. Estética só é problema quando atrapalha leitura, hierarquia, confiança ou acessibilidade.
- O que depende de interação (feedback após clique, tempo de resposta, validação ao digitar) não é avaliável numa imagem parada: diga isso em vez de supor.`
  },
  {
    id: 'hierarquia',
    title: 'Hierarquia visual e leitura',
    when: () => true,
    text: `- Em até 5 segundos a pessoa deve saber onde está, o que a tela oferece e qual é a próxima ação. Se precisar "pensar" para descobrir, há problema.
- Uma ação principal por tela, visualmente dominante (cor sólida, contraste, tamanho). Ações secundárias com peso menor (contorno ou link). Duas ações com o mesmo peso dividem a decisão.
- A ordem de leitura deve seguir a importância: título → informação essencial → ação. Na web a varredura tende a começar no topo e à esquerda (padrões em F e em Z); o que está abaixo da primeira dobra recebe bem menos atenção.
- Hierarquia se constrói com tamanho, peso, cor e espaço, nessa ordem de força. Muitos elementos "gritando" anulam o destaque de todos.
- Títulos devem dizer a tarefa ou o conteúdo ("Dados do veículo"), não rótulos vagos ("Informações").
- Agrupe o que é relacionado (proximidade, região comum) e separe o que é diferente; elementos parecidos são lidos como de mesma função (similaridade).`
  },
  {
    id: 'ui',
    title: 'UI: tipografia, cor, espaço e consistência',
    when: () => true,
    text: `- Texto corrido na web: em geral 16px ou mais, entrelinha entre 1,4 e 1,6, linhas de 45 a 75 caracteres. Textos muito pequenos (abaixo de 12px) só para informação acessória.
- Poucos tamanhos de fonte, em escala definida; pesos usados com intenção (negrito para destacar, não para tudo).
- Espaçamento em sistema (múltiplos de 4 ou 8). Espaço é o principal organizador: mais espaço entre grupos do que dentro do grupo.
- Alinhe a um grid; desalinhamentos pequenos parecem descuido e reduzem confiança.
- Cor com significado consistente: uma cor de ação principal, vermelho só para erro/perigo, verde para sucesso. Cor nunca pode ser o único sinal de estado (use ícone ou texto junto).
- Componentes iguais devem parecer e se comportar igual em todo o fluxo (botões, campos, cards, ícones). Inconsistência obriga a reaprender.
- Elementos clicáveis precisam parecer clicáveis; elementos não clicáveis não devem parecer botões.`
  },
  {
    id: 'cognitivo',
    title: 'Carga cognitiva',
    when: () => true,
    text: `- Cada opção a mais aumenta o tempo de decisão (lei de Hick). Reduza escolhas visíveis ou destaque a recomendada.
- Alvos importantes devem ser grandes e próximos de onde a atenção já está (lei de Fitts).
- A memória de trabalho é curta: agrupe informação em blocos pequenos (chunking), mostre em vez de pedir para lembrar (reconhecer é mais fácil que recordar).
- Revelação progressiva: mostre primeiro o essencial; o detalhe aparece quando for necessário.
- Use padrões que a pessoa já conhece de outros sites e apps (lei de Jakob). Inovar em padrões básicos (menu, carrinho, formulário) custa aprendizado.
- Valores padrão sensatos e preenchimento automático reduzem esforço; nunca pré-marque algo que o usuário não escolheu e que o prejudique.
- Fluxos longos: divida em etapas com indicador de progresso ("Etapa 2 de 4") e títulos claros por etapa.`
  },
  {
    id: 'heuristicas',
    title: 'Heurísticas e critérios ergonômicos (como aplicar)',
    when: () => true,
    text: `- Visibilidade do status: a tela mostra em que etapa a pessoa está, o que já foi feito e o que está acontecendo (carregando, salvo, enviado).
- Linguagem do mundo real: palavras do usuário, não do sistema ou do negócio; ordem lógica e natural das informações.
- Controle e liberdade: sempre há como voltar, cancelar ou corrigir sem perder o que já foi preenchido.
- Consistência e padrões: mesmo termo para a mesma coisa; mesma posição para a mesma ação.
- Prevenção de erros: limitar entradas inválidas (máscaras, listas, calendário), confirmar ações destrutivas ou caras.
- Reconhecimento em vez de memorização: opções e instruções visíveis quando necessárias.
- Eficiência: atalhos para quem é frequente (preencher com dados anteriores, repetir cotação) sem atrapalhar quem é novo.
- Minimalismo: cada informação extra compete com a importante.
- Erros: mensagem diz o que aconteceu e como resolver, perto do campo, sem culpar o usuário.
- Ajuda: contextual, curta, perto de onde surge a dúvida (ícone de ajuda ao lado do termo difícil).
- Bastien & Scapin acrescentam: condução (convite claro à ação, agrupamento, feedback imediato), carga de trabalho (brevidade e densidade informacional), controle explícito (ações só acontecem quando o usuário pede), adaptabilidade, gestão de erros, homogeneidade, significado dos códigos e denominações, compatibilidade com o contexto e os hábitos do usuário.`
  },
  {
    id: 'escrita',
    title: 'UX writing em português do Brasil e tom de voz',
    when: () => true,
    text: `- Linguagem simples (técnicas da Lei 15.263/2025, referência de boa prática também fora do governo): frases curtas em ordem direta, uma ideia por parágrafo, palavras comuns, explicar termo técnico no próprio texto, nome completo antes da sigla, evitar estrangeirismo que não seja de uso corrente, organizar em listas e tabelas quando couber.
- Tom padrão no Brasil: próximo, cordial e respeitoso, tratando por "você". Sem formalidade burocrática ("Prezado cliente", "Favor preencher"), sem gíria excessiva, sem infantilizar (diminutivos, excesso de emojis), sem excesso de exclamação.
- Botões com verbo de ação que diz o resultado: "Ver cotação", "Enviar proposta", "Salvar e continuar". Evite "OK", "Prosseguir", "Clique aqui", "Submeter".
- Em confirmação de ação, o botão repete a ação ("Cancelar seguro"), não "Sim/Não".
- Mensagem de erro: o que houve + como resolver, sem culpa e sem código técnico. Ex.: "Não encontramos esse CPF. Confira os números e tente de novo." em vez de "CPF inválido!".
- Títulos e rótulos em caixa normal (só a primeira letra maiúscula); caixa alta em frases longas dificulta a leitura e soa como grito.
- Textos de apoio dizem o porquê quando o pedido não é óbvio: "Usamos seu CPF para buscar o histórico do veículo".
- Consistência de vocabulário: escolha um termo e use sempre (não alternar "cotação", "simulação" e "orçamento" para a mesma coisa).
- Números e datas no padrão brasileiro: R$ 1.234,56; 13/11/2026; 14h30.`
  },
  {
    id: 'acessibilidade',
    title: 'Acessibilidade (WCAG 2.2 e eMAG)',
    when: () => true,
    text: `- Contraste mínimo de texto (nível AA): 4,5:1; texto grande (a partir de 24px, ou 18,66px em negrito): 3:1. Bordas de campo, ícones e componentes de interface: 3:1 com o fundo.
- Alvo de toque/clique: mínimo de 24×24px (WCAG 2.2, AA); o recomendado para toque é 44×44px (iOS) ou 48×48dp (Android).
- Todo campo tem rótulo visível e permanente. Placeholder não é rótulo: some ao digitar e costuma ter contraste baixo.
- Informação não pode depender só de cor, posição ou forma.
- Imagens informativas precisam de texto alternativo; ícones sem texto precisam de nome acessível.
- Ordem de foco e de leitura coerente com a visual; foco do teclado visível.
- Erros identificados em texto, perto do campo, e não apenas por borda vermelha.
- No Brasil, o eMAG (Modelo de Acessibilidade em Governo Eletrônico) segue a mesma base da WCAG e é referência obrigatória em serviços públicos.`
  },
  {
    id: 'brasil',
    title: 'Contexto do usuário brasileiro',
    when: () => true,
    text: `- O CPF funciona como identidade universal: muitas jornadas começam por ele, e ele permite buscar dados em vez de pedir de novo.
- Uso majoritário de celulares Android, muitos de entrada (tela menor, menos memória) e conexão móvel que oscila: telas leves, que não dependam de carregar muito para mostrar o essencial.
- O WhatsApp é canal natural de atendimento e de envio de documentos e propostas; usuários esperam poder compartilhar ou continuar por lá.
- O Pix tornou pagamentos instantâneos o padrão esperado; formas de pagamento conhecidas transmitem confiança.
- Há grande diversidade de escolaridade e de familiaridade digital (o INAF mostra uma parcela relevante da população com alfabetismo funcional limitado): linguagem simples e caminhos óbvios não são luxo.
- Nomes brasileiros costumam ter vários sobrenomes e partículas ("de", "da", "dos"): prefira um campo de nome completo; ofereça nome social quando houver identificação da pessoa.
- Desconfiança de golpes digitais é alta: sinais de segurança e de marca, explicação do uso dos dados e ausência de surpresas (custos, cobranças) pesam na decisão.
- Relação próxima e cordial é valorizada; frieza ou excesso de burocracia afastam, mas intimidade forçada também.`
  },
  {
    id: 'formularios',
    title: 'Formulários e entrada de dados (padrões brasileiros)',
    when: (t) => t.fields > 0,
    text: `- Uma coluna é mais rápida de preencher e mais difícil de errar do que várias colunas; exceção para pares naturais e curtos (CEP e número, DDD e telefone).
- Rótulo acima do campo, sempre visível. Exemplos de formato no texto de ajuda, não dentro do campo.
- Peça só o necessário naquela etapa; cada campo a mais reduz conclusão. Campos opcionais marcados como "(opcional)".
- Tamanho do campo sugere o tamanho da resposta (CEP curto, endereço longo).
- Agrupe por assunto com subtítulos (Dados pessoais, Endereço, Veículo) e mantenha uma ordem lógica.
- Máscaras e teclado certo (teclado numérico em CPF, CEP, telefone):
  - CPF: 000.000.000-00 (11 dígitos).
  - CNPJ: 00.000.000/0000-00. Desde julho de 2026 a Receita Federal atribui CNPJ alfanumérico a novas inscrições (as posições iniciais podem ter letras, os dígitos verificadores seguem numéricos): campos de CNPJ não podem aceitar só números nem usar teclado só numérico.
  - CEP: 00000-000, preenchendo o endereço automaticamente e deixando editar.
  - Telefone: (00) 00000-0000 para celular, (00) 0000-0000 para fixo.
  - Placa: padrão Mercosul ABC1D23 e antigo ABC-1234 continuam circulando; aceite os dois.
  - Data: dd/mm/aaaa; valores: R$ 1.234,56 (vírgula decimal, ponto de milhar).
  - RG varia por estado: não force máscara única.
- Validação: confirme formato ao sair do campo, não a cada tecla; mensagem junto do campo; nunca apague o que foi digitado por causa de um erro.
- Botão principal ao final, alinhado ao fluxo de leitura; ação secundária (voltar) com menos peso e longe o suficiente para não ser tocada por engano. Não use botão "Limpar".
- Botão desabilitado sem explicação confunde; prefira habilitar e dizer o que falta ao tentar avançar.
- Em formulários longos, salve o progresso e mostre a etapa atual.`
  },
  {
    id: 'dados',
    title: 'Dados pessoais, LGPD e confiança',
    when: (t) => t.personalData || t.payment,
    text: `- LGPD (Lei 13.709/2018): coletar só o necessário para a finalidade, dizer para que o dado será usado e permitir que a pessoa entenda e decida.
- Consentimento precisa ser livre, informado e inequívoco: caixa de seleção nunca vem marcada; termos em linguagem simples, com o essencial resumido ao lado do link.
- Explique o porquê de dados sensíveis no momento em que são pedidos.
- Sinais de confiança perto do pedido de dados ou de pagamento: marca reconhecível, ambiente seguro, política de privacidade acessível, contato de atendimento.
- Mostre custos totais antes do compromisso; surpresas no final destroem confiança e conversão.`
  },
  {
    id: 'seguros',
    title: 'Seguros e serviços financeiros',
    when: (t) => t.insurance || t.payment,
    text: `- Termos técnicos do setor precisam de explicação ou de equivalente simples: prêmio (o valor pago pelo seguro), franquia (a parte do prejuízo paga pelo segurado), sinistro (o ocorrido coberto), apólice, carência, indenização, coberturas e assistências.
- Comparação de planos lado a lado, com o que muda entre eles, e o recomendado destacado com o motivo.
- Valor, forma de pagamento e o que está coberto (e o que não está) visíveis antes de pedir confirmação.
- Em momentos de tensão (sinistro, cancelamento, recusa) o tom deve ser acolhedor e objetivo, com próximo passo claro e prazo.
- Para profissionais que usam a ferramenta todo dia (como corretores), eficiência pesa: reaproveitar dados já informados, atalhos, menos cliques, informação densa porém organizada.`
  },
  {
    id: 'navegacao',
    title: 'Arquitetura de informação e navegação',
    when: (t) => t.navigation || t.firstScreen,
    text: `- A pessoa precisa responder: onde estou, o que posso fazer aqui, para onde posso ir. Título da página, item ativo no menu e trilha (breadcrumb) ajudam.
- Rótulos de menu com o vocabulário do usuário e mutuamente exclusivos (não deve ficar em dúvida entre dois itens).
- Agrupe por tarefa ou objetivo do usuário, não pela estrutura interna da empresa.
- Poucos itens no primeiro nível; o resto em níveis claros. Itens muito parecidos entre si indicam problema de organização.
- A tela inicial deve dar acesso direto às tarefas mais frequentes e mostrar o que está pendente ou em andamento.
- Cards e listas: informação mais importante primeiro em cada item, com ação clara; itens iguais demais impedem distinguir e escolher.`
  },
  {
    id: 'modal',
    title: 'Modais e diálogos',
    when: (t) => t.dialog,
    text: `- Use modal só para uma decisão ou tarefa curta que exige foco; conteúdo longo ou formulário extenso pede página própria.
- Título que diz o assunto ou a pergunta; texto curto; ação principal clara e uma forma evidente de sair (botão de fechar, "Cancelar", tecla Esc, clique fora quando não houver perda).
- Ações destrutivas ou irreversíveis pedem confirmação com o nome da ação no botão.
- Não abra modal sem o usuário pedir (por exemplo, ao carregar a página) e não empilhe modais.`
  },
  {
    id: 'estados',
    title: 'Feedback, erros, vazio e confirmação',
    when: (t) => t.confirmation || t.error || t.firstScreen,
    text: `- Confirmação de sucesso: diga o que foi feito, mostre um identificador (protocolo, número da proposta), o prazo e o próximo passo; ofereça salvar ou compartilhar.
- Tela de erro: explique em linguagem simples, diga como resolver e ofereça caminho (tentar de novo, falar com atendimento) sem perder o que foi feito.
- Estado vazio: explique por que está vazio e ofereça a ação para começar ("Nenhuma cotação ainda. Fazer primeira cotação").
- Carregamento acima de 1 segundo pede indicador; acima de alguns segundos, diga o que está acontecendo.`
  },
  {
    id: 'mobile',
    title: 'Celular',
    when: (t) => t.mobile,
    text: `- A ação principal deve ficar ao alcance do polegar (parte de baixo da tela) e visível sem rolar, ou fixa no rodapé em telas longas.
- Alvos de toque de 44 a 48px, com espaço entre eles.
- Campos com fonte de pelo menos 16px (no iPhone, menor que isso faz o navegador dar zoom ao tocar) e teclado adequado (numérico, e-mail, telefone).
- Nada que dependa de passar o mouse por cima.
- Texto e imagens legíveis sem zoom; evite tabelas largas que exigem rolagem lateral.`
  },
  {
    id: 'conteudo',
    title: 'Textos longos e conteúdo informativo',
    when: (t) => t.longText,
    text: `- As pessoas varrem antes de ler: subtítulos que resumem, parágrafos curtos, listas, destaque para o essencial.
- A informação mais importante primeiro (pirâmide invertida).
- Corte o que não ajuda a decidir ou agir; o detalhe pode ficar num "Saiba mais".`
  },
  {
    id: 'emocional',
    title: 'Design emocional',
    when: () => true,
    text: `- Visceral: a primeira impressão estética, em frações de segundo, define a disposição para continuar e a percepção de confiança e de qualidade.
- Comportamental: a sensação de controle e fluidez ao usar; atrito, incerteza e erro geram frustração.
- Reflexivo: o significado depois do uso, a imagem que fica da marca e se a pessoa voltaria ou recomendaria.
- Microinterações e textos que reconhecem o esforço do usuário (em fluxos longos, depois de concluir) reforçam a experiência, desde que não atrasem a tarefa.`
  }
];

const has = (s: string, re: RegExp) => re.test(s);

export function screenTraits(analysis: any, screen: any, index: number): Traits {
  const ctx = screen.context || {};
  const text = `${ctx.title || ''} ${ctx.text || ''} ${(ctx.buttons || []).join(' ')} ${analysis.goal || ''} ${analysis.audience || ''}`.toLowerCase();
  const els: any[] = Array.isArray(screen.elements) ? screen.elements : [];
  const fields = (ctx.fields || []).length || els.filter((e) => e.k === 'campo').length;
  const actions = els.filter((e) => e.k === 'acao').length;
  const labels = (ctx.fields || []).map((f: any) => `${f.label} ${f.placeholder || ''}`.toLowerCase()).join(' ');
  return {
    fields,
    actions,
    dialog: !!(ctx.dialog || screen.dialog),
    mobile: analysis.device === 'mobile' || (screen.viewportWidth || 1440) < 700,
    confirmation: has(text, /sucesso|enviad[ao]|conclu[ií]d|confirmad|protocolo|obrigad|pronto!/),
    error: (ctx.errors || []).length > 0 || has(text, /erro|inválid|invalid|não foi possível|tente novamente/),
    navigation: actions >= 6 && fields === 0,
    personalData: has(`${labels} ${text}`, /cpf|cnpj|rg\b|nascimento|e-?mail|telefone|celular|endere[cç]o|cep|nome completo|renda/),
    payment: has(text, /pagamento|pagar|cart[aã]o|boleto|pix|parcel|r\$/),
    insurance: has(text, /seguro|segurad|ap[oó]lice|cobertura|franquia|sinistro|pr[eê]mio|corretor|cota[cç][aã]o|assist[eê]ncia/),
    longText: String(ctx.text || '').length > 1500,
    firstScreen: index === 0
  };
}

/** O repertório que vai para o agente nesta tela (só os blocos que se aplicam). */
export function knowledgeFor(analysis: any, screen: any, index: number) {
  const t = screenTraits(analysis, screen, index);
  const blocks = BLOCKS.filter((b) => b.when(t));
  return { traits: t, ids: blocks.map((b) => b.id), text: blocks.map((b) => `## ${b.title}\n${b.text}`).join('\n\n') };
}
