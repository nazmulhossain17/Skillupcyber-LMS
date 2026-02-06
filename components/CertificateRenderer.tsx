// ============================================
// FILE: components/certificates/CertificateRenderer.tsx
// Renders certificate and exports to PDF
// ============================================

'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Share2, 
  Loader2, 
  Award,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface CertificateData {
  id: string;
  credentialId: string;
  studentName: string;
  courseName: string;
  instructorName?: string | null;
  courseHours?: number | null;
  issuedAt: string | Date;
  // Template data
  templateTitle?: string;
  templateSubtitle?: string;
  templateDescription?: string;
  signatureText?: string | null;
  signatureImage?: string | null;
  logoUrl?: string | null;
  backgroundUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  settings?: {
    layout?: 'classic' | 'modern' | 'minimal' | 'elegant';
    orientation?: 'landscape' | 'portrait';
    showDate?: boolean;
    showCourseHours?: boolean;
    showInstructorName?: boolean;
    showCredentialId?: boolean;
    borderStyle?: 'none' | 'simple' | 'elegant' | 'ornate';
  };
}

interface CertificateRendererProps {
  certificate: CertificateData;
  showActions?: boolean;
  onDownload?: () => void;
  previewMode?: boolean;
}

export function CertificateRenderer({
  certificate,
  showActions = true,
  onDownload,
  previewMode = false,
}: CertificateRendererProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const settings = certificate.settings || {};
  const layout = settings.layout || 'classic';
  const orientation = settings.orientation || 'landscape';
  const primaryColor = certificate.primaryColor || '#4f0099';
  const secondaryColor = certificate.secondaryColor || '#22ad5c';

  const handleDownloadPDF = async () => {
    if (!certificateRef.current) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: orientation === 'landscape' ? 'l' : 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`certificate-${certificate.credentialId}.pdf`);

      // Track download
      onDownload?.();
      toast.success('Certificate downloaded!');

    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const verifyUrl = `${window.location.origin}/certificates/verify/${certificate.credentialId}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `${certificate.courseName} - Certificate`,
          text: `I completed ${certificate.courseName}! Verify my certificate:`,
          url: verifyUrl,
        });
      } else {
        await navigator.clipboard.writeText(verifyUrl);
        toast.success('Verification link copied to clipboard!');
      }
    } catch (error) {
      console.error('Share error:', error);
    } finally {
      setSharing(false);
    }
  };

  const formattedDate = format(new Date(certificate.issuedAt), 'MMMM d, yyyy');

  return (
    <div className="space-y-6">
      {/* Certificate */}
      <div 
        ref={certificateRef}
        className={`
          relative bg-white shadow-2xl overflow-hidden
          ${orientation === 'landscape' ? 'aspect-[1.414/1]' : 'aspect-[1/1.414]'}
        `}
        style={{ 
          width: '100%',
          maxWidth: previewMode 
            ? (orientation === 'landscape' ? '100%' : '500px')
            : (orientation === 'landscape' ? '900px' : '636px'),
          minWidth: previewMode ? '500px' : undefined,
        }}
      >
        {/* Background */}
        {certificate.backgroundUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-10"
            style={{ backgroundImage: `url(${certificate.backgroundUrl})` }}
          />
        )}

        {/* Border */}
        {settings.borderStyle !== 'none' && (
          <div 
            className={`
              absolute inset-2 border-4 pointer-events-none
              ${settings.borderStyle === 'ornate' ? 'border-double border-8' : ''}
              ${settings.borderStyle === 'elegant' ? 'border-double' : ''}
            `}
            style={{ borderColor: primaryColor }}
          />
        )}

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 md:p-12 text-center">
          {/* Logo */}
          {certificate.logoUrl && (
            <img 
              src={certificate.logoUrl} 
              alt="Logo" 
              className="h-16 md:h-20 object-contain mb-4"
            />
          )}

          {/* Award Icon */}
          <Award 
            className="h-16 w-16 md:h-20 md:w-20 mb-4" 
            style={{ color: primaryColor }}
          />

          {/* Title */}
          <h1 
            className="text-2xl md:text-4xl font-serif font-bold mb-2"
            style={{ color: primaryColor }}
          >
            {certificate.templateTitle || 'Certificate of Completion'}
          </h1>

          {/* Subtitle */}
          <p className="text-gray-600 text-sm md:text-base mb-6">
            {certificate.templateSubtitle || 'This is to certify that'}
          </p>

          {/* Student Name */}
          <h2 
            className="text-xl md:text-3xl font-script font-bold mb-4 px-8 py-2 border-b-2"
            style={{ 
              color: primaryColor,
              borderColor: secondaryColor,
            }}
          >
            {certificate.studentName}
          </h2>

          {/* Description */}
          <p className="text-gray-600 text-sm md:text-base mb-4 max-w-lg">
            {certificate.templateDescription || 'has successfully completed the course'}
          </p>

          {/* Course Name */}
          <h3 
            className="text-lg md:text-2xl font-bold mb-6"
            style={{ color: primaryColor }}
          >
            {certificate.courseName}
          </h3>

          {/* Course Hours */}
          {settings.showCourseHours !== false && certificate.courseHours && (
            <p className="text-gray-500 text-sm mb-4">
              Course Duration: {certificate.courseHours} hours
            </p>
          )}

          {/* Date and Credential */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-4 text-sm text-gray-500">
            {settings.showDate !== false && (
              <div>
                <p className="font-semibold">Date Issued</p>
                <p>{formattedDate}</p>
              </div>
            )}
            
            {settings.showCredentialId !== false && (
              <div>
                <p className="font-semibold">Credential ID</p>
                <p className="font-mono text-xs">{certificate.credentialId}</p>
              </div>
            )}
          </div>

          {/* Signature */}
          {settings.showInstructorName !== false && (certificate.signatureImage || certificate.signatureText || certificate.instructorName) && (
            <div className="mt-8 pt-4 border-t" style={{ borderColor: secondaryColor }}>
              {certificate.signatureImage && (
                <img 
                  src={certificate.signatureImage} 
                  alt="Signature" 
                  className="h-12 mx-auto mb-2"
                />
              )}
              <p className="font-semibold" style={{ color: primaryColor }}>
                {certificate.signatureText || certificate.instructorName}
              </p>
              <p className="text-xs text-gray-500">Instructor</p>
            </div>
          )}

          {/* Verification Badge */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 text-xs text-gray-400">
            <CheckCircle className="h-3 w-3" style={{ color: secondaryColor }} />
            <span>Verified Certificate</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>

          <Button
            onClick={handleShare}
            disabled={sharing}
            variant="outline"
            className="border-stroke dark:border-stroke-dark"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>

          <Button
            variant="outline"
            className="border-stroke dark:border-stroke-dark"
            onClick={() => window.open(`/certificates/verify/${certificate.credentialId}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Verify
          </Button>
        </div>
      )}
    </div>
  );
}