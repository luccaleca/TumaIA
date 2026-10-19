import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "TumaIA — Do WhatsApp para o Instagram em segundos",
  description:
    "O TumaIA transforma mensagens, áudios e fotos do WhatsApp em posts profissionais para o Instagram — com a identidade da sua marca e aprovação antes de publicar.",
  openGraph: {
    title: "TumaIA",
    description:
      "Transforme mensagens do WhatsApp em posts profissionais para o Instagram com IA.",
    images: [{ url: "/imagens/imagem-final-pronto-instagram.jpg" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="landing-font-root min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
