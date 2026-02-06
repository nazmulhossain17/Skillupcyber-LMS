// ============================================
// FILE: app/certificates/verify/[credentialId]/not-found.tsx
// Not found page for invalid certificate credentials
// ============================================

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { XCircle, Search, ArrowLeft } from 'lucide-react';

export default function CertificateNotFound() {
  return (
    <div className="min-h-screen bg-gray dark:bg-gray-dark flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
        <CardContent className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-light-6 dark:bg-red-dark/10 mb-6">
            <XCircle className="h-10 w-10 text-red" />
          </div>
          
          <h1 className="text-2xl font-bold text-dark dark:text-white mb-3">
            Certificate Not Found
          </h1>
          
          <p className="text-dark-5 mb-6">
            We couldn't find a certificate with this credential ID. 
            Please check the ID and try again.
          </p>

          <div className="space-y-3">
            <Link href="/" className="block">
              <Button className="w-full bg-primary text-white hover:bg-primary/90">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Home
              </Button>
            </Link>
            
            <Link href="/courses" className="block">
              <Button variant="outline" className="w-full border-stroke dark:border-stroke-dark">
                <Search className="h-4 w-4 mr-2" />
                Browse Courses
              </Button>
            </Link>
          </div>

          <p className="text-xs text-dark-6 mt-6">
            If you believe this is an error, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}