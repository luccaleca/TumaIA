export const landingCopy = {
  brand: { name: "Tuma", suffix: "IA" },
  nav: [
    { href: "#produto", id: "produto", label: "Produto" },
    { href: "#planos", id: "planos", label: "Planos" },
    { href: "#quem-somos", id: "quem-somos", label: "Quem somos" },
  ],
  auth: {
    entrar: "Entrar",
    cadastrar: "Cadastrar",
    areaUsuario: "Área do usuário",
    sair: "Sair",
  },
  hero: {
    titleBefore: "Do WhatsApp para o Instagram",
    titleHighlight: "em segundos",
    description:
      "O TumaIA transforma mensagens, áudios e fotos do WhatsApp em posts profissionais para o Instagram — com a identidade da sua marca e sem complicação técnica.",
    ctaPrimary: "Começar agora",
    ctaSecondary: "Como funciona",
    chips: ["WhatsApp como canal", "IA generativa", "Aprovação antes de publicar"],
    floatAudio: "Áudio enviado",
    floatPreview: "Prévia pronta para aprovar",
    floatPublished: "Aprovado e publicado",
  },
  demo: {
    eyebrow: "Demonstração",
    title: "Veja o projeto em poucos minutos",
    description:
      "Assista ao vídeo da equipe explicando como o TumaIA conecta WhatsApp, inteligência artificial e Instagram para automatizar a criação de conteúdo da sua marca.",
    youtubeLabel: "Abrir no YouTube",
    youtubeUrl: "https://youtube.com/shorts/wkVhfJu6v0w?si=O1RNpmzxEPmrXYIt",
    youtubeId: "wkVhfJu6v0w",
  },
  practice: {
    eyebrow: "Na prática",
    title: "Feito para o dia a dia do comércio",
    description:
      "Imagens que representam como o TumaIA se encaixa na rotina de quem vende, atende e precisa postar.",
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
  },
  product: {
    eyebrow: "Produto",
    title: "Como o TumaIA funciona",
    description:
      "Simplificamos o marketing do seu comércio. Esqueça horas perdidas criando posts — a IA cuida do conteúdo; você cuida do negócio.",
    steps: [
      {
        num: "01",
        titulo: "Conexão direta",
        texto: "Integre o TumaIA ao WhatsApp do seu negócio de forma simples e rápida.",
      },
      {
        num: "02",
        titulo: "Criação com IA",
        texto: "Legendas persuasivas e imagens alinhadas à identidade da sua marca.",
      },
      {
        num: "03",
        titulo: "Publicação",
        texto: "Aprove no WhatsApp e publique no Instagram sem sair da rotina da loja.",
      },
    ],
    automation: {
      title: "Automação inteligente",
      text: "O TumaIA aprende o tom de voz da sua marca e cria conteúdos como se fosse você, liberando seu tempo para focar no que realmente importa: o seu negócio.",
    },
    flow: {
      title: "Fluxo de produção",
      steps: [
        "Você envia um áudio ou foto no WhatsApp.",
        "A IA processa e cria a arte + legenda.",
        "Você recebe a prévia no próprio WhatsApp.",
        "É só aprovar e o post vai pro ar.",
      ],
    },
  },
  pricing: {
    eyebrow: "Planos",
    title: "Pacotes para impulsionar seu negócio",
    description: "Escolha o pacote ideal para a sua necessidade, sem fidelidade ou letras miúdas.",
    plans: [
      {
        id: "starter",
        name: "Starter",
        description: "Ideal para quem está começando a estruturar as redes sociais.",
        cta: "Começar agora",
        href: "/cadastro",
        featured: false,
      },
      {
        id: "pro",
        name: "Pro",
        description: "Automação completa para quem quer presença digital diária.",
        cta: "Começar agora",
        href: "/cadastro",
        featured: true,
        badge: "Popular",
      },
      {
        id: "business",
        name: "Business",
        description: "Escala e acompanhamento para operações com mais volume e times.",
        cta: "Falar com a equipe",
        href: "/cadastro",
        featured: false,
      },
    ],
    tableTitle: "Comparativo de benefícios",
    tableHeaders: ["Recurso", "Starter", "Pro", "Business"],
    tableRows: [
      ["Posts mensais (referência)", "Até 30", "Até 120", "Sob consulta"],
      ["Geração de imagens com IA", "Incluída (padrão)", "Incluída (prioridade)", "Fluxo customizado"],
      ["Suporte", "E-mail", "E-mail + chat prioritário", "Gerente de conta"],
    ],
  },
  testimonials: {
    eyebrow: "Depoimentos",
    title: "O que nossos clientes dizem",
    description: "Veja como o TumaIA está transformando a rotina de empreendedores.",
    items: [
      {
        texto:
          "Antes eu passava o domingo fazendo post. Agora mando um áudio no WhatsApp e em minutos já tenho legenda e imagem prontas para aprovar.",
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
  },
  faq: {
    eyebrow: "FAQ",
    title: "Dúvidas comuns",
    items: [
      {
        q: "Como funciona a integração com o WhatsApp?",
        a: "Você conecta o número do seu negócio ao fluxo do TumaIA. A partir daí, pedidos de conteúdo podem ser feitos por mensagem, áudio ou foto no WhatsApp, e o sistema responde com prévias e próximos passos no mesmo canal.",
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
  },
  about: {
    eyebrow: "Sobre",
    title: "Nossa história",
    description:
      "Nascemos para descomplicar o marketing digital para pequenos e médios empreendedores, unindo a praticidade do aplicativo de mensagens mais usado do Brasil com o poder da inteligência artificial.",
    pillars: [
      ["Missão", "Democratizar o acesso a um marketing de qualidade e automatizado."],
      ["Visão", "Ser a principal ferramenta de automação de redes sociais para o comércio local."],
      ["Valores", "Inovação, simplicidade e foco total no sucesso do cliente."],
    ],
  },
  cta: {
    title: "Pronto para revolucionar seu Instagram?",
    description:
      "Cadastre sua empresa, configure a identidade da marca e comece a produzir conteúdo pelo WhatsApp.",
    primary: "Começar agora",
    secondary: "Já tenho conta",
  },
  footer: {
    blurb:
      "O TumaIA transforma mensagens, áudios e fotos do WhatsApp em posts profissionais para o Instagram — com a identidade da sua marca e sem complicação técnica.",
    backToTop: "Voltar ao topo",
    socialTitle: "Redes sociais",
    instagram: {
      label: "@tumaiaoficial",
      href: "https://www.instagram.com/tumaiaoficial",
    },
  },
};
