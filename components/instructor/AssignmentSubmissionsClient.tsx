// ============================================
// FILE: components/instructor/AssignmentSubmissionsClient.tsx
// Client component for viewing/grading student submissions
// Uses CSS variable colors from globals.css
// ============================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  FileText,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  MoreVertical,
  Loader2,
  Star,
  RefreshCw,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Send,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Course {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  assignments: {
    id: string;
    title: string;
    maxScore: number;
  }[];
  assignmentCount: number;
}

interface Attachment {
  url: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  key?: string;
}

interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatar: string | null;
  content: string | null;
  attachments: Attachment[] | null;
  submittedAt: string;
  status: 'pending' | 'submitted' | 'graded' | 'late';
  grade: number | null;
  maxGrade: number;
  feedback: string | null;
  gradedAt: string | null;
  courseTitle: string;
  courseSlug: string;
}

interface AssignmentSubmissionsClientProps {
  courses: Course[];
  instructorId: string;
}

export function AssignmentSubmissionsClient({
  courses,
  instructorId,
}: AssignmentSubmissionsClientProps) {
  // Filters
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetched = useRef(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const LIMIT = 20;
  
  // Grading
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeValue, setGradeValue] = useState(0);
  const [feedbackValue, setFeedbackValue] = useState('');
  const [grading, setGrading] = useState(false);
  
  // Preview
  const [previewSubmission, setPreviewSubmission] = useState<Submission | null>(null);
  
  // Stats
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    graded: number;
    avgGrade: number | string | null;
  }>({
    total: 0,
    pending: 0,
    graded: 0,
    avgGrade: 0,
  });

  // Get assignments for selected course
  const availableAssignments = selectedCourse === 'all'
    ? courses.flatMap(c => c.assignments.map(a => ({ ...a, courseTitle: c.title })))
    : courses.find(c => c.id === selectedCourse)?.assignments || [];

  // Fetch submissions
  const fetchSubmissions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: LIMIT.toString(),
      });

      if (selectedCourse !== 'all') params.append('courseId', selectedCourse);
      if (selectedAssignment !== 'all') params.append('assignmentId', selectedAssignment);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/instructor/assignments/submissions?${params}`);
      const data = await res.json();

      if (data.success) {
        setSubmissions(data.submissions || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalSubmissions(data.pagination?.total || 0);
        setStats(data.stats || { total: 0, pending: 0, graded: 0, avgGrade: 0 });
      } else {
        toast.error(data.error || 'Failed to load submissions');
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedCourse, selectedAssignment, selectedStatus, searchQuery]);

  // Initial fetch
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchSubmissions();
    }
  }, []);

  // Refetch when filters change
  useEffect(() => {
    if (hasFetched.current) {
      setPage(1);
      fetchSubmissions();
    }
  }, [selectedCourse, selectedAssignment, selectedStatus]);

  // Refetch when page changes
  useEffect(() => {
    if (hasFetched.current && page > 1) {
      fetchSubmissions();
    }
  }, [page]);

  // Search with debounce
  useEffect(() => {
    if (!hasFetched.current) return;
    
    const timer = setTimeout(() => {
      setPage(1);
      fetchSubmissions();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Grade submission
  const handleGradeSubmission = async () => {
    if (!gradingSubmission) return;

    setGrading(true);
    try {
      const res = await fetch(`/api/instructor/assignments/submissions/${gradingSubmission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: gradeValue,
          feedback: feedbackValue.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to grade submission');
      }

      toast.success('Submission graded successfully!');
      
      // Update local state
      setSubmissions(prev => prev.map(s => 
        s.id === gradingSubmission.id
          ? { ...s, grade: gradeValue, feedback: feedbackValue.trim(), status: 'graded', gradedAt: new Date().toISOString() }
          : s
      ));
      
      // Update stats
      if (gradingSubmission.status !== 'graded') {
        setStats(prev => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          graded: prev.graded + 1,
        }));
      }
      
      setGradingSubmission(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to grade submission');
    } finally {
      setGrading(false);
    }
  };

  // Start grading
  const startGrading = (submission: Submission) => {
    setGradingSubmission(submission);
    setGradeValue(submission.grade || 0);
    setFeedbackValue(submission.feedback || '');
  };

  // Get status badge - using CSS variable colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return <Badge className="bg-green text-white"><CheckCircle className="h-3 w-3 mr-1" />Graded</Badge>;
      case 'submitted':
        return <Badge className="bg-blue text-white"><Clock className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-dark border-yellow-dark"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'late':
        return <Badge className="bg-red text-white"><AlertCircle className="h-3 w-3 mr-1" />Late</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Get grade color - using CSS variable colors
  const getGradeColor = (grade: number, max: number) => {
    const percentage = (grade / max) * 100;
    if (percentage >= 80) return 'text-green';
    if (percentage >= 60) return 'text-yellow-dark';
    if (percentage >= 40) return 'text-orange-light';
    return 'text-red';
  };

  // Parse attachments (can be JSON or already parsed)
  const parseAttachments = (attachments: any): Attachment[] => {
    if (!attachments) return [];
    if (Array.isArray(attachments)) return attachments;
    try {
      return JSON.parse(attachments);
    } catch {
      return [];
    }
  };

  // Secure file download/view handler
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  
  const handleSecureDownload = async (attachment: Attachment, forceDownload = false) => {
    const fileId = attachment.url || attachment.key || attachment.fileName;
    setDownloadingFile(fileId);
    
    try {
      const params = new URLSearchParams({
        url: attachment.url,
        name: attachment.fileName,
        ...(forceDownload && { download: 'true' }),
      });
      
      if (attachment.key) {
        params.append('key', attachment.key);
      }
      
      const res = await fetch(`/api/files/download?${params}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get download URL');
      }
      
      // Open pre-signed URL in new tab or trigger download
      if (forceDownload) {
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = data.url;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Open in new tab for viewing
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray dark:bg-dark">
      {/* Header */}
      <div className="bg-white dark:bg-dark-2 border-b border-stroke dark:border-stroke-dark">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-dark dark:text-white">
                Assignment Submissions
              </h1>
              <p className="text-dark-5 dark:text-dark-6 mt-1">
                Review and grade student assignments
              </p>
            </div>
            <Button
              onClick={() => fetchSubmissions(true)}
              disabled={refreshing}
              variant="outline"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark dark:text-white">{stats.total}</p>
                  <p className="text-xs text-dark-5 dark:text-dark-6">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-dark/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-dark" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark dark:text-white">{stats.pending}</p>
                  <p className="text-xs text-dark-5 dark:text-dark-6">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark dark:text-white">{stats.graded}</p>
                  <p className="text-xs text-dark-5 dark:text-dark-6">Graded</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue/10 flex items-center justify-center">
                  <Star className="h-5 w-5 text-blue" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark dark:text-white">
                    {stats.avgGrade ? Number(stats.avgGrade).toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-dark-5 dark:text-dark-6">Avg. Grade</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-5" />
                <Input
                  placeholder="Search by student name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Course Filter */}
              <Select value={selectedCourse} onValueChange={(v) => {
                setSelectedCourse(v);
                setSelectedAssignment('all');
              }}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Assignment Filter */}
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="All Assignments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  {availableAssignments.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="graded">Graded</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Submissions</CardTitle>
              <p className="text-sm text-dark-5 dark:text-dark-6">
                {totalSubmissions} submission{totalSubmissions !== 1 ? 's' : ''}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : submissions.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                        <TableRow key={submission.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={submission.studentAvatar || undefined} />
                                <AvatarFallback className="text-xs">
                                  {submission.studentName?.charAt(0) || 'S'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{submission.studentName}</p>
                                <p className="text-xs text-dark-5 dark:text-dark-6">
                                  {submission.studentEmail}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm line-clamp-1">
                              {submission.assignmentTitle}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-dark-5 dark:text-dark-6 line-clamp-1">
                              {submission.courseTitle}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{format(new Date(submission.submittedAt), 'MMM d, yyyy')}</p>
                              <p className="text-xs text-dark-5 dark:text-dark-6">
                                {format(new Date(submission.submittedAt), 'h:mm a')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(submission.status)}
                          </TableCell>
                          <TableCell>
                            {submission.grade !== null ? (
                              <span className={cn("font-semibold", getGradeColor(submission.grade, submission.maxGrade))}>
                                {submission.grade}/{submission.maxGrade}
                              </span>
                            ) : (
                              <span className="text-dark-5 dark:text-dark-6">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewSubmission(submission)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startGrading(submission)}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setPreviewSubmission(submission)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => startGrading(submission)}>
                                  <Star className="h-4 w-4 mr-2" />
                                  Grade
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-stroke dark:border-stroke-dark">
                    <p className="text-sm text-dark-5 dark:text-dark-6">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Inbox className="h-12 w-12 mx-auto text-dark-5 dark:text-dark-6 mb-3" />
                <p className="text-dark-5 dark:text-dark-6 font-medium">No submissions found</p>
                <p className="text-sm text-dark-5 dark:text-dark-6 mt-1">
                  {courses.length === 0 
                    ? "You don't have any courses with assignments yet."
                    : "Try adjusting your filters or wait for students to submit."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewSubmission} onOpenChange={(open) => !open && setPreviewSubmission(null)}>
        <DialogContent className="bg-white text-black dark:bg-gray-950 dark:text-white max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              {previewSubmission?.assignmentTitle}
            </DialogDescription>
          </DialogHeader>
          
          {previewSubmission && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                {/* Student Info */}
                <div className="flex items-center gap-4 p-4 bg-gray dark:bg-dark rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={previewSubmission.studentAvatar || undefined} />
                    <AvatarFallback>{previewSubmission.studentName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{previewSubmission.studentName}</p>
                    <p className="text-sm text-dark-5 dark:text-dark-6">{previewSubmission.studentEmail}</p>
                  </div>
                  {getStatusBadge(previewSubmission.status)}
                </div>

                {/* Submission Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-dark-5 dark:text-dark-6">Course</p>
                    <p className="font-medium">{previewSubmission.courseTitle}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-5 dark:text-dark-6">Submitted</p>
                    <p className="font-medium">
                      {format(new Date(previewSubmission.submittedAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {previewSubmission.grade !== null && (
                    <>
                      <div>
                        <p className="text-sm text-dark-5 dark:text-dark-6">Grade</p>
                        <p className={cn("font-semibold text-lg", getGradeColor(previewSubmission.grade, previewSubmission.maxGrade))}>
                          {previewSubmission.grade}/{previewSubmission.maxGrade}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-dark-5 dark:text-dark-6">Graded</p>
                        <p className="font-medium">
                          {previewSubmission.gradedAt 
                            ? format(new Date(previewSubmission.gradedAt), 'MMM d, yyyy')
                            : '-'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Submission Content */}
                {previewSubmission.content && (
                  <div>
                    <p className="text-sm text-dark-5 dark:text-dark-6 mb-2">Submission Content</p>
                    <div className="p-4 bg-gray dark:bg-dark rounded-lg">
                      <p className="whitespace-pre-wrap text-sm">{previewSubmission.content}</p>
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {previewSubmission.attachments && parseAttachments(previewSubmission.attachments).length > 0 && (
                  <div>
                    <p className="text-sm text-dark-5 dark:text-dark-6 mb-2">Attachments</p>
                    <div className="space-y-2">
                      {parseAttachments(previewSubmission.attachments).map((attachment, idx) => {
                        const fileId = attachment.url || attachment.key || attachment.fileName;
                        const isDownloading = downloadingFile === fileId;
                        
                        return (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-gray dark:bg-dark rounded-lg">
                            <FileText className="h-6 w-6 text-primary" />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{attachment.fileName}</p>
                              {attachment.fileSize && (
                                <p className="text-xs text-dark-5 dark:text-dark-6">
                                  {(attachment.fileSize / 1024).toFixed(1)} KB
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleSecureDownload(attachment, false)}
                                disabled={isDownloading}
                              >
                                {isDownloading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View
                                  </>
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleSecureDownload(attachment, true)}
                                disabled={isDownloading}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {previewSubmission.feedback && (
                  <div>
                    <p className="text-sm text-dark-5 dark:text-dark-6 mb-2">Instructor Feedback</p>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="whitespace-pre-wrap text-sm">{previewSubmission.feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewSubmission(null)}>
              Close
            </Button>
            {previewSubmission && (
              <Button onClick={() => {
                setPreviewSubmission(null);
                startGrading(previewSubmission);
              }}>
                <Star className="h-4 w-4 mr-2" />
                {previewSubmission.status === 'graded' ? 'Update Grade' : 'Grade'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grading Modal */}
      <Dialog open={!!gradingSubmission} onOpenChange={(open) => !open && setGradingSubmission(null)}>
        <DialogContent className="max-w-md bg-white text-black dark:bg-gray-950 dark:text-white">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              {gradingSubmission?.studentName} - {gradingSubmission?.assignmentTitle}
            </DialogDescription>
          </DialogHeader>
          
          {gradingSubmission && (
            <div className="space-y-6 py-4">
              {/* Grade Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Grade</Label>
                  <span className="text-2xl font-bold text-primary">
                    {gradeValue}/{gradingSubmission.maxGrade}
                  </span>
                </div>
                <Slider
                  value={[gradeValue]}
                  onValueChange={([value]) => setGradeValue(value)}
                  max={gradingSubmission.maxGrade}
                  step={1}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-dark-5 dark:text-dark-6">
                  <span>0</span>
                  <span>{gradingSubmission.maxGrade / 2}</span>
                  <span>{gradingSubmission.maxGrade}</span>
                </div>
              </div>

              {/* Quick Grade Buttons */}
              <div className="flex gap-2">
                {[100, 80, 60, 40, 0].map((percent) => {
                  const grade = Math.round((percent / 100) * gradingSubmission.maxGrade);
                  return (
                    <Button
                      key={percent}
                      variant={gradeValue === grade ? "default" : "outline"}
                      size="sm"
                      onClick={() => setGradeValue(grade)}
                      className="flex-1"
                    >
                      {percent}%
                    </Button>
                  );
                })}
              </div>

              {/* Feedback */}
              <div className="space-y-2">
                <Label>Feedback (optional)</Label>
                <Textarea
                  placeholder="Provide feedback to the student..."
                  value={feedbackValue}
                  onChange={(e) => setFeedbackValue(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingSubmission(null)}>
              Cancel
            </Button>
            <Button onClick={handleGradeSubmission} disabled={grading}>
              {grading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Grade
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}