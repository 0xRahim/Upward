"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { coursesApi, bundlesApi, categoriesApi } from "@/lib/api";
import type { Bundle, Category, Course } from "@/lib/types";
import { CourseCard, CourseCardSkeleton } from "@/components/course-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightIcon, BookOpenIcon, GraduationCapIcon, LayersIcon, SparklesIcon, StarIcon } from "lucide-react";

export function HomePage() {
  const router = useRouter();
  const [categories, setCategories] = React.useState<Category[] | null>(null);
  const [courses, setCourses] = React.useState<Course[] | null>(null);
  const [bundles, setBundles] = React.useState<Bundle[] | null>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      const [catRes, courseRes, bundleRes] = await Promise.allSettled([
        categoriesApi.list(),
        coursesApi.list({ perPage: 8, sort: "-rating" }),
        bundlesApi.list({ perPage: 3 }),
      ]);
      if (!active) return;
      if (catRes.status === "fulfilled") setCategories(catRes.value.data);
      if (courseRes.status === "fulfilled") setCourses(courseRes.value.data);
      if (bundleRes.status === "fulfilled") setBundles(bundleRes.value.data);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="from-background to-muted/50 border-b bg-gradient-to-b">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <SparklesIcon className="size-3.5" />
            100% free — no payments, ever
          </Badge>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Learn anything. <span className="text-primary">Go upward.</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-balance">
            Browse free courses and curated bundles, enroll instantly and track your progress all
            the way to a certificate.
          </p>
          <form
            className="flex w-full max-w-lg gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to learn?"
              aria-label="Search courses"
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border px-3.5 text-sm shadow-xs outline-none focus-visible:ring-3"
            />
            <Button type="submit" size="lg" disabled={query.trim().length < 2}>
              Search
            </Button>
          </form>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {categories === null
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-28 rounded-full" />)
            : categories.map((cat) => (
                <Link key={cat.id} href={`/courses?category=${cat.slug}`}>
                  <Badge variant="outline" className="hover:bg-muted cursor-pointer px-3 py-1.5 text-sm">
                    {cat.name}
                    {cat.courseCount !== undefined && (
                      <span className="text-muted-foreground ml-1.5">{cat.courseCount}</span>
                    )}
                  </Badge>
                </Link>
              ))}
        </div>
      </section>

      {/* Top rated courses */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <StarIcon className="size-5 fill-amber-400 text-amber-400" />
              Top-rated courses
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">Start with the community favorites.</p>
          </div>
          <Button variant="ghost" render={<Link href="/courses" />}>
            View all <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {courses === null
            ? Array.from({ length: 4 }).map((_, i) => <CourseCardSkeleton key={i} />)
            : courses.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
        {courses?.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenIcon />
              </EmptyMedia>
              <EmptyTitle>No published courses yet</EmptyTitle>
              <EmptyDescription>Check back soon — new content is on the way.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      {/* Bundles */}
      <section className="bg-muted/40 border-y">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <LayersIcon className="text-primary size-5" />
                Learning bundles
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Enroll once, get every course in the bundle.
              </p>
            </div>
            <Button variant="ghost" render={<Link href="/bundles" />}>
              View all <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {bundles === null
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
              : bundles.map((bundle) => (
                  <Link key={bundle.id} href={`/bundles/${bundle.slug}`} className="group">
                    <Card className="hover:border-ring h-full transition-shadow group-hover:shadow-md">
                      <CardContent className="flex h-full flex-col gap-3 p-5">
                        <div className="flex items-center justify-between gap-2">
                          <GraduationCapIcon className="text-primary size-6" />
                          <Badge variant="secondary">{bundle.courseCount ?? bundle.courses?.length ?? 0} courses</Badge>
                        </div>
                        <h3 className="group-hover:text-primary line-clamp-2 font-semibold transition-colors">
                          {bundle.title}
                        </h3>
                        <p className="text-muted-foreground line-clamp-2 text-sm">{bundle.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Ready to start?</h2>
          <p className="text-muted-foreground mt-2">
            Creating an account takes seconds. Enrollment is instant and always free.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button size="lg" render={<Link href="/register" />}>
              Create free account
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/courses" />}>
              Browse courses
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
