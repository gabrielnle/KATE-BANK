import Link from 'next/link'
import { KateLogo } from './KateLogo'
import { Globe, Rss, Code2 } from 'lucide-react'

const footerLinks = {
  Plataforma: [
    { label: 'Oportunidades',    href: '/offers' },
    { label: 'Mercado Secundário', href: '/secondary' },
    { label: 'Captar Recursos',  href: '/captar' },
    { label: 'Como Funciona',    href: '/about' },
  ],
  Empresa: [
    { label: 'Sobre a Kate',    href: '/about' },
    { label: 'Blog',            href: '/blog' },
    { label: 'Contato',         href: '/contato' },
    { label: 'Carreiras',       href: '/carreiras' },
  ],
  Legal: [
    { label: 'Termos de Uso',          href: '/termos' },
    { label: 'Política de Privacidade', href: '/privacidade' },
    { label: 'CVM 88 Compliance',      href: '/compliance' },
    { label: 'Alertas de Risco',       href: '/riscos' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-kate-dark-blue border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <KateLogo width={28} />
              <span className="font-bold text-white">Kate <span className="text-kate-yellow">Equity</span></span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed">
              Plataforma de Equity Crowdfunding integrada à blockchain Stellar.
              Conformidade CVM 88 e segurança para seus investimentos.
            </p>
            <div className="flex gap-3 mt-5">
              <a href="#" aria-label="Website" className="text-white/40 hover:text-kate-yellow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kate-yellow rounded"><Globe size={18} /></a>
              <a href="#" aria-label="Blog RSS" className="text-white/40 hover:text-kate-yellow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kate-yellow rounded"><Rss size={18} /></a>
              <a href="#" aria-label="Código Fonte" className="text-white/40 hover:text-kate-yellow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kate-yellow rounded"><Code2 size={18} /></a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-kate-yellow font-semibold text-sm mb-4 uppercase tracking-wider">{section}</h4>
              <ul className="flex flex-col gap-2.5">
                {links.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-white/50 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Stellar badge */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-white/30">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Powered by <span className="text-white/50 font-medium">Stellar Network</span>
          </div>
          <p className="text-xs text-white/30 text-center">
            © {new Date().getFullYear()} Kate Equity. Todos os direitos reservados.
            Investimento em valores mobiliários envolve riscos.
          </p>
          <div className="text-xs text-white/30">
            CVM 88 • CNPJ: 00.000.000/0001-00
          </div>
        </div>
      </div>
    </footer>
  )
}
