// app/instructor/courses/[slug]/preview/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ReviewList from "@/components/reviews/ReviewList";
import {
  ArrowLeft,
  Play,
  Clock,
  Users,
  Award,
  CheckCircle2,
  FileText,
  Video,
  Download,
  Star,
  Share2,
  Bookmark,
  Globe,
  Eye,
  Calendar,
  Loader2,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  durationMinutes: number | null;
  isFree: boolean;
  order: number;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  thumbnail: string | null;
  price: string | number;
  discountPrice: string | number | null;
  level: string;
  language: string;
  durationHours: number | null;
  published: boolean;
  featured: boolean;
  enrollmentCount: number;
  averageRating: string | number;
  reviewCount: number;
  requirements: string[] | null;
  learningOutcomes: string[] | null;
  targetAudience: string[] | null;
  createdAt: string;
  updatedAt: string;
  instructor: {
    name: string;
    avatar: string;
    bio: string;
  };
}

export default function CoursePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (slug) {
      fetchCoursePreview();
    }
  }, [slug]);

  const fetchCoursePreview = async () => {
    try {
      const [courseRes, sectionsRes] = await Promise.all([
        fetch(`/api/courses/${slug}`),
        fetch(`/api/courses/${slug}/sections`),
      ]);

      if (courseRes.ok) {
        const { course: data } = await courseRes.json();
        setCourse(data);
      }

      if (sectionsRes.ok) {
        const { sections: secs } = await sectionsRes.json();
        const sectionsWithLessons = await Promise.all(
          secs.map(async (section: Section) => {
            const lessonsRes = await fetch(`/api/courses/${slug}/sections/${section.id}/lessons`);
            if (lessonsRes.ok) {
              const { lessons } = await lessonsRes.json();
              return { ...section, lessons: lessons || [] };
            }
            return { ...section, lessons: [] };
          })
        );
        setSections(sectionsWithLessons);
        if (sectionsWithLessons.length > 0) {
          setExpandedSections(new Set([sectionsWithLessons[0].id]));
        }
      }
    } catch (error) {
      toast.error("Failed to load course preview");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const safeNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? 0 : num;
  };

  const totalLessons = sections.reduce((acc, section) => acc + section.lessons.length, 0);
  const totalDuration = sections.reduce(
    (acc, section) =>
      acc + section.lessons.reduce((sum, lesson) => sum + safeNumber(lesson.durationMinutes), 0),
    0
  );

  const price = safeNumber(course?.price);
  const discountPrice = safeNumber(course?.discountPrice);
  const averageRating = safeNumber(course?.averageRating);
  const enrollmentCount = course?.enrollmentCount || 0;
  const reviewCount = course?.reviewCount || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold mb-4">Course not found</h2>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Preview Banner */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Preview Mode - This is how students will see your course
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/instructor/courses/${slug}/sections`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Editor
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-linear-to-br from-primary/5 via-primary/10 to-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="capitalize">
                  {course.level}
                </Badge>
                <Badge variant="outline">
                  <Globe className="w-3 h-3 mr-1" />
                  {course.language}
                </Badge>
                <Badge variant="outline">
                  <Calendar className="w-3 h-3 mr-1" />
                  Updated {new Date(course.updatedAt).toLocaleDateString()}
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight">{course.title}</h1>

              {course.shortDescription && (
                <p className="text-xl text-muted-foreground">{course.shortDescription}</p>
              )}

              {/* Course Stats */}
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.floor(averageRating)
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold">{averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-5 h-5" />
                  <span>{enrollmentCount.toLocaleString()} students</span>
                </div>
              </div>

              {/* Instructor */}
              {course.instructor && (
                <div className="flex items-center gap-4 pt-4">
                  <img
                    src={course.instructor.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                    alt={course.instructor.name}
                    className="w-14 h-14 rounded-full object-cover border-2"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Created by</p>
                    <p className="font-semibold text-lg">{course.instructor.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar - Course Card */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4 shadow-xl">
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden rounded-t-lg">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Video className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Button size="lg" className="rounded-full h-16 w-16">
                      <Play className="h-8 w-8" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-6 space-y-4">
                  {/* Price */}
                  <div className="space-y-2">
                    {discountPrice > 0 && discountPrice < price ? (
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-bold">${discountPrice.toFixed(2)}</span>
                        <span className="text-xl text-muted-foreground line-through">
                          ${price.toFixed(2)}
                        </span>
                        <Badge variant="destructive">
                          {Math.round(((price - discountPrice) / price) * 100)}% OFF
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-4xl font-bold">
                        {price === 0 ? "Free" : `$${price.toFixed(2)}`}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button size="lg" className="w-full">
                      Enroll Now
                    </Button>
                    <Button size="lg" variant="outline" className="w-full">
                      <Bookmark className="mr-2 h-4 w-4" />
                      Add to Wishlist
                    </Button>
                  </div>

                  <Separator />

                  {/* Course Includes */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">This course includes:</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-primary" />
                        <span>{Math.floor(totalDuration)} minutes on-demand video</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span>{totalLessons} lessons</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-primary" />
                        <span>Downloadable resources</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary" />
                        <span>Certificate of completion</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>Full lifetime access</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Share */}
                  <Button variant="ghost" className="w-full">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share this course
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                <TabsTrigger value="instructor">Instructor</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Description */}
                <Card>
                  <CardHeader>
                    <CardTitle>About this course</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: course.description || '<p>No description available.</p>' }}
                    />
                  </CardContent>
                </Card>

                {/* Learning Outcomes */}
                {course.learningOutcomes && course.learningOutcomes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>What you'll learn</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-3">
                        {course.learningOutcomes.map((outcome, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            <span className="text-sm">{outcome}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Requirements */}
                {course.requirements && course.requirements.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Requirements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {course.requirements.map((req, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground mt-1">•</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Target Audience */}
                {course.targetAudience && course.targetAudience.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Who this course is for</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {course.targetAudience.map((audience, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground mt-1">•</span>
                            <span>{audience}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Curriculum Tab */}
              <TabsContent value="curriculum" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Course Curriculum</CardTitle>
                    <CardDescription>
                      {sections.length} sections • {totalLessons} lessons • {Math.floor(totalDuration / 60)}h{" "}
                      {totalDuration % 60}m total length
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sections.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No curriculum available yet
                      </p>
                    ) : (
                      sections.map((section, sectionIndex) => {
                        const sectionDuration = section.lessons.reduce(
                          (sum, l) => sum + safeNumber(l.durationMinutes),
                          0
                        );
                        
                        return (
                          <div key={section.id} className="border rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleSection(section.id)}
                              className="w-full px-4 py-3 bg-muted/50 hover:bg-muted flex items-center justify-between text-left transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <span className="font-semibold">
                                  Section {sectionIndex + 1}: {section.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{section.lessons.length} lessons</span>
                                <span>
                                  {Math.floor(sectionDuration / 60)}h {sectionDuration % 60}m
                                </span>
                              </div>
                            </button>

                            {expandedSections.has(section.id) && (
                              <div className="divide-y">
                                {section.lessons.map((lesson, lessonIndex) => (
                                  <div
                                    key={lesson.id}
                                    className="px-4 py-3 hover:bg-muted/30 transition-colors flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Play className="w-4 h-4 text-muted-foreground" />
                                      <span className="text-sm">
                                        {lessonIndex + 1}. {lesson.title}
                                      </span>
                                      {lesson.isFree && (
                                        <Badge variant="secondary" className="text-xs">
                                          Free Preview
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {safeNumber(lesson.durationMinutes)} min
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Instructor Tab */}
              <TabsContent value="instructor" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <img
                        src={course.instructor?.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                        alt={course.instructor?.name || 'Instructor'}
                        className="w-20 h-20 rounded-full object-cover border-2"
                      />
                      <div>
                        <CardTitle>{course.instructor?.name || 'Instructor'}</CardTitle>
                        <CardDescription>Course Instructor</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">
                      {course.instructor?.bio || 'No bio available.'}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Student Reviews</CardTitle>
                    <CardDescription>
                      {averageRating.toFixed(1)} average rating • {reviewCount} reviews
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Reviews List */}
                    <ReviewList courseId={course.id} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar - Empty on mobile, shows course card on desktop */}
          <div className="hidden lg:block lg:col-span-1"></div>
        </div>
      </div>
    </div>
  );
}