import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "sonner";
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
  title: "FLOW - Plataforma de Automação",
  description: "Plataforma de Automação",
  icons: {
    icon: '/assets/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <NextTopLoader
          color="#ffffffff"
          shadow="0 0 10px #ffffffff, 0 0 5px #ffffffff"
          height={3}
          showSpinner={false}
        />
        <Toaster
          position="top-right"
          gap={8}
          offset={32}
          toastOptions={{
            style: {
              background: 'rgba(5, 15, 30, 0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#ffffff',
              backdropFilter: 'blur(24px)',
              fontFamily: 'inherit',
              borderRadius: '9999px',
              padding: '14px 24px',
              fontSize: '13.5px',
              fontWeight: '500',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
