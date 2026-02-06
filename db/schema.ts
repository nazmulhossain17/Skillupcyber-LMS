// db/schema.ts - Complete Schema (Corrected)

import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ========================================
// ENUMS
// ========================================
export const roleEnum = pgEnum('role', ['student', 'instructor', 'admin', 'manager']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'completed', 'cancelled', 'expired']);
export const certificateStatusEnum = pgEnum('certificate_status', ['issued', 'revoked', 'pending']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'failed', 'refunded']);
export const courseLevelEnum = pgEnum('course_level', ['beginner', 'intermediate', 'advanced', 'expert']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['pending', 'submitted', 'graded', 'late']);
export const quizStatusEnum = pgEnum('quiz_status', ['not_started', 'in_progress', 'completed']);
export const resourceTypeEnum = pgEnum('resource_type', ['file', 'url', 'document']);
export const sectionTypeEnum = pgEnum('section_type', ['lessons', 'quiz', 'assignment']);

const uuidV4 = () => sql`gen_random_uuid()`;

// ========================================
// BETTER AUTH TABLES (Required)
// ========================================
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ========================================
// APPLICATION TABLES
// ========================================

// Extended User Profile
export const app_users = pgTable(
  'app_users',
  {
    id: uuid('id').default(uuidV4()).primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    avatar: varchar('avatar', { length: 512 }).default('https://cdn-icons-png.flaticon.com/512/149/149071.png'),
    role: roleEnum('role').default('student').notNull(),
    bio: text('bio'),
    phone: varchar('phone', { length: 50 }),
    country: varchar('country', { length: 100 }),
    timezone: varchar('timezone', { length: 100 }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roleIdx: index('users_role_idx').on(table.role),
    isActiveIdx: index('users_is_active_idx').on(table.isActive),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
    stripeCustomerIdx: index('users_stripe_customer_idx').on(table.stripeCustomerId),
  })
);

// Categories
export const categories = pgTable('categories', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  courseCount: integer('course_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  order: integer('order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('categories_slug_idx').on(table.slug),
  isActiveIdx: index('categories_is_active_idx').on(table.isActive),
}));

// Courses
export const courses = pgTable(
  'courses',
  {
    id: uuid('id').default(uuidV4()).primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description').notNull(),
    shortDescription: varchar('short_description', { length: 500 }),
    thumbnail: varchar('thumbnail', { length: 512 }),
    fileKey: varchar('file_key', { length: 255 }),
    previewVideo: varchar('preview_video', { length: 512 }),
    price: decimal('price', { precision: 10, scale: 2 }).default('0.00').notNull(),
    discountPrice: decimal('discount_price', { precision: 10, scale: 2 }),
    level: courseLevelEnum('level').default('beginner').notNull(),
    durationHours: integer('duration_hours').default(0),
    language: varchar('language', { length: 50 }).default('English'),
    published: boolean('published').default(false).notNull(),
    featured: boolean('featured').default(false).notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    instructorId: uuid('instructor_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
    enrollmentCount: integer('enrollment_count').default(0).notNull(),
    averageRating: decimal('average_rating', { precision: 3, scale: 2 }).default('0.00'),
    reviewCount: integer('review_count').default(0).notNull(),
    completionRate: decimal('completion_rate', { precision: 5, scale: 2 }).default('0.00'),
    requirements: jsonb('requirements'),
    learningOutcomes: jsonb('learning_outcomes'),
    targetAudience: jsonb('target_audience'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('courses_slug_idx').on(table.slug),
    instructorIdx: index('courses_instructor_idx').on(table.instructorId),
    publishedIdx: index('courses_published_idx').on(table.published),
    featuredIdx: index('courses_featured_idx').on(table.featured),
    categoryIdx: index('courses_category_idx').on(table.categoryId),
  })
);

// Sections
export const sections = pgTable('sections', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  type: sectionTypeEnum('type').default('lessons').notNull(),
  order: integer('order').notNull(),
  position: integer('position').notNull(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  courseOrderIdx: index('sections_course_order_idx').on(table.courseId, table.order),
  typeIdx: index('sections_type_idx').on(table.type),
}));

