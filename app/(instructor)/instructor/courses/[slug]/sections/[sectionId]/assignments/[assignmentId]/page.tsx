// app/instructor/courses/[slug]/sections/[sectionId]/assignments/[assignmentId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  maxScore: number;
  dueDate: Date | null;
  sectionId: string;
}

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const sectionId = params.sectionId as string;
  const assignmentId = params.assignmentId as string;

  const isNew = assignmentId === "new";

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!isNew) {
      fetchAssignmentData();
    }
  }, [assignmentId, isNew]);

  const fetchAssignmentData = async () => {
    try {
      const res = await fetch(
        `/api/courses/${slug}/sections/${sectionId}/assignments/${assignmentId}`
      );

      if (res.ok) {
        const data = await res.json();
        setAssignment(data.assignment);
        setTitle(data.assignment.title);
        setDescription(data.assignment.description);
        setInstructions(data.assignment.instructions || "");
        setMaxScore(data.assignment.maxScore);
        setDueDate(
          data.assignment.dueDate
            ? new Date(data.assignment.dueDate).toISOString().split("T")[0]
            : ""
        );
      } else {
        toast.error("Failed to load assignment");
        router.back();
      }
    } catch (error) {
      console.error("Failed to load assignment:", error);
      toast.error("Failed to load assignment data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      return toast.error("Assignment title is required");
    }
    if (!description.trim()) {
      return toast.error("Description is required");
    }

    setSaving(true);
    try {
      const method = isNew ? "POST" : "PATCH";
      const url = isNew
        ? `/api/courses/${slug}/sections/${sectionId}/assignments`
        : `/api/courses/${slug}/sections/${sectionId}/assignments/${assignmentId}`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          instructions: instructions.trim() || null,
          maxScore,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });

      if (!res.ok) throw new Error();

      const { assignment: savedAssignment } = await res.json();

      if (isNew) {
        toast.success("Assignment created successfully!");
        router.push(`/instructor/courses/${slug}/sections/`);
      } else {
        toast.success("Assignment updated successfully!");
        setAssignment(savedAssignment);
      }
    } catch (error) {
      toast.error(isNew ? "Failed to create assignment" : "Failed to update assignment");
    } finally {
      setSaving(false);
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
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Course
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew ? "Create New Assignment" : assignment?.title || "Assignment"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNew
              ? "Set up a new assignment for your students"
              : "Manage assignment details and settings"}
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div>
              <label className="text-sm font-medium">Assignment Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Build a Calculator App"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the assignment..."
                rows={3}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide a brief overview of what students need to do
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Instructions</label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Detailed step-by-step instructions for students..."
                rows={6}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide detailed instructions, requirements, and guidelines
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Max Score *</label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum points for this assignment
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for no due date
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isNew ? "Create Assignment" : "Save Changes"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {!isNew && assignment && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Assignment Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Submissions</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">0</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Graded</p>
                  <p className="text-2xl font-bold text-green-600">0</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">-</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}