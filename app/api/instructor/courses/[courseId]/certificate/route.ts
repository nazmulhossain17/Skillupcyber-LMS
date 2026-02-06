// ============================================
// FILE: app/api/instructor/courses/[courseId]/certificate/route.ts
// Instructor API for managing certificate templates
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { 
  app_users, 
  courses, 
  certificateTemplates,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for certificate template
const certificateTemplateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  subtitle: z.string().max(255).optional(),
  description: z.string().optional(),
  signatureText: z.string().max(255).optional().nullable(),
  signatureImage: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  backgroundUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  settings: z.object({
    layout: z.enum(['classic', 'modern', 'minimal', 'elegant']).optional(),
    orientation: z.enum(['landscape', 'portrait']).optional(),
    showDate: z.boolean().optional(),
    showCourseHours: z.boolean().optional(),
    showInstructorName: z.boolean().optional(),
    showCredentialId: z.boolean().optional(),
    borderStyle: z.enum(['none', 'simple', 'elegant', 'ornate']).optional(),
    fontFamily: z.string().optional(),
  }).optional(),
  isActive: z.boolean().optional(),
});

// GET - Fetch certificate template for a course
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
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

    if (!appUser || !['instructor', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify course ownership
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, appUser.id)
        )
      )
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get certificate template
    const [template] = await db
      .select()
      .from(certificateTemplates)
      .where(eq(certificateTemplates.courseId, courseId))
      .limit(1);

    return NextResponse.json({
      success: true,
      template: template || null,
      course: {
        id: course.id,
        title: course.title,
        thumbnail: course.thumbnail,
      },
    });

  } catch (error: any) {
    console.error('Get certificate template error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificate template' },
      { status: 500 }
    );
  }
}

// POST - Create certificate template
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
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

    if (!appUser || !['instructor', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify course ownership
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, appUser.id)
        )
      )
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check if template already exists
    const [existing] = await db
      .select()
      .from(certificateTemplates)
      .where(eq(certificateTemplates.courseId, courseId))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'Certificate template already exists. Use PATCH to update.' },
        { status: 409 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = certificateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Create template with defaults
    const [template] = await db
      .insert(certificateTemplates)
      .values({
        courseId,
        title: parsed.data.title || 'Certificate of Completion',
        subtitle: parsed.data.subtitle || 'This is to certify that',
        description: parsed.data.description || 'has successfully completed the course',
        signatureText: parsed.data.signatureText || appUser.name,
        signatureImage: parsed.data.signatureImage,
        logoUrl: parsed.data.logoUrl,
        backgroundUrl: parsed.data.backgroundUrl,
        primaryColor: parsed.data.primaryColor || '#4f0099',
        secondaryColor: parsed.data.secondaryColor || '#22ad5c',
        settings: parsed.data.settings || {
          layout: 'classic',
          orientation: 'landscape',
          showDate: true,
          showCourseHours: true,
          showInstructorName: true,
          showCredentialId: true,
          borderStyle: 'elegant',
        },
        isActive: parsed.data.isActive ?? true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      template,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create certificate template error:', error);
    return NextResponse.json(
      { error: 'Failed to create certificate template' },
      { status: 500 }
    );
  }
}

// PATCH - Update certificate template
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
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

    if (!appUser || !['instructor', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify course ownership
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, appUser.id)
        )
      )
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get existing template
    const [existing] = await db
      .select()
      .from(certificateTemplates)
      .where(eq(certificateTemplates.courseId, courseId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Certificate template not found. Use POST to create.' },
        { status: 404 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = certificateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.subtitle !== undefined) updateData.subtitle = parsed.data.subtitle;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.signatureText !== undefined) updateData.signatureText = parsed.data.signatureText;
    if (parsed.data.signatureImage !== undefined) updateData.signatureImage = parsed.data.signatureImage;
    if (parsed.data.logoUrl !== undefined) updateData.logoUrl = parsed.data.logoUrl;
    if (parsed.data.backgroundUrl !== undefined) updateData.backgroundUrl = parsed.data.backgroundUrl;
    if (parsed.data.primaryColor !== undefined) updateData.primaryColor = parsed.data.primaryColor;
    if (parsed.data.secondaryColor !== undefined) updateData.secondaryColor = parsed.data.secondaryColor;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    
    if (parsed.data.settings) {
      // Merge with existing settings
      updateData.settings = {
        ...(existing.settings as object),
        ...parsed.data.settings,
      };
    }

    // Update template
    const [template] = await db
      .update(certificateTemplates)
      .set(updateData)
      .where(eq(certificateTemplates.id, existing.id))
      .returning();

    return NextResponse.json({
      success: true,
      template,
    });

  } catch (error: any) {
    console.error('Update certificate template error:', error);
    return NextResponse.json(
      { error: 'Failed to update certificate template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete certificate template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
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

    if (!appUser || !['instructor', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify course ownership
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.instructorId, appUser.id)
        )
      )
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Delete template (will cascade delete issued certificates)
    await db
      .delete(certificateTemplates)
      .where(eq(certificateTemplates.courseId, courseId));

    return NextResponse.json({
      success: true,
      message: 'Certificate template deleted',
    });

  } catch (error: any) {
    console.error('Delete certificate template error:', error);
    return NextResponse.json(
      { error: 'Failed to delete certificate template' },
      { status: 500 }
    );
  }
}