// ============================================
// FILE: components/courses/CourseCompletionModal.tsx
// Modal shown when student completes a course
// Allows them to claim their certificate
// ============================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Award,
  Download,
  Loader2,
  PartyPopper,
  CheckCircle,
  ExternalLink,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CourseCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseName: string;
  onCertificateClaimed?: (credentialId: string) => void;
}

export function CourseCompletionModal({
  open,
  onOpenChange,
  courseId,
  courseName,
  onCertificateClaimed,
}: CourseCompletionModalProps) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [certificate, setCertificate] = useState<{
    id: string;
    credentialId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#4f0099', '#22ad5c', '#ffd700'],
    });
  };

  const handleClaimCertificate = async () => {
    setClaiming(true);
    setError(null);

    try {
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to claim certificate');
      }

      setClaimed(true);
      setCertificate(data.certificate);
      onCertificateClaimed?.(data.certificate.credentialId);
      triggerConfetti();
      toast.success('Congratulations! Certificate claimed!');

    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Failed to claim certificate');
    } finally {
      setClaiming(false);
    }
  };

  const handleShare = async () => {
    if (!certificate) return;

    const verifyUrl = `${window.location.origin}/certificates/verify/${certificate.credentialId}`;
    const text = `I just completed "${courseName}" and earned my certificate! 🎉\n\nVerify: ${verifyUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${courseName} - Certificate`,
          text,
          url: verifyUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Share text copied to clipboard!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
        {!claimed ? (
          <>
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <PartyPopper className="h-12 w-12 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-green flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
              <DialogTitle className="text-2xl text-dark dark:text-white">
                🎉 Congratulations!
              </DialogTitle>
              <DialogDescription className="text-dark-5 text-base mt-2">
                You've successfully completed <span className="font-semibold text-dark dark:text-white">"{courseName}"</span>
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-dark dark:text-white">
                    Claim Your Certificate
                  </h4>
                  <p className="text-sm text-dark-5">
                    Get your verified certificate of completion
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-light-6 dark:bg-red-dark/10 rounded-lg border border-red-light-3 dark:border-red-dark/30">
                <p className="text-sm text-red dark:text-red-light">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 mt-6">
              <Button
                onClick={handleClaimCertificate}
                disabled={claiming}
                className="w-full bg-primary text-white hover:bg-primary/90 h-12 text-base"
              >
                {claiming ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <Award className="h-5 w-5 mr-2" />
                    Claim Certificate
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full border-stroke dark:border-stroke-dark"
              >
                Maybe Later
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-full bg-green/10 flex items-center justify-center">
                  <CheckCircle className="h-14 w-14 text-green" />
                </div>
              </div>
              <DialogTitle className="text-2xl text-dark dark:text-white">
                Certificate Claimed!
              </DialogTitle>
              <DialogDescription className="text-dark-5 text-base mt-2">
                Your certificate has been issued and is ready to download.
              </DialogDescription>
            </DialogHeader>

            {certificate && (
              <div className="mt-6 p-4 bg-gray-1 dark:bg-dark-3 rounded-xl">
                <p className="text-sm text-dark-5 mb-1">Credential ID</p>
                <p className="font-mono font-semibold text-dark dark:text-white">
                  {certificate.credentialId}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 mt-6">
              <Link href="/my-certificates" className="w-full">
                <Button className="w-full bg-primary text-white hover:bg-primary/90 h-12">
                  <Download className="h-5 w-5 mr-2" />
                  View & Download Certificate
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleShare}
                className="w-full border-stroke dark:border-stroke-dark"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Achievement
              </Button>
              {certificate && (
                <Link 
                  href={`/certificates/verify/${certificate.credentialId}`}
                  target="_blank"
                  className="w-full"
                >
                  <Button
                    variant="ghost"
                    className="w-full text-dark-5"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Verification Page
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}