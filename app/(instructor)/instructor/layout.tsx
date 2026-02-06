import "./satoshi.css";
import "./globals.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import { Sidebar } from "@/components/instructor/new/Layouts/sidebar";
import { Header } from "@/components/instructor/new/Layouts/header";
import { Providers } from "./providers";
import { QueryProvider } from "@/providers/QueryProvider";

export const metadata: Metadata = {
  title: {
    template: "Instuctor Dashboard | %s",
    default: "SkillupCyber Instuctor Dashboard",
  },
  description:
    "Next.js instuctor dashboard toolkit with 200+ templates, UI components, and integrations for fast dashboard development.",
};

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
            <Providers>
          <NextTopLoader color="#5750F1" showSpinner={false} />

          <div className="flex min-h-screen">
            <Sidebar />

            <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
              <Header />

              <main className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10">
                {children}
              </main>
            </div>
          </div>
        </Providers>
        </QueryProvider>
      </body>
    </html>
  )
}
