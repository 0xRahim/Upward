"use client";

import * as React from "react";
import { reviewsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import type { PaginationMeta, Review } from "@/lib/types";
import { Pager } from "@/components/pager";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  MoreHorizontalIcon,
  PencilIcon,
  StarIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";

const sortOptions = [
  { value: "-helpfulVotes", label: "Most helpful" },
  { value: "helpfulVotes", label: "Least helpful" },
  { value: "newest", label: "Newest" },
];

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          className={cn("size-4", i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

export function ReviewsSection({ courseId, enrolled }: { courseId: string; enrolled: boolean }) {
  const { user, isAdmin } = useAuth();
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState("-helpfulVotes");
  const [loading, setLoading] = React.useState(true);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingReview, setEditingReview] = React.useState<Review | null>(null);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewsApi.list(courseId, { page, perPage: 10, sort });
      setReviews(res.data);
      setMeta(res.meta);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, page, sort]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const myReview = reviews.find((r) => r.userId === user?.id) ?? null;

  const openCreate = () => {
    setEditingReview(null);
    setRating(5);
    setComment("");
    setDialogOpen(true);
  };

  const openEdit = (review: Review) => {
    setEditingReview(review);
    setRating(review.rating);
    setComment(review.comment ?? "");
    setDialogOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    const toast = (await import("sonner")).toast;
    try {
      if (editingReview) {
        await reviewsApi.update(editingReview.id, { rating, comment: comment.trim() || undefined });
        toast.success("Review updated");
      } else {
        await reviewsApi.create(courseId, { rating, comment: comment.trim() || undefined });
        toast.success("Review published — thank you!");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message ?? "Could not save your review");
      }
    } finally {
      setSaving(false);
    }
  };

  const removeReview = async (reviewId: string) => {
    const toast = (await import("sonner")).toast;
    try {
      await reviewsApi.remove(reviewId);
      toast.success("Review deleted");
      await load();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message ?? "Could not delete review");
    }
  };

  const toggleHelpful = async (review: Review) => {
    if (!user) return;
    try {
      const res = await reviewsApi.helpful(review.id);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === review.id ? { ...r, helpfulVotes: res.helpfulVotes, votedByMe: res.votedByMe } : r
        )
      );
    } catch {
      // ignore
    }
  };

  const canWriteReview = user && enrolled;

  return (
    <section id="reviews" className="bg-muted/40 border-t">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Reviews</h2>
            <p className="text-muted-foreground mt-1 text-sm">Only students who started learning can leave a review.</p>
          </div>
          <div className="flex items-center gap-3">
            <Select items={sortOptions} value={sort} onValueChange={(v) => { setSort(String(v)); setPage(1); }}>
              <SelectTrigger className="w-40" aria-label="Sort reviews">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canWriteReview &&
              (myReview ? (
                <Button variant="outline" onClick={() => openEdit(myReview)}>
                  <PencilIcon /> Edit your review
                </Button>
              ) : (
                <Button onClick={openCreate}>Write a review</Button>
              ))}
            {!user && (
              <Button variant="outline" render={<a href="/login" />}>
                Log in to review
              </Button>
            )}
            {user && !enrolled && (
              <Button variant="outline" disabled>
                Enroll & start to review
              </Button>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card animate-pulse rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted size-9 rounded-full" />
                  <div className="bg-muted h-4 w-32 rounded" />
                </div>
                <div className="bg-muted mt-3 h-3 w-2/3 rounded" />
              </div>
            ))
          ) : reviews.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No reviews yet. Be the first to share your experience.
            </p>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className="bg-card rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-9 border">
                    <AvatarFallback>{review.userName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{review.userName}</span>
                      <Stars rating={review.rating} />
                      <span className="text-muted-foreground text-xs">{formatDate(review.createdAt)}</span>
                      {isAdmin && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          admin view
                        </Badge>
                      )}
                    </div>
                    {review.comment && (
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{review.comment}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant={review.votedByMe ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => void toggleHelpful(review)}
                        disabled={!user}
                        title={user ? undefined : "Log in to vote"}
                      >
                        <ThumbsUpIcon className={cn(review.votedByMe && "fill-current")} />
                        Helpful · {review.helpfulVotes}
                      </Button>
                      {(user?.id === review.userId || isAdmin) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Review actions" />}>
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {user?.id === review.userId && (
                              <DropdownMenuItem onSelect={() => openEdit(review)}>
                                <PencilIcon /> Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem variant="destructive" onSelect={() => void removeReview(review.id)}>
                              <Trash2Icon /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {meta && <Pager meta={meta} onPageChange={setPage} />}
      </div>

      {/* Create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReview ? "Edit your review" : "Write a review"}</DialogTitle>
            <DialogDescription>Rate this course and share what you thought.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Rating</FieldLabel>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
                  className="cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded"
                >
                  <StarIcon
                    className={cn(
                      "size-7 transition-colors",
                      i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"
                    )}
                  />
                </button>
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel>Comment (optional)</FieldLabel>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What did you like or dislike?"
            />
            <p className="text-muted-foreground text-right text-xs">{comment.length}/2000</p>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? "Saving…" : editingReview ? "Save changes" : "Publish review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
