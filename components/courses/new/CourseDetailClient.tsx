// ============================================
// FILE: components/courses/new/CourseDetailClient.tsx
// Updated with Udemy-style video preview modal
// ============================================

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Star,
  Users,
  Clock,
  BookOpen,
  Globe,
  Award,
  Play,
  CheckCircle2,
  FileText,
  ClipboardList,
  PlayCircle,
  Lock,
  Share2,
  Heart,
  ChevronRight,
  GraduationCap,
  Target,
  Zap,
  Captions,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { CoursePreviewModal } from './CoursePreviewModal';
import { CourseReviews } from './CourseReviews';

// ✅ Inline helper to convert S3 URLs to secure proxy URLs
function getSecureUrl(url: string | null | undefined): string {
  if (!url) return '';
  url = url.trim();
  
  if (url.startsWith('/api/media/') || url.startsWith('/api/files/')) return url;
  if (url.startsWith('/images/') || url.startsWith('/assets/')) return url;
  
  const s3Pattern1 = /https?:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)/;
  const match1 = url.match(s3Pattern1);
  if (match1) return `/api/files/${match1[3]}`;
  
  const s3Pattern2 = /https?:\/\/s3\.([^.]+)\.amazonaws\.com\/([^/]+)\/(.+)/;
  const match2 = url.match(s3Pattern2);
  if (match2) return `/api/files/${match2[3]}`;
  
  const s3Pattern3 = /https?:\/\/([^.]+)\.s3\.amazonaws\.com\/(.+)/;
  const match3 = url.match(s3Pattern3);
  if (match3) return `/api/files/${match3[2]}`;
  
  if (!url.startsWith('http') && !url.startsWith('/')) return `/api/files/${url}`;
  
  return url;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  thumbnail: string | null;
  previewVideo: string | null;
  price: number;
  discountPrice: number | null;
  level: string;
  language: string | null;
  durationHours: number | null;
  enrollmentCount: number;
  averageRating: number;
  reviewCount: number;
  requirements: string[];
  learningOutcomes: string[];
  targetAudience: string[];
  updatedAt?: string | null;
}

interface Instructor {
  id: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
}

interface Lesson {
  id: string;
  title: string;
  order: number;
  isFree?: boolean;
  videoUrl?: string | null;
  durationMinutes?: number;
}

interface Section {
  id: string;
  title: string;
  type: string;
  order: number;
  lessons: Lesson[];
  lessonCount: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date | null;
  user: { name: string | null; avatar: string | null };
}

interface CourseDetailClientProps {
  course: Course;
  instructor: Instructor | null;
  category: { id: string; name: string } | null;
  curriculum: Section[];
  totalLessons: number;
  reviews: Review[];
  isEnrolled: boolean;
  isInstructor: boolean;
  isLoggedIn: boolean;
  enrollment: any;
  currentUserId?: string;
}

