"use client";

import * as React from "react";
import Link from "next/link";
import { enrollmentsApi, usersApi, ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { AuthGuard } from "@/components/guards";
import { CoverImage } from "@/components/course-card";
import { Pager } from "@/components/pager";
import type { Enrollment, PaginationMeta, User } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import {
  AwardIcon,
  BookOpenIcon,
  ChevronRightIcon,
  LayersIcon,
  TrophyIcon,
  XCircleIcon,
} from "lucide-react";

function DashboardInner() {
  const { user } = useAuth();
  const [me, setMe] = React.useState<User | null>(user);
  const [enrollments, setEnrollments] = React.useState<Enrollment[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<"active" | "completed">("active");
  const [type, setType] = React.useState<"" | "course" | "bundle">("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    usersApi
      .me()
      .then((u) => active && setMe(u))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadEnrollments = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await enrollmentsApi.mine({
        status,
        type: type || undefined,
        page,
        perPage: 10,
      });
      setEnrollments(res.data);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof ApiError) setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [status, type, page]);

  React.useEffect(() => {
    void loadEnrollments();
  }, [loadEnrollments]);

  const cancelEnrollment = async (id: string) => {
    const toast = (await import("sonner")).toast;
    try {
      await enrollmentsApi.cancel(id);
      toast.success("Enrollment cancelled");
      await loadEnrollments();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message ?? "Could not cancel enrollment");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Hi, {me?.name.split(" ")[0]} 👋</h1>
      <p className="text-muted-foreground mt-1">Pick up where you left off.</p>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Enrolled courses", value: me?.stats?.enrolledCourses, icon: BookOpenIcon },
          { label: "Completed courses", value: me?.stats?.completedCourses, icon: TrophyIcon },
          { label: "Active bundles", value: me?.stats?.activeBundles, icon: LayersIcon },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
                <stat.icon className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-bold">
                  {me?.stats ? (
                    stat.value ?? 0
                  ) : (
                    <Skeleton className="h-7 w-10" />
                  )}
                </p>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* My learning */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">My learning</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={status}
            onValueChange={(v) => {
              setStatus(v as "active" | "completed");
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="active">In progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as "" | "course" | "bundle");
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="">All types</TabsTrigger>
              <TabsTrigger value="course">Courses</TabsTrigger>
              <TabsTrigger value="bundle">Via bundles</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : enrollments.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpenIcon />
                </EmptyMedia>
                <EmptyTitle>Nothing here yet</EmptyTitle>
                <EmptyDescription>
                  {status === "active"
                    ? "Enroll in a course or bundle to start learning."
                    : "Complete all lessons in a course to see it here."}
                </EmptyDescription>
              </EmptyHeader>
              <Button render={<Link href="/courses" />}>Browse courses</Button>
            </Empty>
          ) : (
            enrollments.map((enrollment) => {
              const course = enrollment.course;
              if (!course) return null;
              const pct = enrollment.progressPercent ?? 0;
              return (
                <Card key={enrollment.id} className="overflow-hidden py-0">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <CoverImage
                      title={course.title}
                      url={course.coverImageUrl}
                      className="hidden h-20 w-32 shrink-0 rounded-md border sm:block"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/courses/${course.slug}`}
                          className="truncate font-medium hover:underline"
                        >
                          {course.title}
                        </Link>
                        {enrollment.bundleId && (
                          <Badge variant="secondary" className="gap-1">
                            <LayersIcon className="size-3" /> via bundle
                          </Badge>
                        )}
                        <Badge
                          variant={enrollment.status === "completed" ? "outline" : "secondary"}
                          className={enrollment.status === "completed" ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : ""}
                        >
                          {enrollment.status === "completed" ? (
                            <>
                              <TrophyIcon className="size-3" /> Completed
                            </>
                          ) : (
                            "In progress"
                          )}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">Enrolled {formatDate(enrollment.enrolledAt)}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={pct} className="max-w-xs flex-1 sm:flex-none sm:w-56" />
                        <span className="text-muted-foreground shrink-0 text-xs">{pct}%</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {enrollment.status === "completed" && (
                        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                          <AwardIcon className="size-3.5" /> Certificate earned
                        </Badge>
                      )}
                      <Button size="sm" render={<Link href={`/learn/${course.id}`} />}>
                        {pct > 0 && enrollment.status !== "completed" ? "Continue" : enrollment.status === "completed" ? "Review" : "Start"}
                        <ChevronRightIcon data-icon="inline-end" />
                      </Button>
                      {enrollment.status === "active" && (
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Cancel enrollment" />}>
                            <XCircleIcon className="text-muted-foreground" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel enrollment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove &ldquo;{course.title}&rdquo; and your progress from My Learning. You can re-enroll for free anytime.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep learning</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void cancelEnrollment(enrollment.id)}>
                                Cancel enrollment
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
        {meta && <Pager meta={meta} onPageChange={setPage} />}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  );
}
