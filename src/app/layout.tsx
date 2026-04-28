import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Omni-Builder — AI-Powered Web App Builder",
  description: "Generate, preview, and deploy full-stack web applications from natural language prompts. The open-source alternative to Bolt.new and Lovable.",
  keywords: ["Omni-Builder", "AI", "Code Generation", "React", "Vite", "Web Builder", "Next.js", "TypeScript"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Omni-Builder",
    description: "AI-powered web application builder",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        {children}
      </body>
    </html>
  );
}
