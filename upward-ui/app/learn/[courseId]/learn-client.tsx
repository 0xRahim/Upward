"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { coursesApi, lessonsApi, progressApi, ApiError } from "@/lib/api";
import { AuthGuard } from "@/components/guards";
import { Markdown } from "@/components/markdown";
import type { CourseProgress, LessonContent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AwardIcon,
  CheckCircle2Icon,
  CircleIcon,
  FileTextIcon,
  HelpCircleIcon,
  PlayCircleIcon,
} from "lucide-react";

function flattenLessons(course: NonNullable<Awaited<ReturnType<typeof coursesApi.get>>>) {
  return (course.modules ?? []).flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));
}

function LearnInner({ courseId }: { courseId: string }) {
  const searchParams = useSearchParams();
  const previewId = searchParams.get("preview");

  const [course, setCourse] = React.useState<Awaited<ReturnType<typeof coursesApi.get>> | null>(null);
  const [progress, setProgress] = React.useState<CourseProgress | null>(null);
  const [notEnrolled, setNotEnrolled] = React.useState(false);
  const [currentLesson, setCurrentLesson] = React.useState<LessonContent | null>(null);
  const [lessonLoading, setLessonLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentLessonId, setCurrentLessonId] = React.useState<string | null>(null);
  const [certificate, setCertificate] = React.useState<{ certificateUrl: string; issuedAt: string } | null>(null);

  // Load course outline + enrollment state
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const c = await coursesApi.get(courseId);
        if (!active) return;
        setCourse(c);
        try {
          const p = await progressApi.get(courseId);
          if (!active) return;
          setProgress(p);
          // initial lesson: URL param > last accessed > first
          const all = c.modules ?? [];
          const firstId =
            searchParams.get("lesson") ??
            p.lastAccessedLessonId ??
            all[0]?.lessons[0]?.id;
          if (!searchParams.get("preview")) setCurrentLessonId(firstId ?? null);
        } catch (err) {
          if (err instanceof ApiError && err.code === "NOT_ENROLLED") {
            if (active) {
              setNotEnrolled(true);
              setCurrentLessonId(previewId ?? null);
            }
          }
        }
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : "Failed to load course");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Load lesson content when selection changes
  React.useEffect(() => {
    if (!currentLessonId || notEnrolled) {
      if (!currentLessonId) setLessonLoading(false);
      return;
    }
    let active = true;
    setLessonLoading(true);
    lessonsApi
      .content(currentLessonId)
      .then((lc) => active && setCurrentLesson(lc))
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.code === "NOT_ENROLLED") {
          setNotEnrolled(true);
        }
      })
      .finally(() => active && setLessonLoading(false));
    return () => {
      active = false;
    };
  }, [currentLessonId, notEnrolled]);

  const flat = course ? flattenLessons(course) : [];
  const currentIndex = flat.findIndex((l) => l.id === currentLessonId);

  const toggleComplete = async () => {
    if (!currentLesson) return;
    const toast = (await import("sonner")).toast;
    try {
      if (currentLesson.completed) {
        const updated = await progressApi.incompleteLesson(currentLesson.id);
        setProgress(updated);
        setCurrentLesson({ ...currentLesson, completed: false });
        toast.success("Marked as incomplete");
      } else {
        const res = await progressApi.completeLesson(currentLesson.id);
        setCurrentLesson({ ...currentLesson, completed: true });
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                progressPercent: res.courseProgressPercent,
                lessonsCompleted: prev.completedLessons.includes(currentLesson.id)
                  ? prev.lessonsCompleted
                  : prev.lessonsCompleted + 1,
                completedLessons: prev.completedLessons.includes(currentLesson.id)
                  ? prev.completedLessons
                  : [...prev.completedLessons, currentLesson.id],
              }
            : prev
        );
        toast.success(`Lesson complete — ${res.courseProgressPercent}% of course`);
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message ?? "Could not update progress");
    }
  };

  const getCertificate = async () => {
    const toast = (await import("sonner")).toast;
    try {
      const cert = await progressApi.certificate(courseId);
      setCertificate(cert);
      toast.success("Certificate ready!");
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message ?? "Certificate not available yet");
    }
  };

  const handleEnroll = async () => {
    const enrollmentsMod = await import("@/lib/api").then((m) => m.enrollmentsApi);
    const toast = (await import("sonner")).toast;
    try {
      await enrollmentsMod.enrollCourse(courseId);
      window.location.reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_ENROLLED") {
        window.location.reload();
      } else if (err instanceof ApiError) {
        toast.error(err.message ?? "Could not enroll");
      }
    }
  };

  if (error) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4" render={<Link href="/dashboard" />}>
          Back to My Learning
        </Button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr]">
        <Skeleton className="hidden h-[70vh] rounded-xl lg:block" />
        <div className="space-y-4">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
    );
  }

  // Not enrolled → preview mode / enroll prompt
  if (notEnrolled) {
    const previewLesson = previewId
      ? flat.find((l) => l.id === previewId)
      : null;

    if (previewLesson) {
      return <PreviewLesson course={course} lessonId={previewLesson.id} onEnroll={handleEnroll} />;
    }

    return (
      <div className="px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">You&apos;re not enrolled in this course</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Enrollment is free and instant.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={handleEnroll}>Enroll for free</Button>
          <Button variant="outline" render={<Link href={`/courses/${course.slug}`} />}>
            Course page
          </Button>
        </div>
      </div>
    );
  }

  const pct = progress?.progressPercent ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          <ArrowLeftIcon /> My Learning
        </Button>
        <h1 className="min-w-0 flex-1 truncate font-semibold">{course.title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {progress?.lessonsCompleted ?? 0}/{progress?.lessonsTotal ?? 0} · {pct}%
          </span>
          <Progress value={pct} className="w-32 sm:w-44" />
        </div>
        {pct >= 100 && (
          certificate ? (
            <Button size="sm" variant="secondary" render={<a href={certificate.certificateUrl} target="_blank" rel="noreferrer" />}>
              <AwardIcon className="text-amber-500" /> Download certificate
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={getCertificate}>
              <AwardIcon className="text-amber-500" /> Get certificate
            </Button>
          )
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="bg-card max-h-[75vh] overflow-y-auto rounded-xl border lg:sticky lg:top-20">
          {(course.modules ?? []).map((module) => (
            <details key={module.id} open className="border-b last:border-b-0 [&[open]_.chev]:rotate-90">
              <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
                <ChevronSmall />
                <span className="truncate">{module.title}</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {module.lessons.filter((l) => progress?.completedLessons.includes(l.id)).length}/
                  {module.lessons.length}
                </span>
              </summary>
              <ul className="pb-1">
                {module.lessons.map((lesson) => {
                  const done = progress?.completedLessons.includes(lesson.id) ?? false;
                  const active = lesson.id === currentLessonId;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setCurrentLessonId(lesson.id)}
                        className={cn(
                          "hover:bg-muted/70 flex w-full cursor-pointer items-center gap-2 px-3 py-2 pl-7 text-left text-sm",
                          active && "bg-muted"
                        )}
                      >
                        {done ? (
                          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                        ) : (
                          <CircleIcon className="text-muted-foreground size-4 shrink-0" />
                        )}
                        <span className="truncate">{lesson.title}</span>
                        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                          {lesson.durationMinutes ? formatDuration(lesson.durationMinutes) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </aside>

        {/* Main */}
        <section>
          {lessonLoading ? (
            <div className="bg-card space-y-4 rounded-xl border p-6">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : currentLesson ? (
            <article className="bg-card rounded-xl border">
              <div className="border-b p-5 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">{currentLesson.title}</h2>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs capitalize">
                      {currentLesson.type === "video" ? (
                        <>
                          <PlayCircleIcon className="size-3.5" />
                          Video{currentLesson.durationMinutes ? ` · ${formatDuration(currentLesson.durationMinutes)}` : ""}
                        </>
                      ) : currentLesson.type === "quiz" ? (
                        <>
                          <HelpCircleIcon className="size-3.5" /> Quiz
                        </>
                      ) : (
                        <>
                          <FileTextIcon className="size-3.5" /> Reading
                        </>
                      )}
                    </p>
                  </div>
                  {currentLesson.type !== "quiz" && (
                    <Button
                      variant={currentLesson.completed ? "secondary" : "default"}
                      onClick={toggleComplete}
                    >
                      {currentLesson.completed ? (
                        <>
                          <CheckCircle2Icon className="text-emerald-500" /> Completed — undo
                        </>
                      ) : (
                        "Mark as complete"
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-5">
                {currentLesson.type === "video" && currentLesson.contentUrl && (
                  <video controls className="aspect-video w-full rounded-lg bg-black" src={currentLesson.contentUrl} />
                )}
                {currentLesson.type === "text" && currentLesson.content && (
                  <Markdown>{currentLesson.content}</Markdown>
                )}
                {currentLesson.type === "quiz" && (
                  <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                    Quiz content is delivered by instructors outside the platform for this lesson.
                  </div>
                )}
                {currentLesson.type !== "text" &&
                  currentLesson.type !== "video" &&
                  currentLesson.type !== "quiz" &&
                  currentLesson.content && <Markdown>{currentLesson.content}</Markdown>}
              </div>
            </article>
          ) : (
            <div className="bg-card text-muted-foreground rounded-xl border p-10 text-center text-sm">
              Select a lesson from the sidebar to start learning.
            </div>
          )}

          {/* Prev/Next */}
          <nav className="mt-4 flex items-center justify-between gap-3">
            {currentIndex > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentLessonId(flat[currentIndex - 1].id)}
              >
                <ArrowLeftIcon data-icon="inline-start" /> {flat[currentIndex - 1].title}
              </Button>
            ) : (
              <span />
            )}
            {currentIndex >= 0 && currentIndex < flat.length - 1 && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto max-w-[50%]"
                onClick={async () => {
                  const next = flat[currentIndex + 1];
                  if (currentLesson && !currentLesson.completed) await toggleComplete();
                  setCurrentLessonId(next.id);
                }}
              >
                Complete & next: <span className="truncate">{flat[currentIndex + 1].title}</span>{" "}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
          </nav>

          {/* Certificate nudge */}
          {pct >= 100 && !certificate && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button className="mt-4 w-full" variant="secondary" />}>
                <AwardIcon className="text-amber-500" /> Congratulations! Get your certificate 🎓
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Claim your certificate</AlertDialogTitle>
                  <AlertDialogDescription>
                    You finished every lesson in &ldquo;{course.title}&rdquo;. Generate your certificate of completion now.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Later</AlertDialogCancel>
                  <AlertDialogAction onClick={getCertificate}>Get certificate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {certificate && (
            <p className="text-muted-foreground mt-3 text-xs">
              Certificate issued {new Date(certificate.issuedAt).toLocaleDateString()} —{" "}
              <a href={certificate.certificateUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                download
              </a>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function ChevronSmall() {
  return <ChevronRightSmall />;
}

function ChevronRightSmall() {
  return (
    <svg
      className="chev size-4 shrink-0 transition-transform"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PreviewLesson({
  course,
  lessonId,
  onEnroll,
}: {
  course: Awaited<ReturnType<typeof coursesApi.get>>;
  lessonId: string;
  onEnroll: () => void;
}) {
  const [lesson, setLesson] = React.useState<LessonContent | null>(null);
  React.useEffect(() => {
    let active = true;
    lessonsApi
      .content(lessonId)
      .then((lc) => active && setLesson(lc))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lessonId]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{course.title} — Free preview</h1>
        <Button variant="outline" size="sm" render={<Link href={`/courses/${course.slug}`} />}>
          Back to course
        </Button>
      </div>
      <div className="bg-card rounded-xl border p-6">
        <p className="font-medium">{lesson?.title ?? "Loading preview…"}</p>
        {lesson === null ? (
          <div className="mt-3 space-y-3">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            {lesson.type === "video" && lesson.contentUrl && (
              <video controls className="mt-3 aspect-video w-full rounded-lg bg-black" src={lesson.contentUrl} />
            )}
            {lesson.content && (
              <div className="mt-3">
                <Markdown>{lesson.content}</Markdown>
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-6 rounded-lg border p-5 text-center">
        <p className="text-sm">Enjoying the preview? Enroll for free to unlock all lessons.</p>
        <Button className="mt-3" onClick={onEnroll}>
          Enroll now — it&apos;s free
        </Button>
      </div>
    </div>
  );
}

export function LearnClient({ courseId }: { courseId: string }) {
  return (
    <AuthGuard>
      <React.Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10"><Skeleton className="h-[60vh] w-full rounded-xl" /></div>}>
        <LearnPlayer courseId={courseId} />
      </React.Suspense>
    </AuthGuard>
  );
}

function LearnPlayer(props: { courseId: string }) {
  return <LearnInner {...props} />;
}
