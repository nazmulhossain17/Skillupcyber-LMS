// types/analytics.ts

export interface AnalyticsOverview {
  overview: {
    totalCourses: number;
    totalStudents: number;
    totalRevenue: number;
    averageRating: string;
    enrollmentGrowth: {
      count: number;
      rate: string;
    };
  };
  revenue: {
    total: number;
    last30Days: number;
    last7Days: number;
  };
  topCourses: Array<{
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    enrollments: number;
    revenue: number;
    rating: number;
    reviews: number;
  }>;
  recentReviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date | null;
    course: string;
    student: {
      name: string | null;
      avatar: string | null;
    };
  }>;
}

export interface CourseAnalytics {
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    published: boolean;
  };
  enrollments: {
    total: number;
    active: number;
    completed: number;
    averageProgress: string;
  };
  revenue: {
    total: number;
    last30Days: number;
    transactionCount: number;
    averagePerStudent: string;
  };
  progress: {
    totalLessons: number;
    completedLessons: number;
    completionRate: string;
    avgWatchTimeMinutes: string;
  };
  lessons: Array<{
    id: string;
    title: string;
    order: number;
    views: number;
    completions: number;
    completionRate: string;
    avgWatchTimeMinutes: string;
    durationMinutes: number;
  }>;
  reviews: {
    total: number;
    average: string;
    distribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  topStudents: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
    progress: number;
    enrolledAt: Date | null;
    lastAccessed: Date | null;
  }>;
  enrollmentTrend: Array<{
    date: string;
    enrollments: number;
  }>;
}

export interface StudentsList {
  students: Array<{
    enrollmentId: string;
    id: string;
    name: string | null;
    email: string | null;
    avatar: string | null;
    progress: number;
    status: 'active' | 'completed' | 'cancelled' | 'expired';
    enrolledAt: Date | null;
    lastAccessedAt: Date | null;
    completedAt: Date | null;
    lessonsCompleted: number;
    totalLessons: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface AssignmentsAnalytics {
  overview: {
    totalAssignments: number;
    totalSubmissions: number;
    pendingReview: number;
    graded: number;
    averageScore: string;
    submissionRate: string;
  };
  assignments: Array<{
    id: string;
    title: string;
    maxScore: number;
    dueDate: Date | null;
    submissions: {
      total: number;
      pending: number;
      graded: number;
    };
    averageScore: string;
    completionRate: string;
  }>;
  pendingSubmissions: Array<{
    id: string;
    assignment: string;
    student: {
      name: string | null;
      avatar: string | null;
    };
    submittedAt: Date | null;
    status: string;
  }>;
}