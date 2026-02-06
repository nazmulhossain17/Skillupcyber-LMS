// ============================================
// FILE: app/(student)/my-certificates/page.tsx
// Student page to view all earned certificates
// ============================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Award,
  Download,
  ExternalLink,
  Search,
  Loader2,
  Calendar,
  Clock,
  Share2,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { CertificateData, CertificateRenderer } from '@/components/CertificateRenderer';

interface Certificate {
  id: string;
  credentialId: string;
  studentName: string;
  courseName: string;
  instructorName: string | null;
  courseHours: number | null;
  issuedAt: string;
  courseId: string;
  courseSlug: string;
  courseThumbnail: string | null;
  templateId: string;
  templateTitle: string;
  templateSettings: any;
  primaryColor: string;
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateData | null>(null);
  const [loadingCertificate, setLoadingCertificate] = useState(false);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const res = await fetch('/api/certificates');
      if (res.ok) {
        const data = await res.json();
        setCertificates(data.certificates || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  const openCertificateModal = async (cert: Certificate) => {
    setLoadingCertificate(true);
    try {
      const res = await fetch(`/api/certificates/${cert.id}`);
      if (res.ok) {
        const { certificate } = await res.json();
        setSelectedCertificate(certificate);
      }
    } catch (error) {
      toast.error('Failed to load certificate details');
    } finally {
      setLoadingCertificate(false);
    }
  };

  const handleDownloadTracking = async () => {
    if (selectedCertificate) {
      await fetch(`/api/certificates/${selectedCertificate.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download' }),
      }).catch(console.error);
    }
  };

  const filteredCertificates = certificates.filter(cert =>
    cert.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.credentialId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray dark:bg-gray-dark">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark dark:text-white flex items-center gap-3">
            <Award className="h-8 w-8 text-primary" />
            My Certificates
          </h1>
          <p className="text-dark-5 mt-2">
            View and download your earned course certificates
          </p>
        </div>

        {/* Search */}
        {certificates.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-5" />
              <Input
                placeholder="Search certificates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark"
              />
            </div>
          </div>
        )}

        {/* Certificates Grid */}
        {certificates.length === 0 ? (
          <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <CardContent className="py-16 text-center">
              <Award className="h-16 w-16 mx-auto mb-4 text-dark-5" />
              <h2 className="text-xl font-semibold text-dark dark:text-white mb-2">
                No Certificates Yet
              </h2>
              <p className="text-dark-5 mb-6 max-w-md mx-auto">
                Complete courses to earn certificates. Your certificates will appear here once you finish a course.
              </p>
              <Link href="/courses">
                <Button className="bg-primary text-white hover:bg-primary/90">
                  Browse Courses
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredCertificates.length === 0 ? (
          <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-dark-5" />
              <p className="text-dark-5">No certificates match your search.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCertificates.map((cert) => (
              <Card
                key={cert.id}
                className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Course Thumbnail */}
                <div className="relative h-40 bg-gray-1 dark:bg-dark-3">
                  {cert.courseThumbnail ? (
                    <Image
                      src={cert.courseThumbnail}
                      alt={cert.courseName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <Award className="h-16 w-16 text-dark-5" />
                    </div>
                  )}
                  {/* Certificate badge overlay */}
                  <div 
                    className="absolute top-3 right-3 px-3 py-1 rounded-full text-white text-xs font-semibold"
                    style={{ backgroundColor: cert.primaryColor || '#4f0099' }}
                  >
                    Certified
                  </div>
                </div>

                <CardContent className="p-4">
                  {/* Course Name */}
                  <h3 className="font-semibold text-dark dark:text-white line-clamp-2 mb-2">
                    {cert.courseName}
                  </h3>

                  {/* Meta info */}
                  <div className="space-y-1 text-sm text-dark-5 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Issued: {format(new Date(cert.issuedAt), 'MMM d, yyyy')}</span>
                    </div>
                    {cert.courseHours && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{cert.courseHours} hours</span>
                      </div>
                    )}
                    <div className="font-mono text-xs text-dark-6">
                      {cert.credentialId}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => openCertificateModal(cert)}
                      className="flex-1 bg-primary text-white hover:bg-primary/90"
                      size="sm"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-stroke dark:border-stroke-dark"
                      onClick={() => {
                        const url = `${window.location.origin}/certificates/verify/${cert.credentialId}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Verification link copied!');
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Certificate Modal */}
        <Dialog 
          open={!!selectedCertificate} 
          onOpenChange={() => setSelectedCertificate(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
            <DialogHeader>
              <DialogTitle className="text-dark dark:text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Your Certificate
              </DialogTitle>
            </DialogHeader>
            
            {loadingCertificate ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedCertificate ? (
              <CertificateRenderer
                certificate={selectedCertificate}
                showActions={true}
                onDownload={handleDownloadTracking}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}