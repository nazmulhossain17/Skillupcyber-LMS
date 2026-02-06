// ============================================
// FILE: components/courses/AssignmentPlayer.tsx
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Calendar, 
  Target, 
  Upload, 
  X, 
  Paperclip,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast } from 'date-fns';

interface Assignment {
  id: string;
  title: string;
  instructions: string | null;
  dueDate: Date | null;
  maxScore: number;
}

interface Attachment {
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  key: string;
}

interface Submission {
  id: string;
  content: string | null;
  attachments: Attachment[];
  status: 'pending' | 'submitted' | 'graded' | 'late';
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
}

interface AssignmentPlayerProps {
  assignment: Assignment | null;
  courseSlug: string;
  sectionTitle: string;
}

export function AssignmentPlayer({ assignment, courseSlug, sectionTitle }: AssignmentPlayerProps) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (assignment?.id) {
      fetchSubmission();
    }
  }, [assignment?.id]);

  const fetchSubmission = async () => {
    if (!assignment) return;
    
    try {
      const res = await fetch(`/api/courses/${courseSlug}/assignments/${assignment.id}/submit`);
      if (res.ok) {
        const data = await res.json();
        if (data.submission) {
          setSubmission(data.submission);
          setContent(data.submission.content || '');
          setAttachments(data.submission.attachments || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch submission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Get presigned URL
        const res = await fetch('/api/s3/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });

        if (!res.ok) throw new Error('Failed to get upload URL');
        
        const { presignedUrl, key, url } = await res.json();

        // Upload to S3
        await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        setAttachments(prev => [...prev, {
          url,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          key,
        }]);
      }
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (index: number) => {
    const attachment = attachments[index];
    try {
      await fetch('/api/s3/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: attachment.key }),
      });
      setAttachments(prev => prev.filter((_, i) => i !== index));
      toast.success('File removed');
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleSubmit = async () => {
    if (!assignment || !content.trim()) {
      toast.error('Please enter your submission content');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/assignments/${assignment.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit');
      }

      const data = await res.json();
      setSubmission(data.submission);
      toast.success('Assignment submitted successfully!');
    } catch (error) {
      console.error('Submit failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!assignment) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-purple-900 to-indigo-900">
        <Card className="max-w-md bg-white/10 backdrop-blur border-white/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">No Assignment</h3>
            <p className="text-gray-300 text-sm">This section doesn't have an assignment yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isGraded = submission?.status === 'graded';
  const isOverdue = assignment.dueDate && isPast(new Date(assignment.dueDate));

  return (
    <div className="w-full h-full bg-linear-to-br from-purple-900 via-indigo-900 to-purple-900 overflow-y-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FileText className="h-7 w-7 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Assignment</p>
                <h1 className="text-2xl font-bold">{assignment.title}</h1>
              </div>
              
              {/* Status Badge */}
              {submission && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isGraded ? 'bg-green-100 text-green-700' :
                  submission.status === 'late' ? 'bg-red-100 text-red-700' :
                  submission.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {isGraded ? 'Graded' : 
                   submission.status === 'late' ? 'Late' :
                   submission.status === 'submitted' ? 'Submitted' : 'Pending'}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Max Score
                </div>
                <p className="font-bold text-lg">{assignment.maxScore}</p>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Due Date
                </div>
                <p className="font-bold text-lg">
                  {assignment.dueDate 
                    ? format(new Date(assignment.dueDate), 'MMM d, yyyy')
                    : 'No deadline'}
                </p>
              </div>

              {isGraded && submission && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Trophy className="h-4 w-4" />
                    Your Score
                  </div>
                  <p className="font-bold text-lg text-green-700">
                    {submission.score}/{assignment.maxScore}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Graded Feedback */}
        {isGraded && submission?.feedback && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-green-800 mb-2">Instructor Feedback</h3>
              <p className="text-green-700">{submission.feedback}</p>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {assignment.instructions && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Instructions</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submission Form */}
        {!isGraded && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Your Submission</h3>
              
              {/* Overdue Warning */}
              {isOverdue && !submission && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">This assignment is overdue. Your submission will be marked as late.</span>
                </div>
              )}

              {/* Content Textarea */}
              <Textarea
                placeholder="Write your submission here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="mb-4"
                disabled={isGraded}
              />

              {/* File Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Attachments</label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={uploading || isGraded}
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground mt-2">
                      {uploading ? 'Uploading...' : 'Click to upload files'}
                    </span>
                  </label>
                </div>

                {/* Attached Files */}
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-3 p-2 bg-muted rounded-lg"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{file.fileName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)}
                        </span>
                        {!isGraded && (
                          <button
                            onClick={() => removeAttachment(index)}
                            className="p-1 hover:bg-destructive/10 rounded"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !content.trim() || isGraded}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : submission ? (
                  'Update Submission'
                ) : (
                  'Submit Assignment'
                )}
              </Button>

              {submission?.submittedAt && (
                <p className="text-sm text-muted-foreground text-center mt-3">
                  Last submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* View-only mode for graded submissions */}
        {isGraded && submission && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Your Submission</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none bg-muted p-4 rounded-lg">
                <p className="whitespace-pre-wrap">{submission.content}</p>
              </div>
              
              {submission.attachments?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Attachments</p>
                  <div className="space-y-2">
                    {submission.attachments.map((file, index) => (
                      <a
                        key={index}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2 bg-muted rounded-lg hover:bg-muted/80"
                      >
                        <Paperclip className="h-4 w-4" />
                        <span className="text-sm flex-1">{file.fileName}</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}