export function CourseDetailClient({
  course,
  instructor,
  category,
  curriculum,
  totalLessons,
  reviews,
  isEnrolled,
  isInstructor,
  isLoggedIn,
  enrollment,
  currentUserId,
}: CourseDetailClientProps) {
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);

  const hasDiscount = course.discountPrice && course.discountPrice < course.price;
  const displayPrice = hasDiscount ? course.discountPrice : course.price;
  const isFree = displayPrice === 0;
  const discountPercent = hasDiscount
    ? Math.round((1 - course.discountPrice! / course.price) * 100)
    : 0;

  // ✅ Extract free preview lessons from curriculum
  const previewLessons = useMemo(() => {
    const freeLessons: {
      id: string;
      title: string;
      videoUrl: string | null;
      durationMinutes: number;
      order: number;
      sectionTitle: string;
    }[] = [];

    curriculum.forEach((section) => {
      if (section.type === 'lessons') {
        section.lessons.forEach((lesson) => {
          if (lesson.isFree && lesson.videoUrl) {
            freeLessons.push({
              id: lesson.id,
              title: lesson.title,
              videoUrl: lesson.videoUrl,
              durationMinutes: lesson.durationMinutes || 0,
              order: lesson.order,
              sectionTitle: section.title,
            });
          }
        });
      }
    });

    return freeLessons;
  }, [curriculum]);

  // Count free lessons
  const freeLessonsCount = previewLessons.length;

  const handleEnroll = async () => {
    if (!isLoggedIn) {
      toast.error('Please login to enroll in this course');
      router.push(`/auth/login?redirect=/checkout/${course.slug}`);
      return;
    }
    router.push(`/checkout/${course.slug}`);
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'quiz':
        return <ClipboardList className="h-4 w-4 text-purple-500" />;
      case 'assignment':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <PlayCircle className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ============================================ */}
      {/* Preview Modal - Udemy Style */}
      {/* ============================================ */}
      <CoursePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        courseTitle={course.title}
        courseThumbnail={course.thumbnail}
        previewLessons={previewLessons}
        previewVideo={course.previewVideo}
      />

      {/* ============================================ */}
      {/* MOBILE LAYOUT */}
      {/* ============================================ */}
      <div className="lg:hidden">
        {/* Mobile: Video/Image Preview */}
        <div
          className="relative w-full aspect-video cursor-pointer bg-black"
          onClick={() => setShowPreview(true)}
        >
          {course.thumbnail ? (
            <Image
              src={getSecureUrl(course.thumbnail)}
              alt={course.title}
              fill
              sizes="100vw"
              className="object-cover"
              priority
              unoptimized={getSecureUrl(course.thumbnail).startsWith('/api/')}
            />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-violet-600 to-purple-800 flex items-center justify-center">
              <GraduationCap className="h-16 w-16 text-white/50" />
            </div>
          )}
          {/* Play Button Overlay */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white/90 rounded-full p-4 shadow-lg">
              <Play className="h-8 w-8 text-black ml-0.5" />
            </div>
          </div>
          {/* Preview Text */}
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <span className="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">
              Preview this course
            </span>
          </div>
          {/* Free lessons badge */}
          {freeLessonsCount > 0 && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-green text-white">
                <Eye className="h-3 w-3 mr-1" />
                {freeLessonsCount} Free Preview{freeLessonsCount > 1 ? 's' : ''}
              </Badge>
            </div>
          )}
        </div>

        {/* Mobile: Course Info */}
        <div className="px-4 py-4 space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <Link href="/courses" className="text-primary hover:underline">
              Courses
            </Link>
            {category && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-primary">{category.name}</span>
              </>
            )}
          </div>

          <h1 className="text-xl font-bold leading-tight">{course.title}</h1>

          {course.shortDescription && (
            <p className="text-sm text-muted-foreground">{course.shortDescription}</p>
          )}

          {course.averageRating >= 4.0 && (
            <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-400">
              Bestseller
            </Badge>
          )}

          {/* Rating & Students */}
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="font-bold text-amber-600">{course.averageRating.toFixed(1)}</span>
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(course.averageRating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-muted-foreground">({course.reviewCount.toLocaleString()})</span>
            <span className="text-muted-foreground">
              {course.enrollmentCount.toLocaleString()} students
            </span>
          </div>

          {/* Instructor */}
          {instructor && (
            <div className="text-sm">
              <span className="text-muted-foreground">Created by </span>
              <Link href={`/instructor/${instructor.id}`} className="text-primary hover:underline font-medium">
                {instructor.name}
              </Link>
            </div>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {course.updatedAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Updated {new Date(course.updatedAt).toLocaleDateString('en-US', { month: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
            {course.language && (
              <div className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                <span>{course.language}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* DESKTOP LAYOUT */}
      {/* ============================================ */}
      <div className="hidden lg:block bg-linear-to-r from-slate-900 via-purple-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Left: Course Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Link href="/courses" className="hover:text-white">Courses</Link>
                <ChevronRight className="h-4 w-4" />
                {category && (
                  <>
                    <Link href={`/courses?category=${category.name.toLowerCase()}`} className="hover:text-white">
                      {category.name}
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
                <span className="text-gray-400 truncate">{course.title}</span>
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold">{course.title}</h1>

              {course.shortDescription && (
                <p className="text-lg text-gray-300">{course.shortDescription}</p>
              )}

              {/* Badges */}
              <div className="flex items-center gap-3">
                {course.averageRating >= 4.0 && (
                  <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-400">
                    Bestseller
                  </Badge>
                )}
                {freeLessonsCount > 0 && (
                  <Badge className="bg-green text-white hover:bg-green">
                    <Eye className="h-3 w-3 mr-1" />
                    {freeLessonsCount} Free Preview{freeLessonsCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {/* Stats Row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-yellow-400">{course.averageRating.toFixed(1)}</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.round(course.averageRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-500'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-400">({course.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1 text-gray-300">
                  <Users className="h-4 w-4" />
                  <span>{course.enrollmentCount.toLocaleString()} students</span>
                </div>
              </div>

              {/* Instructor */}
              {instructor && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white/20">
                    <AvatarImage src={instructor.avatar ? getSecureUrl(instructor.avatar) : undefined} />
                    <AvatarFallback>{instructor.name?.charAt(0) || 'I'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-gray-400">Created by</p>
                    <p className="font-medium">{instructor.name}</p>
                  </div>
                </div>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                {course.language && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    <span>{course.language}</span>
                  </div>
                )}
                {course.durationHours && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{course.durationHours} hours</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{totalLessons} lessons</span>
                </div>
                <Badge variant="secondary" className="capitalize">{course.level}</Badge>
              </div>
            </div>

            {/* Right: Course Card (Desktop) */}
            <div className="hidden lg:block">
              <Card className="sticky top-24 overflow-hidden shadow-2xl">
                {/* Thumbnail with Preview */}
                <div
                  className="relative aspect-video cursor-pointer group bg-slate-800"
                  onClick={() => setShowPreview(true)}
                >
                  {course.thumbnail ? (
                    <Image
                      src={getSecureUrl(course.thumbnail)}
                      alt={course.title}
                      fill
                      sizes="400px"
                      className="object-cover"
                      priority
                      unoptimized={getSecureUrl(course.thumbnail).startsWith('/api/')}
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                      <GraduationCap className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white rounded-full p-4">
                      <Play className="h-8 w-8 text-black" />
                    </div>
                  </div>
                  {/* Free lessons badge */}
                  {freeLessonsCount > 0 && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-green text-white text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        {freeLessonsCount} Free
                      </Badge>
                    </div>
                  )}
                  {/* Preview text */}
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-white text-xs font-medium bg-black/60 px-3 py-1 rounded-full">
                      Preview this course
                    </span>
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* Price */}
                  <div className="mb-4">
                    {isFree ? (
                      <span className="text-3xl font-bold text-green">Free</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold">${displayPrice?.toFixed(2)}</span>
                        {hasDiscount && (
                          <>
                            <span className="text-lg text-muted-foreground line-through">
                              ${course.price.toFixed(2)}
                            </span>
                            <Badge className="bg-red text-white">{discountPercent}% OFF</Badge>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA Buttons */}
                  {isEnrolled ? (
                    <div className="space-y-3">
                      <Button className="w-full bg-primary hover:bg-primary/90" size="lg" asChild>
                        <Link href={`/courses/${course.slug}/learn`}>
                          <Play className="h-4 w-4 mr-2" />
                          Continue Learning
                        </Link>
                      </Button>
                      <p className="text-center text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 inline mr-1 text-green" />
                        You're enrolled in this course
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button className="w-full bg-primary hover:bg-primary/90" size="lg" onClick={handleEnroll}>
                        {isFree ? 'Enroll for Free' : 'Enroll Now'}
                      </Button>
                      {!isFree && (
                        <p className="text-center text-xs text-muted-foreground">
                          30-Day Money-Back Guarantee
                        </p>
                      )}
                    </div>
                  )}

                  {/* Course Includes */}
                  <div className="mt-6 pt-6 border-t space-y-3">
                    <h4 className="font-semibold">This course includes:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-primary" />
                        {course.durationHours || 0} hours of video
                      </li>
                      <li className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        {totalLessons} lessons
                      </li>
                      {freeLessonsCount > 0 && (
                        <li className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-green" />
                          {freeLessonsCount} free preview lesson{freeLessonsCount > 1 ? 's' : ''}
                        </li>
                      )}
                      <li className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        Certificate of completion
                      </li>
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Lifetime access
                      </li>
                    </ul>
                  </div>

                  {/* Share */}
                  <div className="mt-6 pt-6 border-t flex items-center justify-center gap-4">
                    <Button variant="ghost" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Heart className="h-4 w-4 mr-2" />
                      Wishlist
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-3 z-50">
        <div className="flex items-center justify-between gap-3">
          <div className="shrink-0">
            {isFree ? (
              <span className="text-xl font-bold text-green">Free</span>
            ) : (
              <div>
                <span className="text-xl font-bold">${displayPrice?.toFixed(2)}</span>
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through ml-1">
                    ${course.price.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
          {isEnrolled ? (
            <Button className="flex-1 bg-primary" asChild>
              <Link href={`/courses/${course.slug}/learn`}>
                <Play className="h-4 w-4 mr-1" />
                Continue
              </Link>
            </Button>
          ) : (
            <Button className="flex-1 bg-primary" onClick={handleEnroll}>
              {isFree ? 'Enroll Free' : 'Enroll Now'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="container mx-auto px-4 py-4 md:py-8 pb-24 lg:pb-8">
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="w-full">
              <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
                <TabsList className="w-max lg:w-full justify-start mb-4 lg:mb-6 bg-muted/50 p-1 h-auto">
                  <TabsTrigger value="overview" className="px-4 lg:px-6 py-2 text-sm">Overview</TabsTrigger>
                  <TabsTrigger value="curriculum" className="px-4 lg:px-6 py-2 text-sm">Curriculum</TabsTrigger>
                  <TabsTrigger value="instructor" className="px-4 lg:px-6 py-2 text-sm">Instructor</TabsTrigger>
                  <TabsTrigger value="reviews" className="px-4 lg:px-6 py-2 text-sm">Reviews</TabsTrigger>
                </TabsList>
              </div>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 lg:space-y-8 mt-0">
                {course.learningOutcomes && course.learningOutcomes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="h-5 w-5 text-primary" />
                        What you'll learn
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-3">
                        {course.learningOutcomes.map((outcome, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green shrink-0 mt-0.5" />
                            <span className="text-sm">{outcome}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">About This Course</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: course.description }}
                    />
                  </CardContent>
                </Card>

                {course.requirements && course.requirements.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Zap className="h-5 w-5 text-primary" />
                        Requirements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {course.requirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-5 w-5 text-primary shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {course.targetAudience && course.targetAudience.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Users className="h-5 w-5 text-primary" />
                        Who this course is for
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {course.targetAudience.map((audience, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                            <span>{audience}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Curriculum Tab */}
              <TabsContent value="curriculum" className="mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardTitle className="text-lg">Course Curriculum</CardTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{curriculum.length} sections • {totalLessons} lessons</span>
                        {freeLessonsCount > 0 && (
                          <Badge variant="outline" className="text-green border-green">
                            <Eye className="h-3 w-3 mr-1" />
                            {freeLessonsCount} free
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {curriculum.length > 0 ? (
                      <Accordion type="multiple" className="w-full" defaultValue={[curriculum[0]?.id]}>
                        {curriculum.map((section) => (
                          <AccordionItem key={section.id} value={section.id}>
                            <AccordionTrigger className="hover:no-underline text-sm py-3">
                              <div className="flex items-center gap-3 text-left">
                                {getSectionIcon(section.type)}
                                <div>
                                  <p className="font-medium">{section.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {section.lessonCount} {section.type === 'lessons' ? 'lessons' : section.type}
                                  </p>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-1 pl-7">
                                {section.lessons.map((lesson) => {
                                  const isFreeLesson = lesson.isFree && lesson.videoUrl;
                                  
                                  return (
                                    <div
                                      key={lesson.id}
                                      className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                                        isFreeLesson 
                                          ? 'hover:bg-green/10 cursor-pointer' 
                                          : 'hover:bg-muted'
                                      }`}
                                      onClick={() => {
                                        if (isFreeLesson) {
                                          setShowPreview(true);
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <PlayCircle className={`h-4 w-4 ${
                                          isFreeLesson ? 'text-green' : 'text-muted-foreground'
                                        }`} />
                                        <span className="line-clamp-1">{lesson.title}</span>
                                        {isFreeLesson && (
                                          <Badge variant="outline" className="text-green border-green text-xs py-0">
                                            Preview
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {lesson.durationMinutes && (
                                          <span className="text-xs text-muted-foreground">
                                            {lesson.durationMinutes} min
                                          </span>
                                        )}
                                        {!isEnrolled && !isFreeLesson && (
                                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {section.type === 'quiz' && (
                                  <div className="flex items-center gap-3 py-2 px-3 text-sm">
                                    <ClipboardList className="h-4 w-4 text-purple-500" />
                                    <span>Quiz</span>
                                    {!isEnrolled && <Lock className="h-4 w-4 text-muted-foreground ml-auto" />}
                                  </div>
                                )}
                                {section.type === 'assignment' && (
                                  <div className="flex items-center gap-3 py-2 px-3 text-sm">
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    <span>Assignment</span>
                                    {!isEnrolled && <Lock className="h-4 w-4 text-muted-foreground ml-auto" />}
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <p className="text-center text-muted-foreground py-8 text-sm">
                        No curriculum available yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Instructor Tab */}
              <TabsContent value="instructor" className="mt-0">
                {instructor ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={instructor.avatar ? getSecureUrl(instructor.avatar) : undefined} />
                          <AvatarFallback className="text-2xl">
                            {instructor.name?.charAt(0) || 'I'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold">{instructor.name}</h3>
                          <p className="text-muted-foreground text-sm">Course Instructor</p>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span>4.8 Rating</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>1,234 Students</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {instructor.bio && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-muted-foreground text-sm">{instructor.bio}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground text-sm">Instructor information not available.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="mt-0">
                <CourseReviews
                  courseId={course.id}
                  courseSlug={course.slug}
                  averageRating={course.averageRating}
                  reviewCount={course.reviewCount}
                  isEnrolled={isEnrolled}
                  isLoggedIn={isLoggedIn}
                  currentUserId={currentUserId}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="hidden lg:block" />
        </div>
      </div>
    </div>
  );
}