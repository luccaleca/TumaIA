import "./landing.css";
import About from "./components/landing/About";
import Demo from "./components/landing/Demo";
import Faq from "./components/landing/Faq";
import FinalCta from "./components/landing/FinalCta";
import Footer from "./components/landing/Footer";
import Header from "./components/landing/Header";
import Hero from "./components/landing/Hero";
import HowItWorks from "./components/landing/HowItWorks";
import Practice from "./components/landing/Practice";
import Pricing from "./components/landing/Pricing";
import Testimonials from "./components/landing/Testimonials";

export const metadata = {
  title: "TumaIA — Do WhatsApp para o Instagram em segundos",
  description:
    "O TumaIA transforma mensagens, áudios e fotos do WhatsApp em posts profissionais para o Instagram, com a identidade da sua marca e aprovação antes de publicar.",
  openGraph: {
    title: "TumaIA — Do WhatsApp para o Instagram em segundos",
    description:
      "Posts profissionais para o Instagram criados com IA a partir do WhatsApp, com aprovação antes de publicar.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function Home() {
  return (
    <div className="lp">
      <a href="#conteudo" className="lp-skip">
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        <Hero />
        <Demo />
        <Practice />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <Faq />
        <About />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
