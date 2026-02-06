// ============================================
// FILE: app/courses/page.tsx
// ============================================

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { CoursesPageClient } from '@/components/courses/new/CoursesPageClient';

function CoursesLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading courses...</p>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Suspense fallback={<CoursesLoading />}>
        <CoursesPageClient />
      </Suspense>
    </div>
  );
}