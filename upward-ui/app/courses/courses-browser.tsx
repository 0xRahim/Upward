"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { categoriesApi, coursesApi } from "@/lib/api";
import type { Category, Course, PaginationMeta } from "@/lib/types";
import { CourseCard, CourseCardSkeleton } from "@/components/course-card";
import { Pager } from "@/components/pager";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BookOpenIcon, SearchIcon, XIcon } from "lucide-react";

const levels = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const sorts = [
  { value: "newest", label: "Newest" },
  { value: "-rating", label: "Top rated" },
  { value: "rating", label: "Lowest rated" },
  { value: "title", label: "Title A–Z" },
  { value: "-title", label: "Title Z–A" },
];

export function CoursesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const search = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchInput, setSearchInput] = React.useState(search);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      if (key !== "page") params.delete("page");
      router.push(`/courses?${params.toString()}`, { scroll: true });
    },
    [router, searchParams]
  );

  // Debounced search input
  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (searchInput === search) return;
    timerRef.current = setTimeout(() => updateParam("search", searchInput.trim()), 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput, search, updateParam]);

  React.useEffect(() => setSearchInput(search), [search]);

  React.useEffect(() => {
    let active = true;
    categoriesApi
      .list()
      .then((res) => active && setCategories(res.data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    coursesApi
      .list({ page, perPage: 12, category: category || undefined, level: level || undefined, sort, search: search || undefined })
      .then((res) => {
        if (!active) return;
        setCourses(res.data);
        setMeta(res.meta);
      })
      .catch(() => active && setCourses([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, level, sort, search, page]);

  const hasFilters = Boolean(category || level || search);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">All courses</h1>
        <p className="text-muted-foreground mt-1">
          {meta ? `${meta.totalItems} free course${meta.totalItems === 1 ? "" : "s"}` : "Free, forever."}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <InputGroup className="w-full max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search courses…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </InputGroup>

        <Select
          items={[
            { value: "__all", label: "All categories" },
            ...categories.map((c) => ({ value: c.slug, label: c.name })),
          ]}
          value={category || "__all"}
          onValueChange={(v) => updateParam("category", v === "__all" ? "" : String(v))}
        >
          <SelectTrigger className="w-44" aria-label="Category filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={[{ value: "__all", label: "All levels" }, ...levels]}
          value={level || "__all"}
          onValueChange={(v) => updateParam("level", v === "__all" ? "" : String(v))}
        >
          <SelectTrigger className="w-40" aria-label="Level filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All levels</SelectItem>
            {levels.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={sorts} value={sort} onValueChange={(v) => updateParam("sort", String(v))}>
          <SelectTrigger className="w-40" aria-label="Sort order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sorts.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              router.push("/courses");
            }}
          >
            <XIcon /> Clear filters
          </Button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>No courses found</EmptyTitle>
            <EmptyDescription>Try adjusting your filters or search terms.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          {meta && <Pager meta={meta} onPageChange={(p) => updateParam("page", String(p))} />}
        </>
      )}
    </div>
  );
}
