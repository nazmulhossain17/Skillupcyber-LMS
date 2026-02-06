// ============================================
// FILE: components/courses/CourseDiscussions.tsx
// Discussion component for course video player
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare,
  Plus,
  Loader2,
  Send,
  MoreVertical,
  CheckCircle,
  Pin,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Eye,
  Award,
  MessageCircle,
  Search,
  Filter,
} from 'lucide-react';

interface Discussion {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isResolved: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userRole: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  replyCount: number;
}

interface Reply {
  id: string;
  content: string;
  isInstructorReply: boolean;
  isBestAnswer: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userRole: string;
}

interface CourseDiscussionsProps {
  courseId: string;
  lessonId?: string;
  currentUserId?: string;
  currentUserRole?: string;
}

export function CourseDiscussions({
  courseId,
  lessonId,
  currentUserId,
  currentUserRole,
}: CourseDiscussionsProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);

  useEffect(() => {
    fetchDiscussions();
  }, [courseId, lessonId, sortBy]);

  const fetchDiscussions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        courseId,
        sort: sortBy,
        limit: '50',
      });
      if (lessonId) params.append('lessonId', lessonId);

      const res = await fetch(`/api/discussions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data.discussions || []);
      }
    } catch (error) {
      console.error('Failed to fetch discussions:', error);
      toast.error('Failed to load discussions');
    } finally {
      setLoading(false);
    }
  };

  const filteredDiscussions = discussions.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canModerate = currentUserRole === 'instructor' || currentUserRole === 'admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Discussions
          <Badge variant="secondary">{discussions.length}</Badge>
        </h3>
        <Button
          onClick={() => setShowCreateModal(true)}
          size="sm"
          className="bg-primary text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-1" />
          Ask Question
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" />
              {sortBy === 'recent' ? 'Recent' : 'Popular'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSortBy('recent')}>
              Most Recent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('popular')}>
              Most Popular
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Discussion List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredDiscussions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No discussions match your search' : 'No discussions yet. Be the first to ask a question!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDiscussions.map((discussion) => (
            <DiscussionCard
              key={discussion.id}
              discussion={discussion}
              onClick={() => setSelectedDiscussion(discussion)}
              canModerate={canModerate}
              onRefresh={fetchDiscussions}
            />
          ))}
        </div>
      )}

      {/* Create Discussion Modal */}
      <CreateDiscussionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        courseId={courseId}
        lessonId={lessonId}
        onSuccess={() => {
          fetchDiscussions();
          setShowCreateModal(false);
        }}
      />

      {/* Discussion Detail Modal */}
      {selectedDiscussion && (
        <DiscussionDetailModal
          discussion={selectedDiscussion}
          open={!!selectedDiscussion}
          onOpenChange={(open) => !open && setSelectedDiscussion(null)}
          currentUserId={currentUserId}
          canModerate={canModerate}
          onRefresh={fetchDiscussions}
        />
      )}
    </div>
  );
}

// ============================================
// Discussion Card Component
// ============================================
function DiscussionCard({
  discussion,
  onClick,
  canModerate,
  onRefresh,
}: {
  discussion: Discussion;
  onClick: () => void;
  canModerate: boolean;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this discussion?')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Discussion deleted');
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete discussion');
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !discussion.isPinned }),
      });
      if (res.ok) {
        toast.success(discussion.isPinned ? 'Unpinned' : 'Pinned');
        onRefresh();
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleToggleResolved = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: !discussion.isResolved }),
      });
      if (res.ok) {
        toast.success(discussion.isResolved ? 'Marked as unresolved' : 'Marked as resolved');
        onRefresh();
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={discussion.userAvatar || undefined} />
            <AvatarFallback>
              {discussion.userName?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {/* Title with badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {discussion.isPinned && (
                    <Badge variant="secondary" className="text-xs">
                      <Pin className="h-3 w-3 mr-1" />
                      Pinned
                    </Badge>
                  )}
                  {discussion.isResolved && (
                    <Badge className="bg-green-500 text-white text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Resolved
                    </Badge>
                  )}
                  <h4 className="font-medium text-foreground line-clamp-1">
                    {discussion.title}
                  </h4>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <span>{discussion.userName}</span>
                  {discussion.userRole === 'instructor' && (
                    <Badge variant="outline" className="text-xs">Instructor</Badge>
                  )}
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })}</span>
                </div>

                {/* Preview */}
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {discussion.content}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {discussion.replyCount} replies
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {discussion.viewCount} views
                  </span>
                </div>
              </div>

              {/* Actions */}
              {canModerate && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleTogglePin}>
                      <Pin className="h-4 w-4 mr-2" />
                      {discussion.isPinned ? 'Unpin' : 'Pin'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleToggleResolved}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {discussion.isResolved ? 'Mark Unresolved' : 'Mark Resolved'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Create Discussion Modal
// ============================================
function CreateDiscussionModal({
  open,
  onOpenChange,
  courseId,
  lessonId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  lessonId?: string;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId,
          title: title.trim(),
          content: content.trim(),
        }),
      });

      if (res.ok) {
        toast.success('Discussion created!');
        setTitle('');
        setContent('');
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create discussion');
      }
    } catch (error) {
      toast.error('Failed to create discussion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Ask a Question
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your question about?"
              className="mt-1"
              minLength={5}
              maxLength={200}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Details</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide more details about your question..."
              className="mt-1 min-h-[120px]"
              minLength={10}
              maxLength={5000}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Post Question
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Discussion Detail Modal
// ============================================
function DiscussionDetailModal({
  discussion,
  open,
  onOpenChange,
  currentUserId,
  canModerate,
  onRefresh,
}: {
  discussion: Discussion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  canModerate: boolean;
  onRefresh: () => void;
}) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchReplies();
    }
  }, [open, discussion.id]);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/discussions/${discussion.id}`);
      if (res.ok) {
        const data = await res.json();
        setReplies(data.discussion?.replies || []);
      }
    } catch (error) {
      console.error('Failed to fetch replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim() }),
      });

      if (res.ok) {
        toast.success('Reply posted!');
        setReplyContent('');
        fetchReplies();
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to post reply');
      }
    } catch (error) {
      toast.error('Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkBestAnswer = async (replyId: string, isBest: boolean) => {
    try {
      const res = await fetch(`/api/discussions/${discussion.id}/replies/${replyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBestAnswer: !isBest }),
      });

      if (res.ok) {
        toast.success(isBest ? 'Unmarked as best answer' : 'Marked as best answer');
        fetchReplies();
        onRefresh();
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Delete this reply?')) return;

    try {
      const res = await fetch(`/api/discussions/${discussion.id}/replies/${replyId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Reply deleted');
        fetchReplies();
        onRefresh();
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-2">
            {discussion.isResolved && (
              <Badge className="bg-green-500 text-white shrink-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                Resolved
              </Badge>
            )}
            <DialogTitle className="text-left">{discussion.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Original Post */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={discussion.userAvatar || undefined} />
                <AvatarFallback>
                  {discussion.userName?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="font-medium">{discussion.userName}</span>
                {discussion.userRole === 'instructor' && (
                  <Badge variant="outline" className="ml-2 text-xs">Instructor</Badge>
                )}
                <span className="text-sm text-muted-foreground ml-2">
                  {formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap">{discussion.content}</p>
          </div>

          {/* Replies */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              {replies.length} Replies
            </h4>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : replies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No replies yet. Be the first to respond!
              </p>
            ) : (
              <div className="space-y-3">
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`p-3 rounded-lg border ${
                      reply.isBestAnswer
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                        : 'bg-background'
                    }`}
                  >
                    {reply.isBestAnswer && (
                      <Badge className="bg-green-500 text-white mb-2">
                        <Award className="h-3 w-3 mr-1" />
                        Best Answer
                      </Badge>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={reply.userAvatar || undefined} />
                        <AvatarFallback>
                          {reply.userName?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{reply.userName}</span>
                      {reply.isInstructorReply && (
                        <Badge variant="outline" className="text-xs">Instructor</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                      </span>

                      {/* Reply actions */}
                      <div className="ml-auto flex items-center gap-1">
                        {(canModerate || discussion.userId === currentUserId) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleMarkBestAnswer(reply.id, reply.isBestAnswer)}
                          >
                            <Award className="h-3 w-3 mr-1" />
                            {reply.isBestAnswer ? 'Unmark' : 'Best'}
                          </Button>
                        )}
                        {(canModerate || reply.userId === currentUserId) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-600"
                            onClick={() => handleDeleteReply(reply.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reply Form */}
        <form onSubmit={handleSubmitReply} className="pt-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[60px] flex-1"
              minLength={5}
              maxLength={2000}
            />
            <Button
              type="submit"
              disabled={submitting || !replyContent.trim()}
              className="bg-primary text-white hover:bg-primary/90 self-end"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}