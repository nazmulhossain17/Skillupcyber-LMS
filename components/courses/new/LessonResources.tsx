// ============================================
// FILE: components/courses/LessonResources.tsx
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  File, 
  FileImage, 
  FileVideo, 
  FileArchive,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Resource {
  id: string;
  title: string;
  type: 'file' | 'url' | 'document';
  url: string;
  fileSize: number | null;
  mimeType: string | null;
  description: string | null;
  isDownloadable: boolean;
}

interface LessonResourcesProps {
  lessonId: string;
  courseSlug: string;
}

export function LessonResources({ lessonId, courseSlug }: LessonResourcesProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResources();
  }, [lessonId]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/courses/${courseSlug}/lessons/${lessonId}/resources`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch resources');
      }
      
      const data = await res.json();
      setResources(data.resources || []);
    } catch (err) {
      console.error('Error fetching resources:', err);
      setError('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string | null, type: string) => {
    if (type === 'url') {
      return <ExternalLink className="h-5 w-5 text-blue-500" />;
    }
    
    if (!mimeType) {
      return <File className="h-5 w-5 text-gray-500" />;
    }

    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-5 w-5 text-green-500" />;
    }
    if (mimeType.startsWith('video/')) {
      return <FileVideo className="h-5 w-5 text-purple-500" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      return <FileArchive className="h-5 w-5 text-amber-500" />;
    }
    if (mimeType.includes('document') || mimeType.includes('word')) {
      return <FileText className="h-5 w-5 text-blue-600" />;
    }
    
    return <File className="h-5 w-5 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="text-center py-8">
        <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No resources attached to this lesson.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        {resources.length} resource{resources.length !== 1 ? 's' : ''} available for this lesson
      </p>
      
      {resources.map((resource) => (
        <div
          key={resource.id}
          className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border hover:bg-muted/80 transition-colors"
        >
          {/* Icon */}
          <div className="p-2 bg-background rounded-lg">
            {getFileIcon(resource.mimeType, resource.type)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{resource.title}</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="capitalize">{resource.type}</span>
              {resource.fileSize && (
                <>
                  <span>•</span>
                  <span>{formatFileSize(resource.fileSize)}</span>
                </>
              )}
            </div>
            {resource.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {resource.description}
              </p>
            )}
          </div>

          {/* Action Button */}
          {resource.type === 'url' ? (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </a>
            </Button>
          ) : resource.isDownloadable ? (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={resource.url} download={resource.title}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}