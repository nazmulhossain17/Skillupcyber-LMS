// app/instructor/courses/[slug]/sections/[sectionId]/quizzes/[quizId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, AlertCircle } from "lucide-react";
import { QuizBuilder } from "@/components/instructor/QuizBuilder";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  sectionId: string;
}

// Must match the interface in QuizBuilder.tsx exactly
interface QuizQuestion {
  id: string; // Required, not optional
  question: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
  order: number;
}

export default function QuizDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const sectionId = params.sectionId as string;
  const quizId = params.quizId as string;

  const isNew = quizId === "new";

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState(3);

  useEffect(() => {
    if (!isNew) {
      fetchQuizData();
    }
  }, [quizId, isNew]);

  const fetchQuizData = async () => {
    try {
      console.log("🔍 Fetching quiz data:", { slug, sectionId, quizId });
      
      const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/quizzes/${quizId}`);
      
      console.log("📥 Quiz fetch response:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("✅ Quiz data loaded:", data);
        
        setQuiz(data.quiz);
        // Ensure all questions have proper IDs
        const loadedQuestions = (data.quiz.questions || []).map((q: any) => ({
          ...q,
          id: q.id || crypto.randomUUID(), // Ensure ID exists
        }));
        setQuestions(loadedQuestions);
        setTitle(data.quiz.title);
        setDescription(data.quiz.description || "");
        setPassingScore(data.quiz.passingScore);
        setTimeLimit(data.quiz.timeLimit);
        setMaxAttempts(data.quiz.maxAttempts);
        setError(null);
      } else {
        const errorData = await res.json();
        console.error("❌ Failed to load quiz:", errorData);
        setError(errorData.error || "Failed to load quiz");
        toast.error("Failed to load quiz");
      }
    } catch (error) {
      console.error("❌ Quiz fetch error:", error);
      const errorMessage = "Failed to load quiz data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!title.trim()) {
      return toast.error("Quiz title is required");
    }

    setError(null);
    setSaving(true);
    
    try {
      const method = isNew ? "POST" : "PATCH";
      const url = isNew
        ? `/api/courses/${slug}/sections/${sectionId}/quizzes`
        : `/api/courses/${slug}/sections/${sectionId}/quizzes/${quizId}`;

      console.log(`🚀 Saving quiz settings: ${method} ${url}`);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          passingScore,
          timeLimit,
          maxAttempts,
        }),
      });

      console.log("📥 Save response:", res.status);

      if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ Save failed:", errorData);
        
        // Extract error message
        let errorMessage = "Failed to save quiz";
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.details) {
          errorMessage += ": " + JSON.stringify(errorData.details);
        }
        
        setError(errorMessage);
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      const { quiz: savedQuiz } = await res.json();
      console.log("✅ Quiz saved:", savedQuiz);
      
      if (isNew) {
        toast.success("Quiz created! Now add questions.");
        // Redirect to the edit page
        router.replace(`/instructor/courses/${slug}/sections/${sectionId}/quizzes/${savedQuiz.id}`);
      } else {
        toast.success("Quiz settings updated!");
        setQuiz(savedQuiz);
      }
      
      setError(null);
    } catch (error: any) {
      console.error("❌ Save quiz error:", error);
      // Error already set above
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuestions = async (updatedQuestions: QuizQuestion[]) => {
    if (isNew || !quiz) {
      const errorMessage = "Please save quiz settings first";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    setError(null);
    
    try {
      console.log("🚀 Saving questions:", { quizId: quiz.id, count: updatedQuestions.length });
      
      // Remove id field for new questions or ensure it's a valid UUID
      const questionsToSave = updatedQuestions.map(q => {
        // If id exists and looks invalid (not a UUID), remove it
        if (q.id && !q.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          const { id, ...rest } = q;
          return rest;
        }
        return q;
      });
      
      console.log("📋 Questions to save:", JSON.stringify(questionsToSave, null, 2));

      const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsToSave }),
      });

      console.log("📥 Save questions response:", res.status);

      if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ Save questions failed:", errorData);
        
        // Extract detailed error message
        let errorMessage = "Failed to save questions";
        
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        if (errorData.details && Array.isArray(errorData.details)) {
          const detailMessages = errorData.details.map((detail: any) => {
            if (detail.path && detail.message) {
              return `${detail.path.join('.')}: ${detail.message}`;
            }
            return detail.message || JSON.stringify(detail);
          });
          errorMessage += "\n" + detailMessages.join("\n");
        }
        
        setError(errorMessage);
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log("✅ Questions saved:", data);
      
      setQuestions(updatedQuestions);
      setError(null);
      toast.success("Questions saved successfully!");
    } catch (error: any) {
      console.error("❌ Save questions error:", error);
      // Error already set and toasted above
      throw error; // Re-throw so QuizBuilder can handle it
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Course
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew ? "Create New Quiz" : quiz?.title || "Quiz"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNew
              ? "Set up quiz settings and add questions"
              : "Manage quiz settings and questions"}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="settings">Quiz Settings</TabsTrigger>
            <TabsTrigger value="questions" disabled={isNew}>
              Questions {!isNew && `(${questions.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <label className="text-sm font-medium">Quiz Title *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., JavaScript Fundamentals Quiz"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what this quiz covers..."
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Passing Score (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={passingScore}
                      onChange={(e) => setPassingScore(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Time Limit (minutes)</label>
                    <Input
                      type="number"
                      min="0"
                      value={timeLimit || ""}
                      onChange={(e) =>
                        setTimeLimit(e.target.value ? Number(e.target.value) : null)
                      }
                      placeholder="No limit"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Max Attempts</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t">
                  <Button onClick={handleSaveBasicInfo} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {isNew ? "Create Quiz" : "Save Settings"}
                      </>
                    )}
                  </Button>
                </div>

                {isNew && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      💡 <strong>Tip:</strong> Save the quiz settings first, then you can add questions in the Questions tab.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions">
            {!isNew && (
              <QuizBuilder
                initialQuestions={questions}
                onSave={handleSaveQuestions}
                onCancel={() => router.back()}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}