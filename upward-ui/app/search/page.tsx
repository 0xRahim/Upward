import { Suspense } from "react";
import { SearchResults } from "./search-results";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-8 h-24 w-full rounded-xl" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
