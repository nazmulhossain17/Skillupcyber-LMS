// components/instructor/CourseStructure.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  GripVertical, 
  Edit2, 
  Trash2, 
  FileQuestion, 
  ClipboardCheck,
  Video,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Section, Lesson, Quiz, Assignment } from "@/types/course";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CourseStructureProps {
  slug: string;
}

// Sortable Section Item Component
function SortableSectionItem({
  section,
  isExpanded,
  onToggle,
  onDelete,
  onRenderContent,
  getSectionIcon,
  getSectionTypeBadge,
  slug,
}: {
  section: Section;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRenderContent: (section: Section) => React.ReactNode;
  getSectionIcon: (type: Section['type']) => React.ReactNode;
  getSectionTypeBadge: (type: Section['type']) => React.ReactNode;
  slug: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? 'shadow-lg' : ''}>
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Drag Handle */}
          <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </div>
          
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
          {getSectionIcon(section.type)}
          <div className="flex-1">
            <h3 className="font-medium">{section.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              {getSectionTypeBadge(section.type)}
              {section.type === 'lessons' && (
                <span className="text-xs text-muted-foreground">
                  {section.lessons?.length || 0} lessons
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t">
          {onRenderContent(section)}
        </div>
      )}
    </Card>
  );
}

export function CourseStructure({ slug }: CourseStructureProps) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const isFetchingRef = useRef(false); // ✅ Track if fetch is in progress
  const hasFetchedRef = useRef(false); // ✅ Track if we've fetched at least once
  
  // Add Section Dialog
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionType, setNewSectionType] = useState<'lessons' | 'quiz' | 'assignment'>('lessons');
  const [creating, setCreating] = useState(false);

  // Drag and Drop Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ✅ Define fetchSections without useCallback (stable reference)
  const fetchSections = async () => {
    // ✅ Prevent concurrent fetches using ref
    if (isFetchingRef.current) {
      console.log('⏳ Already fetching sections, skipping...');
      return;
    }
    
    try {
      isFetchingRef.current = true; // ✅ Mark as fetching
      setLoading(true);
      console.log('📥 Fetching sections for:', slug);
      
      const res = await fetch(`/api/courses/${slug}/sections`);
      if (!res.ok) throw new Error("Failed to fetch sections");
      
      const data = await res.json();
      const sectionsData = data.sections || [];
      
      // ✅ Fetch all data for each section in parallel
      const sectionsWithData = await Promise.all(
        sectionsData.map(async (section: any) => {
          try {
            const sectionType = section.type || 'lessons';
            
            if (sectionType === 'lessons') {
              const lessonsRes = await fetch(`/api/courses/${slug}/sections/${section.id}/lessons`);
              const lessonsData = lessonsRes.ok ? await lessonsRes.json() : { lessons: [] };
              return {
                ...section,
                type: sectionType,
                lessons: lessonsData.lessons || [],
              };
            } else if (sectionType === 'quiz') {
              const quizzesRes = await fetch(`/api/courses/${slug}/sections/${section.id}/quizzes`);
              const quizzesData = quizzesRes.ok ? await quizzesRes.json() : { quizzes: [] };
              return {
                ...section,
                type: sectionType,
                quiz: quizzesData.quizzes?.[0] || null,
              };
            } else if (sectionType === 'assignment') {
              const assignmentsRes = await fetch(`/api/courses/${slug}/sections/${section.id}/assignments`);
              const assignmentsData = assignmentsRes.ok ? await assignmentsRes.json() : { assignments: [] };
              return {
                ...section,
                type: sectionType,
                assignment: assignmentsData.assignments?.[0] || null,
              };
            }
            
            return {
              ...section,
              type: 'lessons' as const,
              lessons: [],
            };
          } catch (error) {
            console.error(`Error fetching data for section ${section.id}:`, error);
            return {
              ...section,
              type: section.type || 'lessons',
              lessons: [],
            };
          }
        })
      );
      
      console.log('✅ Sections loaded:', sectionsWithData.length);
      setSections(sectionsWithData);
      hasFetchedRef.current = true; // ✅ Mark as fetched
    } catch (error) {
      console.error("Error fetching sections:", error);
      toast.error("Failed to load sections");
    } finally {
      setLoading(false);
      isFetchingRef.current = false; // ✅ Mark as not fetching
    }
  };

  // ✅ Fetch sections only once on mount
  useEffect(() => {
    if (!hasFetchedRef.current) {
      fetchSections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array = only run on mount

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) {
      return toast.error("Section title is required");
    }

    try {
      setCreating(true);
      const res = await fetch(`/api/courses/${slug}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSectionTitle.trim(),
          type: newSectionType,
          order: sections.length,
        }),
      });

      if (!res.ok) throw new Error();

      toast.success('Section created!');
      setAddSectionDialogOpen(false);
      setNewSectionTitle("");
      setNewSectionType('lessons');
      
      await fetchSections();
    } catch (error) {
      toast.error('Failed to create section');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section and all its content?')) return;
    
    try {
      const res = await fetch(`/api/courses/${slug}/sections?sectionId=${sectionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error();

      toast.success('Section deleted!');
      await fetchSections();
    } catch (error) {
      toast.error('Failed to delete section');
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    // Optimistically update UI
    const newSections = arrayMove(sections, oldIndex, newIndex);
    setSections(newSections);

    // Update order in backend
    try {
      const updatePromises = newSections.map((section, index) => 
        fetch(`/api/courses/${slug}/sections?sectionId=${section.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: index }),
        })
      );

      await Promise.all(updatePromises);
      toast.success('Section order updated!');
    } catch (error) {
      console.error('Failed to update section order:', error);
      toast.error('Failed to update section order');
      // Revert on error
      await fetchSections();
    }
  };

  const renderSectionContent = (section: Section) => {
    const sectionType = section.type || 'lessons';
    
    switch (sectionType) {
      case 'lessons':
        return (
          <div className="p-4 space-y-2">
            {section.lessons && section.lessons.length > 0 ? (
              <>
                {section.lessons.map((lesson: Lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between p-3 bg-muted/30 border-l-2 border-blue-500/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/instructor/courses/${slug}/lessons/${lesson.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Video className="w-4 h-4 text-blue-600" />
                      <div>
                        <h4 className="font-medium text-sm">{lesson.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {lesson.durationMinutes || 0} min
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => router.push(`/instructor/courses/${slug}/lessons/${lesson.id}`)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => router.push(`/instructor/courses/${slug}/lessons/new?sectionId=${section.id}`)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lesson
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <Video className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No lessons yet. Add your first video lesson.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/instructor/courses/${slug}/lessons/new?sectionId=${section.id}`)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Lesson
                </Button>
              </div>
            )}
          </div>
        );

      case 'quiz':
        return (
          <div className="p-4">
            {section.quiz ? (
              <div
                className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer transition-colors"
                onClick={() => router.push(`/instructor/courses/${slug}/sections/${section.id}/quizzes/${section.quiz!.id}`)}
              >
                <div className="flex items-center gap-3">
                  <FileQuestion className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <h4 className="font-medium">{section.quiz.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {section.quiz.questionCount || 0} questions • {section.quiz.passingScore}% to pass
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/instructor/courses/${slug}/sections/${section.id}/quizzes/${section.quiz!.id}`);
                }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileQuestion className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No quiz created yet. Create a quiz to test student knowledge.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/instructor/courses/${slug}/sections/${section.id}/quizzes/new`)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Quiz
                </Button>
              </div>
            )}
          </div>
        );

      case 'assignment':
        return (
          <div className="p-4">
            {section.assignment ? (
              <div
                className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
                onClick={() => router.push(`/instructor/courses/${slug}/sections/${section.id}/assignments/${section.assignment!.id}`)}
              >
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <h4 className="font-medium">{section.assignment.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {section.assignment.maxScore} points
                      {section.assignment.dueDate && 
                        ` • Due ${new Date(section.assignment.dueDate).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/instructor/courses/${slug}/sections/${section.id}/assignments/${section.assignment!.id}`);
                }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No assignment created yet. Create a hands-on project.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/instructor/courses/${slug}/sections/${section.id}/assignments/new`)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Assignment
                </Button>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Unknown section type</p>
          </div>
        );
    }
  };

  const getSectionIcon = (type: Section['type']) => {
    const safeType = type || 'lessons';
    
    switch (safeType) {
      case 'lessons':
        return <Video className="w-5 h-5 text-blue-600" />;
      case 'quiz':
        return <FileQuestion className="w-5 h-5 text-green-600" />;
      case 'assignment':
        return <ClipboardCheck className="w-5 h-5 text-purple-600" />;
      default:
        return <Video className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSectionTypeBadge = (type: Section['type']) => {
    const badges = {
      lessons: { label: 'Lessons', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
      quiz: { label: 'Quiz', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
      assignment: { label: 'Assignment', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    };
    
    const safeType = type || 'lessons';
    const badge = badges[safeType];
    
    if (!badge) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Unknown
        </span>
      );
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Course Structure</h2>
          <p className="text-muted-foreground mt-1">
            Organize your course with lessons, quizzes, and assignments
          </p>
        </div>

        <div className="flex gap-2">
          {/* Refresh Button */}
          <Button 
            variant="outline" 
            onClick={() => fetchSections()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Add Section Dialog */}
          <Dialog open={addSectionDialogOpen} onOpenChange={setAddSectionDialogOpen}>
            <Button className="text-white" onClick={() => setAddSectionDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4 text-white" /> Add Section
            </Button>
            <DialogContent className="bg-white dark:bg-gray-900 ">
              <DialogHeader>
                <DialogTitle>Add New Section</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Section Title *</Label>
                  <Input
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="e.g., Introduction to Neural Networks"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Section Type *</Label>
                  <Select value={newSectionType} onValueChange={(v) => setNewSectionType(v as 'lessons' | 'quiz' | 'assignment')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lessons">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          <div>
                            <p className="font-medium">Video Lessons</p>
                            <p className="text-xs text-muted-foreground">
                              Add multiple video lessons
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="quiz">
                        <div className="flex items-center gap-2">
                          <FileQuestion className="w-4 h-4" />
                          <div>
                            <p className="font-medium">Quiz</p>
                            <p className="text-xs text-muted-foreground">
                              Test student knowledge
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="assignment">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4" />
                          <div>
                            <p className="font-medium">Assignment</p>
                            <p className="text-xs text-muted-foreground">
                              Hands-on project
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setAddSectionDialogOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddSection}
                    disabled={creating}
                    className="text-white"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Section'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sections List with Drag and Drop */}
      {sections.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="bg-muted w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Plus className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No sections yet</h3>
          <p className="text-muted-foreground mt-1">
            Start building your course structure by adding sections
          </p>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sections.map((section: Section) => (
                <SortableSectionItem
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  onDelete={() => handleDeleteSection(section.id)}
                  onRenderContent={renderSectionContent}
                  getSectionIcon={getSectionIcon}
                  getSectionTypeBadge={getSectionTypeBadge}
                  slug={slug}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}