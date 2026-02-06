// ============================================
// FILE: app/api/certificates/route.ts
// API to fetch user's certificates
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
import { eq, and, desc } from 'drizzle-orm';

// GET - Fetch all certificates for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all certificates for user
    const certificates = await db
      .select({
        id: issuedCertificates.id,
        credentialId: issuedCertificates.credentialId,
        studentName: issuedCertificates.studentName,
        courseName: issuedCertificates.courseName,
        instructorName: issuedCertificates.instructorName,
        courseHours: issuedCertificates.courseHours,
        issuedAt: issuedCertificates.issuedAt,
        isRevoked: issuedCertificates.isRevoked,
        downloadCount: issuedCertificates.downloadCount,
        courseId: issuedCertificates.courseId,
        // Course info
        courseSlug: courses.slug,
        courseThumbnail: courses.thumbnail,
        // Template info for rendering
        templateId: certificateTemplates.id,
        templateTitle: certificateTemplates.title,
        templateSettings: certificateTemplates.settings,
        primaryColor: certificateTemplates.primaryColor,
      })
      .from(issuedCertificates)
      .innerJoin(courses, eq(issuedCertificates.courseId, courses.id))
      .innerJoin(certificateTemplates, eq(issuedCertificates.templateId, certificateTemplates.id))
      .where(
        and(
          eq(issuedCertificates.studentId, appUser.id),
          eq(issuedCertificates.isRevoked, false)
        )
      )
      .orderBy(desc(issuedCertificates.issuedAt));

    return NextResponse.json({
      success: true,
      certificates,
    });

  } catch (error: any) {
    console.error('Get certificates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}