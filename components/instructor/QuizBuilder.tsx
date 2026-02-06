// components/instructor/QuizBuilder.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface QuizQuestion {
  id: string;
  question: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
  order: number;
}

interface QuizBuilderProps {
  initialQuestions?: QuizQuestion[];
  onSave: (questions: QuizQuestion[]) => Promise<void>;
  onCancel: () => void;
}

function SortableQuestion({
  question,
  index,
  onUpdate,
  onDelete,
}: {
  question: QuizQuestion;
  index: number;
  onUpdate: (id: string, updates: Partial<QuizQuestion>) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const addOption = () => {
    if (question.options.length < 6) {
      onUpdate(question.id, {
        options: [...question.options, ""],
      });
    }
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...question.options];
    newOptions[optionIndex] = value;
    onUpdate(question.id, { options: newOptions });
  };

  const removeOption = (optionIndex: number) => {
    if (question.options.length > 2) {
      const newOptions = question.options.filter((_, i) => i !== optionIndex);
      onUpdate(question.id, { options: newOptions });
      
      // If removed option was the correct answer, reset it
      if (question.correctAnswer === question.options[optionIndex]) {
        onUpdate(question.id, { correctAnswer: "" });
      }
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                {...attributes}
                {...listeners}
                className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="w-5 h-5" />
              </button>
              <CardTitle className="text-base">Question {index + 1}</CardTitle>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => onDelete(question.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Question Text */}
          <div>
            <Label>Question Text *</Label>
            <Textarea
              value={question.question}
              onChange={(e) => onUpdate(question.id, { question: e.target.value })}
              placeholder="Enter your question here..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Question Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Question Type</Label>
              <Select
                value={question.questionType}
                onValueChange={(value: any) => {
                  onUpdate(question.id, { 
                    questionType: value,
                    options: value === "true_false" 
                      ? ["True", "False"]
                      : value === "short_answer"
                      ? []
                      : question.options.length >= 2
                      ? question.options
                      : ["", "", "", ""],
                    correctAnswer: "",
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Points</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={question.points}
                onChange={(e) =>
                  onUpdate(question.id, { points: parseInt(e.target.value) || 1 })
                }
                className="mt-1"
              />
            </div>
          </div>

          {/* Options for Multiple Choice and True/False */}
          {(question.questionType === "multiple_choice" ||
            question.questionType === "true_false") && (
            <div>
              <Label>Options *</Label>
              <RadioGroup
                value={question.correctAnswer as string}
                onValueChange={(value) =>
                  onUpdate(question.id, { correctAnswer: value })
                }
                className="mt-2 space-y-2"
              >
                {question.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className="flex items-center gap-2"
                  >
                    <RadioGroupItem
                      value={option}
                      id={`${question.id}-option-${optionIndex}`}
                    />
                    <Input
                      value={option}
                      onChange={(e) => updateOption(optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="flex-1"
                      disabled={question.questionType === "true_false"}
                    />
                    {question.questionType === "multiple_choice" &&
                      question.options.length > 2 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeOption(optionIndex)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                  </div>
                ))}
              </RadioGroup>

              {question.questionType === "multiple_choice" &&
                question.options.length < 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    className="mt-2"
                  >
                    <Plus className="w-3 h-3 mr-2" />
                    Add Option
                  </Button>
                )}
              
              {!question.correctAnswer && (
                <p className="text-xs text-destructive mt-1">
                  Please select the correct answer
                </p>
              )}
            </div>
          )}

          {/* Correct Answer for Short Answer */}
          {question.questionType === "short_answer" && (
            <div>
              <Label>Correct Answer *</Label>
              <Input
                value={question.correctAnswer as string}
                onChange={(e) =>
                  onUpdate(question.id, { correctAnswer: e.target.value })
                }
                placeholder="Enter the correct answer..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Students' answers will be compared with this (case-insensitive)
              </p>
            </div>
          )}

          {/* Explanation */}
          <div>
            <Label>Explanation (Optional)</Label>
            <Textarea
              value={question.explanation || ""}
              onChange={(e) =>
                onUpdate(question.id, { explanation: e.target.value })
              }
              placeholder="Explain why this is the correct answer..."
              rows={2}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This will be shown to students after they submit
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function QuizBuilder({
  initialQuestions = [],
  onSave,
  onCancel,
}: QuizBuilderProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialQuestions.length > 0
      ? initialQuestions
      : [
          {
            id: `q-${Date.now()}`,
            question: "",
            questionType: "multiple_choice",
            options: ["", "", "", ""],
            correctAnswer: "",
            points: 10,
            order: 0,
          },
        ]
  );
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}`,
      question: "",
      questionType: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 10,
      order: questions.length,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const deleteQuestion = (id: string) => {
    if (questions.length === 1) {
      toast.error("Quiz must have at least one question");
      return;
    }
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setQuestions((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      return newItems.map((item, index) => ({ ...item, order: index }));
    });
  };

  const validateQuestions = (): boolean => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.question.trim()) {
        toast.error(`Question ${i + 1}: Question text is required`);
        return false;
      }

      if (q.questionType === "multiple_choice" || q.questionType === "true_false") {
        // Check if all options are filled
        if (q.options.some(opt => !opt.trim())) {
          toast.error(`Question ${i + 1}: All options must be filled`);
          return false;
        }

        // Check if correct answer is selected
        if (!q.correctAnswer) {
          toast.error(`Question ${i + 1}: Please select the correct answer`);
          return false;
        }
      }

      if (q.questionType === "short_answer") {
        if (!q.correctAnswer || !(q.correctAnswer as string).trim()) {
          toast.error(`Question ${i + 1}: Correct answer is required`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateQuestions()) return;

    // Clean up questions before saving
    const cleanedQuestions = questions.map((q, index) => ({
      ...q,
      order: index,
      // ✅ Convert empty string to undefined for explanation
      explanation: q.explanation?.trim() || undefined,
    }));

    setSaving(true);
    try {
      await onSave(cleanedQuestions);
      toast.success("Quiz saved successfully!");
    } catch (error) {
      toast.error("Failed to save quiz");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Questions</h3>
          <p className="text-sm text-muted-foreground">
            Add and organize your quiz questions
          </p>
        </div>
        <Button onClick={addQuestion} variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </Button>
      </div>

      {/* Questions List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          {questions.map((question, index) => (
            <SortableQuestion
              key={question.id}
              question={question}
              index={index}
              onUpdate={updateQuestion}
              onDelete={deleteQuestion}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Total Questions: <span className="font-medium text-foreground">{questions.length}</span>
              </p>
              <p className="text-muted-foreground">
                Total Points:{" "}
                <span className="font-medium text-foreground">
                  {questions.reduce((sum, q) => sum + q.points, 0)}
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel} disabled={saving}>
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
                    Save Quiz
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}