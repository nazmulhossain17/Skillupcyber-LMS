// ============================================
// FILE: app/certificates/verify/[credentialId]/CertificateVerificationClient.tsx
// Client component for certificate verification page
// ============================================

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Award,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  User,
  BookOpen,
  ExternalLink,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

interface CertificateData {
  id: string;
  credentialId: string;
  studentName: string;
  courseName: string;
  instructorName: string | null;
  courseHours: number | null;
  issuedAt: string;
  isRevoked: boolean;
  revokedAt: string | null;
  courseSlug: string;
  templateTitle: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
}

interface Props {
  certificate: CertificateData;
}

export function CertificateVerificationClient({ certificate }: Props) {
  const isValid = !certificate.isRevoked;
  
  // Default colors if null
  const primaryColor = certificate.primaryColor || '#4f0099';
  const secondaryColor = certificate.secondaryColor || '#22ad5c';

  return (
    <div className="min-h-screen bg-gray dark:bg-gray-dark">
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {certificate.logoUrl ? (
              <img 
                src={certificate.logoUrl} 
                alt="Logo" 
                className="h-16 object-contain"
              />
            ) : (
              <Award 
                className="h-16 w-16"
                style={{ color: primaryColor }}
              />
            )}
          </div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">
            Certificate Verification
          </h1>
          <p className="text-dark-5 mt-2">
            Verify the authenticity of a course completion certificate
          </p>
        </div>

        {/* Verification Status Card */}
        <Card className={`
          mb-6 border-2
          ${isValid 
            ? 'bg-green-light-6 dark:bg-green-dark/10 border-green dark:border-green-dark' 
            : 'bg-red-light-6 dark:bg-red-dark/10 border-red dark:border-red-dark'
          }
        `}>
          <CardContent className="py-8 text-center">
            {isValid ? (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green dark:bg-green-dark mb-4">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-green dark:text-green-light mb-2">
                  Valid Certificate
                </h2>
                <p className="text-green-dark dark:text-green-light-1">
                  This certificate is authentic and has been verified.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red dark:bg-red-dark mb-4">
                  <XCircle className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-red dark:text-red-light mb-2">
                  Certificate Revoked
                </h2>
                <p className="text-red-dark dark:text-red-light-1">
                  This certificate has been revoked and is no longer valid.
                </p>
                {certificate.revokedAt && (
                  <p className="text-sm text-red-dark/70 dark:text-red-light-1/70 mt-2">
                    Revoked on {format(new Date(certificate.revokedAt), 'MMMM d, yyyy')}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Certificate Details */}
        <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
          <CardContent className="py-6">
            <h3 className="text-lg font-semibold text-dark dark:text-white mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Certificate Details
            </h3>

            <div className="space-y-4">
              {/* Credential ID */}
              <div className="flex items-start gap-4 p-4 bg-gray-1 dark:bg-dark-3 rounded-lg">
                <Award className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-dark-5">Credential ID</p>
                  <p className="font-mono font-semibold text-dark dark:text-white">
                    {certificate.credentialId}
                  </p>
                </div>
              </div>

              {/* Student Name */}
              <div className="flex items-start gap-4 p-4 bg-gray-1 dark:bg-dark-3 rounded-lg">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-dark-5">Awarded To</p>
                  <p className="font-semibold text-dark dark:text-white">
                    {certificate.studentName}
                  </p>
                </div>
              </div>

              {/* Course Name */}
              <div className="flex items-start gap-4 p-4 bg-gray-1 dark:bg-dark-3 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-dark-5">Course</p>
                  <p className="font-semibold text-dark dark:text-white">
                    {certificate.courseName}
                  </p>
                  {certificate.instructorName && (
                    <p className="text-sm text-dark-5 mt-1">
                      Instructor: {certificate.instructorName}
                    </p>
                  )}
                </div>
              </div>

              {/* Issue Date & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-4 p-4 bg-gray-1 dark:bg-dark-3 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-dark-5">Issue Date</p>
                    <p className="font-semibold text-dark dark:text-white">
                      {format(new Date(certificate.issuedAt), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {certificate.courseHours && (
                  <div className="flex items-start gap-4 p-4 bg-gray-1 dark:bg-dark-3 rounded-lg">
                    <Clock className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-dark-5">Course Duration</p>
                      <p className="font-semibold text-dark dark:text-white">
                        {certificate.courseHours} hours
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* View Course Button */}
            {isValid && (
              <div className="mt-6 pt-6 border-t border-stroke dark:border-stroke-dark">
                <Link href={`/courses/${certificate.courseSlug}`}>
                  <Button 
                    className="w-full"
                    style={{ 
                      backgroundColor: primaryColor,
                      color: 'white',
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Course
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Note */}
        <div className="mt-6 p-4 bg-blue-light-5 dark:bg-blue-dark/10 rounded-lg border border-blue-light-3 dark:border-blue-dark/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue dark:text-blue-light shrink-0 mt-0.5" />
            <div className="text-sm text-blue-dark dark:text-blue-light-1">
              <p className="font-semibold mb-1">About Certificate Verification</p>
              <p>
                This page confirms the authenticity of certificates issued through our platform. 
                Each certificate has a unique credential ID that can be verified at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="text-sm text-dark-5 hover:text-primary transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}