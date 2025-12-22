import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter, Bebas_Neue } from 'next/font/google'
import './globals.css'


const inter = Inter({ subsets: ['latin'] })
const bebasNeue = Bebas_Neue({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display'
})
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Richy.ai - Valide et construis ton SaaS comme un boss",
  description: "Plateforme IA pour valider tes idées SaaS, générer des roadmaps personnalisées et recevoir des conseils entrepreneur. Essai gratuit 3 jours.",
  keywords: ["SaaS", "validation d'idée", "roadmap", "entrepreneur", "IA", "startup"],
  authors: [{ name: "Richy.ai" }],
  creator: "Richy.ai",
  publisher: "Richy.ai",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://richy.ai'),
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Richy.ai",
    title: "Richy.ai - Valide et construis ton SaaS comme un boss",
    description: "Plateforme IA pour valider tes idées SaaS, générer des roadmaps personnalisées et recevoir des conseils entrepreneur. Essai gratuit 3 jours.",
    images: [
      {
        url: "/logo-richy.png",
        width: 1200,
        height: 630,
        alt: "Richy.ai Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Richy.ai - Valide et construis ton SaaS comme un boss",
    description: "Plateforme IA pour valider tes idées SaaS, générer des roadmaps personnalisées et recevoir des conseils entrepreneur.",
    images: ["/logo-richy.png"],
    creator: "@richyai",
  },
  icons: {
    icon: [
      { url: "/logo-richy.png", sizes: "any" },
      { url: "/logo-richy.png", type: "image/png", sizes: "32x32" },
      { url: "/logo-richy.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/logo-richy.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/logo-richy.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/logo-richy.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-richy.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
