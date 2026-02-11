'use client'

import { Button } from '@/components/ui/button'
import { Play, TrendingUp, Users, Award, BookOpen, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export function Hero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM2MzY2ZjEiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-60" />
      
      <div className="container relative mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24 xl:py-32">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-20">
          {/* Left Content */}
          <div className={`space-y-6 sm:space-y-8 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-violet-700 dark:text-violet-300">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Join 50,000+ learners today</span>
            </div>
            
            {/* Heading */}
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl">
              Unlock Your Potential with{' '}
              <span className="bg-primary bg-clip-text text-transparent">
                Expert-Led
              </span>{' '}
              Courses
            </h1>
            
            {/* Description */}
            <p className="max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-400 sm:text-lg lg:text-xl">
              Master in-demand skills from world-class instructors. Interactive courses in business, technology, design, and more — learn at your own pace.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button 
                size="lg" 
                className="group h-12  text-white text-base sm:h-14 sm:px-8 sm:text-lg"
                asChild
              >
                <Link href="/course">
                  Browse Courses
                  <Play className="ml-2 h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 border-gray-300 dark:border-gray-700 text-base sm:h-14 sm:px-8 sm:text-lg"
                asChild
              >
                <Link href="/signup">
                  Start Free Trial
                </Link>
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-4 pt-2 sm:gap-6 sm:pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-800 pt-6 sm:gap-8 sm:pt-8">
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl lg:text-4xl">500+</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Courses</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl lg:text-4xl">50K+</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Students</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl lg:text-4xl">4.9</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Avg. Rating</div>
              </div>
            </div>
          </div>

          {/* Right - Hero Image */}
          <div className={`relative ${isVisible ? 'animate-scale-in' : 'opacity-0'} [animation-delay:200ms]`}>
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              {/* Main Image Container */}
              <div className="relative aspect-[4/3] sm:aspect-square lg:aspect-[4/3] overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl shadow-violet-500/20">
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/20 to-transparent z-10" />
                
                {/* Hero Image */}
                <Image
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1471&auto=format&fit=crop"
                  alt="Students collaborating and learning together"
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                />
              </div>

              {/* Floating Card - Live Classes (Top Left) */}
              <div className="absolute -left-2 top-4 sm:-left-4 sm:top-8 lg:-left-6 z-20 animate-float">
                <div className="rounded-xl bg-white dark:bg-gray-800 p-3 sm:p-4 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Live Classes</div>
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Join anytime</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Card - Certificates (Bottom Right) */}
              <div className="absolute -right-2 bottom-4 sm:-right-4 sm:bottom-8 lg:-right-6 z-20 animate-float [animation-delay:1s]">
                <div className="rounded-xl bg-white dark:bg-gray-800 p-3 sm:p-4 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                      <Award className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Certificates</div>
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Get verified</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Card - Course Progress (Hidden on mobile) */}
              <div className="hidden sm:block absolute -bottom-4 left-8 lg:left-12 z-20 animate-float [animation-delay:0.5s]">
                <div className="rounded-xl bg-white dark:bg-gray-800 p-3 sm:p-4 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/50">
                      <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">500+ Courses</div>
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">All skill levels</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative Blurs */}
              <div className="absolute -z-10 -top-4 -right-4 h-72 w-72 rounded-full bg-violet-200 dark:bg-violet-900/30 blur-3xl opacity-60" />
              <div className="absolute -z-10 -bottom-8 -left-8 h-72 w-72 rounded-full bg-indigo-200 dark:bg-indigo-900/30 blur-3xl opacity-60" />
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animation Styles */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.6s ease-out forwards;
        }
      `}</style>
    </section>
  )
}