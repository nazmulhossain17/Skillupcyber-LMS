// ============================================
// FILE: app/courses/[slug]/learn/layout.tsx
// ============================================

import { ReactNode } from 'react';

interface LearnLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function LearnLayout({ children, params }: LearnLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}