// Lessons - Only for 'lessons' type sections
export const lessons = pgTable('lessons', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  order: integer('order').notNull(),
  sectionId: uuid('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sectionOrderIdx: index('lessons_section_order_idx').on(table.sectionId, table.order),
  courseOrderIdx: index('lessons_course_order_idx').on(table.courseId, table.order),
  slugIdx: index('lessons_slug_idx').on(table.slug),
}));

// Lesson Content
export const lessonContent = pgTable('lesson_content', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }).unique(),
  durationMinutes: integer('duration_minutes').default(0),
  videoUrl: varchar('video_url', { length: 512 }),
  videoPlaybackId: varchar('video_playback_id', { length: 255 }),
  content: text('content'),
  isFree: boolean('is_free').default(false).notNull(),
  resources: jsonb('resources'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  lessonIdx: uniqueIndex('lesson_content_lesson_idx').on(table.lessonId),
}));

// Resources
export const resources = pgTable('resources', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  type: resourceTypeEnum('type').notNull(),
  url: varchar('url', { length: 512 }).notNull(),
  fileKey: varchar('file_key', { length: 512 }),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  description: text('description'),
  order: integer('order').default(0).notNull(),
  isDownloadable: boolean('is_downloadable').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  lessonIdx: index('resources_lesson_idx').on(table.lessonId),
  orderIdx: index('resources_order_idx').on(table.lessonId, table.order),
}));

// ========================================
// PAYMENT & ENROLLMENT
// ========================================

// Payments
export const payments = pgTable('payments', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }).notNull().unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('usd'),
  status: paymentStatusEnum('status').default('pending').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('payments_user_idx').on(table.appUserId),
  courseIdx: index('payments_course_idx').on(table.courseId),
  statusIdx: index('payments_status_idx').on(table.status),
  stripeIntentIdx: uniqueIndex('payments_stripe_intent_idx').on(table.stripePaymentIntentId),
}));

// Enrollments
export const enrollments = pgTable('enrollments', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  status: enrollmentStatusEnum('status').default('active').notNull(),
  progressPercent: integer('progress_percent').default(0).notNull(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  userCourseUnique: uniqueIndex('enrollments_user_course_idx').on(table.appUserId, table.courseId),
  paymentIdx: index('enrollments_payment_idx').on(table.paymentId),
  statusIdx: index('enrollments_status_idx').on(table.status),
}));

// ========================================
// PROGRESS & LEARNING
// ========================================

// Lesson Progress
export const lessonProgress = pgTable('lesson_progress', {
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  completed: boolean('completed').default(false).notNull(),
  watchedSeconds: integer('watched_seconds').default(0),
  lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.appUserId, table.lessonId] }),
}));

// Quizzes - One per section (1-to-1)
export const quizzes = pgTable('quizzes', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  sectionId: uuid('section_id').notNull().unique().references(() => sections.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  passingScore: integer('passing_score').default(70).notNull(),
  timeLimit: integer('time_limit'),
  maxAttempts: integer('max_attempts').default(3),
  questionCount: integer('question_count').default(0),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sectionIdx: uniqueIndex('quizzes_section_idx').on(table.sectionId),
  courseIdx: index('quizzes_course_idx').on(table.courseId),
}));

// Quiz Questions
export const quizQuestions = pgTable('quiz_questions', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  quizId: uuid('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  questionType: varchar('question_type', { length: 50 }).default('multiple_choice'),
  options: jsonb('options').notNull(),
  correctAnswer: jsonb('correct_answer').notNull(),
  explanation: text('explanation'),
  points: integer('points').default(1).notNull(),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  quizIdx: index('quiz_questions_quiz_idx').on(table.quizId),
  orderIdx: index('quiz_questions_order_idx').on(table.quizId, table.order),
}));

