import type { Metadata } from "next";
import { Fraunces, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"]
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500"],
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
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
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a1c" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
