"use client";

import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BookOpen, 
  DollarSign, 
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Award,
  BarChart3,
  Activity
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AnalyticsData {
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
    createdAt: Date;
    course: string;
    student: {
      name: string | null;
      avatar: string | null;
    };
  }>;
}

export default function InstructorAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/instructor/analytics/overview");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            {error || "Failed to load analytics data"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const maxEnrollments = Math.max(...data.topCourses.map(c => c.enrollments), 1);

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Track your teaching performance and revenue metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Courses */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Courses
            </CardTitle>
            <BookOpen className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.overview.totalCourses}</div>
          </CardContent>
        </Card>

        {/* Total Students */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.overview.totalStudents}</div>
            <div className="flex items-center gap-1 mt-2">
              <Badge variant="secondary" className="gap-1">
                <ArrowUpRight className="h-3 w-3" />
                {data.overview.enrollmentGrowth.rate}% growth
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(data.overview.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        {/* Average Rating */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Rating
            </CardTitle>
            <Star className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              {data.overview.averageRating}
              <Star className="h-6 w-6 fill-amber-500 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <CardTitle>Revenue Breakdown</CardTitle>
          </div>
          <CardDescription>Your earnings over different time periods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last 7 Days</span>
                <Activity className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(data.revenue.last7Days)}
              </div>
              <Progress 
                value={(data.revenue.last7Days / data.revenue.total) * 100} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last 30 Days</span>
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.revenue.last30Days)}
              </div>
              <Progress 
                value={(data.revenue.last30Days / data.revenue.total) * 100} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">All Time</span>
                <Activity className="h-4 w-4 text-violet-600" />
              </div>
              <div className="text-2xl font-bold text-violet-600">
                {formatCurrency(data.revenue.total)}
              </div>
              <Progress value={100} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Courses */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-violet-600" />
            <CardTitle>Top Performing Courses</CardTitle>
          </div>
          <CardDescription>Your most successful courses by enrollment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.topCourses.map((course, index) => (
            <div
              key={course.id}
              className="flex flex-col md:flex-row gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              {/* Rank Badge */}
              <div className="flex items-center gap-4">
                <Badge 
                  variant={index === 0 ? "default" : "secondary"}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold"
                >
                  {index + 1}
                </Badge>

                {/* Thumbnail */}
                <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg truncate">{course.title}</h3>
                  <p className="text-sm text-muted-foreground">{course.slug}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Enrollments</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-blue-600">{course.enrollments}</p>
                      <Progress 
                        value={(course.enrollments / maxEnrollments) * 100} 
                        className="h-1 flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(course.revenue)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Rating</p>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <p className="text-lg font-bold">{course.rating.toFixed(1)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reviews</p>
                    <p className="text-lg font-bold">{course.reviews}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <CardTitle>Recent Reviews</CardTitle>
          </div>
          <CardDescription>Latest feedback from your students</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.recentReviews.map((review) => (
            <div
              key={review.id}
              className="flex gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              {/* Avatar */}
              <Avatar className="h-12 w-12">
                <AvatarImage src={review.student.avatar || undefined} />
                <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white">
                  {review.student.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{review.student.name || "Anonymous"}</p>
                    <p className="text-sm text-muted-foreground">{review.course}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Rating Stars */}
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm leading-relaxed">{review.comment}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}