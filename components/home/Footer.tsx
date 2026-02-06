import Link from 'next/link'
import { Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">E</span>
              </div>
              <span className="text-xl font-bold text-foreground">EduPro</span>
            </Link>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
              Transform your future with expert-led online courses. Learn new skills, advance your career, and achieve your goals with EduPro.
            </p>
            <div className="mt-6 flex gap-4">
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Categories</h3>
            <ul className="space-y-3">
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Development</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Design</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Business</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Marketing</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Photography</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Support</h3>
            <ul className="space-y-3">
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Help Center</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">FAQs</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Contact Us</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Become Instructor</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Affiliate Program</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Company</h3>
            <ul className="space-y-3">
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">About Us</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Careers</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Press</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Blog</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">Partners</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © 2025 EduPro. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                Privacy Policy
              </Link>
              <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                Terms of Service
              </Link>
              <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
