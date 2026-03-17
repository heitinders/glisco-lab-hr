'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, Star, Loader2, MessageSquare } from 'lucide-react';
import { useMyReviews, useSubmitReview } from '@/hooks/use-performance';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'outline' | 'secondary' }> = {
  NOT_STARTED: { label: 'Not Started', variant: 'outline' },
  SELF_REVIEW: { label: 'Self Review', variant: 'secondary' },
  PEER_REVIEW: { label: 'Peer Review', variant: 'secondary' },
  MANAGER_REVIEW: { label: 'Manager Review', variant: 'warning' },
  HR_REVIEW: { label: 'HR Review', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
};

export default function ReviewsPage() {
  const { data: reviewsData, isLoading } = useMyReviews();
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  const reviews = reviewsData?.data ?? [];
  const pendingReviews = reviews.filter((r: any) => r.status !== 'COMPLETED' && r.status !== 'NOT_STARTED');
  const completedReviews = reviews.filter((r: any) => r.status === 'COMPLETED');
  const notStartedReviews = reviews.filter((r: any) => r.status === 'NOT_STARTED');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/performance">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            My Reviews
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your pending reviews and view past feedback
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No reviews</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You don't have any performance reviews yet.
          </p>
        </div>
      ) : (
        <>
          {/* Pending Reviews */}
          {pendingReviews.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Action Required</h2>
              <div className="space-y-3">
                {pendingReviews.map((review: any) => (
                  <div key={review.id}>
                    <ReviewCard
                      review={review}
                      isExpanded={activeReviewId === review.id}
                      onToggle={() => setActiveReviewId(activeReviewId === review.id ? null : review.id)}
                    />
                    {activeReviewId === review.id && (
                      <ReviewSubmitForm review={review} onDone={() => setActiveReviewId(null)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Started */}
          {notStartedReviews.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Upcoming</h2>
              <div className="space-y-2">
                {notStartedReviews.map((review: any) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedReviews.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">Completed</h2>
              <div className="space-y-2">
                {completedReviews.map((review: any) => (
                  <ReviewCard key={review.id} review={review} showRating />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  isExpanded,
  onToggle,
  showRating,
}: {
  review: any;
  isExpanded?: boolean;
  onToggle?: () => void;
  showRating?: boolean;
}) {
  const sb = STATUS_BADGE[review.status] ?? { label: review.status, variant: 'outline' as const };

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${onToggle ? 'cursor-pointer hover:bg-muted/30' : ''}`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {review.subject
                ? `${review.subject.firstName} ${review.subject.lastName}`
                : 'Review'}
            </span>
            <Badge variant="outline">{review.type}</Badge>
            <Badge variant={sb.variant}>{sb.label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {review.cycle?.name ?? 'Unknown cycle'}
          </p>
        </div>
        <div className="text-right">
          {showRating && review.overallRating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-medium">{review.overallRating.toFixed(1)}</span>
            </div>
          )}
          {onToggle && (
            <Button variant="ghost" size="sm">
              {isExpanded ? 'Close' : 'Submit Review'}
            </Button>
          )}
        </div>
      </div>
      {/* AI Summary */}
      {review.aiSummary && (
        <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <span className="font-medium">AI Summary: </span>
          {review.aiSummary}
        </div>
      )}
    </div>
  );
}

function ReviewSubmitForm({ review, onDone }: { review: any; onDone: () => void }) {
  const submitReview = useSubmitReview(review.id);
  const [rating, setRating] = useState(3);
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [comments, setComments] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data: any = { comments };

      if (review.type === 'SELF') {
        data.selfRating = rating;
        data.strengths = strengths;
        data.improvements = improvements;
      } else if (review.type === 'MANAGER') {
        data.managerRating = rating;
        data.strengths = strengths;
        data.improvements = improvements;
      } else if (review.type === 'HR') {
        data.finalRating = rating;
      } else {
        data.peerRating = rating;
      }

      await submitReview.mutateAsync(data);
      toast.success('Review submitted successfully');
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit review');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded-lg border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Rating */}
      <div>
        <label className="mb-2 block text-sm font-medium">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-7 w-7 ${
                  star <= rating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            </button>
          ))}
          <span className="ml-2 self-center text-sm text-muted-foreground">{rating}/5</span>
        </div>
      </div>

      {/* Strengths */}
      {(review.type === 'SELF' || review.type === 'MANAGER') && (
        <div>
          <label className="mb-1 block text-sm font-medium">Strengths</label>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Key strengths and accomplishments..."
          />
        </div>
      )}

      {/* Areas for Improvement */}
      {(review.type === 'SELF' || review.type === 'MANAGER') && (
        <div>
          <label className="mb-1 block text-sm font-medium">Areas for Improvement</label>
          <textarea
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Areas to develop and grow..."
          />
        </div>
      )}

      {/* Comments */}
      <div>
        <label className="mb-1 block text-sm font-medium">Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={3}
          placeholder="Additional comments..."
          required
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={submitReview.isPending}>
          {submitReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Review
        </Button>
      </div>
    </form>
  );
}
