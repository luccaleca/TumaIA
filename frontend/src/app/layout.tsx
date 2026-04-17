import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TumaIA",
  description: "Crie posts profissionais direto do seu WhatsApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