// Quiz Attempts
export const quizAttempts = pgTable('quiz_attempts', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  quizId: uuid('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  score: integer('score'),
  totalPoints: integer('total_points'),
  passed: boolean('passed').default(false),
  answers: jsonb('answers'),
  status: quizStatusEnum('status').default('not_started').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  userQuizIdx: index('quiz_attempts_user_quiz_idx').on(table.appUserId, table.quizId),
}));

// Assignments - One per section (1-to-1)
export const assignments = pgTable('assignments', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  sectionId: uuid('section_id').notNull().unique().references(() => sections.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  instructions: text('instructions'),
  maxScore: integer('max_score').default(100).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sectionIdx: uniqueIndex('assignments_section_idx').on(table.sectionId),
  courseIdx: index('assignments_course_idx').on(table.courseId),
}));

// ✅ CORRECTED: Assignment Submissions
// References assignments.id (not sections.id)
// Uses attachments (JSONB) for multiple files
// Uses score (not grade) to match assignments.maxScore
export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  
  // References
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => assignments.id, { onDelete: 'cascade' }),
  appUserId: uuid('app_user_id')
    .notNull()
    .references(() => app_users.id, { onDelete: 'cascade' }),
  
  // Submission content
  content: text('content'),
  attachments: jsonb('attachments'), // Array of { url, fileName, fileSize?, fileType?, key? }
  
  // Status: 'pending', 'submitted', 'graded', 'late'
  status: assignmentStatusEnum('status').default('pending').notNull(),
  
  // Grading
  score: integer('score'), // Matches assignments.maxScore
  feedback: text('feedback'),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  gradedBy: uuid('graded_by').references(() => app_users.id, { onDelete: 'set null' }),
  
  // Timestamps
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Unique: one submission per student per assignment
  userAssignmentUnique: uniqueIndex('assignment_submissions_user_assignment_idx')
    .on(table.appUserId, table.assignmentId),
  assignmentIdx: index('assignment_submissions_assignment_idx').on(table.assignmentId),
  statusIdx: index('assignment_submissions_status_idx').on(table.status),
  submittedAtIdx: index('assignment_submissions_submitted_at_idx').on(table.submittedAt),
}));

// ========================================
// CERTIFICATES
// ========================================

export const certificates = pgTable('certificates', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  certificateId: varchar('certificate_id', { length: 50 }).notNull().unique(),
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow(),
  pdfUrl: varchar('pdf_url', { length: 512 }),
  qrCodeUrl: varchar('qr_code_url', { length: 512 }),
  verificationUrl: varchar('verification_url', { length: 512 }),
  status: certificateStatusEnum('status').default('issued').notNull(),
  metadata: jsonb('metadata'),
}, (table) => ({
  certIdIdx: uniqueIndex('certificates_cert_id_idx').on(table.certificateId),
  userCourseIdx: uniqueIndex('certificates_user_course_idx').on(table.appUserId, table.courseId),
}));

// ========================================
// REVIEWS & RATINGS
// ========================================

export const reviews = pgTable('reviews', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userCourseUnique: uniqueIndex('reviews_user_course_idx').on(table.appUserId, table.courseId),
  courseIdx: index('reviews_course_idx').on(table.courseId),
  ratingIdx: index('reviews_rating_idx').on(table.rating),
}));

// ========================================
// NOTIFICATIONS
// ========================================

export const notifications = pgTable('notifications', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  link: varchar('link', { length: 512 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.appUserId),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

// ========================================
// ANALYTICS & TRACKING
// ========================================

export const courseAnalytics = pgTable('course_analytics', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  views: integer('views').default(0),
  enrollments: integer('enrollments').default(0),
  completions: integer('completions').default(0),
  revenue: decimal('revenue', { precision: 10, scale: 2 }).default('0.00'),
  avgWatchTime: integer('avg_watch_time').default(0),
}, (table) => ({
  courseDateIdx: uniqueIndex('course_analytics_course_date_idx').on(table.courseId, table.date),
}));

export const userActivityLog = pgTable('user_activity_log', {
  id: uuid('id').default(uuidV4()).primaryKey(),
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: varchar('resource_id', { length: 255 }),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('user_activity_log_user_idx').on(table.appUserId),
  actionIdx: index('user_activity_log_action_idx').on(table.action),
  createdAtIdx: index('user_activity_log_created_at_idx').on(table.createdAt),
}));

