// app/instructor/courses/[slug]/sections/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  ArrowLeft,
  Sparkles,
  Award,
} from "lucide-react";
import { CourseStructure } from "@/components/instructor/CourseStructure";
import { RichTextEditor } from "@/components/rich-text-editor/RichTextEditor";
import { useCourseDetails, useUpdateCourse } from "@/hooks/use-instructor-queries";

export default function CourseManagementPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  // ✅ TanStack Query - fetches course details
  const { data: course, isLoading: loadingCourse } = useCourseDetails(slug);
  const updateCourseMutation = useUpdateCourse(slug);

  // Form state
  const [title, setTitle] = useState("");
  const [courseSlug, setCourseSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced" | "expert">("beginner");
  const [language, setLanguage] = useState("English");
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // ✅ Initialize form when course data loads
  useEffect(() => {
    if (course && !isInitialized) {
      console.log('📝 Initializing form with course data:', {
        hasDescription: !!course.description,
        descriptionLength: course.description?.length || 0,
        description: course.description?.substring(0, 100)
      });
      
      setTitle(course.title || "");
      setCourseSlug(course.slug || "");
      setShortDescription(course.shortDescription || "");
      setDescription(course.description || "");
      setPrice(course.price?.toString() || "0.00");
      setDiscountPrice(course.discountPrice?.toString() || "");
      setLevel(course.level || "beginner");
      setLanguage(course.language || "English");

      const totalMins = course.durationMinutes || 0;
      setDurationHours(Math.floor(totalMins / 60));
      setDurationMinutes(totalMins % 60);
      
      setIsInitialized(true);
      console.log('✅ Form initialized with description');
    }
  }, [course, isInitialized]);

  const generateSlug = () => {
    const generated = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setCourseSlug(generated);
  };

  const handleSaveCourse = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!description.trim()) return toast.error("Description is required");

    const totalMinutes = durationHours * 60 + durationMinutes;

    updateCourseMutation.mutate({
      title: title.trim(),
      slug: courseSlug.trim(),
      shortDescription: shortDescription.trim() || null,
      description: description.trim(),
      price: parseFloat(price) || 0,
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      level,
      durationHours: totalMinutes,
      language: language.trim(),
    });
  };

  if (loadingCourse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Course not found</p>
          <Button className="mt-4" onClick={() => router.push("/instructor/courses")}>
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-9xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Button variant="ghost" className="mb-4" onClick={() => router.push("/instructor/courses")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Button>
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <p className="text-muted-foreground mt-1">Manage your course content and structure</p>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          {/* ✅ Updated to 3 columns */}
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="structure">Course Structure</TabsTrigger>
            {/* ✅ Certificate Tab */}
            <TabsTrigger value="certificate" className="flex items-center justify-center gap-2">
              <Award className="h-4 w-4" />
              Certificate
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium">Slug *</label>
                  <div className="flex gap-2 mt-1">
                    <Input value={courseSlug} onChange={(e) => setCourseSlug(e.target.value)} />
                    <Button variant="outline" onClick={generateSlug}>
                      <Sparkles className="mr-2 h-4 w-4" /> Generate
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Short Description</label>
                  <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={3} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">A brief one-liner about your course</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description *</label>
                  {isInitialized ? (
                    <RichTextEditor
                      key={`editor-${course.id}`}
                      content={description}
                      onChange={setDescription}
                      placeholder="Write a detailed course description..."
                    />
                  ) : (
                    <div className="border rounded-md p-4 flex items-center justify-center h-64">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Provide a comprehensive overview of what students will learn</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Price ($)</label>
                    <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Discount Price ($)</label>
                    <Input type="number" step="0.01" value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} placeholder="Leave empty for no discount" className="mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium">Level</label>
                    <Select
                      value={level}
                      onValueChange={(value) =>
                        setLevel(value as "beginner" | "intermediate" | "advanced" | "expert")
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Duration (Hours)</label>
                    <Input type="number" min="0" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value) || 0)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Minutes</label>
                    <Input type="number" min="0" max="59" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Language</label>
                    <Input value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <Button onClick={handleSaveCourse} disabled={updateCourseMutation.isPending}>
                    {updateCourseMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Course Structure Tab */}
          <TabsContent value="structure">
            {/* ✅ CourseStructure manages its own data with React Query */}
            <CourseStructure slug={slug} />
          </TabsContent>

          {/* ✅ Certificate Tab */}
          <TabsContent value="certificate" className="space-y-6">
            <Card>
              <CardContent className="py-12">
                <div className="text-center max-w-lg mx-auto">
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
                    <Award className="h-12 w-12 text-primary" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-2xl font-bold text-foreground mb-3">
                    Course Certificate
                  </h3>
                  
                  {/* Description */}
                  <p className="text-muted-foreground mb-8 leading-relaxed">
                    Design a professional certificate that students will receive when they complete this course. 
                    Customize the layout, colors, and branding to match your style.
                  </p>
                  
                  {/* Features */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-primary font-semibold mb-1">✨ Custom Design</div>
                      <p className="text-sm text-muted-foreground">Add your logo, colors & signature</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-primary font-semibold mb-1">📄 PDF Download</div>
                      <p className="text-sm text-muted-foreground">Students can download their cert</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-primary font-semibold mb-1">✅ Verification</div>
                      <p className="text-sm text-muted-foreground">Unique ID for authenticity</p>
                    </div>
                  </div>
                  
                  {/* Button */}
                  <Link href={`/instructor/courses/${slug}/certificate`}>
                    <Button 
                      size="lg" 
                      className="bg-primary text-white hover:bg-primary/90 px-8"
                    >
                      <Award className="h-5 w-5 mr-2" />
                      Design Certificate
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-sm">💡</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      Pro Tip
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Students can only claim their certificate after completing 100% of the course lessons. 
                      The certificate will automatically include the course name, student name, and completion date.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}