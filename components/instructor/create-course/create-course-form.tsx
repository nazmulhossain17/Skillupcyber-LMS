"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import confetti from "canvas-confetti"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { RichTextEditor } from "@/components/rich-text-editor/RichTextEditor"
import { ImageUploaderSingle } from "@/components/file-uploader/Uploader"

// ✅ FIXED: Accept both full URLs and /api/media/ paths
const createCourseSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  shortDescription: z.string().optional(),
  description: z.string().min(20, "Description must be at least 20 characters"),
  thumbnail: z.string().min(1, "Please upload a thumbnail image").refine(
    (val) => val.startsWith('/api/media/') || val.startsWith('/api/files/') || val.startsWith('http'),
    "Invalid thumbnail URL"
  ),
  price: z.number().min(0, "Price must be 0 or greater"),
  discountPrice: z.number().min(0).optional().nullable(),
  durationHours: z.number().min(0).optional().nullable(),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  categoryId: z.string().uuid("Please select a valid category"),
  language: z.string().min(1, "Language is required"),
});

type CreateCourseFormData = z.infer<typeof createCourseSchema>;

interface Category {
  id: string;
  name: string;
}

export function CreateCourseForm() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateCourseFormData>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      title: "",
      shortDescription: "",
      description: "",
      thumbnail: "",
      price: 0,
      discountPrice: null,
      level: "beginner",
      language: "English",
      categoryId: "",
    },
  });

  // ✅ Debug: Log form errors
  const onError = (errors: any) => {
    console.log("❌ Form validation errors:", errors);
    // Show first error as toast
    const firstError = Object.values(errors)[0] as any;
    if (firstError?.message) {
      toast.error(firstError.message);
    }
  };

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await fetch("/api/categories");
        if (!res.ok) throw new Error("Failed");

        const data = await res.json();
        setCategories(Array.isArray(data) ? data : data.categories || []);
      } catch {
        toast.error("Failed to load categories");
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCats();
  }, []);

  // 🎉 Confetti celebration function
  const celebrate = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Fire confetti from two sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const onSubmit = async (data: CreateCourseFormData) => {
    console.log("✅ Form submitted with data:", data);
    setSubmitting(true);
    
    try {
      const res = await fetch("/api/courses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          discountPrice: data.discountPrice || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create course");
      }

      const json = await res.json();
      
      // 🎉 Trigger confetti celebration
      celebrate();
      
      toast.success("🎉 Course created successfully!", {
        description: "Redirecting to course builder...",
        duration: 3000,
      });

      // Redirect after confetti starts
      setTimeout(() => {
        window.location.href = `/instructor/courses/${json.course.slug}/sections`;
      }, 1500);
      
    } catch (error: any) {
      console.error("❌ Create course error:", error);
      toast.error(error.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-8 max-w-5xl mx-auto py-8">
        {/* Course Info */}
        <Card>
          <CardHeader><CardTitle>Course Information</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Complete React Masterclass 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shortDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="A catchy one-liner..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader><CardTitle>Description *</CardTitle></CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RichTextEditor
                      content={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Write a detailed course description..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Thumbnail */}
        <Card>
          <CardHeader><CardTitle>Course Thumbnail *</CardTitle></CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="thumbnail"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImageUploaderSingle
                      onUploadSuccess={(url) => {
                        console.log("✅ Thumbnail uploaded:", url);
                        field.onChange(url);
                      }}
                      onRemove={() => field.onChange("")}
                      existingUrl={field.value || undefined}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Pricing & Details */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (USD) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Price (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? e.target.valueAsNumber : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-dark text-white dark:bg-white dark:text-black">
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    {loadingCategories ? (
                      <div className="h-10 bg-muted animate-pulse rounded-md" />
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-dark text-white dark:bg-white dark:text-black">
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. English" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duration Fields */}
              <FormField
                control={form.control}
                name="durationHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="3"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? e.target.valueAsNumber : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" size="lg">
            Save Draft
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Course"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}