"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDuration, formatNumber, levelLabel } from "@/lib/format";
import { ClockIcon, PlayCircleIcon, StarIcon, UsersIcon } from "lucide-react";

const levelStyles: Record<string, string> = {
  beginner: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  advanced: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function CoverImage({
  title,
  url,
  className,
}: {
  title: string;
  url?: string | null;
  className?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={title} className={cn("object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "from-primary/80 via-primary/60 to-primary/40 flex items-center justify-center bg-gradient-to-br",
        className
      )}
    >
      <span className="text-primary-foreground text-4xl font-bold">{title.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={`/courses/${course.slug}`} className="group block h-full">
      <Card className="hover:border-ring h-full gap-0 overflow-hidden p-0 py-0 transition-shadow group-hover:shadow-md">
        <CoverImage
          title={course.title}
          url={course.coverImageUrl}
          className="aspect-video w-full border-b"
        />
        <CardContent className="flex flex-1 flex-col gap-2 p-4">
          {course.category && (
            <span className="text-muted-foreground w-fit text-xs font-medium">
              {course.category.name}
            </span>
          )}
          <h3 className="group-hover:text-primary line-clamp-2 leading-snug font-semibold transition-colors">
            {course.title}
          </h3>
          <p className="text-muted-foreground line-clamp-2 text-sm">{course.description}</p>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-pretty">
            {course.rating !== undefined && course.rating > 0 && (
              <span className="flex items-center gap-1 font-medium">
                <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
                {course.rating.toFixed(1)}
                {course.reviewCount ? (
                  <span className="text-muted-foreground font-normal">({formatNumber(course.reviewCount)})</span>
                ) : null}
              </span>
            )}
            {course.level && (
              <Badge variant="outline" className={cn("px-1.5", levelStyles[course.level])}>
                {levelLabel(course.level)}
              </Badge>
            )}
            <span className="text-muted-foreground flex items-center gap-1">
              <PlayCircleIcon className="size-3.5" />
              {course.lessonCount ?? 0} lessons
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {formatDuration(course.durationMinutes)}
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              {formatNumber(course.studentCount)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
