import { BarChart3, PlusCircle, Video, LucideIcon, CheckSquare } from "lucide-react";
import * as Icons from "../icons";
import { JSX } from "react";

// ✅ Define proper types
export type NavSubItem = {
  title: string;
  url: string;
};

export type NavItem = {
  title: string;
  url?: string;
  icon: LucideIcon | ((props: any) => JSX.Element);
  items: NavSubItem[];
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

// ✅ Export with explicit type
export const NAV_DATA: NavSection[] = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Dashboard",
        url: "/instructor",
        icon: Icons.HomeIcon,
        items: []
      },
      {
        title: "Create Course",
        url: "/instructor/create-course",
        icon: PlusCircle,
        items: [],
      },
      {
        title: "Courses",
        url: "/instructor/courses",
        icon: Video,
        items: [],
      },
      {
        title: "Analytics",
        url: "/instructor/analytics",
        icon: BarChart3,
        items: [],
      },
      {
        title: "Submissions",
        url: "/instructor/assignments",
        icon: CheckSquare,
        items: [],
      },
    ],
  },
];