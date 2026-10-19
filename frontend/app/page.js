import About from "../components/landing/About";
import Demo from "../components/landing/Demo";
import Faq from "../components/landing/Faq";
import FinalCta from "../components/landing/FinalCta";
import Footer from "../components/landing/Footer";
import Header from "../components/landing/Header";
import Hero from "../components/landing/Hero";
import HowItWorks from "../components/landing/HowItWorks";
import LandingShell from "../components/landing/LandingShell";
import Practice from "../components/landing/Practice";
import Pricing from "../components/landing/Pricing";
import Testimonials from "../components/landing/Testimonials";

export default function Home() {
  return (
    <LandingShell>
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-[var(--brand-500)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--ink-950)]"
      >
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo-principal">
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
    </LandingShell>
  );
}
