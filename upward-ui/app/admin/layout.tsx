"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminGuard } from "@/components/guards";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookOpenIcon, FolderIcon, GraduationCapIcon, LayersIcon, UsersIcon, ClipboardListIcon } from "lucide-react";

const nav = [
  { href: "/admin/courses", label: "Courses", icon: BookOpenIcon },
  { href: "/admin/bundles", label: "Bundles", icon: LayersIcon },
  { href: "/admin/categories", label: "Categories", icon: FolderIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/enrollments", label: "Enrollments", icon: ClipboardListIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AdminGuard>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
            <GraduationCapIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin panel</h1>
            <p className="text-muted-foreground text-sm">Manage Upward content and users</p>
          </div>
          <Button variant="ghost" size="sm" render={<Link href="/" />} className="ml-auto">
            ← Back to site
          </Button>
        </div>
        <nav className="scrollbar-none mb-8 flex gap-1 overflow-x-auto pb-0.5">
          {nav.map((item) => (
            <Button
              key={item.href}
              variant={pathname.startsWith(item.href) ? "secondary" : "ghost"}
              size="sm"
              render={<Link href={item.href} />}
              className={cn("shrink-0")}
            >
              <item.icon /> {item.label}
            </Button>
          ))}
        </nav>
        {children}
      </div>
    </AdminGuard>
  );
}
