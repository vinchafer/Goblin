import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,700&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a1c" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
