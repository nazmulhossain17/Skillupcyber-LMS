// components/layout/ConditionalLayout.tsx
'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/home/Header';
import { Footer } from '@/components/home/Footer';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLearnPage = pathname?.includes('/learn');

  return (
    <>
      {!isLearnPage && <Header />}
      {children}
      {!isLearnPage && <Footer />}
    </>
  );
}