// app/my-courses/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  BookOpen,
  Clock,
  Award,
  Play,
  MoreVertical,
  Star,
  Calendar,
  TrendingUp,
  Filter,
  Grid3x3,
  List,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getSecureUrl } from '@/lib/media-url';

interface Enrollment {
  id: string;
  status: string;
  progressPercent: number;
  enrolledAt: string;
  completedAt: string | null;
  lastAccessedAt: string | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseThumbnail: string | null;
  coursePrice: string;
  courseLevel: string;
  courseDurationHours: number | null;
}

export default function MyCoursesPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [filteredEnrollments, setFilteredEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'title'>('recent');
  const [filterProgress, setFilterProgress] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!sessionLoading && !session) {
      toast.error('Please sign in to view your courses');
      router.push('/auth/signin');
      return;
    }

    if (session) {
      fetchEnrollments();
    }
  }, [session, sessionLoading]);

  useEffect(() => {
    filterAndSortEnrollments();
  }, [enrollments, searchQuery, sortBy, filterProgress]);

  const fetchEnrollments = async () => {
    try {
      const res = await fetch('/api/enrollments');

      if (!res.ok) {
        throw new Error('Failed to fetch enrollments');
      }

      const data = await res.json();
      setEnrollments(data.enrollments || []);
    } catch (error) {
      console.error('Failed to fetch enrollments:', error);
      toast.error('Failed to load your courses');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortEnrollments = () => {
    let filtered = [...enrollments];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((enrollment) =>
        enrollment.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Progress filter
    if (filterProgress === 'in-progress') {
      filtered = filtered.filter(
        (e) => e.progressPercent > 0 && e.progressPercent < 100
      );
    } else if (filterProgress === 'completed') {
      filtered = filtered.filter((e) => e.progressPercent === 100 || e.completedAt);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.lastAccessedAt || b.enrolledAt).getTime() - 
               new Date(a.lastAccessedAt || a.enrolledAt).getTime();
      } else if (sortBy === 'progress') {
        return b.progressPercent - a.progressPercent;
      } else {
        return a.courseTitle.localeCompare(b.courseTitle);
      }
    });

    setFilteredEnrollments(filtered);
  };

  const getProgressColor = (progress: number) => {
    if (progress === 0) return 'bg-gray-200';
    if (progress < 30) return 'bg-red-500';
    if (progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressLabel = (progress: number) => {
    if (progress === 0) return 'Not started';
    if (progress === 100) return 'Completed';
    return `${progress}% complete`;
  };

  if (sessionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = {
    total: enrollments.length,
    inProgress: enrollments.filter((e) => e.progressPercent > 0 && e.progressPercent < 100).length,
    completed: enrollments.filter((e) => e.progressPercent === 100 || e.completedAt).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero Section */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold mb-4">My Learning</h1>
          <p className="text-gray-300">Continue your learning journey</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <Card className="bg-white/10 border-0">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <BookOpen className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-gray-400">Total Courses</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-0">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-500/20 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.inProgress}</p>
                    <p className="text-sm text-gray-400">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-0">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500/20 rounded-lg">
                    <Award className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                    <p className="text-sm text-gray-400">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white dark:bg-gray-900 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all" onClick={() => setFilterProgress('all')}>
                All courses
              </TabsTrigger>
              <TabsTrigger value="in-progress" onClick={() => setFilterProgress('in-progress')}>
                In Progress
              </TabsTrigger>
              <TabsTrigger value="completed" onClick={() => setFilterProgress('completed')}>
                Completed
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-4 mt-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search my courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Accessed</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Course List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredEnrollments.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchQuery || filterProgress !== 'all'
                  ? 'No courses found'
                  : 'No enrolled courses yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || filterProgress !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'Start learning by enrolling in a course'}
              </p>
              <Button onClick={() => router.push('/courses')}>
                Browse Courses
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {filteredEnrollments.map((enrollment) => (
              <Card
                key={enrollment.id}
                className="group hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
              >
                <Link href={`/courses/${enrollment.courseSlug}/learn`}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video overflow-hidden">
                    {enrollment.courseThumbnail ? (
                      <img
                        src={getSecureUrl(enrollment.courseThumbnail)}
                        alt={enrollment.courseTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-white" />
                      </div>
                    )}
                    
                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white rounded-full p-4">
                        <Play className="h-8 w-8 text-gray-900 fill-gray-900" />
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {enrollment.progressPercent > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                        <div
                          className={`h-full ${getProgressColor(enrollment.progressPercent)}`}
                          style={{ width: `${enrollment.progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold line-clamp-2 flex-1">
                        {enrollment.courseTitle}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/courses/${enrollment.courseSlug}/learn`);
                            }}
                          >
                            Continue Learning
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/courses/${enrollment.courseSlug}/preview`);
                            }}
                          >
                            View Course Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">
                          {getProgressLabel(enrollment.progressPercent)}
                        </span>
                        <span className="font-medium">
                          {enrollment.progressPercent}%
                        </span>
                      </div>
                      <Progress value={enrollment.progressPercent} className="h-2" />
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {enrollment.courseDurationHours 
                            ? `${Math.floor(enrollment.courseDurationHours / 60)}h ${enrollment.courseDurationHours % 60}m`
                            : 'N/A'}
                        </span>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {enrollment.courseLevel}
                      </Badge>
                    </div>

                    {/* Last accessed */}
                    {enrollment.lastAccessedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last accessed{' '}
                        {formatDistanceToNow(new Date(enrollment.lastAccessedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}