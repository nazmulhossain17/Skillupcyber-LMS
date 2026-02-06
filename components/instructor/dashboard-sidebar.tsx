"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Video, MessageSquare, BarChart3, Wrench, BookOpen, Home, PlusCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: Home, label: "Dashboard", href: "/instructor" },
  { icon: PlusCircle, label: "Create Course", href: "/instructor/create-course" },
  { icon: Video, label: "Courses", href: "/instructor/courses" },
  { icon: BarChart3, label: "Analytics", href: "/instructor/analytics" },
]

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-64 min-h-screen lg:h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="p-4 sm:p-6 border-b border-sidebar-border flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-lg">E</span>
            </div>
            <span className="text-sidebar-foreground font-bold text-xl">Edupro</span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-sidebar-foreground hover:text-sidebar-accent-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 sm:p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors text-sm font-medium",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
