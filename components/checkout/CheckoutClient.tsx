// ============================================
// FILE: components/checkout/CheckoutClient.tsx
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Star,
  Users,
  Clock,
  BookOpen,
  Shield,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  GraduationCap,
  Play,
  Award,
  Infinity,
  ChevronRight,
  Lock,
  CreditCard,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  thumbnail: string | null;
  price: number;
  discountPrice: number | null;
  level: string;
  language: string | null;
  durationHours: number | null;
  enrollmentCount: number;
  averageRating: number;
  reviewCount: number;
}

interface Instructor {
  id: string;
  name: string | null;
  avatar: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface CheckoutClientProps {
  course: Course;
  instructor: Instructor | null;
  category: { id: string; name: string } | null;
  user: User;
}

export function CheckoutClient({
  course,
  instructor,
  category,
  user,
}: CheckoutClientProps) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const hasDiscount = course.discountPrice !== null && course.discountPrice < course.price;
  const displayPrice = hasDiscount ? course.discountPrice : course.price;
  const isFree = displayPrice === 0;
  const discountPercent = hasDiscount
    ? Math.round((1 - course.discountPrice! / course.price) * 100)
    : 0;
  const savings = hasDiscount ? course.price - course.discountPrice! : 0;

  const handleEnroll = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setEnrolling(true);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: course.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Already enrolled
          toast.info('You are already enrolled in this course');
          router.push(`/course/${course.slug}/learn`);
          return;
        }
        throw new Error(data.error || 'Failed to enroll');
      }

      toast.success('🎉 Successfully enrolled! Welcome to the course!');
      router.push(`/course/${course.slug}/learn`);
    } catch (error) {
      console.error('Enrollment error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href={`/course/${course.slug}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to course</span>
            </Link>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Secure Checkout</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Complete Your Enrollment</h1>
            <p className="text-muted-foreground">You're one step away from starting your learning journey</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left Side - Course Details */}
            <div className="lg:col-span-3 space-y-6">
              {/* Course Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Course Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-32 h-20 md:w-40 md:h-24 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                      {course.thumbnail ? (
                        <Image
                          src={course.thumbnail}
                          alt={course.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <GraduationCap className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg line-clamp-2 mb-2">
                        {course.title}
                      </h3>
                      {instructor && (
                        <p className="text-sm text-muted-foreground mb-2">
                          By {instructor.name}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="font-medium">{course.averageRating.toFixed(1)}</span>
                          <span className="text-muted-foreground">({course.reviewCount})</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{course.enrollmentCount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* What's Included */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">What's Included</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                        <Play className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{course.durationHours || 0}+ hours</p>
                        <p className="text-xs text-muted-foreground">On-demand video</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Full curriculum</p>
                        <p className="text-xs text-muted-foreground">All lessons & resources</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Award className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Certificate</p>
                        <p className="text-xs text-muted-foreground">Of completion</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <Infinity className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Lifetime access</p>
                        <p className="text-xs text-muted-foreground">Learn at your pace</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enrolled As */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Enrolling As</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name || 'Student'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Order Summary */}
            <div className="lg:col-span-2">
              <Card className="sticky top-24 border-2 border-primary/20">
                <CardHeader className="pb-4 bg-primary/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Price Breakdown */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Original price</span>
                      <span className={hasDiscount ? 'line-through text-muted-foreground' : ''}>
                        ${course.price.toFixed(2)}
                      </span>
                    </div>
                    
                    {hasDiscount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 flex items-center gap-1">
                          <Zap className="h-4 w-4" />
                          Discount ({discountPercent}% off)
                        </span>
                        <span className="text-green-600">-${savings.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg">Total</span>
                    {isFree ? (
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-600">FREE</span>
                        {course.price > 0 && (
                          <p className="text-xs text-muted-foreground">
                            (Originally ${course.price.toFixed(2)})
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-2xl font-bold">${displayPrice?.toFixed(2)}</span>
                    )}
                  </div>

                  {/* Free Course Badge */}
                  {isFree && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium text-sm">This course is free!</span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                        No payment required. Enroll now and start learning immediately.
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* Terms Agreement */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    />
                    <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                      I agree to the{' '}
                      <Link href="/terms" className="text-primary hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>

                  {/* Enroll Button */}
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                    onClick={handleEnroll}
                    disabled={enrolling || !agreedToTerms}
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        {isFree ? 'Complete Free Enrollment' : 'Complete Purchase'}
                      </>
                    )}
                  </Button>

                  {/* Security Note */}
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>30-day money-back guarantee</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Secure Enrollment</p>
              <p className="text-xs text-muted-foreground">Your data is protected</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium">Instant Access</p>
              <p className="text-xs text-muted-foreground">Start learning immediately</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                <Infinity className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium">Lifetime Access</p>
              <p className="text-xs text-muted-foreground">Learn at your own pace</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                <Award className="h-6 w-6 text-orange-600" />
              </div>
              <p className="text-sm font-medium">Certificate</p>
              <p className="text-xs text-muted-foreground">Upon completion</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}