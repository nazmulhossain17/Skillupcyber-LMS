// ============================================
// FILE: app/api/instructor/dashboard/route.ts
// Instructor Dashboard Overview API
// ============================================

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  app_users,
  courses,
  enrollments,
  payments,
  reviews,
  lessons,
  lessonProgress,
  issuedCertificates,
  assignmentSubmissions,
  assignments,
  discussions,
  discussionReplies,
} from '@/db/schema';
import { eq, sql, and, gte, desc, count, avg, sum } from 'drizzle-orm';
import { db } from '@/db/drizzle';

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get app_user and verify instructor role
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!['instructor', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Access denied. Instructor role required.' }, { status: 403 });
    }

    const instructorId = appUser.id;

    // Date calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last12Months = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    // ========================================
    // OVERVIEW STATS
    // ========================================

    // Total courses by this instructor
    const [courseStats] = await db
      .select({
        totalCourses: count(),
        publishedCourses: sql<number>`count(*) filter (where ${courses.published} = true)`,
        draftCourses: sql<number>`count(*) filter (where ${courses.published} = false)`,
        totalEnrollments: sql<number>`coalesce(sum(${courses.enrollmentCount}), 0)`,
      })
      .from(courses)
      .where(eq(courses.instructorId, instructorId));

    // Total students (unique enrollees in instructor's courses)
    const [studentStats] = await db
      .select({
        totalStudents: sql<number>`count(distinct ${enrollments.appUserId})`,
        activeStudents: sql<number>`count(distinct ${enrollments.appUserId}) filter (where ${enrollments.status} = 'active')`,
        completedStudents: sql<number>`count(distinct ${enrollments.appUserId}) filter (where ${enrollments.status} = 'completed')`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId));

    // Revenue calculations
    const [revenueStats] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)), 0)`,
        revenueThisMonth: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)) filter (where ${payments.createdAt} >= ${startOfMonth}), 0)`,
        revenueLastMonth: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)) filter (where ${payments.createdAt} >= ${startOfLastMonth} and ${payments.createdAt} < ${startOfMonth}), 0)`,
      })
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        eq(payments.status, 'succeeded')
      ));

    // Enrollments this month vs last month
    const [enrollmentGrowth] = await db
      .select({
        thisMonth: sql<number>`count(*) filter (where ${enrollments.enrolledAt} >= ${startOfMonth})`,
        lastMonth: sql<number>`count(*) filter (where ${enrollments.enrolledAt} >= ${startOfLastMonth} and ${enrollments.enrolledAt} < ${startOfMonth})`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId));

    // Reviews and ratings
    const [reviewStats] = await db
      .select({
        totalReviews: count(),
        averageRating: avg(reviews.rating),
        fiveStarCount: sql<number>`count(*) filter (where ${reviews.rating} = 5)`,
        recentReviews: sql<number>`count(*) filter (where ${reviews.createdAt} >= ${last7Days})`,
      })
      .from(reviews)
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId));

    // Certificates issued
    const [certStats] = await db
      .select({
        totalCertificates: count(),
        certificatesThisMonth: sql<number>`count(*) filter (where ${issuedCertificates.issuedAt} >= ${startOfMonth})`,
      })
      .from(issuedCertificates)
      .innerJoin(courses, eq(issuedCertificates.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId));

    // Pending assignments to grade
    const [assignmentStats] = await db
      .select({
        pendingGrading: count(),
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        eq(assignmentSubmissions.status, 'submitted')
      ));

    // Unanswered discussions
    const [discussionStats] = await db
      .select({
        unansweredCount: count(),
      })
      .from(discussions)
      .innerJoin(courses, eq(discussions.courseId, courses.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        eq(discussions.isResolved, false)
      ));

    // Calculate growth percentages
    const revenueGrowthPercent = Number(revenueStats.revenueLastMonth) > 0
      ? Math.round(((Number(revenueStats.revenueThisMonth) - Number(revenueStats.revenueLastMonth)) / Number(revenueStats.revenueLastMonth)) * 100)
      : Number(revenueStats.revenueThisMonth) > 0 ? 100 : 0;

    const enrollmentGrowthPercent = Number(enrollmentGrowth.lastMonth) > 0
      ? Math.round(((Number(enrollmentGrowth.thisMonth) - Number(enrollmentGrowth.lastMonth)) / Number(enrollmentGrowth.lastMonth)) * 100)
      : Number(enrollmentGrowth.thisMonth) > 0 ? 100 : 0;

    // ========================================
    // CHARTS DATA
    // ========================================

    // Monthly revenue trend (last 12 months)
    const revenueTrend = await db
      .select({
        month: sql<string>`to_char(${payments.createdAt}, 'Mon')`,
        revenue: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)), 0)`,
      })
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, last12Months)
      ))
      .groupBy(sql`to_char(${payments.createdAt}, 'Mon'), date_trunc('month', ${payments.createdAt})`)
      .orderBy(sql`date_trunc('month', ${payments.createdAt})`);

    // Monthly enrollments trend (last 12 months)
    const enrollmentsTrend = await db
      .select({
        month: sql<string>`to_char(${enrollments.enrolledAt}, 'Mon')`,
        count: sql<number>`count(*)`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        gte(enrollments.enrolledAt, last12Months)
      ))
      .groupBy(sql`to_char(${enrollments.enrolledAt}, 'Mon'), date_trunc('month', ${enrollments.enrolledAt})`)
      .orderBy(sql`date_trunc('month', ${enrollments.enrolledAt})`);

    // Daily stats (last 7 days)
    const dailyStats = await db
      .select({
        day: sql<string>`to_char(${enrollments.enrolledAt}, 'Dy')`,
        enrollments: sql<number>`count(*)`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        gte(enrollments.enrolledAt, last7Days)
      ))
      .groupBy(sql`to_char(${enrollments.enrolledAt}, 'Dy'), date_trunc('day', ${enrollments.enrolledAt})`)
      .orderBy(sql`date_trunc('day', ${enrollments.enrolledAt})`);

    // Enrollments by status
    const enrollmentsByStatus = await db
      .select({
        status: enrollments.status,
        count: sql<number>`count(*)`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId))
      .groupBy(enrollments.status);

    // Courses by level
    const coursesByLevel = await db
      .select({
        level: courses.level,
        count: sql<number>`count(*)`,
      })
      .from(courses)
      .where(eq(courses.instructorId, instructorId))
      .groupBy(courses.level);

    // Rating distribution
    const ratingDistribution = await db
      .select({
        rating: reviews.rating,
        count: sql<number>`count(*)`,
      })
      .from(reviews)
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .where(eq(courses.instructorId, instructorId))
      .groupBy(reviews.rating)
      .orderBy(reviews.rating);

    // ========================================
    // TOP PERFORMING COURSES
    // ========================================

    const topCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        thumbnail: courses.thumbnail,
        enrollmentCount: courses.enrollmentCount,
        averageRating: courses.averageRating,
        reviewCount: courses.reviewCount,
        published: courses.published,
        price: courses.price,
      })
      .from(courses)
      .where(eq(courses.instructorId, instructorId))
      .orderBy(desc(courses.enrollmentCount))
      .limit(5);

    // Get revenue per course
    const courseRevenueData = await db
      .select({
        courseId: payments.courseId,
        revenue: sql<number>`coalesce(sum(cast(${payments.amount} as decimal)), 0)`,
      })
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        eq(payments.status, 'succeeded')
      ))
      .groupBy(payments.courseId);

    const courseRevenueMap = new Map(courseRevenueData.map(c => [c.courseId, Number(c.revenue)]));

    const topCoursesWithRevenue = topCourses.map(course => ({
      ...course,
      revenue: courseRevenueMap.get(course.id) || 0,
    }));

    // ========================================
    // RECENT ACTIVITY
    // ========================================

    // Recent enrollments
    const recentEnrollments = await db
      .select({
        id: enrollments.id,
        enrolledAt: enrollments.enrolledAt,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        courseTitle: courses.title,
        courseSlug: courses.slug,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(app_users, eq(enrollments.appUserId, app_users.id))
      .where(eq(courses.instructorId, instructorId))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(10);

    // Recent reviews
    const recentReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        courseTitle: courses.title,
      })
      .from(reviews)
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .innerJoin(app_users, eq(reviews.appUserId, app_users.id))
      .where(eq(courses.instructorId, instructorId))
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    // Recent discussions (unanswered)
    const recentDiscussions = await db
      .select({
        id: discussions.id,
        title: discussions.title,
        createdAt: discussions.createdAt,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        isResolved: discussions.isResolved,
      })
      .from(discussions)
      .innerJoin(courses, eq(discussions.courseId, courses.id))
      .innerJoin(app_users, eq(discussions.appUserId, app_users.id))
      .where(eq(courses.instructorId, instructorId))
      .orderBy(desc(discussions.createdAt))
      .limit(10);

    // Pending submissions
    const pendingSubmissions = await db
      .select({
        id: assignmentSubmissions.id,
        submittedAt: assignmentSubmissions.submittedAt,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        assignmentTitle: assignments.title,
        courseTitle: courses.title,
        courseSlug: courses.slug,
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .innerJoin(app_users, eq(assignmentSubmissions.appUserId, app_users.id))
      .where(and(
        eq(courses.instructorId, instructorId),
        eq(assignmentSubmissions.status, 'submitted')
      ))
      .orderBy(desc(assignmentSubmissions.submittedAt))
      .limit(10);

    // ========================================
    // RESPONSE
    // ========================================

    return NextResponse.json({
      overview: {
        totalCourses: Number(courseStats.totalCourses) || 0,
        publishedCourses: Number(courseStats.publishedCourses) || 0,
        draftCourses: Number(courseStats.draftCourses) || 0,
        totalEnrollments: Number(courseStats.totalEnrollments) || 0,
        totalStudents: Number(studentStats.totalStudents) || 0,
        activeStudents: Number(studentStats.activeStudents) || 0,
        completedStudents: Number(studentStats.completedStudents) || 0,
        totalRevenue: Number(revenueStats.totalRevenue) || 0,
        revenueThisMonth: Number(revenueStats.revenueThisMonth) || 0,
        revenueGrowthPercent,
        enrollmentsThisMonth: Number(enrollmentGrowth.thisMonth) || 0,
        enrollmentGrowthPercent,
        totalReviews: Number(reviewStats.totalReviews) || 0,
        averageRating: reviewStats.averageRating ? Number(reviewStats.averageRating).toFixed(1) : '0.0',
        fiveStarReviews: Number(reviewStats.fiveStarCount) || 0,
        recentReviewsCount: Number(reviewStats.recentReviews) || 0,
        totalCertificates: Number(certStats.totalCertificates) || 0,
        certificatesThisMonth: Number(certStats.certificatesThisMonth) || 0,
        pendingGrading: Number(assignmentStats.pendingGrading) || 0,
        unansweredDiscussions: Number(discussionStats.unansweredCount) || 0,
      },
      charts: {
        revenueTrend: revenueTrend.map(r => ({ month: r.month, revenue: Number(r.revenue) })),
        enrollmentsTrend: enrollmentsTrend.map(e => ({ month: e.month, count: Number(e.count) })),
        dailyStats: dailyStats.map(d => ({ day: d.day, enrollments: Number(d.enrollments) })),
        enrollmentsByStatus: enrollmentsByStatus.map(e => ({ status: e.status, count: Number(e.count) })),
        coursesByLevel: coursesByLevel.map(c => ({ level: c.level, count: Number(c.count) })),
        ratingDistribution: ratingDistribution.map(r => ({ rating: r.rating, count: Number(r.count) })),
      },
      topCourses: topCoursesWithRevenue,
      recentActivity: {
        enrollments: recentEnrollments,
        reviews: recentReviews,
        discussions: recentDiscussions,
        pendingSubmissions: pendingSubmissions,
      },
    });

  } catch (error) {
    console.error('Instructor dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}