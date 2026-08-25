"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { searchApi } from "@/lib/api";
import type { SearchResults as SearchResultsType } from "@/lib/types";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpenIcon, LayersIcon, SearchIcon, StarIcon } from "lucide-react";

function Highlighted({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [results, setResults] = React.useState<SearchResultsType | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState(q);

  React.useEffect(() => setInput(q), [q]);

  React.useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    let active = true;
    setLoading(true);
    searchApi
      .global(q.trim())
      .then((res) => active && setResults(res))
      .catch(() => active && setResults(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [q]);

  const courseCount = results?.total.courses ?? 0;
  const bundleCount = results?.total.bundles ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {q ? (
          <>
            Results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
          </>
        ) : (
          "Search"
        )}
      </h1>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(input.trim())}`);
        }}
      >
        <InputGroup className="max-w-lg">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search courses and bundles…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
        </InputGroup>
      </form>

      {q.trim().length < 2 ? (
        <p className="text-muted-foreground mt-8 text-sm">Enter at least 2 characters to search.</p>
      ) : loading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border p-4">
              <div className="bg-muted h-4 w-1/2 rounded" />
              <div className="bg-muted mt-2 h-3 w-full rounded" />
            </div>
          ))}
        </div>
      ) : !results || (courseCount === 0 && bundleCount === 0) ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>Try different keywords or browse all courses.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" render={<Link href="/courses" />}>
            Browse courses
          </Button>
        </Empty>
      ) : (
        <Tabs defaultValue="courses" className="mt-8">
          <TabsList>
            <TabsTrigger value="courses">Courses ({courseCount})</TabsTrigger>
            <TabsTrigger value="bundles">Bundles ({bundleCount})</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-4 space-y-3">
            {results.results.courses.map((hit) => (
              <Link key={hit.id} href={`/courses/${hit.slug}`} className="group block">
                <Card className="hover:border-ring transition-colors">
                  <CardContent className="p-4">
                    <p className="group-hover:text-primary font-medium transition-colors [&_em]:text-primary [&_em]:not-italic [&_em]:font-semibold">
                      <Highlighted html={hit.highlightedTitle} />
                    </p>
                    <p
                      className="text-muted-foreground mt-1 line-clamp-2 text-sm [&_em]:font-medium [&_em]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                    <Badge variant="secondary" className="mt-2 gap-1">
                      <StarIcon className="size-3 fill-current" />
                      {hit.rating.toFixed(1)}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="bundles" className="mt-4 space-y-3">
            {results.results.bundles.map((hit) => (
              <Link key={hit.id} href={`/bundles/${hit.slug}`} className="group block">
                <Card className="hover:border-ring transition-colors">
                  <CardContent className="flex items-center gap-4 p-4">
                    <LayersIcon className="text-muted-foreground size-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="group-hover:text-primary font-medium transition-colors [&_em]:text-primary [&_em]:not-italic [&_em]:font-semibold">
                        <Highlighted html={hit.highlightedTitle} />
                      </p>
                      <p
                        className="text-muted-foreground mt-1 line-clamp-2 text-sm [&_em]:font-medium [&_em]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: hit.snippet }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </TabsContent>
        </Tabs>
      )}

      {!loading && results && courseCount === 0 && bundleCount > 0 && (
        <p className="text-muted-foreground mt-4 flex items-center gap-1.5 text-xs">
          <BookOpenIcon className="size-3.5" /> No matching courses — see bundles above.
        </p>
      )}
    </div>
  );
}
