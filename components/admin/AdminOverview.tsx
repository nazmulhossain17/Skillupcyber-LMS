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

// Types
interface DashboardData {
  overview: {
    totalUsers: number;
    newUsersThisMonth: number;
    userGrowthPercent: number;
    totalCourses: number;
    publishedCourses: number;
    draftCourses: number;
    totalEnrollments: number;
    newEnrollmentsThisMonth: number;
    enrollmentGrowthPercent: number;
    totalRevenue: number;
    revenueThisMonth: number;
    revenueGrowthPercent: number;
    totalCertificates: number;
    activeStudents: number;
    completionRate: number;
    averageRating: string;
  };
  charts: {
    userGrowth: Array<{ month: string; count: number }>;
    revenueTrend: Array<{ month: string; revenue: number }>;
    enrollmentsTrend: Array<{ month: string; count: number }>;
    enrollmentsByStatus: Array<{ status: string; count: number }>;
    coursesByCategory: Array<{ category: string; count: number }>;
    coursesByLevel: Array<{ level: string; count: number }>;
    dailyStats: Array<{ day: string; new_users: number; new_enrollments: number; revenue: number }>;
  };
  topPerformers: {
    courses: Array<{
      id: string;
      title: string;
      slug: string;
      thumbnail: string | null;
      enrollmentCount: number;
      averageRating: string | null;
      revenue: number;
    }>;
    instructors: Array<{
      id: string;
      name: string | null;
      avatar: string | null;
      courseCount: number;
      studentCount: number;
      totalRevenue: number;
    }>;
  };
  recentActivity: {
    enrollments: Array<{
      id: string;
      enrolledAt: string;
      userName: string | null;
      userAvatar: string | null;
      courseTitle: string;
      courseSlug: string;
    }>;
    payments: Array<{
      id: string;
      amount: string;
      status: string;
      createdAt: string;
      userName: string | null;
      courseTitle: string | null;
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
  };
}

// Chart colors - using CSS variable values from globals.css
const COLORS = {
  primary: '#5750f1',      // --color-primary
  secondary: '#3c50e0',    // --color-blue
  success: '#22ad5c',      // --color-green
  warning: '#f59e0b',      // --color-yellow-dark
  danger: '#f23030',       // --color-red
  info: '#3c50e0',         // --color-blue
  muted: '#9ca3af',        // --color-dark-6
  orange: '#f59460',       // --color-orange-light
  greenLight: '#2cd673',   // --color-green-light
  blueDark: '#1c3fb7',     // --color-blue-dark
};

const PIE_COLORS = [
  '#5750f1',  // --color-primary
  '#3c50e0',  // --color-blue
  '#22ad5c',  // --color-green
  '#f59e0b',  // --color-yellow-dark
  '#f59460',  // --color-orange-light
];

const STATUS_COLORS: Record<string, string> = {
  active: '#22ad5c',    // --color-green
  completed: '#3c50e0', // --color-blue
  cancelled: '#f23030', // --color-red
  expired: '#9ca3af',   // --color-dark-6
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
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1.5">
                {trend === 'up' ? (
                  <ArrowUpRight className="h-4 w-4 text-green" />
                ) : trend === 'down' ? (
                  <ArrowDownRight className="h-4 w-4 text-red" />
                ) : null}
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend === 'up' && 'text-green',
                    trend === 'down' && 'text-red',
                    trend === 'neutral' && 'text-dark-6'
                  )}
                >
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="text-xs text-muted-foreground">{changeLabel}</span>
              </div>
            )}
          </div>
          <div
            className={cn(
              'rounded-xl p-3',
              iconColor
            )}
          >
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mini Stat Card for secondary metrics
function MiniStatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
      <div className={cn('p-2 rounded-lg', color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}

// Custom Tooltip for charts
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
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

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/dashboard');
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
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here&apos;s what&apos;s happening with your platform.
          </p>
        </div>
        <Button onClick={fetchDashboard} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Users"
          value={data.overview.totalUsers.toLocaleString()}
          change={data.overview.userGrowthPercent}
          changeLabel="vs last month"
          icon={Users}
          iconColor="bg-blue"
          trend={data.overview.userGrowthPercent >= 0 ? 'up' : 'down'}
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
          title="Total Revenue"
          value={formatCurrency(data.overview.totalRevenue)}
          change={data.overview.revenueGrowthPercent}
          changeLabel="vs last month"
          icon={DollarSign}
          iconColor="bg-green"
          trend={data.overview.revenueGrowthPercent >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Published Courses"
          value={data.overview.publishedCourses.toLocaleString()}
          icon={BookOpen}
          iconColor="bg-yellow-dark"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <MiniStatCard
          title="Active Students"
          value={data.overview.activeStudents.toLocaleString()}
          icon={Activity}
          color="bg-primary"
        />
        <MiniStatCard
          title="Certificates Issued"
          value={data.overview.totalCertificates.toLocaleString()}
          icon={Award}
          color="bg-yellow-dark"
        />
        <MiniStatCard
          title="Completion Rate"
          value={`${data.overview.completionRate}%`}
          icon={TrendingUp}
          color="bg-green"
        />
        <MiniStatCard
          title="Avg Rating"
          value={data.overview.averageRating}
          icon={Star}
          color="bg-red"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Monthly revenue over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.revenueTrend}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
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

        {/* User & Enrollment Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue" />
              Growth Overview
            </CardTitle>
            <CardDescription>Users and enrollments over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    allowDuplicatedCategory={false}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    data={data.charts.userGrowth}
                    type="monotone"
                    dataKey="count"
                    name="New Users"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    data={data.charts.enrollmentsTrend}
                    type="monotone"
                    dataKey="count"
                    name="New Enrollments"
                    stroke={COLORS.secondary}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Daily Stats */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Last 7 Days
            </CardTitle>
            <CardDescription>Daily performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="new_users" name="New Users" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="new_enrollments" name="Enrollments" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Enrollment Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Enrollment Status
            </CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.enrollmentsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Courses by Level & Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Courses by Level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-yellow-dark" />
              Courses by Level
            </CardTitle>
            <CardDescription>Distribution of course difficulty</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.coursesByLevel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis 
                    type="category" 
                    dataKey="level" 
                    tick={{ fontSize: 12 }}
                    width={80}
                    tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Courses" fill={COLORS.warning} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Courses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-green" />
              Courses by Category
            </CardTitle>
            <CardDescription>Distribution across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.coursesByCategory}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    nameKey="category"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.charts.coursesByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Courses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-dark" />
              Top Performing Courses
            </CardTitle>
            <CardDescription>By enrollment count</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-4">
              <div className="space-y-4">
                {data.topPerformers.courses.map((course, index) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{course.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {course.enrollmentCount}
                        </span>
                        {course.averageRating && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-dark" />
                            {parseFloat(course.averageRating).toFixed(1)}
                          </span>
                        )}
                        <span className="text-green font-medium">
                          {formatCurrency(course.revenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Top Instructors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue" />
              Top Instructors
            </CardTitle>
            <CardDescription>By student count</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-4">
              <div className="space-y-4">
                {data.topPerformers.instructors.map((instructor, index) => (
                  <div
                    key={instructor.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={instructor.avatar || undefined} />
                        <AvatarFallback>{getInitials(instructor.name)}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{instructor.name || 'Unknown'}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{instructor.courseCount} courses</span>
                        <span>{instructor.studentCount} students</span>
                        <span className="text-green font-medium">
                          {formatCurrency(instructor.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest platform activity</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="enrollments" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="enrollments">
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {data.recentActivity.enrollments.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={enrollment.userAvatar || undefined} />
                        <AvatarFallback>{getInitials(enrollment.userName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{enrollment.userName || 'User'}</span>
                          {' enrolled in '}
                          <span className="font-medium text-primary">{enrollment.courseTitle}</span>
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDate(enrollment.enrolledAt)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">New</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="payments">
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {data.recentActivity.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn(
                        "p-2 rounded-full",
                        payment.status === 'succeeded' ? 'bg-green-light-6' : 'bg-red-light-5'
                      )}>
                        <DollarSign className={cn(
                          "h-4 w-4",
                          payment.status === 'succeeded' ? 'text-green' : 'text-red'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{payment.userName || 'User'}</span>
                          {' paid '}
                          <span className="font-bold text-green">
                            {formatCurrency(parseFloat(payment.amount))}
                          </span>
                          {payment.courseTitle && (
                            <> for <span className="font-medium">{payment.courseTitle}</span></>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDate(payment.createdAt)}
                        </p>
                      </div>
                      <Badge 
                        variant={payment.status === 'succeeded' ? 'default' : 'destructive'}
                        className="shrink-0"
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="reviews">
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {data.recentActivity.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={review.userAvatar || undefined} />
                        <AvatarFallback>{getInitials(review.userName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{review.userName || 'User'}</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'h-3 w-3',
                                  i < review.rating ? 'text-yellow-dark fill-yellow-dark' : 'text-gray-5'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-primary mt-0.5">{review.courseTitle}</p>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {review.comment}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(review.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}