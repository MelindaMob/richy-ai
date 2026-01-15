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
  title: "RICHY.AI - Ton assistant IA pour valider et construire ton SaaS",
  description: "Valide et construis ton SaaS avec l'IA. Pas de bullshit, que du concret.",
  openGraph: {
    title: "RICHY.AI - Ton assistant IA pour valider et construire ton SaaS",
    description: "Valide et construis ton SaaS avec l'IA. Pas de bullshit, que du concret.",
    type: "website",
    siteName: "RICHY.AI",
    images: [
      {
        url: "/richy-logo.jpg",
        width: 1200,
        height: 630,
        alt: "RICHY.AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RICHY.AI - Ton assistant IA pour valider et construire ton SaaS",
    description: "Valide et construis ton SaaS avec l'IA. Pas de bullshit, que du concret.",
    images: ["/richy-logo.jpg"],
  },
  icons: {
    icon: "/richy-logo.jpg",
    apple: "/richy-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
