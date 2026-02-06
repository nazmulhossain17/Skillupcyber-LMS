// ============================================
// FILE: app/api/certificates/[certificateId]/route.ts
// API for individual certificate operations
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { 
  app_users,
  courses,
  certificateTemplates,
  issuedCertificates,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// GET - Fetch single certificate by ID or credential ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const { certificateId } = await params;

    // Can be UUID or credential ID (CERT-XXXX-XXXXXXXX)
    const isCredentialId = certificateId.startsWith('CERT-');

    // Fetch certificate with all related data
    const [certificate] = await db
      .select({
        // Certificate data
        id: issuedCertificates.id,
        credentialId: issuedCertificates.credentialId,
        studentName: issuedCertificates.studentName,
        courseName: issuedCertificates.courseName,
        instructorName: issuedCertificates.instructorName,
        courseHours: issuedCertificates.courseHours,
        issuedAt: issuedCertificates.issuedAt,
        isRevoked: issuedCertificates.isRevoked,
        revokedAt: issuedCertificates.revokedAt,
        revokedReason: issuedCertificates.revokedReason,
        downloadCount: issuedCertificates.downloadCount,
        courseId: issuedCertificates.courseId,
        studentId: issuedCertificates.studentId,
        // Template data
        templateId: certificateTemplates.id,
        templateTitle: certificateTemplates.title,
        templateSubtitle: certificateTemplates.subtitle,
        templateDescription: certificateTemplates.description,
        signatureText: certificateTemplates.signatureText,
        signatureImage: certificateTemplates.signatureImage,
        logoUrl: certificateTemplates.logoUrl,
        backgroundUrl: certificateTemplates.backgroundUrl,
        primaryColor: certificateTemplates.primaryColor,
        secondaryColor: certificateTemplates.secondaryColor,
        settings: certificateTemplates.settings,
        // Course data
        courseSlug: courses.slug,
        courseThumbnail: courses.thumbnail,
      })
      .from(issuedCertificates)
      .innerJoin(certificateTemplates, eq(issuedCertificates.templateId, certificateTemplates.id))
      .innerJoin(courses, eq(issuedCertificates.courseId, courses.id))
      .where(
        isCredentialId
          ? eq(issuedCertificates.credentialId, certificateId)
          : eq(issuedCertificates.id, certificateId)
      )
      .limit(1);

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      certificate,
      isValid: !certificate.isRevoked,
    });

  } catch (error: any) {
    console.error('Get certificate error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificate' },
      { status: 500 }
    );
  }
}

// POST - Track download
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const { certificateId } = await params;
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'download') {
      // Increment download count using sql template
      await db
        .update(issuedCertificates)
        .set({
          downloadCount: sql`${issuedCertificates.downloadCount} + 1`,
          lastDownloadedAt: new Date(),
        })
        .where(eq(issuedCertificates.id, certificateId));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Certificate action error:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}