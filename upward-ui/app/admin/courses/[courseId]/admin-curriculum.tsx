"use client";

import * as React from "react";
import Link from "next/link";
import { coursesApi, modulesApi, lessonsApi, ApiError } from "@/lib/api";
import type { Course, Lesson, Module } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/format";
import {
  ArrowLeftIcon,
  FileTextIcon,
  HelpCircleIcon,
  PencilIcon,
  PlayCircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

type ModuleForm = { id?: string; title: string; position: string };
type LessonForm = {
  id?: string;
  moduleId: string;
  title: string;
  type: "video" | "text" | "quiz";
  contentUrl: string;
  content: string;
  durationMinutes: string;
  position: string;
  isPreviewable: boolean;
};

const emptyLesson = (moduleId: string): LessonForm => ({
  moduleId,
  title: "",
  type: "video",
  contentUrl: "",
  content: "",
  durationMinutes: "",
  position: "",
  isPreviewable: false,
});

export function AdminCurriculum({ courseId }: { courseId: string }) {
  const [course, setCourse] = React.useState<Course | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [moduleDialogOpen, setModuleDialogOpen] = React.useState(false);
  const [moduleForm, setModuleForm] = React.useState<ModuleForm>({ title: "", position: "" });
  const [savingModule, setSavingModule] = React.useState(false);

  const [lessonDialogOpen, setLessonDialogOpen] = React.useState(false);
  const [lessonForm, setLessonForm] = React.useState<LessonForm>(emptyLesson(""));
  const [lessonError, setLessonError] = React.useState<string | null>(null);
  const [savingLesson, setSavingLesson] = React.useState(false);

  const [deletingModule, setDeletingModule] = React.useState<Module | null>(null);
  const [deletingLesson, setDeletingLesson] = React.useState<Lesson | null>(null);

  const load = React.useCallback(async () => {
    try {
      const c = await coursesApi.get(courseId);
      setCourse(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load course");
    }
  }, [courseId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // ---- Modules ----
  const openModuleCreate = () => {
    setModuleForm({ title: "", position: String((course?.modules?.length ?? 0) + 1) });
    setModuleDialogOpen(true);
  };

  const openModuleEdit = (module: Module) => {
    setModuleForm({ id: module.id, title: module.title, position: String(module.position) });
    setModuleDialogOpen(true);
  };

  const submitModule = async () => {
    if (!moduleForm.title.trim()) return;
    setSavingModule(true);
    try {
      const body = {
        title: moduleForm.title.trim(),
        ...(moduleForm.position ? { position: Number(moduleForm.position) } : {}),
      };
      if (moduleForm.id) {
        await modulesApi.update(moduleForm.id, body);
        notify.success("Module updated");
      } else {
        await modulesApi.create(courseId, body);
        notify.success("Module added");
      }
      setModuleDialogOpen(false);
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSavingModule(false);
    }
  };

  const deleteModule = async () => {
    if (!deletingModule) return;
    try {
      await modulesApi.remove(deletingModule.id);
      notify.success("Module deleted");
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeletingModule(null);
    }
  };

  // ---- Lessons ----
  const openLessonCreate = (moduleId: string) => {
    const targetModule = course?.modules?.find((m) => m.id === moduleId);
    setLessonForm(emptyLesson(moduleId));
    setLessonForm((f) => ({ ...f, position: String((targetModule?.lessons.length ?? 0) + 1) }));
    setLessonError(null);
    setLessonDialogOpen(true);
  };

  const openLessonEdit = (moduleId: string, lesson: Lesson & { type?: string }) => {
    setLessonForm({
      id: lesson.id,
      moduleId,
      title: lesson.title,
      type: (lesson.type as LessonForm["type"]) ?? "video",
      contentUrl: (lesson as { contentUrl?: string | null }).contentUrl ?? "",
      content: (lesson as { content?: string | null }).content ?? "",
      durationMinutes: lesson.durationMinutes ? String(lesson.durationMinutes) : "",
      position: String(lesson.position ?? ""),
      isPreviewable: !!lesson.isPreviewable,
    });
    setLessonError(null);
    setLessonDialogOpen(true);
  };

  const submitLesson = async () => {
    if (!lessonForm.title.trim()) return;
    const f = lessonForm;
    if (f.type === "video" && (!f.contentUrl.trim() || !f.durationMinutes)) {
      setLessonError("Video lessons need a content URL and a duration in minutes.");
      return;
    }
    if (f.type === "text" && !f.content.trim()) {
      setLessonError("Text lessons need markdown content.");
      return;
    }
    setSavingLesson(true);
    try {
      const body = {
        title: f.title.trim(),
        type: f.type,
        ...(f.type === "video"
          ? { contentUrl: f.contentUrl.trim(), durationMinutes: Number(f.durationMinutes) }
          : {}),
        ...(f.type === "text" ? { content: f.content } : {}),
        ...(f.position ? { position: Number(f.position) } : {}),
        isPreviewable: f.isPreviewable,
      };
      if (f.id) {
        await lessonsApi.update(f.id, body);
        notify.success("Lesson updated");
      } else {
        await lessonsApi.create(f.moduleId, body);
        notify.success("Lesson added");
      }
      setLessonDialogOpen(false);
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSavingLesson(false);
    }
  };

  const deleteLesson = async () => {
    if (!deletingLesson) return;
    try {
      await lessonsApi.remove(deletingLesson.id);
      notify.success("Lesson deleted");
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeletingLesson(null);
    }
  };

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  if (!course) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" render={<Link href="/admin/courses" />}>
        <ArrowLeftIcon /> All courses
      </Button>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{course.title}</h2>
          <p className="text-muted-foreground text-sm">
            /{course.slug} · {course.category?.name}
          </p>
        </div>
        <Button onClick={openModuleCreate}>
          <PlusIcon /> Add module
        </Button>
      </div>

      <div className="space-y-4">
        {(course.modules ?? []).length === 0 && (
          <p className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            No modules yet. Add your first module to start building the curriculum.
          </p>
        )}
        {(course.modules ?? []).map((module) => (
          <div key={module.id} className="bg-card rounded-xl border">
            <div className="flex items-center gap-3 border-b p-4">
              <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {module.position}
              </span>
              <h3 className="font-medium">{module.title}</h3>
              <span className="text-muted-foreground text-sm">{module.lessons.length} lessons</span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openLessonCreate(module.id)}>
                  <PlusIcon /> Lesson
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit module ${module.title}`} onClick={() => openModuleEdit(module)}>
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete module ${module.title}`}
                  onClick={() => setDeletingModule(module)}
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              </div>
            </div>
            {module.lessons.length === 0 ? (
              <p className="text-muted-foreground p-4 pl-14 text-sm">No lessons in this module.</p>
            ) : (
              <ul>
                {module.lessons.map((lesson) => (
                  <li key={lesson.id} className="hover:bg-muted/50 flex items-center gap-3 border-b px-4 py-2.5 pl-11 last:border-b-0">
                    {lesson.type === "video" ? (
                      <PlayCircleIcon className="text-muted-foreground size-4 shrink-0" />
                    ) : lesson.type === "quiz" ? (
                      <HelpCircleIcon className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="truncate text-sm">{lesson.title}</span>
                    {lesson.isPreviewable && (
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">preview</span>
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                      {lesson.durationMinutes ? formatDuration(lesson.durationMinutes) : lesson.type}
                      {" · #"}
                      {lesson.position ?? "—"}
                    </span>
                    <MoreActions
                      onEdit={() => openLessonEdit(module.id, lesson)}
                      onDelete={() => setDeletingLesson(lesson)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Module dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{moduleForm.id ? "Edit module" : "New module"}</DialogTitle>
            <DialogDescription>Modules are shown in position order.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="mod-title">Title</FieldLabel>
            <Input
              id="mod-title"
              value={moduleForm.title}
              onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Getting Started"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mod-pos">Position</FieldLabel>
            <Input
              id="mod-pos"
              type="number"
              min={1}
              value={moduleForm.position}
              onChange={(e) => setModuleForm((f) => ({ ...f, position: e.target.value }))}
            />
            <FieldDescription>Leave empty to append at the end.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitModule} disabled={savingModule || !moduleForm.title.trim()}>
              {savingModule ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{lessonForm.id ? "Edit lesson" : "New lesson"}</DialogTitle>
            <DialogDescription>
              {course.modules?.find((m) => m.id === lessonForm.moduleId)?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="les-title">Title</FieldLabel>
              <Input
                id="les-title"
                value={lessonForm.title}
                onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select
                  items={[
                    { value: "video", label: "Video" },
                    { value: "text", label: "Text (Markdown)" },
                    { value: "quiz", label: "Quiz" },
                  ]}
                  value={lessonForm.type}
                  onValueChange={(v) => v && setLessonForm((f) => ({ ...f, type: v as LessonForm["type"] }))}
                >
                  <SelectTrigger aria-label="Lesson type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="les-pos">Position</FieldLabel>
                <Input
                  id="les-pos"
                  type="number"
                  min={1}
                  value={lessonForm.position}
                  onChange={(e) => setLessonForm((f) => ({ ...f, position: e.target.value }))}
                />
              </Field>
            </div>
            {lessonForm.type === "video" && (
              <>
                <Field>
                  <FieldLabel htmlFor="les-url">Video URL</FieldLabel>
                  <Input
                    id="les-url"
                    type="url"
                    value={lessonForm.contentUrl}
                    onChange={(e) => setLessonForm((f) => ({ ...f, contentUrl: e.target.value }))}
                    placeholder="https://cdn.example.com/video.mp4"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="les-dur">Duration (minutes)</FieldLabel>
                  <Input
                    id="les-dur"
                    type="number"
                    min={1}
                    value={lessonForm.durationMinutes}
                    onChange={(e) => setLessonForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                  />
                </Field>
              </>
            )}
            {lessonForm.type === "text" && (
              <Field>
                <FieldLabel htmlFor="les-content">Content (Markdown)</FieldLabel>
                <textarea
                  id="les-content"
                  value={lessonForm.content}
                  onChange={(e) => setLessonForm((f) => ({ ...f, content: e.target.value }))}
                  rows={8}
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:ring-3"
                />
              </Field>
            )}
            <label className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Previewable</span>
                <span className="text-muted-foreground text-xs">Non-enrolled visitors can view this lesson.</span>
              </span>
              <Switch
                checked={lessonForm.isPreviewable}
                onCheckedChange={(v) => setLessonForm((f) => ({ ...f, isPreviewable: v }))}
              />
            </label>
            {lessonError && <p className="text-destructive text-sm">{lessonError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitLesson} disabled={savingLesson || !lessonForm.title.trim()}>
              {savingLesson ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirms */}
      <AlertDialog open={!!deletingModule} onOpenChange={(o) => !o && setDeletingModule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete module &ldquo;{deletingModule?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>All its lessons and student progress for them will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deleteModule()}>
              Delete module
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingLesson} onOpenChange={(o) => !o && setDeletingLesson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lesson &ldquo;{deletingLesson?.title}&rdquo;?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deleteLesson()}>
              Delete lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MoreActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Edit lesson" onClick={onEdit}>
        <PencilIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Delete lesson" onClick={onDelete}>
        <Trash2Icon className="text-destructive" />
      </Button>
    </>
  );
}
