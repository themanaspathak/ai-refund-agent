import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/UI/Navbar";

export const metadata: Metadata = {
  title: "AI Customer Support Refund Agent",
  description: "Autonomous refund customer support agent with deterministic backend policy enforcement",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
