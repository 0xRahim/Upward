"use client";

import * as React from "react";
import { bundlesApi, coursesApi, ApiError } from "@/lib/api";
import type { Bundle, Course, PaginationMeta } from "@/lib/types";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

export function AdminBundles() {
  const [bundles, setBundles] = React.useState<Bundle[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [page, setPage] = React.useState(1);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Bundle | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [coverImageUrl, setCoverImageUrl] = React.useState("");
  const [selectedCourses, setSelectedCourses] = React.useState<string[]>([]);
  const [isPublished, setIsPublished] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [deleting, setDeleting] = React.useState<Bundle | null>(null);

  React.useEffect(() => {
    coursesApi
      .list({ perPage: 100 })
      .then((res) => setCourses(res.data))
      .catch(() => {});
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await bundlesApi.list({ page, perPage: 15 });
      setBundles(res.data);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof ApiError) notify.error(err.message ?? "Failed to load bundles");
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCoverImageUrl("");
    setSelectedCourses([]);
    setIsPublished(false);
    setFormOpen(true);
  };

  const openEdit = (bundle: Bundle) => {
    setEditing(bundle);
    setTitle(bundle.title);
    setDescription(bundle.description);
    setCoverImageUrl(bundle.coverImageUrl ?? "");
    setSelectedCourses((bundle.courses ?? []).map((c) => c.id));
    setIsPublished(bundle.isPublished ?? false);
    setFormOpen(true);
  };

  const toggleCourse = (id: string) => {
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (selectedCourses.length < 2) {
      notify.error("A bundle needs at least 2 courses.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        courseIds: selectedCourses,
        coverImageUrl: coverImageUrl.trim() || undefined,
        isPublished,
      };
      if (editing) {
        await bundlesApi.update(editing.id, body);
        notify.success("Bundle updated");
      } else {
        await bundlesApi.create(body);
        notify.success("Bundle created");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        notify.error(err.details?.map((d) => `${d.field}: ${d.issue}`).join("; ") || err.message || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await bundlesApi.remove(deleting.id);
      notify.success("Bundle deleted");
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {meta ? `${meta.totalItems} bundle(s)` : ""}
        </p>
        <Button onClick={openCreate}>
          <PlusIcon /> New bundle
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Courses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4} className="h-10 animate-pulse" />
                </TableRow>
              ))
            ) : bundles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                  No published bundles yet.
                </TableCell>
              </TableRow>
            ) : (
              bundles.map((bundle) => (
                <TableRow key={bundle.id}>
                  <TableCell className="max-w-72 font-medium">
                    <span className="block truncate">{bundle.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">{bundle.description}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary">{bundle.courseCount ?? bundle.courses?.length ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={bundle.isPublished ? "default" : "outline"}>
                      {bundle.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${bundle.title}`} onClick={() => openEdit(bundle)}>
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${bundle.title}`} onClick={() => setDeleting(bundle)}>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit bundle" : "New bundle"}</DialogTitle>
            <DialogDescription>Enrolling in a bundle enrolls students in every course inside.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="bundle-title">Title</FieldLabel>
              <Input id="bundle-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bundle-desc">Description</FieldLabel>
              <Textarea id="bundle-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} minLength={10} required />
              <FieldDescription>Minimum 10 characters.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="bundle-cover">Cover image URL</FieldLabel>
              <Input id="bundle-cover" type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://…" />
            </Field>
            <Field>
              <FieldLabel>
                Courses{" "}
                <span className="text-muted-foreground font-normal">
                  ({selectedCourses.length} selected — minimum 2)
                </span>
              </FieldLabel>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                {courses.map((course) => (
                  <label key={course.id} className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm">
                    <Checkbox checked={selectedCourses.includes(course.id)} onCheckedChange={() => toggleCourse(course.id)} />
                    <span className="truncate">{course.title}</span>
                  </label>
                ))}
                {courses.length === 0 && (
                  <p className="text-muted-foreground p-2 text-sm">No courses available.</p>
                )}
              </div>
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
            <Button onClick={submit} disabled={saving || !title.trim() || selectedCourses.length < 2}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create bundle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Courses inside the bundle are not deleted, and already-granted access stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Delete bundle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
