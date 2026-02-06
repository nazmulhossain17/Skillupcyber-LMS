// app/instructor/courses/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Plus, BookOpen, Users, Clock, MoreVertical, Trash2, Edit, Eye, Archive, Copy } from "lucide-react";
import { useInstructorCourses, useDeleteCourse } from "@/hooks/use-instructor-queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSecureUrl } from "@/lib/media-url";

interface Course {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  thumbnail: string | null;
  price: number;
  durationHours: number | null;
  discountPrice: number | null;
  level: string;
  studentCount: number;
  published: boolean;
  createdAt: string;
}

export default function InstructorCoursesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  // ✅ TanStack Query - Fetches once and caches for 24 hours
  const { data: courses = [], isLoading, error } = useInstructorCourses();
  
  // ✅ Delete Mutation
  const deleteMutation = useDeleteCourse();

  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    
    deleteMutation.mutate(deletingCourse.slug, {
      onSuccess: () => {
        setDeletingCourse(null);
      },
    });
  };

  const handleTogglePublish = async (course: Course) => {
    // ✅ Optimistically update the UI immediately
    queryClient.setQueryData(['instructor', 'courses'], (old: Course[] | undefined) => {
      if (!old) return old;
      return old.map(c => 
        c.id === course.id ? { ...c, published: !c.published } : c
      );
    });

    try {
      const res = await fetch(`/api/courses/${course.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !course.published }),
      });

      if (!res.ok) throw new Error();
      
      toast.success(course.published ? 'Course unpublished' : 'Course published!');
      
      // ✅ Invalidate to ensure consistency (won't refetch immediately due to 24h cache)
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
    } catch {
      // ✅ Revert on error
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
      toast.error('Failed to update course');
    }
  };

  const handleDuplicateCourse = (course: Course) => {
    toast.info('Course duplication coming soon!');
    console.log("Duplicate:", course.id);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-10">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full rounded-t-lg" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Failed to load courses</h2>
        <p className="text-muted-foreground mb-6">Please try again later</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] })}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-9xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      {/* Delete Dialog */}
      <AlertDialog open={!!deletingCourse} onOpenChange={() => setDeletingCourse(null)}>
        <AlertDialogContent className="bg-white text-black dark:bg-gray-950 dark:text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingCourse?.title}" and all its content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Course"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground mt-2">
            Manage and build your courses • {courses.length} {courses.length === 1 ? "course" : "courses"}
          </p>
        </div>

        <Button asChild size="lg">
          <Link href="/instructor/create-course">
            <Plus className="mr-2 h-5 w-5" />
            Create New Course
          </Link>
        </Button>
      </div>

      {/* Empty State */}
      {courses.length === 0 ? (
        <div className="text-center py-20">
          <div className="bg-muted w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">No courses yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Start creating your first course and share your knowledge with students around the world.
          </p>
          <Button asChild size="lg">
            <Link href="/instructor/create-course">
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Course
            </Link>
          </Button>
        </div>
      ) : (
        /* Courses Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="group hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
            >
              {/* Thumbnail */}
              <div
                className="relative w-full bg-muted cursor-pointer overflow-hidden"
                style={{ paddingTop: "56.25%" }}
                onClick={() => router.push(`/instructor/courses/${course.slug}/sections`)}
              >
                {course.thumbnail ? (
                  <img
                    src={getSecureUrl(course.thumbnail)}
                    alt={course.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-muted-foreground/50" />
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      course.published
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {course.published ? "Published" : "Draft"}
                  </span>
                </div>

                {/* Actions Menu */}
                <div className="absolute  top-3 right-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 bg-purple-900 text-white backdrop-blur-sm"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-gray-900 text-black dark:text-white">
                      <DropdownMenuItem
                      className="cursor-pointer"
                        onClick={() => router.push(`/instructor/courses/${course.slug}/sections`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Course
                      </DropdownMenuItem>
                      <DropdownMenuItem
                       className="cursor-pointer"
                        onClick={() => router.push(`/instructor/courses/${course.slug}/preview`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem  className="cursor-pointer" onClick={() => handleTogglePublish(course)}>
                        <Archive className="mr-2 h-4 w-4" />
                        {course.published ? "Unpublish" : "Publish"}
                      </DropdownMenuItem>
                      {/* <DropdownMenuItem onClick={() => handleDuplicateCourse(course)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem> */}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeletingCourse(course)}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Course
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Content */}
              <div
                className="flex-1 cursor-pointer"
                onClick={() => router.push(`/instructor/courses/${course.slug}/sections`)}
              >
                <CardHeader>
                  <CardTitle className="line-clamp-2 text-xl">{course.title}</CardTitle>
                  {course.shortDescription && (
                    <CardDescription className="line-clamp-2 mt-2">
                      {course.shortDescription}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{course.studentCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{course.durationHours || 0}h</span>
                      </div>
                      <span className="capitalize px-2 py-1 bg-muted rounded text-xs">
                        {course.level}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        {course.discountPrice ? (
                          <>
                            <span className="text-2xl font-bold text-green-600">
                              ${course.discountPrice}
                            </span>
                            <span className="text-muted-foreground line-through text-sm">
                              ${course.price}
                            </span>
                          </>
                        ) : (
                          <span className="text-2xl font-bold">
                            {course.price === 0 ? "Free" : `$${course.price}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}