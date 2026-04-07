import type { Metadata } from 'next'
import { Inter, Playfair_Display, DM_Sans, Press_Start_2P, VT323 } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const pressStart2P = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pixel',
  display: 'swap',
})

const vt323 = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-vt323',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'The Practical Engineer',
    template: '%s | The Practical Engineer',
  },
  description: 'Practical knowledge for engineers who ship. Deep dives, guides, and architecture insights.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${playfair.variable} ${dmSans.variable} ${pressStart2P.variable} ${vt323.variable}`}>
        <NextTopLoader showSpinner={false} />
        {children}
      </body>
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      )}
    </html>
  )
}
