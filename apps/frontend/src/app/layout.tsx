import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sora } from 'next/font/google';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });

export const metadata: Metadata = {
  title: 'Bosowa Smart OCR',
  description: 'Upload, crop, and digitize invoices effortlessly.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable}`}>
      <body className="font-body bg-transparent">{children}</body>
    </html>
  );
}
