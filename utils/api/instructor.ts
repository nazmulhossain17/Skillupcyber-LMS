// utils/api/instructor.ts

/**
 * Instructor API Functions
 * Centralized data fetching logic
 */

// ============================================
// COURSES
// ============================================

export async function fetchInstructorCourses() {
  const res = await fetch("/api/instructor/courses");
  if (!res.ok) {
    throw new Error("Failed to fetch courses");
  }
  const data = await res.json();
  return data.courses || [];
}

export async function fetchCourseDetails(slug: string) {
  const res = await fetch(`/api/courses/${slug}`);
  if (!res.ok) {
    throw new Error("Failed to fetch course");
  }
  const data = await res.json();
  return data.course;
}

export async function updateCourse(slug: string, updates: any) {
  const res = await fetch(`/api/courses/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  
  if (!res.ok) {
    throw new Error("Failed to update course");
  }
  
  return res.json();
}

export async function deleteCourse(slug: string) {
  const res = await fetch(`/api/courses/${slug}`, {
    method: "DELETE",
  });
  
  if (!res.ok) {
    throw new Error("Failed to delete course");
  }
  
  return res.json();
}

// ============================================
// SECTIONS
// ============================================

export async function fetchCourseSections(slug: string) {
  const res = await fetch(`/api/courses/${slug}/sections`);
  if (!res.ok) {
    throw new Error("Failed to fetch sections");
  }
  const data = await res.json();
  const sections = data.sections || [];
  
  // ✅ Fetch all lessons, quizzes, and assignments in parallel for all sections
  const sectionsWithData = await Promise.all(
    sections.map(async (section: any) => {
      try {
        const [lessonsRes, quizzesRes, assignmentsRes] = await Promise.all([
          fetch(`/api/courses/${slug}/sections/${section.id}/lessons`),
          fetch(`/api/courses/${slug}/sections/${section.id}/quizzes`),
          fetch(`/api/courses/${slug}/sections/${section.id}/assignments`),
        ]);

        const [lessonsData, quizzesData, assignmentsData] = await Promise.all([
          lessonsRes.ok ? lessonsRes.json() : { lessons: [] },
          quizzesRes.ok ? quizzesRes.json() : { quizzes: [] },
          assignmentsRes.ok ? assignmentsRes.json() : { assignments: [] },
        ]);

        return {
          ...section,
          lessons: lessonsData.lessons || [],
          quizzes: quizzesData.quizzes || [],
          assignments: assignmentsData.assignments || [],
        };
      } catch {
        return {
          ...section,
          lessons: [],
          quizzes: [],
          assignments: [],
        };
      }
    })
  );

  return sectionsWithData;
}

export async function createSection(slug: string, sectionData: any) {
  const res = await fetch(`/api/courses/${slug}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sectionData),
  });
  
  if (!res.ok) {
    throw new Error("Failed to create section");
  }
  
  return res.json();
}

export async function updateSection(slug: string, sectionId: string, updates: any) {
  const res = await fetch(`/api/courses/${slug}/sections?sectionId=${sectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  
  if (!res.ok) {
    throw new Error("Failed to update section");
  }
  
  return res.json();
}

export async function deleteSection(slug: string, sectionId: string) {
  const res = await fetch(`/api/courses/${slug}/sections?sectionId=${sectionId}`, {
    method: "DELETE",
  });
  
  if (!res.ok) {
    throw new Error("Failed to delete section");
  }
  
  return res.json();
}

// ============================================
// LESSONS
// ============================================

export async function fetchSectionLessons(slug: string, sectionId: string) {
  const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/lessons`);
  if (!res.ok) {
    throw new Error("Failed to fetch lessons");
  }
  const data = await res.json();
  return data.lessons || [];
}

export async function createLesson(slug: string, sectionId: string, lessonData: any) {
  const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/lessons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lessonData),
  });
  
  if (!res.ok) {
    throw new Error("Failed to create lesson");
  }
  
  return res.json();
}

