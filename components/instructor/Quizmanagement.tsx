// components/instructor/QuizManagement.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  FileQuestion,
} from "lucide-react";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  lessonId: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QuizManagementProps {
  courseSlug: string;
}

export function QuizManagement({ courseSlug }: QuizManagementProps) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState(3);

  useEffect(() => {
    fetchQuizzes();
  }, [courseSlug]);

  const fetchQuizzes = async () => {
    try {
      const res = await fetch(`/api/courses/${courseSlug}/quizzes`);
      if (res.ok) {
        const { quizzes: data } = await res.json();
        setQuizzes(data);
      }
    } catch (error) {
      toast.error("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (quiz?: Quiz) => {
    if (quiz) {
      setEditingQuiz(quiz);
      setTitle(quiz.title);
      setDescription(quiz.description || "");
      setPassingScore(quiz.passingScore);
      setTimeLimit(quiz.timeLimit);
      setMaxAttempts(quiz.maxAttempts);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingQuiz(null);
    setTitle("");
    setDescription("");
    setPassingScore(70);
    setTimeLimit(null);
    setMaxAttempts(3);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      return toast.error("Quiz title is required");
    }

    setSaving(true);
    try {
      const url = editingQuiz
        ? `/api/courses/${courseSlug}/quizzes/${editingQuiz.id}`
        : `/api/courses/${courseSlug}/quizzes`;
      
      const method = editingQuiz ? "PATCH" : "POST";
      
      const payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        passingScore,
        timeLimit: timeLimit || undefined,
        maxAttempts,
      };

      // For new quizzes, add a default question
      if (!editingQuiz) {
        payload.questions = [
          {
            question: "Sample question - please edit",
            questionType: "multiple_choice",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: "Option A",
            points: 10,
            order: 0,
          },
        ];
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      toast.success(editingQuiz ? "Quiz updated!" : "Quiz created!");
      setDialogOpen(false);
      resetForm();
      fetchQuizzes();
    } catch (error) {
      toast.error("Failed to save quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (quizId: string) => {
    if (!confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) {
      return;
    }

    setDeleting(quizId);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/quizzes/${quizId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast.success("Quiz deleted successfully");
      fetchQuizzes();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete quiz");
    } finally {
      setDeleting(null);
    }
  };

  const handleViewDetails = (quizId: string) => {
    router.push(`/instructor/courses/${courseSlug}/quizzes/${quizId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Quizzes</h2>
          <p className="text-muted-foreground mt-1">
            Create and manage quizzes to test student knowledge
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Quiz
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingQuiz ? "Edit" : "Create"} Quiz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="text-sm font-medium">Time Limit (minutes)</label>
                <Input
                  type="number"
                  min="0"
                  value={timeLimit || ""}
                  onChange={(e) => setTimeLimit(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Leave empty for no time limit"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Set a time limit in minutes
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingQuiz ? "Update Quiz" : "Create Quiz"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quiz List */}
      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="bg-muted w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
              <FileQuestion className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No quizzes yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first quiz to test student knowledge
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Quiz
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz) => (
            <Card
              key={quiz.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewDetails(quiz.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{quiz.title}</CardTitle>
                    {quiz.description && (
                      <CardDescription className="mt-2">
                        {quiz.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openDialog(quiz)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(quiz.id)}
                      disabled={deleting === quiz.id}
                    >
                      {deleting === quiz.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileQuestion className="h-4 w-4" />
                    <span>{quiz.questionCount} questions</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{quiz.passingScore}% to pass</span>
                  </div>
                  {quiz.timeLimit && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{quiz.timeLimit} min</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>{quiz.maxAttempts} attempts</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Badge variant="secondary">
                    {quiz.questionCount === 0 ? "Draft" : "Active"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}