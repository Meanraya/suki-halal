import { IBM_Plex_Sans_Thai, Prompt } from 'next/font/google';
import './globals.css';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

const plex = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata = {
  title: 'Suki Halal',
  description: 'ระบบสั่งอาหารบุฟเฟต์ Suki Halal',
};

export const viewport = {
  themeColor: '#0b3d2e',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${prompt.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
