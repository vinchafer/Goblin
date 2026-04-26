import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Goblin — The Cloud Workshop for Builders",
  description: "Build apps with AI from any device. Your workshop lives in the cloud. No setup, no token panic.",
  openGraph: {
    title: "Goblin — The Cloud Workshop for Builders",
    description: "Build apps with AI from any device. Your workshop lives in the cloud.",
    type: "website",
    locale: "en_US",
    url: "https://goblin.dev"
  },
  twitter: {
    card: "summary_large_image",
    title: "Goblin — The Cloud Workshop for Builders"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2D4A2B" />
      </head>
      <body>{children}</body>
    </html>
  );
}