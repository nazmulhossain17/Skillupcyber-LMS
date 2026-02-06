"use client"
import { CreateCourseForm } from "@/components/instructor/create-course/create-course-form";

export default function CreateCoursePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 lg:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Create New Course</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Fill in the details below to create your new course
            </p>
          </div>
          <CreateCourseForm />
        </div>
      </div>
  )
}
