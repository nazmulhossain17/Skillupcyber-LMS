// ============================================
// FILE: components/courses/CoursesPageClient.tsx
// ============================================

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Star,
  Users,
  Clock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Play,
  TrendingUp,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSecureUrl } from '@/lib/media-url';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl: string | null;
  price: number;
  level: string;
  categoryId: string | null;
  categoryName: string | null;
  instructorId: string;
  instructorName: string | null;
  rating: number;
  studentCount: number;
  lessonCount: number;
  duration: number;
  isPublished: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  courseCount: number;
}

const LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

// Inner component that uses useSearchParams
function CoursesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams?.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams?.get('category') || 'all');
  const [selectedLevel, setSelectedLevel] = useState(searchParams?.get('level') || 'all');
  const [sortBy, setSortBy] = useState(searchParams?.get('sort') || 'newest');
  const [currentPage, setCurrentPage] = useState(1);
  const coursesPerPage = 12;

  // Fetch courses from API
  useEffect(() => {
    fetchCourses();
    fetchCategories();
  }, []);

  // Apply filters when data or filters change
  useEffect(() => {
    applyFilters();
  }, [courses, searchQuery, selectedCategory, selectedLevel, sortBy]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error('Failed to fetch courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const applyFilters = () => {
    let result = [...courses];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          course.description?.toLowerCase().includes(query) ||
          course.instructorName?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter(
        (course) =>
          course.categoryName?.toLowerCase() === selectedCategory.toLowerCase() ||
          course.categoryId === selectedCategory
      );
    }

    // Level filter
    if (selectedLevel && selectedLevel !== 'all') {
      result = result.filter(
        (course) => course.level?.toLowerCase() === selectedLevel.toLowerCase()
      );
    }

    // Sort
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        result.sort((a, b) => b.studentCount - a.studentCount);
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    setFilteredCourses(result);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLevel('all');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || selectedCategory !== 'all' || selectedLevel !== 'all';

  // Pagination
  const totalPages = Math.ceil(filteredCourses.length / coursesPerPage);
  const startIndex = (currentPage - 1) * coursesPerPage;
  const paginatedCourses = filteredCourses.slice(startIndex, startIndex + coursesPerPage);

  // Format duration
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border-b">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              {courses.length} Courses Available
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Explore Our Courses
            </h1>
            <p className="text-muted-foreground text-lg mb-8">
              Discover world-class courses taught by industry experts. Start your learning journey today.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for courses, topics, or instructors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-24 h-14 text-lg rounded-full border-2 focus:border-primary"
              />
              <Button 
                type="submit" 
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
              >
                Search
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <BookOpen className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug || cat.name.toLowerCase()}>
                    {cat.name} ({cat.courseCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Level Filter */}
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-[160px]">
                <TrendingUp className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{paginatedCourses.length}</span> of{' '}
            <span className="font-semibold text-foreground">{filteredCourses.length}</span> courses
          </p>
        </div>

        {/* Active Filters Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedCategory !== 'all' && (
              <Badge variant="secondary" className="gap-1 capitalize">
                {selectedCategory}
                <button onClick={() => setSelectedCategory('all')}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedLevel !== 'all' && (
              <Badge variant="secondary" className="gap-1 capitalize">
                {selectedLevel}
                <button onClick={() => setSelectedLevel('all')}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Courses Grid */}
        {paginatedCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedCourses.map((course) => (
              <CourseCard key={course.id} course={course} formatDuration={formatDuration} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or search query
            </p>
            <Button onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1;
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="px-2">...</span>;
              }
              return null;
            })}

            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// Course Card Component
function CourseCard({ 
  course, 
  formatDuration 
}: { 
  course: Course; 
  formatDuration: (minutes: number) => string;
}) {
  const isFree = course.price === 0;
  const thumbnailUrl = course.thumbnailUrl ? getSecureUrl(course.thumbnailUrl) : null;
  // Check if URL is proxied through our API (needs unoptimized)
  const isProxiedUrl = thumbnailUrl?.startsWith('/api/');

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 bg-card">
      <Link href={`/course/${course.slug}`}>
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized={isProxiedUrl}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-500/20">
              <GraduationCap className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button variant="secondary" size="sm" className="gap-2">
              <Play className="h-4 w-4" />
              Preview Course
            </Button>
          </div>

          {/* Free Badge */}
          {isFree && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-green-500 hover:bg-green-600">Free</Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          {/* Category */}
          {course.categoryName && (
            <p className="text-xs text-primary font-medium mb-2 uppercase tracking-wide">
              {course.categoryName}
            </p>
          )}

          {/* Title */}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {course.title}
          </h3>

          {/* Instructor */}
          <p className="text-sm text-muted-foreground mb-3">
            by {course.instructorName || 'Unknown Instructor'}
          </p>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            {/* Rating */}
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-foreground">
                {course.rating.toFixed(1)}
              </span>
            </div>

            {/* Students */}
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{course.studentCount.toLocaleString()}</span>
            </div>
          </div>

          {/* Level & Duration & Lessons */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
            <Badge variant="outline" className="capitalize">
              {course.level}
            </Badge>
            {course.duration > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(course.duration)}
              </div>
            )}
            {course.lessonCount > 0 && (
              <div className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {course.lessonCount} lessons
              </div>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2">
              {isFree ? (
                <span className="text-xl font-bold text-green-600">Free</span>
              ) : (
                <span className="text-xl font-bold">${course.price.toFixed(2)}</span>
              )}
            </div>

            <Button size="sm">
              {isFree ? 'Enroll Free' : 'Enroll Now'}
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

// Exported wrapper component with Suspense
export function CoursesPageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    }>
      <CoursesPageContent />
    </Suspense>
  );
}