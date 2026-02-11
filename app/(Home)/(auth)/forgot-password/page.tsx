// ============================================
// FILE: app/(Home)/(auth)/forgot-password/page.tsx
// Forgot password page - request password reset
// ============================================

'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import z from 'zod'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      setIsLoading(true)
      setError(null)

      const { error } = await authClient.forgetPassword({
        email: values.email,
        redirectTo: "/reset-password",
      });

      if (error) {
        setError(error.message || "Failed to send reset email. Please try again.");
        toast.error(error.message || "Failed to send reset email");
      } else {
        setSubmittedEmail(values.email)
        setIsSuccess(true)
        toast.success("Reset link sent! Check your email.");
      }
    } catch (err: any) {
      console.error("Password reset request failed:", err);
      setError("Something went wrong. Please try again.");
      toast.error("Failed to send reset email");
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-violet-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Back Link */}
      <div className="container mx-auto px-4 pt-6">
        <Link 
          href="/signin" 
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sign In
        </Link>
      </div>

      <div className="container mx-auto flex min-h-[calc(100vh-100px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600">
                <span className="text-2xl font-bold text-white">E</span>
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">EduPro</span>
            </Link>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-xl">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                /* Success State */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center"
                >
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Check Your Email
                  </h1>
                  
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    We've sent a password reset link to{' '}
                    <span className="font-medium text-gray-900 dark:text-white">{submittedEmail}</span>
                  </p>

                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 mb-6">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Didn't receive the email?</strong> Check your spam folder or make sure you entered the correct email address.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full h-12"
                      onClick={() => {
                        setIsSuccess(false)
                        form.reset()
                      }}
                    >
                      Try a different email
                    </Button>
                    
                    <Button
                      asChild
                      className="w-full h-12 bg-violet-600 hover:bg-violet-700"
                    >
                      <Link href="/signin">
                        Return to Sign In
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              ) : (
                /* Form State */
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="mb-6 text-center">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      Forgot Password?
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      No worries! Enter your email and we'll send you a reset link.
                    </p>
                  </div>

                  {/* Error Message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    {/* Email Field */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          className="h-12 pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-violet-500 focus:ring-violet-500"
                          {...form.register("email")}
                          disabled={isLoading}
                        />
                      </div>
                      {form.formState.errors.email && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      className="h-12 w-full text-base font-semibold bg-violet-600 hover:bg-violet-700" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </Button>
                  </form>

                  {/* Back to Sign In */}
                  <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    Remember your password?{' '}
                    <Link 
                      href="/signin" 
                      className="font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
                    >
                      Sign in
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Help Text */}
          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-500">
            Need help?{' '}
            <Link href="/contact" className="text-violet-600 hover:underline dark:text-violet-400">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}