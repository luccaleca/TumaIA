export const YOUTUBE_VIDEO_ID = "AvYnII7Twx4";
export const YOUTUBE_DEMO_URL = "https://youtube.com/shorts/AvYnII7Twx4?feature=share";

export const INSTAGRAM_URL =
  "https://www.instagram.com/tumaiaoficial?utm_source=ig_web_button_share_sheet&exln=ZDNlZDc0MzIxNw==";

export const NAV_LINKS = [
  { id: "produto", label: "Produto" },
  { id: "planos", label: "Planos" },
  { id: "quem-somos", label: "Quem somos" },
];

export const HERO = {
  titulo: "Do WhatsApp para o Instagram",
  destaque: "em segundos",
  texto:
    "O TumaIA transforma o seu pedido por mensagem no WhatsApp em posts profissionais para o Instagram — com as fotos e a identidade da sua marca, cadastradas no painel, e sem complicação técnica.",
  chips: ["WhatsApp como canal", "IA generativa", "Aprovação antes de publicar"],
};

export const DEMO = {
  eyebrow: "Demonstração",
  titulo: "Veja o projeto em poucos minutos",
  texto:
    "Assista ao vídeo para entender como o TumaIA se conecta no WhatsApp, inteligência artificial e Instagram para automatizar a criação de conteúdo da sua marca.",
};

export const PRATICA = {
  eyebrow: "Na prática",
  titulo: "Feito para o dia a dia do comércio",
  texto: "Imagens que representam como o TumaIA se encaixa na rotina de quem vende, atende e precisa postar.",
  cards: [
    {
      slot: "practiceWhats",
      titulo: "Pelo WhatsApp",
      texto: "Peça posts onde você já conversa com clientes — sem app novo para aprender.",
    },
    {
      slot: "practicePanel",
      titulo: "Painel web",
      texto: "Configure empresa, contextos e mídias com clareza, quando precisar.",
    },
    {
      slot: "practicePace",
      titulo: "Para o seu ritmo",
      texto: "Pensado para PMEs que precisam de presença no Instagram sem parar o balcão.",
    },
  ],
};

export const PRODUTO = {
  eyebrow: "Produto",
  titulo: "Como o TumaIA funciona",
  texto:
    "Simplificamos o marketing do seu comércio. Esqueça horas perdidas criando posts — a IA cuida do conteúdo; você cuida do negócio.",
  passos: [
    {
      num: "01",
      icon: "plug",
      titulo: "Conexão direta",
      texto: "Integre o TumaIA ao WhatsApp do seu negócio de forma simples e rápida.",
    },
    {
      num: "02",
      icon: "sparkles",
      titulo: "Criação com IA",
      texto: "Legendas persuasivas e imagens alinhadas à identidade da sua marca.",
    },
    {
      num: "03",
      icon: "send",
      titulo: "Publicação",
      texto: "Aprove no WhatsApp e publique no Instagram sem sair da rotina da loja.",
    },
  ],
  automacao: {
    titulo: "Automação inteligente",
    texto:
      "O TumaIA usa as fotos e a identidade da sua marca, cadastradas no painel, para criar conteúdos alinhados ao seu negócio, liberando seu tempo para focar no que realmente importa.",
  },
  fluxo: {
    titulo: "Fluxo de produção",
    passos: [
      "Você pede o post por mensagem no WhatsApp.",
      "A IA processa e cria a arte + legenda.",
      "Você recebe a prévia no próprio WhatsApp.",
      "É só aprovar e o post vai pro ar.",
    ],
  },
};

export const PLANOS = {
  eyebrow: "Planos",
  titulo: "Pacotes para impulsionar seu negócio",
  texto: "Escolha o pacote ideal para a sua necessidade, sem fidelidade ou letras miúdas.",
  tabelaTitulo: "Comparativo de benefícios",
  planos: [
    {
      id: "free",
      nome: "Free",
      preco: "R$ 79,90",
      texto: "Ideal para quem está começando a estruturar as redes sociais.",
    },
    {
      id: "plus",
      nome: "Plus",
      preco: "R$ 129,90",
      texto: "Automação completa para quem quer presença digital diária.",
      destaque: true,
    },
    {
      id: "pro",
      nome: "Pro",
      preco: "R$ 349,90",
      texto: "Para quem cuida de várias empresas, como pequenas agências, em um só plano.",
    },
  ],
  /** `card: true` aparece também na lista de cada card de plano. */
  linhas: [
    { recurso: "Empresas", valores: ["1", "3", "Até 10"], card: true },
    { recurso: "Produtos cadastrados", valores: ["50", "500", "1.200"], card: true },
    { recurso: "Fotos por mês", valores: ["15", "30", "100"], card: true },
    { recurso: "Artes por mês (aprox.)", valores: ["10", "20", "67"], card: true },
    { recurso: "Preço por foto", valores: ["R$ 5,33", "R$ 4,33", "R$ 3,50"] },
  ],
  nota: "Artes estimadas considerando 1,5 foto por arte. As fotos do plano que não forem usadas expiram no fim do mês.",
  tokens: {
    titulo: "Precisa de mais fotos no mês?",
    texto:
      "Quando as fotos do plano acabam, você compra tokens avulsos: 1 token = 1 foto. Quanto maior o pacote, menor o preço por token.",
    pacotes: [
      { tokens: 1, preco: "R$ 4,90", porToken: "R$ 4,90", desconto: null },
      { tokens: 5, preco: "R$ 21,90", porToken: "R$ 4,38", desconto: "11%" },
      { tokens: 10, preco: "R$ 39,90", porToken: "R$ 3,99", desconto: "19%" },
      { tokens: 20, preco: "R$ 76,90", porToken: "R$ 3,85", desconto: "22%" },
      { tokens: 30, preco: "R$ 107,90", porToken: "R$ 3,60", desconto: "27%" },
      { tokens: 50, preco: "R$ 170,90", porToken: "R$ 3,42", desconto: "30%" },
      { tokens: 100, preco: "R$ 317,90", porToken: "R$ 3,18", desconto: "35%" },
    ],
  },
};

