'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import z from 'zod'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const router = useRouter()
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true)
      setAuthError(null)
      await authClient.signIn.social({
        provider: "google",
        // Middleware will handle role-based redirect
        callbackURL: "/dashboard",
      });
    } catch (error) {
      setAuthError("Google sign in failed")
    } finally {
      setIsLoading(false)
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true)
      setAuthError(null)

      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        // Middleware will redirect based on role
        callbackURL: "/dashboard",
      });

      if (error) {
        setAuthError(error.message || "Login failed. Please try again.");
        toast.error(error.message || "Login failed");
      } else {
        toast.success("Login successful!");
        // Let middleware handle the role-based redirect
        router.push("/dashboard");
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      setAuthError("Something went wrong. Please try again.");
      toast.error("Login failed");
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
      </div>

      <div className="container mx-auto flex min-h-[calc(100vh-100px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* LOGO */}
          <div className="mb-8 flex justify-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <span className="text-2xl font-bold text-primary-foreground">E</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Skillupcyber</span>
            </Link>
          </div>

          {/* CARD */}
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold text-foreground">Welcome Back</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to continue your learning journey
              </p>
            </div>

            {/* AUTH ERROR */}
            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mb-4 rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-700"
                >
                  {authError}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              
              {/* EMAIL */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="h-12 pl-10"
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

              {/* PASSWORD */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="h-12 pl-10 pr-10"
                    {...form.register("password")}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* REMEMBER ME */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" disabled={isLoading} />
                  <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                    Remember me
                  </label>
                </div>
                <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80">
                  Forgot password?
                </Link>
              </div>

              {/* SUBMIT */}
              <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* OR */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* SOCIAL BUTTONS */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={signInWithGoogle}
                disabled={isLoading}
              >
                Google
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => authClient.signIn.social({ 
                  provider: "github", 
                  callbackURL: "/dashboard" 
                })}
                disabled={isLoading}
              >
                GitHub
              </Button>
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
                Sign up for free
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}