export type Role = "user" | "admin";
export type Level = "beginner" | "intermediate" | "advanced";
export type LessonType = "video" | "text" | "quiz";
export type EnrollmentStatus = "active" | "completed";

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  isActive?: boolean;
  createdAt?: string;
  stats?: {
    enrolledCourses: number;
    completedCourses: number;
    activeBundles: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface LoginResponse extends AuthTokens {
  user: Pick<User, "id" | "name" | "email" | "role">;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  courseCount?: number;
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  level?: Level | null;
  language?: string;
  durationMinutes?: number;
  lessonCount?: number;
  rating?: number;
  reviewCount?: number;
  studentCount?: number;
  isPublished?: boolean;
  category?: Category | null;
  createdAt?: string;
  modules?: Module[];
}

export interface Lesson {
  id: string;
  title: string;
  durationMinutes?: number | null;
  isPreviewable?: boolean;
  type?: LessonType;
  position?: number;
}

export interface Module {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

export interface LessonContent extends Lesson {
  moduleId: string;
  courseId: string;
  contentUrl?: string | null;
  content?: string | null;
  completed: boolean;
}

export interface Bundle {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  courseCount?: number;
  courses?: CourseSummary[];
  isPublished?: boolean;
  createdAt?: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  bundleId?: string | null;
  status: EnrollmentStatus;
  progressPercent: number;
  enrolledAt: string;
  completedAt?: string | null;
  expiresAt?: string | null;
  course?: CourseSummary & { coverImageUrl?: string | null };
  user?: Pick<User, "id" | "name" | "email">;
}

export interface BundleEnrollmentResult {
  bundleId: string;
  bundleSlug: string;
  status: EnrollmentStatus;
  enrollments: Enrollment[];
}

export type AdminEnrollment = Enrollment;

export interface CourseProgress {
  courseId: string;
  progressPercent: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  lastAccessedLessonId?: string | null;
  completedLessons: string[];
  startedAt: string;
  completedAt?: string | null;
}

export interface Certificate {
  certificateId: string;
  certificateUrl: string;
  issuedAt: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment?: string | null;
  helpfulVotes: number;
  votedByMe?: boolean;
  createdAt: string;
}

export interface SearchCourseHit {
  id: string;
  slug: string;
  title: string;
  highlightedTitle: string;
  snippet: string;
  rating: number;
}

export interface SearchBundleHit {
  id: string;
  slug: string;
  title: string;
  highlightedTitle: string;
  snippet: string;
  courseCount?: number;
}

export interface SearchResults {
  query: string;
  results: { courses: SearchCourseHit[]; bundles: SearchBundleHit[] };
  total: { courses: number; bundles: number };
}

export interface Suggestion {
  type: "course" | "bundle" | "category";
  label: string;
  slug: string;
}
