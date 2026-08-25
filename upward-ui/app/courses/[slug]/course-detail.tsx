"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { coursesApi, enrollmentsApi, progressApi, ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { CourseProgress, Course } from "@/lib/types";
import { CoverImage } from "@/components/course-card";
import { ReviewsSection } from "./reviews-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDuration, formatNumber, levelLabel } from "@/lib/format";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  LockIcon,
  PlayCircleIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";

const levelStyles: Record<string, string> = {
  beginner: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  advanced: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function CourseDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [course, setCourse] = React.useState<Course | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<CourseProgress | null>(null);
  const [enrolled, setEnrolled] = React.useState(false);
  const [enrollLoading, setEnrollLoading] = React.useState(false);

  const loadCourse = React.useCallback(async () => {
    try {
      const c = await coursesApi.get(slug);
      setCourse(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load course");
    }
  }, [slug]);

  React.useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  // Check enrollment/progress when authed
  React.useEffect(() => {
    if (!user || !course) return;
    let active = true;
    progressApi
      .get(course.id)
      .then((p) => {
        if (!active) return;
        setProgress(p);
        setEnrolled(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, course]);

  const handleEnroll = async () => {
    if (!course) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setEnrollLoading(true);
    try {
      await enrollmentsApi.enrollCourse(course.id);
      setEnrolled(true);
      const p = await progressApi.get(course.id).catch(() => null);
      if (p) setProgress(p);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === "ALREADY_ENROLLED") {
        setEnrolled(true);
        progressApi
          .get(course.id)
          .then(setProgress)
          .catch(() => {});
      } else {
        import("sonner").then(({ toast }) =>
          toast.error(apiErr.message ?? "Could not enroll in this course")
        );
      }
    } finally {
      setEnrollLoading(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4" render={<Link href="/courses" />}>
          Back to courses
        </Button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Skeleton className="aspect-[21/9] w-full rounded-xl" />
        <Skeleton className="mt-6 h-9 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      </div>
    );
  }

  const totalLessons = course.modules?.reduce((acc, m) => acc + m.lessons.length, 0) ?? course.lessonCount ?? 0;

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="from-background to-muted/50 border-b bg-gradient-to-b">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col justify-center gap-4">
            {course.category && (
              <Link href={`/courses?category=${course.category.slug}`} className="w-fit">
                <Badge variant="secondary" className="hover:bg-secondary/80">
                  {course.category.name}
                </Badge>
              </Link>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{course.title}</h1>
            <p className="text-muted-foreground max-w-2xl text-lg">{course.description}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {course.rating !== undefined && course.rating > 0 && (
                <span className="flex items-center gap-1 font-medium">
                  <StarIcon className="size-4 fill-amber-400 text-amber-400" />
                  {course.rating.toFixed(1)}
                  {course.reviewCount ? (
                    <span className="text-muted-foreground font-normal">
                      ({formatNumber(course.reviewCount)} reviews)
                    </span>
                  ) : null}
                </span>
              )}
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UsersIcon className="size-4" />
                {formatNumber(course.studentCount)} students
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5">
                <PlayCircleIcon className="size-4" />
                {totalLessons} lessons
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ClockIcon className="size-4" />
                {formatDuration(course.durationMinutes)}
              </span>
              {course.language && (
                <span className="text-muted-foreground flex items-center gap-1.5 capitalize">
                  <GlobeIcon className="size-4" />
                  {course.language}
                </span>
              )}
              {course.level && (
                <Badge variant="outline" className={cn(levelStyles[course.level])}>
                  {levelLabel(course.level)}
                </Badge>
              )}
            </div>

            {enrolled && progress && (
              <div className="mt-2 max-w-md">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">Your progress</span>
                  <span className="text-muted-foreground">
                    {progress.lessonsCompleted}/{progress.lessonsTotal} lessons ·{" "}
                    {progress.progressPercent}%
                  </span>
                </div>
                <Progress value={progress.progressPercent} />
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-3">
              {enrolled ? (
                <Button size="lg" render={<Link href={`/learn/${course.id}`} />}>
                  {progress && progress.progressPercent > 0 ? "Continue learning" : "Start learning"}
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              ) : (
                <Button size="lg" onClick={handleEnroll} disabled={enrollLoading}>
                  {enrollLoading ? "Enrolling…" : user ? "Enroll for free" : "Log in to enroll"}
                </Button>
              )}
            </div>
          </div>
          <CoverImage
            title={course.title}
            url={course.coverImageUrl}
            className="aspect-video w-full self-start rounded-xl border shadow-lg"
          />
        </div>
      </section>

      {/* Curriculum */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Curriculum</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {course.modules?.length ?? 0} modules · {totalLessons} lessons. Previewable lessons are open to everyone.
        </p>

        {!enrolled && !user && (
          <p className="text-muted-foreground mt-4 text-sm">
            <LockIcon className="mr-1 inline size-4 align-[-2px]" />
            Enroll for free to unlock all lessons.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {(course.modules ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">This course has no modules published yet.</p>
          )}
          {(course.modules ?? []).map((module, mi) => (
            <details key={module.id} className="bg-card rounded-lg border [&[open]_.chev]:rotate-90" open={mi === 0}>
              <summary className="flex cursor-pointer items-center gap-3 p-4 select-none [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="chev size-4 transition-transform" />
                <span className="font-medium">{module.title}</span>
                <span className="text-muted-foreground ml-auto text-sm">
                  {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                </span>
              </summary>
              <ul className="border-t">
                {module.lessons.map((lesson) => {
                  const canView = enrolled || lesson.isPreviewable;
                  const completed = progress?.completedLessons.includes(lesson.id) ?? false;
                  const inner = (
                    <>
                      {completed ? (
                        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                      ) : canView ? (
                        <PlayCircleIcon className="text-muted-foreground size-4 shrink-0" />
                      ) : (
                        <LockIcon className="text-muted-foreground size-4 shrink-0" />
                      )}
                      <span className={cn("truncate", !canView && "text-muted-foreground")}>{lesson.title}</span>
                      <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-2">
                        {lesson.isPreviewable && !enrolled && <Badge variant="outline">Preview</Badge>}
                        {lesson.durationMinutes ? formatDuration(lesson.durationMinutes) : null}
                      </span>
                    </>
                  );
                  return (
                    <li key={lesson.id} className="hover:bg-muted/50 border-b last:border-b-0">
                      {canView ? (
                        <Link
                          href={`/learn/${course.id}${enrolled ? `?lesson=${lesson.id}` : `?preview=${lesson.id}`}`}
                          className="flex items-center gap-3 px-4 py-2.5 pl-11 text-sm"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEnroll}
                          className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 pl-11 text-left text-sm"
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <ReviewsSection courseId={course.id} enrolled={enrolled} />
    </div>
  );
}
