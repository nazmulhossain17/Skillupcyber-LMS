// ============================================
// FILE: app/(instructor)/instructor/page.tsx
// Instructor Dashboard Overview Page
// ============================================

'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  BookOpen,
  GraduationCap,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Award,
  Star,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  FileCheck,
  Eye,
  Edit,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getSecureUrl } from '@/lib/media-url';
import Link from 'next/link';

// Types
interface DashboardData {
  overview: {
    totalCourses: number;
    publishedCourses: number;
    draftCourses: number;
    totalEnrollments: number;
    totalStudents: number;
    activeStudents: number;
    completedStudents: number;
    totalRevenue: number;
    revenueThisMonth: number;
    revenueGrowthPercent: number;
    enrollmentsThisMonth: number;
    enrollmentGrowthPercent: number;
    totalReviews: number;
    averageRating: string;
    fiveStarReviews: number;
    recentReviewsCount: number;
    totalCertificates: number;
    certificatesThisMonth: number;
    pendingGrading: number;
    unansweredDiscussions: number;
  };
  charts: {
    revenueTrend: Array<{ month: string; revenue: number }>;
    enrollmentsTrend: Array<{ month: string; count: number }>;
    dailyStats: Array<{ day: string; enrollments: number }>;
    enrollmentsByStatus: Array<{ status: string; count: number }>;
    coursesByLevel: Array<{ level: string; count: number }>;
    ratingDistribution: Array<{ rating: number; count: number }>;
  };
  topCourses: Array<{
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
    enrollmentCount: number;
    averageRating: string | null;
    reviewCount: number;
    published: boolean;
    price: string;
    revenue: number;
  }>;
  recentActivity: {
    enrollments: Array<{
      id: string;
      enrolledAt: string;
      userName: string | null;
      userAvatar: string | null;
      courseTitle: string;
      courseSlug: string;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: string;
      userName: string | null;
      userAvatar: string | null;
      courseTitle: string;
    }>;
    discussions: Array<{
      id: string;
      title: string;
      createdAt: string;
      userName: string | null;
      userAvatar: string | null;
      courseTitle: string;
      courseSlug: string;
      isResolved: boolean;
    }>;
    pendingSubmissions: Array<{
      id: string;
      submittedAt: string;
      userName: string | null;
      userAvatar: string | null;
      assignmentTitle: string;
      courseTitle: string;
      courseSlug: string;
    }>;
  };
}

// Chart colors
const COLORS = {
  primary: '#5750f1',
  secondary: '#3c50e0',
  success: '#22ad5c',
  warning: '#f59e0b',
  danger: '#f23030',
  info: '#3c50e0',
  muted: '#9ca3af',
  orange: '#f59460',
};

const PIE_COLORS = ['#5750f1', '#3c50e0', '#22ad5c', '#f59e0b', '#f59460'];

const STATUS_COLORS: Record<string, string> = {
  active: '#22ad5c',
  completed: '#3c50e0',
  cancelled: '#f23030',
  expired: '#9ca3af',
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: '#22ad5c',
  intermediate: '#3c50e0',
  advanced: '#f59e0b',
  expert: '#f23030',
};

// Stat Card Component
function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor,
  trend,
  href,
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: 'up' | 'down' | 'neutral';
  href?: string;
}) {
  const content = (
    <Card className={cn("relative overflow-hidden transition-shadow", href && "hover:shadow-lg cursor-pointer")}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 sm:space-y-2">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                {trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-green" />
                ) : trend === 'down' ? (
                  <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-red" />
                ) : null}
                <span
                  className={cn(
                    'text-xs sm:text-sm font-medium',
                    trend === 'up' && 'text-green',
                    trend === 'down' && 'text-red',
                    trend === 'neutral' && 'text-dark-6'
                  )}
                >
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{changeLabel}</span>
              </div>
            )}
          </div>
          <div className={cn('rounded-lg sm:rounded-xl p-2 sm:p-3', iconColor)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Mini Stat Card
function MiniStatCard({
  title,
  value,
  icon: Icon,
  color,
  alert,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-muted/50 relative",
      alert && "ring-2 ring-red/50"
    )}>
      {alert && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red"></span>
        </span>
      )}
      <div className={cn('p-1.5 sm:p-2 rounded-lg', color)}>
        <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-base sm:text-xl font-bold truncate">{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{title}</p>
      </div>
    </div>
  );
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-2 sm:p-3 text-xs sm:text-sm">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' && entry.name?.toLowerCase().includes('revenue')
              ? `$${entry.value.toLocaleString()}`
              : entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// Helper functions
const getAvatarUrl = (url: string | null | undefined): string => {
  const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  if (!url) return DEFAULT_AVATAR;
  if (url.includes('flaticon.com') || url.includes('placeholder')) return url;
  if (url.includes('s3.') || url.includes('amazonaws.com')) return getSecureUrl(url);
  return url;
};

