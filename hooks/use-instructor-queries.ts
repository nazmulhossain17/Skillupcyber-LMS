// hooks/use-instructor-queries.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/utils/api/instructor';
import type { Lesson, Section } from '@/types/course';

// ============================================
// QUERY KEYS - Centralized for consistency
// ============================================

export const queryKeys = {
  instructorCourses: ['instructor', 'courses'] as const,
  courseDetails: (slug: string) => ['course', slug] as const,
  courseSections: (slug: string) => ['course', slug, 'sections'] as const,
  sectionLessons: (slug: string, sectionId: string) =>
    ['course', slug, 'section', sectionId, 'lessons'] as const,
  lessonContent: (slug: string, lessonId: string) =>
    ['course', slug, 'lesson', lessonId] as const,
  lessonResources: (slug: string, lessonId: string) =>
    ['course', slug, 'lesson', lessonId, 'resources'] as const,
  quiz: (slug: string, sectionId: string, quizId: string) =>
    ['course', slug, 'section', sectionId, 'quiz', quizId] as const,
  assignment: (slug: string, sectionId: string, assignmentId: string) =>
    ['course', slug, 'section', sectionId, 'assignment', assignmentId] as const,
  coursePreview: (slug: string) => ['course', slug, 'preview'] as const,
};

// ============================================
// COURSES
// ============================================

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

export function useInstructorCourses() {
  return useQuery<Course[]>({
    queryKey: queryKeys.instructorCourses,
    queryFn: api.fetchInstructorCourses,
  });
}

export function useCourseDetails(slug: string) {
  return useQuery({
    queryKey: queryKeys.courseDetails(slug),
    queryFn: () => api.fetchCourseDetails(slug),
    enabled: !!slug,
  });
}

export function useUpdateCourse(slug: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: any) => api.updateCourse(slug, updates),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.courseDetails(slug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses });
      toast.success('Course updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update course');
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (slug: string) => api.deleteCourse(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCourses });
      toast.success('Course deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete course');
    },
  });
}

// ============================================
// SECTIONS
// ============================================

export function useCourseSections(slug: string) {
  return useQuery<Section[]>({
    queryKey: queryKeys.courseSections(slug),
    queryFn: () => api.fetchCourseSections(slug),
    enabled: !!slug,
  });
}

export function useCreateSection(slug: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sectionData: any) => api.createSection(slug, sectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courseSections(slug) });
    },
  });
}

export function useUpdateSection(slug: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sectionId, updates }: { sectionId: string; updates: any }) =>
      api.updateSection(slug, sectionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courseSections(slug) });
    },
  });
}

export function useDeleteSection(slug: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sectionId: string) => api.deleteSection(slug, sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courseSections(slug) });
    },
  });
}

// ============================================
// LESSONS
// ============================================

export function useSectionLessons(slug: string, sectionId: string, options?: { enabled?: boolean }) {
  return useQuery<Lesson[]>({
    queryKey: queryKeys.sectionLessons(slug, sectionId),
    queryFn: () => api.fetchSectionLessons(slug, sectionId),
    enabled: options?.enabled !== false && !!slug && !!sectionId,
  });
}

export function useCreateLesson(slug: string, sectionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (lessonData: any) => api.createLesson(slug, sectionId, lessonData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionLessons(slug, sectionId) });
      toast.success('Lesson created!');
    },
    onError: () => {
      toast.error('Failed to create lesson');
    },
  });
}

export function useUpdateLesson(slug: string, sectionId: string, lessonId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: any) => api.updateLesson(slug, sectionId, lessonId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionLessons(slug, sectionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lessonContent(slug, lessonId) });
      toast.success('Lesson updated!');
    },
    onError: () => {
      toast.error('Failed to update lesson');
    },
  });
}

export function useDeleteLesson(slug: string, sectionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (lessonId: string) => api.deleteLesson(slug, sectionId, lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionLessons(slug, sectionId) });
      toast.success('Lesson deleted!');
    },
    onError: () => {
      toast.error('Failed to delete lesson');
    },
  });
}

export function useLessonContent(slug: string, lessonId: string) {
  return useQuery({
    queryKey: queryKeys.lessonContent(slug, lessonId),
    queryFn: () => api.fetchLessonContent(slug, lessonId),
    enabled: !!slug && !!lessonId,
  });
}

export function useUpdateLessonContent(slug: string, lessonId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (content: any) => api.updateLessonContent(slug, lessonId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lessonContent(slug, lessonId) });
      toast.success('Lesson updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update lesson');
    },
  });
}

// ============================================
// RESOURCES
// ============================================

export function useLessonResources(slug: string, lessonId: string) {
  return useQuery({
    queryKey: queryKeys.lessonResources(slug, lessonId),
    queryFn: () => api.fetchLessonResources(slug, lessonId),
    enabled: !!slug && !!lessonId,
  });
}

export function useCreateResource(slug: string, lessonId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (resourceData: any) => api.createResource(slug, lessonId, resourceData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lessonResources(slug, lessonId) });
      toast.success('Resource added!');
    },
    onError: () => {
      toast.error('Failed to add resource');
    },
  });
}

export function useDeleteResource(slug: string, lessonId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (resourceId: string) => api.deleteResource(slug, lessonId, resourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lessonResources(slug, lessonId) });
      toast.success('Resource deleted!');
    },
    onError: () => {
      toast.error('Failed to delete resource');
    },
  });
}

// ============================================
// QUIZZES
// ============================================

export function useQuiz(slug: string, sectionId: string, quizId: string) {
  return useQuery({
    queryKey: queryKeys.quiz(slug, sectionId, quizId),
    queryFn: () => api.fetchQuiz(slug, sectionId, quizId),
    enabled: !!slug && !!sectionId && !!quizId && quizId !== 'new',
  });
}

export function useCreateQuiz(slug: string, sectionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (quizData: any) => api.createQuiz(slug, sectionId, quizData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courseSections(slug) });
    },
  });
}

export function useUpdateQuiz(slug: string, sectionId: string, quizId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: any) => api.updateQuiz(slug, sectionId, quizId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz(slug, sectionId, quizId) });
    },
  });
}

// ============================================
// ASSIGNMENTS
// ============================================

export function useAssignment(slug: string, sectionId: string, assignmentId: string) {
  return useQuery({
    queryKey: queryKeys.assignment(slug, sectionId, assignmentId),
    queryFn: () => api.fetchAssignment(slug, sectionId, assignmentId),
    enabled: !!slug && !!sectionId && !!assignmentId && assignmentId !== 'new',
  });
}

export function useCreateAssignment(slug: string, sectionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assignmentData: any) =>
      api.createAssignment(slug, sectionId, assignmentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courseSections(slug) });
      toast.success('Assignment created successfully!');
    },
    onError: () => {
      toast.error('Failed to create assignment');
    },
  });
}

export function useUpdateAssignment(slug: string, sectionId: string, assignmentId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: any) =>
      api.updateAssignment(slug, sectionId, assignmentId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignment(slug, sectionId, assignmentId),
      });
      toast.success('Assignment updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update assignment');
    },
  });
}

// ============================================
// COURSE PREVIEW
// ============================================

export function useCoursePreview(slug: string) {
  return useQuery({
    queryKey: queryKeys.coursePreview(slug),
    queryFn: () => api.fetchCoursePreview(slug),
    enabled: !!slug,
  });
}