export const DEPOIMENTOS = {
  eyebrow: "Depoimentos",
  titulo: "O que nossos clientes dizem",
  texto: "Veja como o TumaIA está transformando a rotina de empreendedores.",
  itens: [
    {
      texto:
        "Antes eu passava o domingo fazendo post. Agora peço pelo WhatsApp e em minutos já tenho legenda e imagem prontas para aprovar.",
      nome: "Mariana Souza",
      cargo: "Loja de roupas, Belo Horizonte",
    },
    {
      texto:
        "O melhor é não precisar abrir outro app na correria do balcão. Peço pelo WhatsApp e sigo atendendo cliente; o marketing não para.",
      nome: "Ricardo Almeida",
      cargo: "Padaria & cafeteria, Curitiba",
    },
    {
      texto:
        "Eu não entendo nada de design. O TumaIA mantém um padrão parecido com o que eu já postava, só que bem mais rápido e organizado.",
      nome: "Fernanda Costa",
      cargo: "Estética automotiva, Fortaleza",
    },
  ],
};

export const FAQ = {
  eyebrow: "FAQ",
  titulo: "Dúvidas comuns",
  itens: [
    {
      q: "Como funciona a integração com o WhatsApp?",
      a: "Você conecta o número do seu negócio ao fluxo do TumaIA. A partir daí, pedidos de conteúdo podem ser feitos por mensagem de texto no WhatsApp, e o sistema responde com prévias e próximos passos no mesmo canal.",
    },
    {
      q: "Preciso saber de design ou edição de imagem?",
      a: "Não. O TumaIA gera sugestões de legenda e arte com base no contexto da sua marca. Você só revisa e aprova quando estiver satisfeito.",
    },
    {
      q: "Meus dados e mídias ficam seguros?",
      a: "Sim. O fluxo foi pensado para uso comercial, com armazenamento e tráfego adequados ao painel e à automação. Evite compartilhar senhas e use sempre o cadastro oficial da sua equipe.",
    },
    {
      q: "Quanto tempo leva para publicar no Instagram?",
      a: "Depois que a IA processa seu pedido e você aprova a prévia, a publicação segue o fluxo configurado para o seu Instagram. Em geral, são poucos minutos do pedido à entrega da arte para aprovação.",
    },
    {
      q: "Posso cancelar ou mudar de plano depois?",
      a: "Sim. Os planos foram pensados sem fidelidade forçada: você escolhe o pacote que faz sentido hoje e pode ajustar conforme sua loja crescer.",
    },
  ],
};

export const SOBRE = {
  eyebrow: "Sobre",
  titulo: "Nossa história",
  texto:
    "Nascemos para descomplicar o marketing digital para pequenos e médios empreendedores, unindo a praticidade do aplicativo de mensagens mais usado do Brasil com o poder da inteligência artificial.",
  valores: [
    ["Missão", "Democratizar o acesso a um marketing de qualidade e automatizado."],
    ["Visão", "Ser a principal ferramenta de automação de redes sociais para o comércio local."],
    ["Valores", "Inovação, simplicidade e foco total no sucesso do cliente."],
  ],
};

export const CTA_FINAL = {
  titulo: "Pronto para revolucionar seu Instagram?",
  texto: "Cadastre sua empresa, configure a identidade da marca e comece a produzir conteúdo pelo WhatsApp.",
};

/** Equipe/instituição: preencha para exibir no rodapé (fica oculto se vazio). */
export const CREDITS = [];

export const FOOTER_DESCRICAO =
  "O TumaIA transforma pedidos por mensagem no WhatsApp em posts profissionais para o Instagram.";