const getThumbnailUrl = (url: string | null | undefined): string => {
  const DEFAULT_THUMB = '/images/placeholder-course.jpg';
  if (!url) return DEFAULT_THUMB;
  if (url.includes('s3.') || url.includes('amazonaws.com')) return getSecureUrl(url);
  return url;
};

export default function InstructorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/instructor/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Failed to load dashboard</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchDashboard} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Instructor Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
            Overview of your courses and student engagement
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/instructor/courses/create">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <BookOpen className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">New Course</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(data.overview.totalRevenue)}
          change={data.overview.revenueGrowthPercent}
          changeLabel="vs last month"
          icon={DollarSign}
          iconColor="bg-green"
          trend={data.overview.revenueGrowthPercent >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Total Students"
          value={data.overview.totalStudents.toLocaleString()}
          icon={Users}
          iconColor="bg-blue"
          href="/instructor/students"
        />
        <StatCard
          title="Total Enrollments"
          value={data.overview.totalEnrollments.toLocaleString()}
          change={data.overview.enrollmentGrowthPercent}
          changeLabel="vs last month"
          icon={GraduationCap}
          iconColor="bg-primary"
          trend={data.overview.enrollmentGrowthPercent >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Published Courses"
          value={`${data.overview.publishedCourses} / ${data.overview.totalCourses}`}
          icon={BookOpen}
          iconColor="bg-yellow-dark"
          href="/instructor/courses"
        />
      </div>

      {/* Secondary Stats - Action Items */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <MiniStatCard
          title="Pending Grading"
          value={data.overview.pendingGrading}
          icon={FileCheck}
          color="bg-orange-light"
          alert={data.overview.pendingGrading > 0}
        />
        <MiniStatCard
          title="Unanswered Q&A"
          value={data.overview.unansweredDiscussions}
          icon={MessageSquare}
          color="bg-yellow-dark"
          alert={data.overview.unansweredDiscussions > 0}
        />
        <MiniStatCard
          title="Avg Rating"
          value={`${data.overview.averageRating} ⭐`}
          icon={Star}
          color="bg-primary"
        />
        <MiniStatCard
          title="Certificates"
          value={data.overview.totalCertificates}
          icon={Award}
          color="bg-green"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green" />
              Revenue Trend
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Monthly earnings over time</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.revenueTrend}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={COLORS.success}
                    fill="url(#revenueGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Enrollments Trend */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Enrollment Trend
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">New students over time</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.enrollmentsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Enrollments"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Daily Activity */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Last 7 Days
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Daily enrollments</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[180px] sm:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" width={25} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="enrollments" name="Enrollments" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Enrollment Status */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Student Status
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">By enrollment status</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[180px] sm:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.enrollmentsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {data.charts.enrollmentsByStatus.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.status] || PIE_COLORS[index % PIE_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend 
                    formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-dark" />
              Rating Distribution
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">{data.overview.totalReviews} total reviews</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[180px] sm:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.ratingDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis 
                    type="category" 
                    dataKey="rating" 
                    tick={{ fontSize: 10 }}
                    width={30}
                    tickFormatter={(value) => `${value}★`}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Reviews" fill={COLORS.warning} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Courses & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Courses */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Award className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-dark" />
                  Your Courses
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Performance overview</CardDescription>
              </div>
              <Link href="/instructor/courses">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] sm:h-[320px] pr-2 sm:pr-4">
              <div className="space-y-3 sm:space-y-4">
                {data.topCourses.map((course, index) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-9 sm:w-16 sm:h-12 rounded overflow-hidden bg-gray-200">
                        <img
                          src={getThumbnailUrl(course.thumbnail)}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Badge
                        className={cn(
                          "absolute -top-1 -left-1 text-[10px] px-1 py-0",
                          course.published ? "bg-green" : "bg-yellow-dark"
                        )}
                      >
                        {index + 1}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{course.title}</p>
                      <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-0.5 sm:gap-1">
                          <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          {course.enrollmentCount}
                        </span>
                        {course.averageRating && Number(course.averageRating) > 0 && (
                          <span className="flex items-center gap-0.5 sm:gap-1">
                            <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-dark" />
                            {Number(course.averageRating).toFixed(1)}
                          </span>
                        )}
                        <span className="text-green font-medium">
                          {formatCurrency(course.revenue)}
                        </span>
                      </div>
                    </div>
                    <Link href={`/instructor/courses/${course.slug}/edit`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
                {data.topCourses.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No courses yet</p>
                    <Link href="/instructor/courses/create">
                      <Button size="sm" className="mt-2">Create Course</Button>
                    </Link>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Latest updates from your courses</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-6 sm:pb-4">
            <Tabs defaultValue="enrollments" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-2 sm:mb-4 mx-2 sm:mx-0" style={{ width: 'calc(100% - 16px)' }}>
                <TabsTrigger value="enrollments" className="text-[10px] sm:text-xs px-1 sm:px-2">
                  <span className="hidden sm:inline">Enrollments</span>
                  <span className="sm:hidden">Enroll</span>
                </TabsTrigger>
                <TabsTrigger value="reviews" className="text-[10px] sm:text-xs px-1 sm:px-2">Reviews</TabsTrigger>
                <TabsTrigger value="discussions" className="text-[10px] sm:text-xs px-1 sm:px-2 relative">
                  <span className="hidden sm:inline">Q&A</span>
                  <span className="sm:hidden">Q&A</span>
                  {data.overview.unansweredDiscussions > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-2 w-2 bg-red rounded-full" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="submissions" className="text-[10px] sm:text-xs px-1 sm:px-2 relative">
                  <span className="hidden sm:inline">Grading</span>
                  <span className="sm:hidden">Grade</span>
                  {data.overview.pendingGrading > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-2 w-2 bg-red rounded-full" />
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="enrollments" className="px-2 sm:px-0">
                <ScrollArea className="h-[220px] sm:h-[260px]">
                  <div className="space-y-2 sm:space-y-3">
                    {data.recentActivity.enrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-7 w-7 sm:h-9 sm:w-9 shrink-0">
                          <AvatarImage src={getAvatarUrl(enrollment.userAvatar)} />
                          <AvatarFallback className="text-[10px] sm:text-xs">{getInitials(enrollment.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm truncate">
                            <span className="font-medium">{enrollment.userName || 'Student'}</span>
                            {' enrolled'}
                          </p>
                          <p className="text-[10px] sm:text-xs text-primary truncate">{enrollment.courseTitle}</p>
                        </div>
                        <span className="text-[9px] sm:text-xs text-muted-foreground shrink-0">
                          {formatDate(enrollment.enrolledAt)}
                        </span>
                      </div>
                    ))}
                    {data.recentActivity.enrollments.length === 0 && (
                      <p className="text-center text-muted-foreground py-8 text-sm">No recent enrollments</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="reviews" className="px-2 sm:px-0">
                <ScrollArea className="h-[220px] sm:h-[260px]">
                  <div className="space-y-2 sm:space-y-3">
                    {data.recentActivity.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-7 w-7 sm:h-9 sm:w-9 shrink-0">
                          <AvatarImage src={getAvatarUrl(review.userAvatar)} />
                          <AvatarFallback className="text-[10px] sm:text-xs">{getInitials(review.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <span className="font-medium text-xs sm:text-sm">{review.userName || 'Student'}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    'h-2.5 w-2.5 sm:h-3 sm:w-3',
                                    i < review.rating ? 'text-yellow-dark fill-yellow-dark' : 'text-gray-300'
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-[10px] sm:text-xs text-primary truncate">{review.courseTitle}</p>
                          {review.comment && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {data.recentActivity.reviews.length === 0 && (
                      <p className="text-center text-muted-foreground py-8 text-sm">No recent reviews</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="discussions" className="px-2 sm:px-0">
                <ScrollArea className="h-[220px] sm:h-[260px]">
                  <div className="space-y-2 sm:space-y-3">
                    {data.recentActivity.discussions.map((discussion) => (
                      <div
                        key={discussion.id}
                        className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-7 w-7 sm:h-9 sm:w-9 shrink-0">
                          <AvatarImage src={getAvatarUrl(discussion.userAvatar)} />
                          <AvatarFallback className="text-[10px] sm:text-xs">{getInitials(discussion.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">{discussion.title}</p>
                          <p className="text-[10px] sm:text-xs text-primary truncate">{discussion.courseTitle}</p>
                          <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5">
                            by {discussion.userName} • {formatDate(discussion.createdAt)}
                          </p>
                        </div>
                        <Badge 
                          variant={discussion.isResolved ? "secondary" : "destructive"} 
                          className="text-[9px] sm:text-xs shrink-0"
                        >
                          {discussion.isResolved ? 'Resolved' : 'Open'}
                        </Badge>
                      </div>
                    ))}
                    {data.recentActivity.discussions.length === 0 && (
                      <p className="text-center text-muted-foreground py-8 text-sm">No discussions yet</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="submissions" className="px-2 sm:px-0">
                <ScrollArea className="h-[220px] sm:h-[260px]">
                  <div className="space-y-2 sm:space-y-3">
                    {data.recentActivity.pendingSubmissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-7 w-7 sm:h-9 sm:w-9 shrink-0">
                          <AvatarImage src={getAvatarUrl(submission.userAvatar)} />
                          <AvatarFallback className="text-[10px] sm:text-xs">{getInitials(submission.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm truncate">
                            <span className="font-medium">{submission.userName}</span>
                            {' submitted'}
                          </p>
                          <p className="text-[10px] sm:text-xs text-primary truncate">{submission.assignmentTitle}</p>
                          <p className="text-[9px] sm:text-xs text-muted-foreground">{submission.courseTitle}</p>
                        </div>
                        <Link href={`/instructor/courses/${submission.courseSlug}/assignments`}>
                          <Button size="sm" variant="outline" className="h-6 sm:h-7 text-[10px] sm:text-xs px-2">
                            Grade
                          </Button>
                        </Link>
                      </div>
                    ))}
                    {data.recentActivity.pendingSubmissions.length === 0 && (
                      <p className="text-center text-muted-foreground py-8 text-sm">No pending submissions</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}