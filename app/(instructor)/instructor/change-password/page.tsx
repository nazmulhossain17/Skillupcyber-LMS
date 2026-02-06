"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ArrowLeft,
  Shield
} from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

  // Check password strength
  const checkPasswordStrength = (password: string) => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    });
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    checkPasswordStrength(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const newErrors: Record<string, string> = {};

    if (!currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(newPassword)) {
      newErrors.newPassword = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(newPassword)) {
      newErrors.newPassword = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(newPassword)) {
      newErrors.newPassword = "Password must contain at least one number";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.details) {
          // Handle validation errors from server
          const serverErrors: Record<string, string> = {};
          Object.keys(data.details).forEach((key) => {
            serverErrors[key] = data.details[key][0];
          });
          setErrors(serverErrors);
          toast.error("Please check the form for errors");
        } else {
          toast.error(data.error || "Failed to change password");
        }
        return;
      }

      toast.success("Password changed successfully!");
      
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStrength({
        hasMinLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
      });

      // Redirect to dashboard after 1.5 seconds
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);

    } catch (error) {
      console.error("Password change error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Button 
          variant="ghost" 
          className="mb-4 sm:mb-6"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">Change Password</CardTitle>
                <CardDescription className="text-sm sm:text-base mt-1">
                  Update your password to keep your account secure
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm sm:text-base">
                  Current Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={`pl-10 pr-10 h-10 sm:h-11 text-sm sm:text-base ${
                      errors.currentPassword ? "border-red-500" : ""
                    }`}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="text-xs sm:text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    {errors.currentPassword}
                  </p>
                )}
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm sm:text-base">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => handleNewPasswordChange(e.target.value)}
                    className={`pl-10 pr-10 h-10 sm:h-11 text-sm sm:text-base ${
                      errors.newPassword ? "border-red-500" : ""
                    }`}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-xs sm:text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    {errors.newPassword}
                  </p>
                )}

                {/* Password Strength Indicators */}
                {newPassword && (
                  <div className="space-y-1.5 sm:space-y-2 mt-3 p-3 sm:p-4 bg-background rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Password Requirements:
                    </p>
                    <div className="space-y-1 sm:space-y-1.5">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        {passwordStrength.hasMinLength ? (
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        )}
                        <span className={passwordStrength.hasMinLength ? "text-green-600" : "text-gray-600"}>
                          At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        {passwordStrength.hasUppercase ? (
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        )}
                        <span className={passwordStrength.hasUppercase ? "text-green-600" : "text-gray-600"}>
                          One uppercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        {passwordStrength.hasLowercase ? (
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        )}
                        <span className={passwordStrength.hasLowercase ? "text-green-600" : "text-gray-600"}>
                          One lowercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        {passwordStrength.hasNumber ? (
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        )}
                        <span className={passwordStrength.hasNumber ? "text-green-600" : "text-gray-600"}>
                          One number
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm sm:text-base">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`pl-10 pr-10 h-10 sm:h-11 text-sm sm:text-base ${
                      errors.confirmPassword ? "border-red-500" : ""
                    }`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs sm:text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    {errors.confirmPassword}
                  </p>
                )}
                {!errors.confirmPassword && confirmPassword && newPassword === confirmPassword && (
                  <p className="text-xs sm:text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 sm:h-11 text-sm sm:text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="flex-1 sm:flex-initial h-10 sm:h-11 text-sm sm:text-base"
                >
                  Cancel
                </Button>
              </div>
            </form>

            {/* Security Tips */}
            <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-background rounded-lg">
              <h4 className="text-xs sm:text-sm font-semibold text-blue-900 mb-2">
                Security Tips:
              </h4>
              <ul className="space-y-1 text-xs sm:text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Use a unique password you don't use elsewhere</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Avoid using personal information in your password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Consider using a password manager</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}