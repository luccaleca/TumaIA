import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export default function MainGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
