"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bundlesApi, enrollmentsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import type { Bundle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { BookOpenIcon, CheckCircle2Icon, LayersIcon } from "lucide-react";

export function BundleDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [bundle, setBundle] = React.useState<Bundle | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [enrollLoading, setEnrollLoading] = React.useState(false);
  const [enrolledAll, setEnrolledAll] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    bundlesApi
      .get(slug)
      .then((b) => active && setBundle(b))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Failed to load bundle"));
    return () => {
      active = false;
    };
  }, [slug]);

  const handleEnroll = async () => {
    if (!bundle) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setEnrollLoading(true);
    const toast = (await import("sonner")).toast;
    try {
      await enrollmentsApi.enrollBundle(bundle.id);
      setEnrolledAll(true);
      toast.success(`You're enrolled in every course of "${bundle.title}"!`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ALREADY_ENROLLED") {
          setEnrolledAll(true);
          toast.info(err.message ?? "You are already enrolled in this bundle.");
        } else {
          toast.error(err.message ?? "Could not enroll in this bundle");
        }
      }
    } finally {
      setEnrollLoading(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4" render={<Link href="/bundles" />}>
          Back to bundles
        </Button>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <Skeleton className="mt-10 h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-4">
        <LayersIcon className="text-primary size-10" />
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{bundle.title}</h1>
        <p className="text-muted-foreground text-lg">{bundle.description}</p>
        <p className="text-muted-foreground text-xs">Created {formatDate(bundle.createdAt)}</p>

        <div>
          {enrolledAll ? (
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-emerald-500" />
              <span className="font-medium">You&apos;re enrolled — find it in My Learning.</span>
              <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
                Go to My Learning
              </Button>
            </div>
          ) : (
            <Button size="lg" onClick={handleEnroll} disabled={enrollLoading}>
              {enrollLoading ? "Enrolling…" : user ? `Enroll for free (${bundle.courseCount ?? bundle.courses?.length ?? 0} courses)` : "Log in to enroll"}
            </Button>
          )}
        </div>
      </div>

      <h2 className="mt-12 mb-4 text-xl font-semibold tracking-tight">
        Included courses ({bundle.courses?.length ?? 0})
      </h2>
      <div className="space-y-3">
        {(bundle.courses ?? []).map((course) => (
          <Link key={course.id} href={`/courses/${course.slug}`} className="group block">
            <Card className="hover:border-ring transition-colors">
              <CardContent className="flex items-center gap-4 p-4">
                <BookOpenIcon className="text-muted-foreground size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="group-hover:text-primary truncate font-medium transition-colors">{course.title}</p>
                  <p className="text-muted-foreground text-xs">/courses/{course.slug}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
