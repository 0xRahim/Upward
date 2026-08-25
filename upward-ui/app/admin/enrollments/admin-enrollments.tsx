"use client";

import * as React from "react";
import Link from "next/link";
import { enrollmentsApi, ApiError } from "@/lib/api";
import type { AdminEnrollment, PaginationMeta } from "@/lib/types";
import { Pager } from "@/components/pager";
import { toast as notify } from "sonner";
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
} from "@/components/ui/alert-dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { LayersIcon, SearchIcon, XCircleIcon } from "lucide-react";

export function AdminEnrollments() {
  const [enrollments, setEnrollments] = React.useState<AdminEnrollment[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState("__all");
  const [userIdInput, setUserIdInput] = React.useState("");
  const [courseIdInput, setCourseIdInput] = React.useState("");
  const [filters, setFilters] = React.useState({ userId: "", courseId: "" });
  const [loading, setLoading] = React.useState(true);
  const [cancelling, setCancelling] = React.useState<AdminEnrollment | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setFilters({ userId: userIdInput.trim(), courseId: courseIdInput.trim() });
      setPage(1);
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userIdInput, courseIdInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await enrollmentsApi.adminList({
        page,
        perPage: 15,
        status: statusFilter === "__all" ? undefined : statusFilter,
        userId: filters.userId || undefined,
        courseId: filters.courseId || undefined,
      });
      setEnrollments(res.data);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof ApiError) notify.error(err.message ?? "Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, filters]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await enrollmentsApi.cancel(cancelling.id);
      notify.success("Enrollment cancelled");
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Cancel failed");
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <InputGroup className="w-full max-w-56">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="User ID…"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
          />
        </InputGroup>
        <InputGroup className="w-full max-w-56">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Course ID…"
            value={courseIdInput}
            onChange={(e) => setCourseIdInput(e.target.value)}
          />
        </InputGroup>
        <Select
          items={[
            { value: "__all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
          ]}
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(String(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground ml-auto text-sm">{meta ? `${meta.totalItems} enrollment(s)` : ""}</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Course</TableHead>
              <TableHead className="hidden sm:table-cell">Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Progress</TableHead>
              <TableHead className="hidden lg:table-cell">Enrolled</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7} className="h-10 animate-pulse" />
                </TableRow>
              ))
            ) : enrollments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                  No enrollments found.
                </TableCell>
              </TableRow>
            ) : (
              enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell>
                    <p className="truncate text-sm font-medium">{enrollment.user?.name ?? enrollment.userId}</p>
                    <p className="text-muted-foreground truncate text-xs">{enrollment.user?.email}</p>
                  </TableCell>
                  <TableCell className="max-w-48">
                    {enrollment.course ? (
                      <Link href={`/courses/${enrollment.course.slug}`} className="block truncate text-sm hover:underline">
                        {enrollment.course.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs">{enrollment.courseId}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {enrollment.bundleId ? (
                      <Badge variant="secondary" className="gap-1">
                        <LayersIcon className="size-3" /> bundle
                      </Badge>
                    ) : (
                      <Badge variant="outline">direct</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={enrollment.status === "completed" ? "outline" : "secondary"}>
                      {enrollment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{enrollment.progressPercent}%</TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                    {formatDate(enrollment.enrolledAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Cancel enrollment" onClick={() => setCancelling(enrollment)}>
                      <XCircleIcon className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && <Pager meta={meta} onPageChange={setPage} />}

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this enrollment?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancels {cancelling?.user?.name ?? "this user"}&apos;s access to{" "}
              {cancelling?.course?.title ?? "the course"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmCancel()}>
              Cancel enrollment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
