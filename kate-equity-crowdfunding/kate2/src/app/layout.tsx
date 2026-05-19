import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { TRPCProvider } from '@/lib/trpc/Provider'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Kate Equity | Investimento em Tokens', template: '%s | Kate Equity' },
  description: 'Plataforma de Equity Crowdfunding integrada à blockchain Stellar. Invista em tokens lastreados em ativos reais com segurança e conformidade CVM 88.',
  keywords: ['equity crowdfunding', 'tokens', 'investimento', 'blockchain', 'Stellar', 'CVM 88'],
  openGraph: {
    title:       'Kate Equity | Investimento em Tokens',
    description: 'Tokenize seus investimentos na blockchain Stellar com conformidade CVM 88.',
    type:        'website',
    locale:      'pt_BR',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-kate-dark text-white antialiased`}>
        <TRPCProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </TRPCProvider>
        <Analytics />
      </body>
    </html>
  )
}

