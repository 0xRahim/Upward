"use client";

import * as React from "react";
import Link from "next/link";
import { categoriesApi, coursesApi, ApiError } from "@/lib/api";
import type { Category, Course, PaginationMeta } from "@/lib/types";
import { Pager } from "@/components/pager";
import { toast as notify } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PencilIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react";

const levels = ["beginner", "intermediate", "advanced"];

export function AdminCourses() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [page, setPage] = React.useState(1);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Course | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [level, setLevel] = React.useState<string>("beginner");
  const [coverImageUrl, setCoverImageUrl] = React.useState("");
  const [isPublished, setIsPublished] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [deleting, setDeleting] = React.useState<Course | null>(null);
  const [forceDelete, setForceDelete] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await coursesApi.list({ page, perPage: 15, sort: "newest" });
      setCourses(res.data);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof ApiError) notify.error(err.message ?? "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCategoryId("");
    setLevel("beginner");
    setCoverImageUrl("");
    setIsPublished(false);
    setFormOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setTitle(course.title);
    setDescription(course.description);
    setCategoryId(course.category?.id ?? "");
    setLevel(course.level ?? "beginner");
    setCoverImageUrl(course.coverImageUrl ?? "");
    setIsPublished(course.isPublished ?? false);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!categoryId) {
      notify.error("Pick a category first.");
      return;
    }
    setSaving(true);
    try {
      const body: Parameters<typeof coursesApi.create>[0] = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        level: (level as "beginner" | "intermediate" | "advanced") || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
        isPublished,
      };
      if (editing) {
        await coursesApi.update(editing.id, body);
        notify.success("Course updated");
      } else {
        await coursesApi.create(body);
        notify.success("Course created");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldIssue = err.details?.map((d) => `${d.field}: ${d.issue}`).join("; ");
        notify.error(fieldIssue || err.message || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (course: Course) => {
    try {
      await coursesApi.update(course.id, { isPublished: !course.isPublished });
      await load();
    } catch (err) {
      if (err instanceof ApiError) notify.error(err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await coursesApi.remove(deleting.id, forceDelete);
      notify.success("Course deleted");
      setDeleting(null);
      setForceDelete(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        notify.warning("Course has active enrollments. Enable 'force delete' to delete anyway.");
      } else if (err instanceof ApiError) {
        notify.error(err.message ?? "Delete failed");
      }
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {meta ? `${meta.totalItems} published course(s)` : ""}
        </p>
        <Button onClick={openCreate}>
          <PlusIcon /> New course
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden sm:table-cell">Level</TableHead>
              <TableHead className="hidden lg:table-cell">Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="h-10 animate-pulse" />
                </TableRow>
              ))
            ) : courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No published courses yet.
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="max-w-56 font-medium">
                    <span className="block truncate">{course.title}</span>
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="text-primary inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                    >
                      <WrenchIcon className="size-3" /> Manage curriculum
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{course.category?.name ?? "—"}</TableCell>
                  <TableCell className="hidden capitalize sm:table-cell">{course.level ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{course.studentCount ?? 0}</TableCell>
                  <TableCell>
                    <Switch checked={!!course.isPublished} onCheckedChange={() => void togglePublish(course)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(course)} aria-label={`Edit ${course.title}`}>
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${course.title}`}
                      onClick={() => {
                        setDeleting(course);
                        setForceDelete(false);
                      }}
                    >
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && <Pager meta={meta} onPageChange={setPage} />}

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
            <DialogDescription>
              {editing ? editing.slug : "Slug is generated automatically from the title."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="course-title">Title</FieldLabel>
              <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="course-desc">Description</FieldLabel>
              <Textarea id="course-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required minLength={20} />
              <FieldDescription>{description.length}/∞ — minimum 20 characters.</FieldDescription>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Category</FieldLabel>
                <Select
                  items={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId || null}
                  onValueChange={(v) => v && setCategoryId(String(v))}
                >
                  <SelectTrigger aria-label="Category">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Level</FieldLabel>
                <Select
                  items={levels.map((l) => ({ value: l, label: l[0].toUpperCase() + l.slice(1) }))}
                  value={level}
                  onValueChange={(v) => v && setLevel(String(v))}
                >
                  <SelectTrigger aria-label="Level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l[0].toUpperCase() + l.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="cover">Cover image URL</FieldLabel>
              <Input id="cover" type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://…" />
            </Field>
            <label className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Published</span>
                <span className="text-muted-foreground text-xs">Visible publicly to students.</span>
              </span>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !title.trim() || !categoryId}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the course with all modules, lessons and progress records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={forceDelete}
              onChange={(e) => setForceDelete(e.target.checked)}
              className="accent-destructive size-4"
            />
            Force delete even with active enrollments
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Delete course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
