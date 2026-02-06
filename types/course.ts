// types/course.ts

export interface Lesson {
  id: string;
  title: string;
  slug: string;
  order: number;
  sectionId: string;
  courseId: string;
  createdAt: string;
  updatedAt: string;
  contentId?: string | null;
  content?: string | null;
  durationMinutes?: number | null;
  videoUrl?: string | null;
  videoPlaybackId?: string | null;
  isFree?: boolean | null;
  resources?: any;
}

// ✅ NEW: Quiz interface
export interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  passingScore: number;
  timeLimit?: number | null;
  maxAttempts: number;
  questionCount: number;
  courseId: string;
  sectionId: string;
  createdAt: string;
  updatedAt: string;
}

// ✅ NEW: Assignment interface
export interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions?: string | null;
  maxScore: number;
  dueDate?: string | null;
  courseId: string;
  sectionId: string;
  createdAt: string;
  updatedAt: string;
}

// ✅ UPDATED: Section interface with type and conditional content
export interface Section {
  id: string;
  title: string;
  description?: string | null;
  type: 'lessons' | 'quiz' | 'assignment'; // ✅ NEW: Section type
  order: number;
  position: number;
  courseId: string;
  createdAt: string;
  updatedAt: string;
  
  // ✅ NEW: Conditional content based on type
  lessons?: Lesson[];
  quiz?: Quiz;
  assignment?: Assignment;
  
  // UI state
  expanded?: boolean;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  thumbnail: string | null;
  price: string;
  discountPrice: string | null;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  language: string;
  durationMinutes: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

// ✅ NEW: Resource interface
export interface Resource {
  id: string;
  lessonId: string;
  title: string;
  type: 'file' | 'url' | 'document';
  url: string;
  fileKey?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  description?: string | null;
  order: number;
  isDownloadable: boolean;
  createdAt: string;
  updatedAt: string;
}

// ✅ NEW: Quiz Question interface
export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  questionType: string;
  options: any;
  correctAnswer: any;
  explanation?: string | null;
  points: number;
  order: number;
  createdAt: string;
}