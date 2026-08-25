"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchApi, ApiError } from "@/lib/api";
import type { Suggestion } from "@/lib/types";
import { BookOpenIcon, FolderIcon, LayersIcon, SearchIcon } from "lucide-react";

const typeIcons: Record<Suggestion["type"], React.ReactNode> = {
  course: <BookOpenIcon />,
  bundle: <LayersIcon />,
  category: <FolderIcon />,
};

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.suggest(query.trim(), 8);
        setSuggestions(res.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const go = (path: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(path);
  };

  const groups: { type: Suggestion["type"]; label: string }[] = [
    { type: "course", label: "Courses" },
    { type: "bundle", label: "Bundles" },
    { type: "category", label: "Categories" },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Upward"
      description="Search courses, bundles and categories"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search courses, bundles…"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map(
          (group) =>
            suggestions.some((s) => s.type === group.type) && (
              <CommandGroup key={group.type} heading={group.label}>
                {suggestions
                  .filter((s) => s.type === group.type)
                  .map((s) => (
                    <CommandItem
                      key={`${s.type}-${s.slug}`}
                      value={s.label}
                      onSelect={() => go(s.type === "category" ? `/courses?category=${s.slug}` : `/${s.type}s/${s.slug}`)}
                    >
                      {typeIcons[s.type]}
                      <span className="truncate">{s.label}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )
        )}
        {query.trim().length >= 2 && (
          <CommandGroup heading="Full search">
            <CommandItem value={`search for ${query}`} onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}>
              <SearchIcon />
              Search for &ldquo;{query.trim()}&rdquo;
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export { ApiError };
