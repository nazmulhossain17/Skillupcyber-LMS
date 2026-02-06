// ============================================
// FILE: app/api/certificates/verify/[credentialId]/route.ts
// Public API to verify certificate authenticity
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { 
  courses,
  certificateTemplates,
  issuedCertificates,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET - Verify certificate by credential ID (public - no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const { credentialId } = await params;

    // Validate credential ID format
    if (!credentialId || !credentialId.startsWith('CERT-')) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid credential ID format' 
        },
        { status: 400 }
      );
    }

    // Fetch certificate
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
        // Course info
        courseSlug: courses.slug,
        courseThumbnail: courses.thumbnail,
        // Template info
        templateTitle: certificateTemplates.title,
        primaryColor: certificateTemplates.primaryColor,
      })
      .from(issuedCertificates)
      .innerJoin(certificateTemplates, eq(issuedCertificates.templateId, certificateTemplates.id))
      .innerJoin(courses, eq(issuedCertificates.courseId, courses.id))
      .where(eq(issuedCertificates.credentialId, credentialId))
      .limit(1);

    if (!certificate) {
      return NextResponse.json({
        valid: false,
        error: 'Certificate not found',
        message: 'No certificate found with this credential ID. It may have been revoked or does not exist.',
      });
    }

    if (certificate.isRevoked) {
      return NextResponse.json({
        valid: false,
        isRevoked: true,
        revokedAt: certificate.revokedAt,
        message: 'This certificate has been revoked.',
        certificate: {
          credentialId: certificate.credentialId,
          studentName: certificate.studentName,
          courseName: certificate.courseName,
        },
      });
    }

    // Valid certificate
    return NextResponse.json({
      valid: true,
      message: 'This certificate is valid and authentic.',
      certificate: {
        credentialId: certificate.credentialId,
        studentName: certificate.studentName,
        courseName: certificate.courseName,
        instructorName: certificate.instructorName,
        courseHours: certificate.courseHours,
        issuedAt: certificate.issuedAt,
        courseSlug: certificate.courseSlug,
      },
    });

  } catch (error: any) {
    console.error('Verify certificate error:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Failed to verify certificate' 
      },
      { status: 500 }
    );
  }
}