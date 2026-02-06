// ============================================
// FILE: app/api/admin/dashboard/route.ts
// ============================================

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  app_users,
  courses,
  enrollments,
  payments,
  lessons,
  lessonProgress,
  reviews,
  categories,
  issuedCertificates,
} from '@/db/schema';
import { eq, sql, desc, gte, and, count, sum, avg } from 'drizzle-orm';
import { db } from '@/db/drizzle';

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get app user and verify admin role
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser || appUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Calculate date ranges
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ========================================
    // OVERVIEW STATS
    // ========================================

    // Total users
    const [totalUsersResult] = await db
      .select({ count: count() })
      .from(app_users);
    const totalUsers = totalUsersResult?.count ?? 0;

    // New users this month
    const [newUsersThisMonthResult] = await db
      .select({ count: count() })
      .from(app_users)
      .where(gte(app_users.createdAt, startOfMonth));
    const newUsersThisMonth = newUsersThisMonthResult?.count ?? 0;

    // New users last month (for comparison)
    const [newUsersLastMonthResult] = await db
      .select({ count: count() })
      .from(app_users)
      .where(and(
        gte(app_users.createdAt, startOfLastMonth),
        sql`${app_users.createdAt} < ${startOfMonth}`
      ));
    const newUsersLastMonth = newUsersLastMonthResult?.count ?? 0;

    // Total courses
    const [totalCoursesResult] = await db
      .select({ count: count() })
      .from(courses);
    const totalCourses = totalCoursesResult?.count ?? 0;

    // Published courses
    const [publishedCoursesResult] = await db
      .select({ count: count() })
      .from(courses)
      .where(eq(courses.published, true));
    const publishedCourses = publishedCoursesResult?.count ?? 0;

    // Total enrollments
    const [totalEnrollmentsResult] = await db
      .select({ count: count() })
      .from(enrollments);
    const totalEnrollments = totalEnrollmentsResult?.count ?? 0;

    // New enrollments this month
    const [newEnrollmentsThisMonthResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(gte(enrollments.enrolledAt, startOfMonth));
    const newEnrollmentsThisMonth = newEnrollmentsThisMonthResult?.count ?? 0;

    // New enrollments last month
    const [newEnrollmentsLastMonthResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(and(
        gte(enrollments.enrolledAt, startOfLastMonth),
        sql`${enrollments.enrolledAt} < ${startOfMonth}`
      ));
    const newEnrollmentsLastMonth = newEnrollmentsLastMonthResult?.count ?? 0;

    // Total revenue
    const [totalRevenueResult] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.status, 'succeeded'));
    const totalRevenue = parseFloat(totalRevenueResult?.total ?? '0');

    // Revenue this month
    const [revenueThisMonthResult] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(and(
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, startOfMonth)
      ));
    const revenueThisMonth = parseFloat(revenueThisMonthResult?.total ?? '0');

    // Revenue last month
    const [revenueLastMonthResult] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(and(
        eq(payments.status, 'succeeded'),
        gte(payments.createdAt, startOfLastMonth),
        sql`${payments.createdAt} < ${startOfMonth}`
      ));
    const revenueLastMonth = parseFloat(revenueLastMonthResult?.total ?? '0');

    // Total certificates issued
    const [totalCertificatesResult] = await db
      .select({ count: count() })
      .from(issuedCertificates)
      .where(eq(issuedCertificates.isRevoked, false));
    const totalCertificates = totalCertificatesResult?.count ?? 0;

    // Active students (enrolled in at least one course)
    const [activeStudentsResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.appUserId})` })
      .from(enrollments)
      .where(eq(enrollments.status, 'active'));
    const activeStudents = activeStudentsResult?.count ?? 0;

    // Course completion rate
    const [completedEnrollmentsResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(eq(enrollments.status, 'completed'));
    const completedEnrollments = completedEnrollmentsResult?.count ?? 0;
    const completionRate = totalEnrollments > 0 
      ? Math.round((completedEnrollments / totalEnrollments) * 100) 
      : 0;

    // Average rating
    const [avgRatingResult] = await db
      .select({ avg: avg(reviews.rating) })
      .from(reviews)
      .where(eq(reviews.isPublished, true));
    const averageRating = parseFloat(avgRatingResult?.avg ?? '0').toFixed(1);

    // ========================================
    // CHARTS DATA
    // ========================================

    // User growth - last 12 months
    const userGrowthData = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', created_at)) as month_num,
        EXTRACT(YEAR FROM DATE_TRUNC('month', created_at)) as year,
        COUNT(*) as count
      FROM app_users
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);

    // Revenue trend - last 12 months
    const revenueTrendData = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', created_at)) as month_num,
        EXTRACT(YEAR FROM DATE_TRUNC('month', created_at)) as year,
        COALESCE(SUM(amount), 0) as revenue
      FROM payments
      WHERE status = 'succeeded' AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);

    // Enrollments trend - last 12 months
    const enrollmentsTrendData = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', enrolled_at), 'Mon') as month,
        EXTRACT(MONTH FROM DATE_TRUNC('month', enrolled_at)) as month_num,
        EXTRACT(YEAR FROM DATE_TRUNC('month', enrolled_at)) as year,
        COUNT(*) as count
      FROM enrollments
      WHERE enrolled_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', enrolled_at)
      ORDER BY DATE_TRUNC('month', enrolled_at) ASC
    `);

    // Enrollments by status
    const enrollmentsByStatus = await db
      .select({
        status: enrollments.status,
        count: count(),
      })
      .from(enrollments)
      .groupBy(enrollments.status);

    // Courses by category
    const coursesByCategory = await db
      .select({
        categoryId: courses.categoryId,
        categoryName: categories.name,
        count: count(),
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .groupBy(courses.categoryId, categories.name);

    // Courses by level
    const coursesByLevel = await db
      .select({
        level: courses.level,
        count: count(),
      })
      .from(courses)
      .groupBy(courses.level);

    // ========================================
    // TOP PERFORMERS
    // ========================================

    // Top 5 courses by enrollments
    const topCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        thumbnail: courses.thumbnail,
        enrollmentCount: courses.enrollmentCount,
        averageRating: courses.averageRating,
        revenue: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(courses)
      .leftJoin(payments, and(
        eq(payments.courseId, courses.id),
        eq(payments.status, 'succeeded')
      ))
      .where(eq(courses.published, true))
      .groupBy(courses.id)
      .orderBy(desc(courses.enrollmentCount))
      .limit(5);

    // Top 5 instructors by students
    const topInstructors = await db
      .select({
        id: app_users.id,
        name: app_users.name,
        avatar: app_users.avatar,
        courseCount: sql<number>`COUNT(DISTINCT ${courses.id})`,
        studentCount: sql<number>`COUNT(DISTINCT ${enrollments.appUserId})`,
        totalRevenue: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(app_users)
      .innerJoin(courses, eq(courses.instructorId, app_users.id))
      .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
      .leftJoin(payments, and(
        eq(payments.courseId, courses.id),
        eq(payments.status, 'succeeded')
      ))
      .where(eq(app_users.role, 'instructor'))
      .groupBy(app_users.id)
      .orderBy(desc(sql`COUNT(DISTINCT ${enrollments.appUserId})`))
      .limit(5);

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
      .innerJoin(app_users, eq(enrollments.appUserId, app_users.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(10);

    // Recent payments
    const recentPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        status: payments.status,
        createdAt: payments.createdAt,
        userName: app_users.name,
        courseTitle: courses.title,
      })
      .from(payments)
      .innerJoin(app_users, eq(payments.appUserId, app_users.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .orderBy(desc(payments.createdAt))
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
      .innerJoin(app_users, eq(reviews.appUserId, app_users.id))
      .innerJoin(courses, eq(reviews.courseId, courses.id))
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    // ========================================
    // DAILY STATS (Last 7 days)
    // ========================================

    const dailyStats = await db.execute(sql`
      SELECT 
        TO_CHAR(d.date, 'Dy') as day,
        d.date,
        COALESCE(u.new_users, 0) as new_users,
        COALESCE(e.new_enrollments, 0) as new_enrollments,
        COALESCE(p.revenue, 0) as revenue
      FROM (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date as date
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) as date, COUNT(*) as new_users
        FROM app_users
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(created_at)
      ) u ON d.date = u.date
      LEFT JOIN (
        SELECT DATE(enrolled_at) as date, COUNT(*) as new_enrollments
        FROM enrollments
        WHERE enrolled_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(enrolled_at)
      ) e ON d.date = e.date
      LEFT JOIN (
        SELECT DATE(created_at) as date, SUM(amount) as revenue
        FROM payments
        WHERE status = 'succeeded' AND created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(created_at)
      ) p ON d.date = p.date
      ORDER BY d.date ASC
    `);

    // ========================================
    // RESPONSE
    // ========================================

    return NextResponse.json({
      overview: {
        totalUsers,
        newUsersThisMonth,
        userGrowthPercent: newUsersLastMonth > 0 
          ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
          : newUsersThisMonth > 0 ? 100 : 0,
        
        totalCourses,
        publishedCourses,
        draftCourses: totalCourses - publishedCourses,
        
        totalEnrollments,
        newEnrollmentsThisMonth,
        enrollmentGrowthPercent: newEnrollmentsLastMonth > 0
          ? Math.round(((newEnrollmentsThisMonth - newEnrollmentsLastMonth) / newEnrollmentsLastMonth) * 100)
          : newEnrollmentsThisMonth > 0 ? 100 : 0,
        
        totalRevenue,
        revenueThisMonth,
        revenueGrowthPercent: revenueLastMonth > 0
          ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
          : revenueThisMonth > 0 ? 100 : 0,
        
        totalCertificates,
        activeStudents,
        completionRate,
        averageRating,
      },
      charts: {
        userGrowth: userGrowthData.rows,
        revenueTrend: revenueTrendData.rows,
        enrollmentsTrend: enrollmentsTrendData.rows,
        enrollmentsByStatus: enrollmentsByStatus.map(e => ({
          status: e.status,
          count: e.count,
        })),
        coursesByCategory: coursesByCategory.map(c => ({
          category: c.categoryName || 'Uncategorized',
          count: c.count,
        })),
        coursesByLevel: coursesByLevel.map(c => ({
          level: c.level,
          count: c.count,
        })),
        dailyStats: dailyStats.rows,
      },
      topPerformers: {
        courses: topCourses,
        instructors: topInstructors,
      },
      recentActivity: {
        enrollments: recentEnrollments,
        payments: recentPayments,
        reviews: recentReviews,
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}