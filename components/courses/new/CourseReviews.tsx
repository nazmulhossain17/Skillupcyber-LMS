// ============================================
// FILE: components/courses/CourseReviews.tsx
// Dynamic reviews section with submit, edit, delete
// Optimized: Prevents refetching on tab switches
// ============================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Star,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
}

interface CourseReviewsProps {
  courseId: string;
  courseSlug: string;
  averageRating: number;
  reviewCount: number;
  isEnrolled: boolean;
  isLoggedIn: boolean;
  currentUserId?: string;
}

export function CourseReviews({
  courseId,
  courseSlug,
  averageRating,
  reviewCount,
  isEnrolled,
  isLoggedIn,
  currentUserId,
}: CourseReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalReviews, setTotalReviews] = useState(reviewCount);
  const [currentAvgRating, setCurrentAvgRating] = useState(averageRating);
  
  // ✅ Track if initial fetch has been done to prevent refetching on tab switch
  const hasFetched = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Edit state
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [editHoverRating, setEditHoverRating] = useState(0);
  
  // Delete state
  const [deletingReview, setDeletingReview] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // User's own review
  const [userReview, setUserReview] = useState<Review | null>(null);

  const LIMIT = 10;

  // Fetch reviews
  const fetchReviews = useCallback(async (reset = false, isManualRefresh = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      const res = await fetch(
        `/api/reviews?courseId=${courseSlug}&limit=${LIMIT}&offset=${currentOffset}`
      );
      const data = await res.json();

      if (data.success) {
        const newReviews = data.reviews || [];
        
        if (reset) {
          setReviews(newReviews);
          setOffset(LIMIT);
        } else {
          setReviews(prev => [...prev, ...newReviews]);
          setOffset(prev => prev + LIMIT);
        }
        
        setHasMore(newReviews.length === LIMIT);
        
        // Find user's review
        if (currentUserId) {
          const found = newReviews.find((r: Review) => r.userId === currentUserId);
          if (found) setUserReview(found);
        }
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      if (isManualRefresh) {
        toast.error('Failed to refresh reviews');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [courseSlug, offset, currentUserId]);

  // ✅ Only fetch once on mount - not on every tab switch
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchReviews(true);
    }
  }, []);  // Empty dependency array - only run once

  // Manual refresh function
  const handleRefresh = () => {
    fetchReviews(true, true);
  };

  // Calculate rating distribution
  const ratingDistribution = reviews.reduce((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Submit new review - updates local state instead of refetching
  const handleSubmitReview = async () => {
    if (!selectedRating) {
      toast.error('Please select a rating');
      return;
    }
    if (reviewComment.trim().length < 10) {
      toast.error('Review must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          rating: selectedRating,
          comment: reviewComment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      toast.success('Review submitted successfully!');
      setShowReviewForm(false);
      setSelectedRating(0);
      setReviewComment('');
      setTotalReviews(prev => prev + 1);
      
      // ✅ Update local state instead of refetching
      const newReview: Review = {
        id: data.review.id,
        rating: selectedRating,
        comment: reviewComment.trim(),
        createdAt: new Date().toISOString(),
        userId: currentUserId || '',
        userName: data.review.userName || 'You',
        userAvatar: data.review.userAvatar || null,
      };
      
      setReviews(prev => [newReview, ...prev]);
      setUserReview(newReview);
      
      // Update average rating
      const newTotal = totalReviews + 1;
      const newAvg = ((currentAvgRating * totalReviews) + selectedRating) / newTotal;
      setCurrentAvgRating(newAvg);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit review - updates local state
  const handleEditReview = async () => {
    if (!editingReview) return;
    if (!editRating) {
      toast.error('Please select a rating');
      return;
    }
    if (editComment.trim().length < 10) {
      toast.error('Review must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${editingReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: editRating,
          comment: editComment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update review');
      }

      toast.success('Review updated successfully!');
      
      // ✅ Update local state and recalculate average
      const oldRating = editingReview.rating;
      const ratingDiff = editRating - oldRating;
      
      setReviews(prev => prev.map(r => 
        r.id === editingReview.id 
          ? { ...r, rating: editRating, comment: editComment.trim(), updatedAt: new Date().toISOString() }
          : r
      ));
      
      if (userReview?.id === editingReview.id) {
        setUserReview(prev => prev ? { ...prev, rating: editRating, comment: editComment.trim() } : null);
      }
      
      // Update average rating locally
      if (totalReviews > 0) {
        const newAvg = currentAvgRating + (ratingDiff / totalReviews);
        setCurrentAvgRating(newAvg);
      }
      
      setEditingReview(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update review');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete review - updates local state
  const handleDeleteReview = async () => {
    if (!deletingReview) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/reviews/${deletingReview.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete review');
      }

      toast.success('Review deleted successfully!');
      
      // ✅ Update average rating locally before removing
      const deletedRating = deletingReview.rating;
      const newTotal = totalReviews - 1;
      
      if (newTotal > 0) {
        const newAvg = ((currentAvgRating * totalReviews) - deletedRating) / newTotal;
        setCurrentAvgRating(newAvg);
      } else {
        setCurrentAvgRating(0);
      }
      
      setTotalReviews(newTotal);
      setDeletingReview(null);
      
      // Update local state
      setReviews(prev => prev.filter(r => r.id !== deletingReview.id));
      
      if (userReview?.id === deletingReview.id) {
        setUserReview(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete review');
    } finally {
      setDeleting(false);
    }
  };

  // Start editing
  const startEditing = (review: Review) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment || '');
  };

  // Rating stars component
  const RatingStars = ({ 
    rating, 
    hover, 
    onSelect, 
    onHover, 
    onLeave,
    size = 'md',
    interactive = true 
  }: {
    rating: number;
    hover?: number;
    onSelect?: (rating: number) => void;
    onHover?: (rating: number) => void;
    onLeave?: () => void;
    size?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
  }) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
    };

    return (
      <div className="flex gap-1" onMouseLeave={onLeave}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onSelect?.(star)}
            onMouseEnter={() => onHover?.(star)}
            className={cn(
              "transition-colors",
              interactive && "cursor-pointer hover:scale-110"
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                "transition-colors",
                (hover || rating) >= star
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 dark:text-dark-5"
              )}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Student Reviews</CardTitle>
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
              title="Refresh reviews"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
          
          {/* Write Review Button */}
          {isLoggedIn && isEnrolled && !userReview && (
            <Button onClick={() => setShowReviewForm(true)} className="bg-primary">
              <MessageSquare className="h-4 w-4 mr-2" />
              Write a Review
            </Button>
          )}
          
          {!isLoggedIn && (
            <p className="text-sm text-muted-foreground">
              Please login to write a review
            </p>
          )}
          
          {isLoggedIn && !isEnrolled && (
            <p className="text-sm text-muted-foreground">
              Enroll in this course to write a review
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rating Summary */}
        <div className="flex flex-col md:flex-row gap-6 p-4 bg-gray dark:bg-dark-2 rounded-lg">
          {/* Average Rating */}
          <div className="flex flex-col items-center justify-center text-center md:min-w-[140px]">
            <div className="text-5xl font-bold text-dark dark:text-white">
              {currentAvgRating.toFixed(1)}
            </div>
            <RatingStars rating={Math.round(currentAvgRating)} interactive={false} size="sm" />
            <p className="text-sm text-muted-foreground mt-1">
              {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingDistribution[star] || 0;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16 text-sm">
                    <span>{star}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <Progress value={percentage} className="flex-1 h-2" />
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* User's Review (if exists) */}
        {userReview && (
          <div className="p-4 border-2 border-primary/20 bg-primary/5 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userReview.userAvatar || undefined} />
                  <AvatarFallback>{userReview.userName?.charAt(0) || 'Y'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{userReview.userName || 'You'}</p>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                      Your Review
                    </span>
                  </div>
                  <RatingStars rating={userReview.rating} interactive={false} size="sm" />
                  {userReview.comment && (
                    <p className="text-sm text-muted-foreground mt-2">{userReview.comment}</p>
                  )}
                  {userReview.createdAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(userReview.createdAt), { addSuffix: true })}
                      {userReview.updatedAt && userReview.updatedAt !== userReview.createdAt && ' (edited)'}
                    </p>
                  )}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => startEditing(userReview)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Review
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setDeletingReview(userReview)}
                    className="text-red focus:text-red"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Review
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* Review Form */}
        {showReviewForm && (
          <div className="p-4 border rounded-lg bg-gray dark:bg-dark-2 space-y-4">
            <h4 className="font-semibold">Write Your Review</h4>
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">How would you rate this course?</p>
              <RatingStars
                rating={selectedRating}
                hover={hoverRating}
                onSelect={setSelectedRating}
                onHover={setHoverRating}
                onLeave={() => setHoverRating(0)}
                size="lg"
              />
              {selectedRating > 0 && (
                <p className="text-sm text-primary mt-1">
                  {selectedRating === 5 && 'Excellent!'}
                  {selectedRating === 4 && 'Very Good'}
                  {selectedRating === 3 && 'Good'}
                  {selectedRating === 2 && 'Fair'}
                  {selectedRating === 1 && 'Poor'}
                </p>
              )}
            </div>

            <div>
              <Textarea
                placeholder="Share your experience with this course... (minimum 10 characters)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {reviewComment.length}/1000 characters
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSubmitReview}
                disabled={submitting || !selectedRating || reviewComment.trim().length < 10}
                className="bg-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Review
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReviewForm(false);
                  setSelectedRating(0);
                  setReviewComment('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reviews List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.filter(r => r.id !== userReview?.id).map((review) => (
              <div 
                key={review.id} 
                className="border-b border-stroke dark:border-stroke-dark pb-4 last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={review.userAvatar || undefined} />
                      <AvatarFallback className="text-sm">
                        {review.userName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{review.userName || 'Anonymous'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <RatingStars rating={review.rating} interactive={false} size="sm" />
                        {review.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions for own review or admin */}
                  {currentUserId && review.userId === currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEditing(review)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeletingReview(review)}
                          className="text-red focus:text-red"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchReviews()}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Reviews'
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No reviews yet. Be the first to review this course!
            </p>
          </div>
        )}
      </CardContent>

      {/* Edit Review Dialog */}
      <Dialog open={!!editingReview} onOpenChange={(open) => !open && setEditingReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Your Review</DialogTitle>
            <DialogDescription>
              Update your rating and feedback for this course.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Your Rating</p>
              <RatingStars
                rating={editRating}
                hover={editHoverRating}
                onSelect={setEditRating}
                onHover={setEditHoverRating}
                onLeave={() => setEditHoverRating(0)}
                size="lg"
              />
            </div>

            <div>
              <Textarea
                placeholder="Share your experience..."
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editComment.length}/1000 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReview(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditReview}
              disabled={submitting || !editRating || editComment.trim().length < 10}
              className="bg-primary"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingReview} onOpenChange={(open) => !open && setDeletingReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red">
              <AlertCircle className="h-5 w-5" />
              Delete Review
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your review? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingReview(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteReview}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}