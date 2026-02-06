'use client'

import { Button } from '@/components/ui/button'
import { Play, TrendingUp, Users, Award } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Hero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-primary/5 via-background to-accent/5 py-16 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left Content */}
          <div className={`space-y-8 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <TrendingUp className="h-4 w-4" />
              <span>Over 50,000 students learning today</span>
            </div>
            
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Transform Your Future with{' '}
              <span className="text-primary">Expert-Led</span> Online Courses
            </h1>
            
            <p className="text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Learn from world-class instructors. Master in-demand skills with interactive courses in business, technology, design, and more.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="group text-base">
                Get Started Free
                <Play className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" className="text-base">
                Explore Courses
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground sm:text-3xl">10K+</div>
                <div className="text-sm text-muted-foreground">Courses</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground sm:text-3xl">50K+</div>
                <div className="text-sm text-muted-foreground">Students</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground sm:text-3xl">500+</div>
                <div className="text-sm text-muted-foreground">Instructors</div>
              </div>
            </div>
          </div>

          {/* Right Image/Illustration */}
          <div className={`relative ${isVisible ? 'animate-scale-in' : 'opacity-0'} [animation-delay:200ms]`}>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-linear-to-br from-primary/20 to-accent/20 p-8">
              <div className="absolute inset-0 bg-[url(/placeholder.svg?height=600&width=600&query=modern+student+learning+online+with+laptop)] bg-cover bg-center opacity-90" />
              
              {/* Floating Cards */}
              <div className="absolute left-8 top-8 animate-bounce [animation-delay:1s] animation-duration-[3s]">
                <div className="rounded-lg bg-card p-4 shadow-lg ring-1 ring-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-card-foreground">Live Classes</div>
                      <div className="text-xs text-muted-foreground">Join 24/7</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 right-8 animate-bounce [animation-delay:2s] animation-duration-[3s]">
                <div className="rounded-lg bg-card p-4 shadow-lg ring-1 ring-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Award className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-card-foreground">Certificates</div>
                      <div className="text-xs text-muted-foreground">Get verified</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
