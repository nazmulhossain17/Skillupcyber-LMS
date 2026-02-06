"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  Clock, 
  Award, 
  TrendingUp,
  PlayCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Target,
  BookMarked
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSecureUrl } from "@/lib/media-url";

interface EnrolledCourse {
  id: string;
  title: string;
  slug: string;
  thumbnail: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  lastAccessedAt: string;
  instructor: {
    name: string;
    avatar: string;
  };
}

interface DashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalLessonsCompleted: number;
  totalWatchTime: number;
  currentStreak: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'in-progress' | 'completed'>('all');

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/auth/signin');
      return;
    }

    if (session) {
      fetchDashboardData();
    }
  }, [session, isPending]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch enrolled courses
      const coursesRes = await fetch('/api/student/enrolled-courses');
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setEnrolledCourses(coursesData.courses || []);
      }

      // Fetch dashboard stats
      const statsRes = await fetch('/api/student/dashboard-stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || null);
      }

    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = enrolledCourses.filter(course => {
    if (activeTab === 'completed') return course.progress === 100;
    if (activeTab === 'in-progress') return course.progress > 0 && course.progress < 100;
    return true;
  });

  if (isPending || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-6 sm:py-8 lg:py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            My Learning Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Track your progress and continue learning
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          {/* Total Courses */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Total Courses</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {stats?.totalCourses || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed Courses */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Completed</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {stats?.completedCourses || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">In Progress</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {stats?.inProgressCourses || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Streak */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                  <Award className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Day Streak</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {stats?.currentStreak || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress */}
        {stats && stats.totalCourses > 0 && (
          <Card className="mb-6 sm:mb-8">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Overall Progress</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    {stats.completedCourses} of {stats.totalCourses} courses completed
                  </p>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-lg sm:text-xl font-bold">
                    {Math.round((stats.completedCourses / stats.totalCourses) * 100)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={(stats.completedCourses / stats.totalCourses) * 100} 
                className="h-3"
              />
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveTab('all')}
            className="text-xs sm:text-sm"
          >
            All Courses ({enrolledCourses.length})
          </Button>
          <Button
            variant={activeTab === 'in-progress' ? 'default' : 'outline'}
            onClick={() => setActiveTab('in-progress')}
            className="text-xs sm:text-sm"
          >
            In Progress ({enrolledCourses.filter(c => c.progress > 0 && c.progress < 100).length})
          </Button>
          <Button
            variant={activeTab === 'completed' ? 'default' : 'outline'}
            onClick={() => setActiveTab('completed')}
            className="text-xs sm:text-sm"
          >
            Completed ({enrolledCourses.filter(c => c.progress === 100).length})
          </Button>
        </div>

        {/* Courses Grid */}
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCourses.map((course) => (
              <Card key={course.id} className="hover:shadow-xl transition-all overflow-hidden group">
                <div className="relative aspect-video bg-gray-200 overflow-hidden">
                  <img
                    src={getSecureUrl(course.thumbnail) || '/placeholder-course.jpg'}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      onClick={() => router.push(`/courses/${course.slug}/learn`)}
                      className="gap-2"
                    >
                      <PlayCircle className="h-5 w-5" />
                      Continue Learning
                    </Button>
                  </div>
                  {course.progress === 100 && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </div>
                  )}
                </div>

                <CardContent className="p-4 sm:p-6">
                  <Link href={`/courses/${course.slug}/learn`}>
                    <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-2 hover:text-primary transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mb-4">
                    <img
                      src={getSecureUrl(course.instructor.avatar) || '/default-avatar.png'}
                      alt={course.instructor.name}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                    />
                    <span className="truncate">{course.instructor.name}</span>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold text-gray-900">{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                    <p className="text-xs text-gray-500">
                      {course.completedLessons} of {course.totalLessons} lessons completed
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => router.push(`/courses/${course.slug}/learn`)}
                      className="flex-1 text-xs sm:text-sm"
                    >
                      Continue
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/courses/${course.slug}/learn`)}
                      className="text-xs sm:text-sm"
                    >
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 sm:p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <BookMarked className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                {activeTab === 'completed' 
                  ? 'No Completed Courses Yet'
                  : activeTab === 'in-progress'
                  ? 'No Courses In Progress'
                  : 'No Courses Enrolled'}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 max-w-md">
                {activeTab === 'all' 
                  ? 'Start your learning journey by enrolling in a course'
                  : 'Keep learning to see your progress here'}
              </p>
              {activeTab === 'all' && (
                <Button
                  onClick={() => router.push('/courses')}
                  className="mt-4"
                >
                  Browse Courses
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="mt-8 sm:mt-12">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/courses')}>
              <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Browse Courses</h3>
                  <p className="text-xs sm:text-sm text-gray-600">Discover new courses</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/my-courses')}>
              <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">My Learning</h3>
                  <p className="text-xs sm:text-sm text-gray-600">View all your courses</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Study Schedule</h3>
                  <p className="text-xs sm:text-sm text-gray-600">Plan your learning</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}