// ========================================
// WISHLISTS
// ========================================

export const wishlists = pgTable('wishlists', {
  appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.appUserId, table.courseId] }),
}));

// ========================================
// DISCUSSIONS
// ========================================

export const discussions = pgTable(
  'discussions',
  {
    id: uuid('id').default(uuidV4()).primaryKey(),
    appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    isResolved: boolean('is_resolved').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    courseIdx: index('discussions_course_idx').on(table.courseId),
    lessonIdx: index('discussions_lesson_idx').on(table.lessonId),
    userIdx: index('discussions_user_idx').on(table.appUserId),
    isPinnedIdx: index('discussions_is_pinned_idx').on(table.isPinned),
    isResolvedIdx: index('discussions_is_resolved_idx').on(table.isResolved),
  })
);

export const discussionReplies = pgTable(
  'discussion_replies',
  {
    id: uuid('id').default(uuidV4()).primaryKey(),
    discussionId: uuid('discussion_id').notNull().references(() => discussions.id, { onDelete: 'cascade' }),
    appUserId: uuid('app_user_id').notNull().references(() => app_users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isInstructorReply: boolean('is_instructor_reply').default(false).notNull(),
    isBestAnswer: boolean('is_best_answer').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    discussionIdx: index('discussion_replies_discussion_idx').on(table.discussionId),
    userIdx: index('discussion_replies_user_idx').on(table.appUserId),
    isBestAnswerIdx: index('discussion_replies_is_best_answer_idx').on(table.isBestAnswer),
  })
);

// ========================================
// MEDIA FILES
// ========================================

export const media_files = pgTable('media_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  secureId: varchar('secure_id', { length: 64 }).notNull().unique(),
  s3Key: text('s3_key').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }),
  uploadedBy: uuid('uploaded_by').notNull().references(() => app_users.id),
  courseId: uuid('course_id').references(() => courses.id),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================
// Certificate Templates (Created by Instructors)
// ============================================
export const certificateTemplates = pgTable('certificate_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  
  // Template settings
  title: varchar('title', { length: 255 }).notNull().default('Certificate of Completion'),
  subtitle: varchar('subtitle', { length: 255 }).default('This is to certify that'),
  description: text('description').default('has successfully completed the course'),
  
  // Instructor signature
  signatureText: varchar('signature_text', { length: 255 }), // e.g., "John Doe, Lead Instructor"
  signatureImage: text('signature_image'), // URL to signature image
  
  // Branding
  logoUrl: text('logo_url'), // Custom logo
  backgroundUrl: text('background_url'), // Custom background image
  primaryColor: varchar('primary_color', { length: 20 }).default('#4f0099'),
  secondaryColor: varchar('secondary_color', { length: 20 }).default('#22ad5c'),
  
  // Layout options stored as JSON
  // { layout: 'classic' | 'modern' | 'minimal', orientation: 'landscape' | 'portrait', ... }
  settings: jsonb('settings').default({
    layout: 'classic',
    orientation: 'landscape',
    showDate: true,
    showCourseHours: true,
    showInstructorName: true,
    showCredentialId: true,
    borderStyle: 'elegant',
  }),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  courseIdx: index('certificate_templates_course_idx').on(table.courseId),
  // One template per course
  uniqueCourse: uniqueIndex('certificate_templates_course_unique').on(table.courseId),
}));

