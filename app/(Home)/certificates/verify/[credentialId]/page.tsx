// ============================================
// FILE: app/certificates/verify/[credentialId]/page.tsx
// Public page to verify certificate authenticity
// ============================================

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/db/drizzle';
import { 
  courses,
  certificateTemplates,
  issuedCertificates,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CertificateVerificationClient } from '@/components/CertificateVerificationClient';

interface PageProps {
  params: Promise<{ credentialId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { credentialId } = await params;
  
  return {
    title: `Verify Certificate ${credentialId}`,
    description: 'Verify the authenticity of this course completion certificate',
  };
}

export default async function CertificateVerificationPage({ params }: PageProps) {
  const { credentialId } = await params;

  // Fetch certificate from database
  const [certificate] = await db
    .select({
      id: issuedCertificates.id,
      credentialId: issuedCertificates.credentialId,
      studentName: issuedCertificates.studentName,
      courseName: issuedCertificates.courseName,
      instructorName: issuedCertificates.instructorName,
      courseHours: issuedCertificates.courseHours,
      issuedAt: issuedCertificates.issuedAt,
      isRevoked: issuedCertificates.isRevoked,
      revokedAt: issuedCertificates.revokedAt,
      courseSlug: courses.slug,
      templateTitle: certificateTemplates.title,
      primaryColor: certificateTemplates.primaryColor,
      secondaryColor: certificateTemplates.secondaryColor,
      logoUrl: certificateTemplates.logoUrl,
    })
    .from(issuedCertificates)
    .innerJoin(certificateTemplates, eq(issuedCertificates.templateId, certificateTemplates.id))
    .innerJoin(courses, eq(issuedCertificates.courseId, courses.id))
    .where(eq(issuedCertificates.credentialId, credentialId))
    .limit(1);

  if (!certificate) {
    notFound();
  }

  return (
    <CertificateVerificationClient
      certificate={{
        ...certificate,
        issuedAt: certificate.issuedAt.toISOString(),
        revokedAt: certificate.revokedAt?.toISOString() || null,
      }} 
    />
  );
}