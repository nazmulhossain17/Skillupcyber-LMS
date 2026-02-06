"use client"

import type React from "react"
import { useState } from "react"
import { Upload, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { getSecureUrl } from "@/lib/media-url"

interface ImageUploaderSingleProps {
  onUploadSuccess: (url: string) => void
  onRemove: () => void
  existingUrl?: string
}

export function ImageUploaderSingle({ onUploadSuccess, onRemove, existingUrl }: ImageUploaderSingleProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null)
  const [secureId, setSecureId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file")
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB")
      return
    }

    setUploading(true)

    try {
      // Create FormData - this is the key change!
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'uploads/thumbnails')
      formData.append('type', 'image')
      formData.append('public', 'true') // Thumbnails can be public

      // Upload via server - DO NOT set Content-Type header!
      const response = await fetch("/api/s3/upload/secure", {
        method: "POST",
        body: formData,
        // ⚠️ No headers! Browser sets Content-Type automatically for FormData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || "Upload failed")
      }

      // data.url is like "/api/media/abc123..."
      setPreviewUrl(data.url)
      setSecureId(data.id)
      onUploadSuccess(data.url)
      toast.success("Image uploaded successfully")

    } catch (error: any) {
      console.error("Upload error:", error)
      toast.error(error.message || "Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!secureId && !previewUrl) return

    setDeleting(true)

    try {
      // Get the secure ID from the URL if we don't have it
      let idToDelete = secureId
      if (!idToDelete && previewUrl) {
        // Extract ID from URL: /api/media/abc123...
        const match = previewUrl.match(/\/api\/media\/([^/?]+)/)
        idToDelete = match?.[1] || null
      }

      if (idToDelete) {
        const deleteRes = await fetch(`/api/media/${idToDelete}`, {
          method: "DELETE",
        })

        if (!deleteRes.ok) {
          console.warn("Failed to delete file from storage")
        }
      }

      setPreviewUrl(null)
      setSecureId(null)
      onRemove()
      toast.success("Image removed")

    } catch (error) {
      console.error("Delete error:", error)
      // Still remove from UI even if delete fails
      setPreviewUrl(null)
      setSecureId(null)
      onRemove()
    } finally {
      setDeleting(false)
    }
  }

  // Convert URL to secure proxy URL if it's an S3 URL
  const displayUrl = previewUrl ? getSecureUrl(previewUrl) : null

  return (
    <div className="space-y-4">
      {displayUrl ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
          <img 
            src={displayUrl} 
            alt="Course thumbnail" 
            className="w-full h-full object-cover" 
          />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2"
            onClick={handleRemove}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </Button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            id="course-thumbnail-upload"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <label
            htmlFor="course-thumbnail-upload"
            className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex flex-col items-center justify-center py-6">
              {uploading ? (
                <>
                  <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG or WEBP (max 10MB)</p>
                </>
              )}
            </div>
          </label>
        </div>
      )}
    </div>
  )
}