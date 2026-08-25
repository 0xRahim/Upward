"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { bundlesApi } from "@/lib/api";
import type { Bundle, PaginationMeta } from "@/lib/types";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCapIcon, LayersIcon, SearchIcon } from "lucide-react";

export function BundlesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [bundles, setBundles] = React.useState<Bundle[]>([]);
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
      router.push(`/bundles?${params.toString()}`, { scroll: true });
    },
    [router, searchParams]
  );

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
    setLoading(true);
    bundlesApi
      .list({ page, perPage: 12, search: search || undefined })
      .then((res) => {
        if (!active) return;
        setBundles(res.data);
        setMeta(res.meta);
      })
      .catch(() => active && setBundles([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, search]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bundles</h1>
          <p className="text-muted-foreground mt-1">Enroll once, unlock every course inside.</p>
        </div>
        <InputGroup className="w-full max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search bundles…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </InputGroup>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : bundles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayersIcon />
            </EmptyMedia>
            <EmptyTitle>No bundles found</EmptyTitle>
            <EmptyDescription>Try adjusting your search.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bundles.map((bundle) => (
              <Link key={bundle.id} href={`/bundles/${bundle.slug}`} className="group block h-full">
                <Card className="hover:border-ring h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <GraduationCapIcon className="text-primary size-6" />
                      <Badge variant="secondary">{bundle.courseCount ?? bundle.courses?.length ?? 0} courses</Badge>
                    </div>
                    <h3 className="group-hover:text-primary line-clamp-2 text-lg font-semibold transition-colors">
                      {bundle.title}
                    </h3>
                    <p className="text-muted-foreground line-clamp-2 flex-1 text-sm">{bundle.description}</p>
                    {bundle.courses && bundle.courses.length > 0 && (
                      <ul className="text-muted-foreground space-y-1 border-t pt-3 text-xs">
                        {bundle.courses.slice(0, 3).map((c) => (
                          <li key={c.id} className="truncate">
                            · {c.title}
                          </li>
                        ))}
                        {(bundle.courseCount ?? bundle.courses.length) > 3 && (
                          <li>+ {(bundle.courseCount ?? bundle.courses.length) - 3} more</li>
                        )}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {meta && <Pager meta={meta} onPageChange={(p) => updateParam("page", String(p))} />}
        </>
      )}
    </div>
  );
}

export function BundlesBrowserFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-40" />
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
