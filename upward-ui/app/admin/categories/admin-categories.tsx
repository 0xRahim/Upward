"use client";

import * as React from "react";
import { categoriesApi, ApiError } from "@/lib/api";
import type { Category } from "@/lib/types";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

export function AdminCategories() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [deleting, setDeleting] = React.useState<Category | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoriesApi.list();
      setCategories(res.data);
    } catch (err) {
      if (err instanceof ApiError) notify.error(err.message ?? "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await categoriesApi.update(editing.id, name.trim());
        notify.success("Category updated");
      } else {
        await categoriesApi.create(name.trim());
        notify.success("Category created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        notify.error("A category with this name already exists.");
      } else {
        notify.error(err instanceof ApiError ? err.message : "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await categoriesApi.remove(deleting.id);
      notify.success("Category deleted");
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        notify.error("Cannot delete: this category still contains courses.");
      } else {
        notify.error(err instanceof ApiError ? err.message : "Delete failed");
      }
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{categories.length} categor(y/ies)</p>
        <Button onClick={openCreate}>
          <PlusIcon /> New category
        </Button>
      </div>

      <div className="max-w-xl rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Slug</TableHead>
              <TableHead>Courses</TableHead>
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
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-20 text-center">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground hidden font-mono text-xs sm:table-cell">
                    {category.slug}
                  </TableCell>
                  <TableCell>{category.courseCount ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.name}`} onClick={() => openEdit(category)}>
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`} onClick={() => setDeleting(category)}>
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Slug is generated automatically from the name.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="cat-name">Name</FieldLabel>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Web Development" />
            <FieldDescription>{name ? `Slug preview: /${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : ""}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Categories that still contain courses cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
