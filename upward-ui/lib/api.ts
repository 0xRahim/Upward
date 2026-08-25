import type {
  AdminEnrollment,
  AuthTokens,
  Bundle,
  BundleEnrollmentResult,
  Category,
  Certificate,
  Course,
  CourseProgress,
  Enrollment,
  LessonContent,
  LoginResponse,
  Paginated,
  Review,
  SearchResults,
  Suggestion,
  User,
} from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/v1";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: { field: string; issue: string }[];

  constructor(status: number, code?: string, message?: string, details?: { field: string; issue: string }[]) {
    super(message ?? code ?? `Request failed with status ${status}`);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Tokens = { accessToken: string; refreshToken: string };

let tokenProvider: (() => Tokens | null) | null = null;
let tokenSetter: ((tokens: Tokens | null) => void) | null = null;

export function configureAuthHooks(
  provider: () => Tokens | null,
  setter: (tokens: Tokens | null) => void
) {
  tokenProvider = provider;
  tokenSetter = setter;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!tokenProvider || !tokenSetter) return false;
  const current = tokenProvider();
  if (!current?.refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as AuthTokens;
        tokenSetter!({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  retry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, retry = true } = options;

  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const tokens = tokenProvider?.();
  if (tokens?.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Is the API running?");
  }

  if (res.status === 401 && retry && tokens?.refreshToken && !path.startsWith("/auth/")) {
    const refreshed = await refreshTokens();
    if (refreshed) return request<T>(path, { ...options, retry: false });
  }

  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: { field: string; issue: string }[] } })
      ?.error;
    throw new ApiError(res.status, err?.code, err?.message, err?.details);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "DELETE", query }),
};

export type CourseListParams = {
  page?: number;
  perPage?: number;
  category?: string;
  level?: string;
  sort?: string;
  search?: string;
};

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    api.post<User>("/auth/register", body),
  login: (body: { email: string; password: string }) => api.post<LoginResponse>("/auth/login", body),
  logout: (refreshToken: string) => api.post<void>("/auth/logout", { refreshToken }),
};

export const usersApi = {
  me: () => api.get<User>("/users/me"),
  updateMe: (body: { name?: string; avatarUrl?: string | null }) => api.patch<User>("/users/me", body),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>("/users/me/change-password", body),
  list: (query: { page?: number; perPage?: number; role?: string; search?: string }) =>
    api.get<Paginated<User>>("/users", query),
  update: (userId: string, body: { role?: string; isActive?: boolean }) =>
    api.patch<User>(`/users/${userId}`, body),
  remove: (userId: string) => api.delete<void>(`/users/${userId}`),
};

export interface CourseInput {
  title?: string;
  description?: string;
  categoryId?: string;
  level?: "beginner" | "intermediate" | "advanced";
  coverImageUrl?: string;
  isPublished?: boolean;
}

export const coursesApi = {
  list: (query: CourseListParams) => api.get<Paginated<Course>>("/courses", query),
  get: (idOrSlug: string) => api.get<Course>(`/courses/${idOrSlug}`),
  create: (body: CourseInput & { title: string; description: string; categoryId: string }) =>
    api.post<Course>("/courses", body),
  update: (courseId: string, body: CourseInput) => api.patch<Course>(`/courses/${courseId}`, body),
  remove: (courseId: string, force?: boolean) =>
    api.delete<void>(`/courses/${courseId}`, { force: force ? true : undefined }),
};

export const modulesApi = {
  create: (courseId: string, body: { title: string; position?: number }) =>
    api.post<import("@/lib/types").Module>(`/courses/${courseId}/modules`, body),
  update: (moduleId: string, body: { title?: string; position?: number }) =>
    api.patch<import("@/lib/types").Module>(`/modules/${moduleId}`, body),
  remove: (moduleId: string) => api.delete<void>(`/modules/${moduleId}`),
};

export interface LessonInput {
  title: string;
  type: string;
  contentUrl?: string | null;
  content?: string | null;
  durationMinutes?: number | null;
  position?: number;
  isPreviewable?: boolean;
}

