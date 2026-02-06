// components/instructor/AssignmentManagement.tsx
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
  Calendar,
  FileText,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  maxScore: number;
  dueDate: string | null;
  lessonId: string | null;
  isOverdue: boolean;
  stats: {
    totalSubmissions: number;
    pendingCount: number;
    gradedCount: number;
    averageScore: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface AssignmentManagementProps {
  courseSlug: string;
}

export function AssignmentManagement({ courseSlug }: AssignmentManagementProps) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    fetchAssignments();
  }, [courseSlug]);

  const fetchAssignments = async () => {
    try {
      const res = await fetch(`/api/courses/${courseSlug}/assignments`);
      if (res.ok) {
        const { assignments: data } = await res.json();
        setAssignments(data);
      }
    } catch (error) {
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (assignment?: Assignment) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setTitle(assignment.title);
      setDescription(assignment.description);
      setInstructions(assignment.instructions || "");
      setMaxScore(assignment.maxScore);
      setDueDate(assignment.dueDate ? assignment.dueDate.split("T")[0] : "");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingAssignment(null);
    setTitle("");
    setDescription("");
    setInstructions("");
    setMaxScore(100);
    setDueDate("");
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
      const url = editingAssignment
        ? `/api/courses/${courseSlug}/assignments/${editingAssignment.id}`
        : `/api/courses/${courseSlug}/assignments`;
      
      const method = editingAssignment ? "PATCH" : "POST";
      
      const payload = {
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim() || undefined,
        maxScore,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      toast.success(editingAssignment ? "Assignment updated!" : "Assignment created!");
      setDialogOpen(false);
      resetForm();
      fetchAssignments();
    } catch (error) {
      toast.error("Failed to save assignment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment? This action cannot be undone.")) {
      return;
    }

    setDeleting(assignmentId);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/assignments/${assignmentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast.success("Assignment deleted successfully");
      fetchAssignments();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete assignment");
    } finally {
      setDeleting(null);
    }
  };

  const handleViewDetails = (assignmentId: string) => {
    router.push(`/instructor/courses/${courseSlug}/assignments/${assignmentId}`);
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
          <h2 className="text-2xl font-bold">Assignments</h2>
          <p className="text-muted-foreground mt-1">
            Create and manage assignments for your students
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
              Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAssignment ? "Edit" : "Create"} Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                  placeholder="Brief description of what students need to do..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Instructions</label>
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Detailed instructions, requirements, and grading criteria..."
                  rows={5}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide step-by-step guidance and requirements
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Max Score</label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="mt-1"
                  />
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
                    Optional: Set a deadline
                  </p>
                </div>
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
                    editingAssignment ? "Update Assignment" : "Create Assignment"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Assignment List */}
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="bg-muted w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No assignments yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first assignment to assess student work
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Assignment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <Card
              key={assignment.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewDetails(assignment.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{assignment.title}</CardTitle>
                      {assignment.isOverdue && (
                        <Badge variant="destructive">Overdue</Badge>
                      )}
                    </div>
                    <CardDescription>{assignment.description}</CardDescription>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openDialog(assignment)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(assignment.id)}
                      disabled={deleting === assignment.id}
                    >
                      {deleting === assignment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm mb-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Award className="h-4 w-4" />
                    <span>{assignment.maxScore} points</span>
                  </div>
                  {assignment.dueDate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Due {format(new Date(assignment.dueDate), "MMM dd, yyyy")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{assignment.stats.totalSubmissions} submissions</span>
                  </div>
                </div>

                {assignment.stats.totalSubmissions > 0 && (
                  <div className="flex flex-wrap gap-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-muted-foreground">
                        {assignment.stats.pendingCount} pending
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">
                        {assignment.stats.gradedCount} graded
                      </span>
                    </div>
                    {assignment.stats.averageScore !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="h-4 w-4 text-blue-600" />
                        <span className="text-muted-foreground">
                          Avg: {assignment.stats.averageScore}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}