// ============================================
// Issued Certificates (Given to Students)
// ============================================
export const issuedCertificates = pgTable('issued_certificates', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Unique credential ID for verification (e.g., "CERT-2024-XXXXXX")
  credentialId: varchar('credential_id', { length: 50 }).notNull().unique(),
  
  // References
  templateId: uuid('template_id')
    .notNull()
    .references(() => certificateTemplates.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id')
    .notNull()
    .references(() => app_users.id, { onDelete: 'cascade' }),
  
  // Snapshot of data at time of issue (in case course/user data changes later)
  studentName: varchar('student_name', { length: 255 }).notNull(),
  courseName: varchar('course_name', { length: 255 }).notNull(),
  instructorName: varchar('instructor_name', { length: 255 }),
  courseHours: integer('course_hours'),
  
  // Issue details
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional expiration
  
  // Status
  isRevoked: boolean('is_revoked').default(false).notNull(),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
  
  // Download tracking
  downloadCount: integer('download_count').default(0).notNull(),
  lastDownloadedAt: timestamp('last_downloaded_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  credentialIdx: uniqueIndex('issued_certificates_credential_idx').on(table.credentialId),
  studentIdx: index('issued_certificates_student_idx').on(table.studentId),
  courseIdx: index('issued_certificates_course_idx').on(table.courseId),
  templateIdx: index('issued_certificates_template_idx').on(table.templateId),
  // One certificate per student per course
  uniqueStudentCourse: uniqueIndex('issued_certificates_student_course_unique')
    .on(table.studentId, table.courseId),
}));

// ============================================
// Relations
// ============================================
export const certificateTemplateRelations = relations(certificateTemplates, ({ one, many }) => ({
  course: one(courses, {
    fields: [certificateTemplates.courseId],
    references: [courses.id],
  }),
  issuedCertificates: many(issuedCertificates),
}));

export const issuedCertificateRelations = relations(issuedCertificates, ({ one }) => ({
  template: one(certificateTemplates, {
    fields: [issuedCertificates.templateId],
    references: [certificateTemplates.id],
  }),
  course: one(courses, {
    fields: [issuedCertificates.courseId],
    references: [courses.id],
  }),
  student: one(app_users, {
    fields: [issuedCertificates.studentId],
    references: [app_users.id],
  }),
}));


// ============================================
// TypeScript Types
// ============================================
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;
export type NewCertificateTemplate = typeof certificateTemplates.$inferInsert;
export type IssuedCertificate = typeof issuedCertificates.$inferSelect;
export type NewIssuedCertificate = typeof issuedCertificates.$inferInsert;

export interface CertificateSettings {
  layout: 'classic' | 'modern' | 'minimal' | 'elegant';
  orientation: 'landscape' | 'portrait';
  showDate: boolean;
  showCourseHours: boolean;
  showInstructorName: boolean;
  showCredentialId: boolean;
  borderStyle: 'none' | 'simple' | 'elegant' | 'ornate';
  fontFamily?: string;
}


// ========================================
// TYPE EXPORTS
// ========================================

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type AppUser = typeof app_users.$inferSelect;
export type NewAppUser = typeof app_users.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

export type LessonContent = typeof lessonContent.$inferSelect;
export type NewLessonContent = typeof lessonContent.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;

export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type NewAssignmentSubmission = typeof assignmentSubmissions.$inferInsert;

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

export type MediaFile = typeof media_files.$inferSelect;
export type NewMediaFile = typeof media_files.$inferInsert;

// ========================================
// ATTACHMENT TYPE (for assignmentSubmissions.attachments)
// ========================================
export interface AssignmentAttachment {
  url: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  key?: string; // S3 key for deletion
}

// ========================================
// SCHEMA EXPORT
// ========================================

export const schema = {
  // Better Auth tables
  user,
  session,
  account,
  verification,
  
  // Application tables
  app_users,
  categories,
  courses,
  sections,
  lessons,
  lessonContent,
  resources,
  
  // Payment & Enrollment
  payments,
  enrollments,
  
  // Progress & Learning
  lessonProgress,
  quizzes,
  quizQuestions,
  quizAttempts,
  assignments,
  assignmentSubmissions,
  
  // Certificates
  certificates,
  
  // Reviews
  reviews,
  
  // Notifications
  notifications,
  
  // Analytics
  courseAnalytics,
  userActivityLog,
  
  // Wishlists
  wishlists,
  
  // Discussions
  discussions,
  discussionReplies,
  
  // Media
  media_files,
};