export async function updateLesson(slug: string, sectionId: string, lessonId: string, updates: any) {
  const res = await fetch(
    `/api/courses/${slug}/sections/${sectionId}/lessons?lessonId=${lessonId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );
  
  if (!res.ok) {
    throw new Error("Failed to update lesson");
  }
  
  return res.json();
}

export async function deleteLesson(slug: string, sectionId: string, lessonId: string) {
  const res = await fetch(
    `/api/courses/${slug}/sections/${sectionId}/lessons?lessonId=${lessonId}`,
    { method: "DELETE" }
  );
  
  if (!res.ok) {
    throw new Error("Failed to delete lesson");
  }
  
  return res.json();
}

export async function fetchLessonContent(slug: string, lessonId: string) {
  const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/content`);
  if (!res.ok) {
    throw new Error("Failed to fetch lesson");
  }
  const data = await res.json();
  return data.lesson;
}

export async function updateLessonContent(slug: string, lessonId: string, content: any) {
  const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/content`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  
  if (!res.ok) {
    throw new Error("Failed to update lesson");
  }
  
  return res.json();
}

// ============================================
// RESOURCES
// ============================================

export async function fetchLessonResources(slug: string, lessonId: string) {
  const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/resources`);
  if (!res.ok) {
    throw new Error("Failed to fetch resources");
  }
  const data = await res.json();
  return data.resources || [];
}

export async function createResource(slug: string, lessonId: string, resourceData: any) {
  const res = await fetch(`/api/courses/${slug}/lessons/${lessonId}/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resourceData),
  });
  
  if (!res.ok) {
    throw new Error("Failed to create resource");
  }
  
  return res.json();
}

export async function deleteResource(slug: string, lessonId: string, resourceId: string) {
  const res = await fetch(
    `/api/courses/${slug}/lessons/${lessonId}/resources?resourceId=${resourceId}`,
    { method: "DELETE" }
  );
  
  if (!res.ok) {
    throw new Error("Failed to delete resource");
  }
  
  return res.json();
}

// ============================================
// QUIZZES
// ============================================

export async function fetchQuiz(slug: string, sectionId: string, quizId: string) {
  const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/quizzes/${quizId}`);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to fetch quiz");
  }
  const data = await res.json();
  return data.quiz;
}

export async function createQuiz(slug: string, sectionId: string, quizData: any) {
  const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/quizzes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quizData),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to create quiz");
  }
  
  return res.json();
}

export async function updateQuiz(slug: string, sectionId: string, quizId: string, updates: any) {
  const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/quizzes/${quizId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to update quiz");
  }
  
  return res.json();
}

// ============================================
// ASSIGNMENTS
// ============================================

export async function fetchAssignment(slug: string, sectionId: string, assignmentId: string) {
  const res = await fetch(
    `/api/courses/${slug}/sections/${sectionId}/assignments/${assignmentId}`
  );
  
  if (!res.ok) {
    throw new Error("Failed to fetch assignment");
  }
  
  const data = await res.json();
  return data.assignment;
}

export async function createAssignment(slug: string, sectionId: string, assignmentData: any) {
  const res = await fetch(`/api/courses/${slug}/sections/${sectionId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignmentData),
  });
  
  if (!res.ok) {
    throw new Error("Failed to create assignment");
  }
  
  return res.json();
}

export async function updateAssignment(
  slug: string,
  sectionId: string,
  assignmentId: string,
  updates: any
) {
  const res = await fetch(
    `/api/courses/${slug}/sections/${sectionId}/assignments/${assignmentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );
  
  if (!res.ok) {
    throw new Error("Failed to update assignment");
  }
  
  return res.json();
}

// ============================================
// COURSE PREVIEW
// ============================================

export async function fetchCoursePreview(slug: string) {
  const [courseRes, sectionsRes] = await Promise.all([
    fetch(`/api/courses/${slug}`),
    fetch(`/api/courses/${slug}/sections`),
  ]);

  if (!courseRes.ok) {
    throw new Error("Failed to fetch course");
  }

  const { course } = await courseRes.json();
  const { sections } = sectionsRes.ok ? await sectionsRes.json() : { sections: [] };

  // Fetch lessons for each section
  const sectionsWithLessons = await Promise.all(
    sections.map(async (section: any) => {
      try {
        const lessonsRes = await fetch(
          `/api/courses/${slug}/sections/${section.id}/lessons`
        );
        const { lessons } = lessonsRes.ok
          ? await lessonsRes.json()
          : { lessons: [] };
        return { ...section, lessons };
      } catch {
        return { ...section, lessons: [] };
      }
    })
  );

  return { course, sections: sectionsWithLessons };
}