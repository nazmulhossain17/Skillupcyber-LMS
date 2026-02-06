// app/instructor/courses/[slug]/lessons/[lessonId]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor/RichTextEditor";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft, Video, FileText, Clock, Upload, X, Link2, File, ExternalLink, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { getSecureUrl } from "@/lib/media-url";
import { useS3Upload } from "@/hooks/use-s3-upload";

interface Resource {
  id: string;
  title: string;
  type: 'file' | 'url' | 'document';
  url: string;
  fileKey?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  description?: string | null;
  order: number;
  isDownloadable: boolean;
}

interface LessonContent {
  id?: string;
  content?: string | null;
  durationMinutes?: number | null;
  videoUrl?: string | null;
  videoPlaybackId?: string | null;
  isFree?: boolean | null;
  resources?: any;
}

interface Lesson {
  id: string;
  title: string;
  slug: string;
  order: number;
  sectionId: string;
  courseId: string;
  createdAt: string;
  updatedAt: string;
  content?: LessonContent | null;
}

export default function LessonEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const lessonId = params.lessonId as string;
  const sectionId = searchParams.get('sectionId');
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isNewLesson = lessonId === 'new';

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(!isNewLesson);
  const [saving, setSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoKey, setVideoKey] = useState("");
  const [isFree, setIsFree] = useState(false);

  // Resource dialog state
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'file' | 'url'>('url');
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");

  // Video upload hook - supports up to 7GB
  const videoUpload = useS3Upload({
    onComplete: (result) => {
      if (result.success && result.url && result.key) {
        // Delete old video if exists
        if (videoKey) {
          fetch(`/api/media/${videoKey}`, { method: "DELETE" }).catch(console.error);
        }
        setVideoUrl(result.url);
        setVideoKey(result.key);
        toast.success("Video uploaded successfully!");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload video");
    },
  });

  // Resource file upload hook
  const resourceUpload = useS3Upload({
    onComplete: async (result) => {
      if (result.success && result.url && result.key) {
        // Create resource record
        try {
          const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/resources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: resourceTitle || "Uploaded File",
              type: "file",
              url: result.url,
              fileKey: result.key,
              fileSize: pendingResourceFile?.size,
              mimeType: pendingResourceFile?.type,
              description: resourceDescription,
            }),
          });

          if (!res.ok) throw new Error("Failed to create resource");

          toast.success("Resource uploaded!");
          setResourceDialogOpen(false);
          resetResourceForm();
          fetchResources();
        } catch (error) {
          toast.error("Failed to save resource");
        }
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload resource");
    },
  });

  // Track pending resource file for metadata
  const [pendingResourceFile, setPendingResourceFile] = useState<File | null>(null);

  useEffect(() => {
    if (slug && lessonId && !isNewLesson) {
      fetchLesson();
      fetchResources();
    } else if (isNewLesson) {
      setLoading(false);
    }
  }, [slug, lessonId, isNewLesson]);

  const fetchLesson = async () => {
    try {
      const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/content`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      
      if (!res.ok) throw new Error("Failed to fetch lesson");

      const { lesson: data } = await res.json();
      
      setLesson(data);
      setTitle(data.title || "");
      setContent(data.content?.content || "");
      setDurationMinutes((data.content?.durationMinutes || 0).toString());
      setVideoUrl(data.content?.videoUrl || "");
      setIsFree(data.content?.isFree || false);

      // Extract video key from URL if it exists
      if (data.content?.videoUrl) {
        // Try to extract key from various URL formats
        const url = data.content.videoUrl;
        if (url.includes('/uploads/')) {
          const match = url.match(/uploads\/(.+)$/);
          if (match) setVideoKey(match[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching lesson:', error);
      toast.error("Failed to load lesson");
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/resources`);
      if (res.ok) {
        const { resources: data } = await res.json();
        setResources(data);
      }
    } catch (error) {
      console.error("Failed to fetch resources:", error);
    }
  };

  // Handle video file selection
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid video file (MP4, WebM, MOV, AVI, MKV)");
      return;
    }

    // Now supports up to 7GB!
    const maxSize = 7 * 1024 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Video file size must be less than 7GB");
      return;
    }

    await videoUpload.upload(file);
    
    // Reset input
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleDeleteVideo = async () => {
    if (!videoUrl) return;
    if (!confirm("Delete this video?")) return;

    try {
      if (videoKey) {
        await fetch(`/api/media/${videoKey}`, { method: "DELETE" }).catch(console.error);
      }
      setVideoUrl("");
      setVideoKey("");
      toast.success("Video deleted!");
    } catch (error) {
      console.error("Delete error:", error);
      setVideoUrl("");
      setVideoKey("");
    }
  };

  const handleResourceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isNewLesson) {
      toast.error("Please save the lesson first before adding resources");
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be less than 100MB");
      return;
    }

    // Store file metadata for later
    setPendingResourceFile(file);
    
    // Upload using presigned URL
    await resourceUpload.upload(file);
    
    // Reset
    setPendingResourceFile(null);
    if (resourceFileInputRef.current) resourceFileInputRef.current.value = '';
  };

  const handleAddUrlResource = async () => {
    if (isNewLesson) {
      toast.error("Please save the lesson first before adding resources");
      return;
    }

    if (!resourceTitle.trim() || !resourceUrl.trim()) {
      toast.error("Title and URL are required");
      return;
    }

    try {
      const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: resourceTitle.trim(),
          type: "url",
          url: resourceUrl.trim(),
          description: resourceDescription.trim() || null,
        }),
      });

      if (!res.ok) throw new Error();

      toast.success("Resource added!");
      setResourceDialogOpen(false);
      resetResourceForm();
      fetchResources();
    } catch (error) {
      toast.error("Failed to add resource");
    }
  };

  const handleDeleteResource = async (resourceId: string, fileKey?: string | null) => {
    if (!confirm("Delete this resource?")) return;

    try {
      const res = await fetch(
        `/api/courses/${slug}/lessons/${lessonId}/resources?resourceId=${resourceId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error();

      if (fileKey) {
        await fetch(`/api/media/${fileKey}`, { method: "DELETE" }).catch(console.error);
      }

      toast.success("Resource deleted!");
      fetchResources();
    } catch (error) {
      toast.error("Failed to delete resource");
    }
  };

  const resetResourceForm = () => {
    setResourceTitle("");
    setResourceUrl("");
    setResourceDescription("");
    setResourceType("url");
    setPendingResourceFile(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      return toast.error("Title is required");
    }

    if (isNewLesson && !sectionId) {
      return toast.error("Section ID is required");
    }

    setSaving(true);
    try {
      if (isNewLesson) {
        const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/lessons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim() || null,
            durationMinutes: parseInt(durationMinutes) || 0,
            videoUrl: videoUrl || null,
            isFree,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to create lesson");
        }

        const { lesson: createdLesson } = await res.json();
        toast.success("Lesson created successfully!");
        
        await new Promise(resolve => setTimeout(resolve, 300));
        router.push(`/instructor/courses/${slug}/lessons/${createdLesson.id}`);

      } else {
        const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim() || null,
            durationMinutes: parseInt(durationMinutes) || 0,
            videoUrl: videoUrl || null,
            isFree,
          }),
        });

        if (!res.ok) throw new Error("Failed to save lesson");

        const { lesson: updatedLesson } = await res.json();
        setLesson(updatedLesson);
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || (isNewLesson ? "Failed to create lesson" : "Failed to save lesson"));
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lesson && !isNewLesson) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold mb-4 text-dark dark:text-white">Lesson not found</h2>
        <Button onClick={() => router.back()} className="bg-primary text-white hover:bg-primary/90">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const isUploading = videoUpload.uploading || resourceUpload.uploading;

  return (
    <div className="min-h-screen bg-gray dark:bg-gray-dark">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Hidden file inputs */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/x-matroska"
          onChange={handleVideoSelect}
          className="hidden"
        />
        <input
          ref={resourceFileInputRef}
          type="file"
          onChange={handleResourceFileSelect}
          className="hidden"
        />

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <DialogHeader>
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-green-light-7 dark:bg-green-dark/20">
                <CheckCircle2 className="w-10 h-10 text-green dark:text-green-light" />
              </div>
              <DialogTitle className="text-center text-2xl text-dark dark:text-white">
                Lesson Saved Successfully!
              </DialogTitle>
              <DialogDescription className="text-center text-dark-5 dark:text-dark-6">
                Your lesson "<span className="font-semibold text-dark dark:text-white">{title}</span>" has been updated.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-4">
              <Button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-primary text-white hover:bg-primary/90"
                size="lg"
              >
                Continue Editing
              </Button>
              <Button
                onClick={() => router.push(`/instructor/courses/${slug}/sections`)}
                variant="outline"
                className="w-full border-stroke dark:border-stroke-dark text-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-3"
                size="lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Course
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4 text-dark-5 dark:text-dark-6 hover:text-dark dark:hover:text-white hover:bg-gray-2 dark:hover:bg-dark-3"
            onClick={() => router.push(`/instructor/courses/${slug}/sections`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Course
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-dark dark:text-white">
                {isNewLesson ? 'Create New Lesson' : 'Edit Lesson'}
              </h1>
              <p className="text-dark-5 dark:text-dark-6 mt-1">
                {isNewLesson 
                  ? 'Add a new lesson to your course' 
                  : 'Manage your lesson content and settings'
                }
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={saving || isUploading}
              className="bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isNewLesson ? 'Creating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isNewLesson ? 'Create Lesson' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-dark dark:text-white">
                <FileText className="h-5 w-5 text-primary" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-dark dark:text-white">Lesson Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Introduction to Neural Networks"
                  className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark text-dark dark:text-white placeholder:text-dark-6"
                />
              </div>

              <div>
                <Label htmlFor="duration" className="text-dark dark:text-white">Duration (minutes)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-dark-5" />
                  <Input
                    id="duration"
                    type="number"
                    min="0"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="0"
                    className="bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark text-dark dark:text-white"
                  />
                </div>
              </div>

              {/* Free Preview Toggle */}
              <div className="flex items-center gap-4 p-4 rounded-lg border border-stroke dark:border-stroke-dark bg-gray-1 dark:bg-dark-3">
                <button
                  type="button"
                  onClick={() => setIsFree(!isFree)}
                  className={`
                    relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full 
                    border-2 border-transparent transition-colors duration-300 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                    ${isFree 
                      ? 'bg-green dark:bg-green-light-1' 
                      : 'bg-red dark:bg-red-light'
                    }
                  `}
                  role="switch"
                  aria-checked={isFree}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-6 w-6 transform rounded-full 
                      bg-white shadow-lg ring-0 transition-transform duration-300 ease-in-out
                      ${isFree ? 'translate-x-8' : 'translate-x-1'}
                    `}
                  />
                </button>
                <div className="flex flex-col">
                  <span 
                    className="font-semibold text-dark dark:text-white cursor-pointer"
                    onClick={() => setIsFree(!isFree)}
                  >
                    Free Preview
                  </span>
                  <span className="text-sm text-dark-5 dark:text-dark-6">
                    {isFree 
                      ? '✓ Students can watch without enrolling' 
                      : '✗ Only enrolled students can watch'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video Upload - Now supports 7GB! */}
          <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-dark dark:text-white">
                <Video className="h-5 w-5 text-primary" />
                Video File
                <span className="text-xs font-normal text-dark-5 ml-2">(Up to 7GB)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!videoUrl ? (
                <div
                  onClick={() => !videoUpload.uploading && videoInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200
                    ${videoUpload.uploading 
                      ? 'border-primary/50 bg-primary/5 cursor-not-allowed opacity-70' 
                      : 'border-stroke dark:border-stroke-dark hover:border-primary hover:bg-primary/5 cursor-pointer'
                    }
                  `}
                >
                  {videoUpload.uploading ? (
                    <>
                      <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
                      <p className="text-lg font-medium mb-2 text-dark dark:text-white">Uploading Video...</p>
                      <p className="text-sm text-dark-5 dark:text-dark-6">
                        Please wait while your video is being uploaded
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 mx-auto mb-4 text-dark-5 dark:text-dark-6" />
                      <p className="text-lg font-medium mb-2 text-dark dark:text-white">Upload Video</p>
                      <p className="text-sm text-dark-5 dark:text-dark-6">
                        Click to browse or drag and drop
                      </p>
                      <p className="text-xs text-dark-6 mt-1">
                        Supports MP4, WebM, MOV, AVI, MKV (Max 7GB)
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-dark rounded-lg overflow-hidden">
                    <video
                      src={getSecureUrl(videoUrl)}
                      controls
                      className="w-full h-full"
                      preload="metadata"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => videoInputRef.current?.click()}
                      disabled={videoUpload.uploading}
                      className="flex-1 bg-blue text-white hover:bg-blue-dark disabled:opacity-50"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Replace Video
                    </Button>
                    <Button 
                      onClick={handleDeleteVideo} 
                      disabled={videoUpload.uploading}
                      className="bg-red text-white hover:bg-red-dark disabled:opacity-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {videoUpload.uploading && videoUpload.progress && (
                <div className="space-y-2 p-4 bg-gray-1 dark:bg-dark-3 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-5 dark:text-dark-6">
                      {videoUpload.formatBytes(videoUpload.progress.loaded)} / {videoUpload.formatBytes(videoUpload.progress.total)}
                    </span>
                    <span className="font-medium text-primary">{videoUpload.progress.percentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-3 dark:bg-dark-4 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${videoUpload.progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-dark-5">
                    <span>{videoUpload.formatBytes(videoUpload.progress.speed)}/s</span>
                    <span>{videoUpload.formatTime(videoUpload.progress.remainingTime)} remaining</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => videoUpload.cancel()}
                    className="mt-2 border-red text-red hover:bg-red/10"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel Upload
                  </Button>
                </div>
              )}

              {videoUpload.error && (
                <div className="p-4 bg-red-light-6 dark:bg-red-dark/10 border border-red-light-3 dark:border-red-dark/30 rounded-lg">
                  <p className="text-sm text-red dark:text-red-light">{videoUpload.error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Text Content with Rich Text Editor */}
          <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <CardHeader>
              <CardTitle className="text-dark dark:text-white">Lesson Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="content" className="mb-2 block text-dark dark:text-white">
                  Content / Notes
                </Label>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Write your lesson description, add notes, code examples, key points..."
                />
                <p className="text-xs text-dark-6 mt-2">
                  Use the rich text editor to format your lesson content
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resources */}
          <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-dark dark:text-white">
                  <File className="h-5 w-5 text-primary" />
                  Resources {!isNewLesson && resources.length > 0 && `(${resources.length})`}
                </CardTitle>
                <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      onClick={resetResourceForm}
                      disabled={isNewLesson}
                      className="bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Resource
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                    <DialogHeader>
                      <DialogTitle className="text-dark dark:text-white">Add Resource</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label className="text-dark dark:text-white">Resource Type</Label>
                        <Select
                          value={resourceType}
                          onValueChange={(v) => setResourceType(v as 'file' | 'url')}
                        >
                          <SelectTrigger className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark text-dark dark:text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                            <SelectItem value="url" className="text-dark dark:text-white">URL / Link</SelectItem>
                            <SelectItem value="file" className="text-dark dark:text-white">Upload File</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-dark dark:text-white">Title *</Label>
                        <Input
                          value={resourceTitle}
                          onChange={(e) => setResourceTitle(e.target.value)}
                          placeholder="e.g., Course Notes PDF"
                          className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark text-dark dark:text-white"
                        />
                      </div>

                      {resourceType === 'url' ? (
                        <div>
                          <Label className="text-dark dark:text-white">URL *</Label>
                          <Input
                            value={resourceUrl}
                            onChange={(e) => setResourceUrl(e.target.value)}
                            placeholder="https://..."
                            className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark text-dark dark:text-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <Label className="text-dark dark:text-white">File</Label>
                          <Button
                            variant="outline"
                            onClick={() => resourceFileInputRef.current?.click()}
                            className="w-full mt-1 border-stroke dark:border-stroke-dark text-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-3"
                            disabled={resourceUpload.uploading}
                          >
                            {resourceUpload.uploading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Choose File (Max 100MB)
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      <div>
                        <Label className="text-dark dark:text-white">Description</Label>
                        <Input
                          value={resourceDescription}
                          onChange={(e) => setResourceDescription(e.target.value)}
                          placeholder="Optional description..."
                          className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark text-dark dark:text-white"
                        />
                      </div>

                      {/* Resource Upload Progress */}
                      {resourceUpload.uploading && resourceUpload.progress && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-dark-5">Uploading...</span>
                            <span className="text-primary font-medium">{resourceUpload.progress.percentage}%</span>
                          </div>
                          <div className="h-2 bg-gray-3 dark:bg-dark-3 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-300 rounded-full"
                              style={{ width: `${resourceUpload.progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setResourceDialogOpen(false)}
                          className="border-stroke dark:border-stroke-dark text-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-3"
                        >
                          Cancel
                        </Button>
                        {resourceType === 'url' && (
                          <Button 
                            onClick={handleAddUrlResource}
                            className="bg-primary text-white hover:bg-primary/90"
                          >
                            Add Resource
                          </Button>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isNewLesson ? (
                <div className="rounded-lg p-6 text-center border border-blue-light-3 dark:border-blue-dark/30 bg-blue-light-5 dark:bg-blue-dark/10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-light-4 dark:bg-blue-dark/20 mb-3">
                    <File className="w-6 h-6 text-blue dark:text-blue-light" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-dark dark:text-white">Resources Coming Soon!</h3>
                  <p className="text-sm text-dark-5 dark:text-dark-6">
                    Create your lesson first, then you can add PDFs, documents, and other downloadable resources.
                  </p>
                </div>
              ) : resources.length === 0 ? (
                <p className="text-sm text-dark-5 dark:text-dark-6 text-center py-8">
                  No resources added yet. Add files or links for students.
                </p>
              ) : (
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className="flex items-center justify-between p-3 border border-stroke dark:border-stroke-dark rounded-lg hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {resource.type === 'file' ? (
                          <File className="h-5 w-5 text-dark-5" />
                        ) : (
                          <Link2 className="h-5 w-5 text-dark-5" />
                        )}
                        <div>
                          <h4 className="font-medium text-sm text-dark dark:text-white">{resource.title}</h4>
                          <p className="text-xs text-dark-6">
                            {resource.type === 'file' ? formatFileSize(resource.fileSize) : "External link"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => window.open(getSecureUrl(resource.url), "_blank")}
                          className="bg-blue text-white hover:bg-blue-dark h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDeleteResource(resource.id, resource.fileKey)}
                          className="bg-red text-white hover:bg-red-dark h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end pb-8">
            <Button 
              onClick={handleSave} 
              disabled={saving || isUploading} 
              size="lg"
              className="bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isNewLesson ? 'Creating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  {isNewLesson ? 'Create Lesson' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}