export const lessonsApi = {
  create: (moduleId: string, body: LessonInput) =>
    api.post<LessonContent>(`/modules/${moduleId}/lessons`, body),
  update: (lessonId: string, body: Partial<LessonInput>) => api.patch<LessonContent>(`/lessons/${lessonId}`, body),
  remove: (lessonId: string) => api.delete<void>(`/lessons/${lessonId}`),
  content: (lessonId: string) => api.get<LessonContent>(`/lessons/${lessonId}/content`),
};

export const bundlesApi = {
  list: (query: { page?: number; perPage?: number; search?: string }) =>
    api.get<Paginated<Bundle>>("/bundles", query),
  get: (idOrSlug: string) => api.get<Bundle>(`/bundles/${idOrSlug}`),
  create: (body: { title: string; description: string; courseIds: string[]; coverImageUrl?: string | null; isPublished?: boolean }) =>
    api.post<Bundle>("/bundles", body),
  update: (bundleId: string, body: Partial<{ title: string; description: string; courseIds: string[]; coverImageUrl?: string | null; isPublished?: boolean }>) =>
    api.patch<Bundle>(`/bundles/${bundleId}`, body),
  remove: (bundleId: string) => api.delete<void>(`/bundles/${bundleId}`),
};

export const categoriesApi = {
  list: () => api.get<{ data: Category[] }>("/categories"),
  create: (name: string) => api.post<Category>("/categories", { name }),
  update: (categoryId: string, name: string) => api.patch<Category>(`/categories/${categoryId}`, { name }),
  remove: (categoryId: string) => api.delete<void>(`/categories/${categoryId}`),
};

export const enrollmentsApi = {
  enrollCourse: (courseId: string) =>
    api.post<Enrollment>("/enrollments", { courseId }),
  enrollBundle: (bundleId: string) =>
    api.post<BundleEnrollmentResult>("/enrollments", { bundleId }),
  mine: (query: { status?: string; type?: string; page?: number; perPage?: number }) =>
    api.get<Paginated<Enrollment & { course: Course }>>("/enrollments/me", query),
  cancel: (enrollmentId: string) => api.delete<void>(`/enrollments/${enrollmentId}`),
  adminList: (query: { userId?: string; courseId?: string; status?: string; page?: number; perPage?: number }) =>
    api.get<Paginated<AdminEnrollment>>("/admin/enrollments", query),
};

export const progressApi = {
  completeLesson: (lessonId: string) =>
    api.post<{ lessonId: string; completedAt: string; courseProgressPercent: number }>(
      `/progress/lessons/${lessonId}/complete`
    ),
  incompleteLesson: (lessonId: string) =>
    api.delete<CourseProgress>(`/progress/lessons/${lessonId}/complete`),
  get: (courseId: string) => api.get<CourseProgress>(`/progress/courses/${courseId}`),
  certificate: (courseId: string) =>
    api.post<Certificate>(`/progress/courses/${courseId}/certificate`),
};

export const reviewsApi = {
  list: (courseId: string, query?: { page?: number; perPage?: number; sort?: string }) =>
    api.get<Paginated<Review>>(`/courses/${courseId}/reviews`, query),
  create: (courseId: string, body: { rating: number; comment?: string }) =>
    api.post<Review>(`/courses/${courseId}/reviews`, body),
  update: (reviewId: string, body: { rating: number; comment?: string }) =>
    api.patch<Review>(`/reviews/${reviewId}`, body),
  remove: (reviewId: string) => api.delete<void>(`/reviews/${reviewId}`),
  helpful: (reviewId: string) =>
    api.post<{ helpfulVotes: number; votedByMe: boolean }>(`/reviews/${reviewId}/helpful`),
};

export const searchApi = {
  global: (q: string, opts?: { type?: string; limit?: number; offset?: number }) =>
    api.get<SearchResults>("/search", { q, ...opts }),
  suggest: (q: string, limit?: number) =>
    api.get<{ suggestions: Suggestion[] }>("/search/suggest", { q, limit }),
};
