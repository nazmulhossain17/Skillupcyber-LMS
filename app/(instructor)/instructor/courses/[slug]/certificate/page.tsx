// ============================================
// FILE: app/instructor/courses/[slug]/certificate/page.tsx
// Instructor page to create/edit certificate template
// ============================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  ArrowLeft,
  Award,
  Palette,
  Settings,
  Eye,
  Upload,
  Trash2,
  CheckCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { useS3Upload } from '@/hooks/use-s3-upload';
import { CertificateData, CertificateRenderer } from '@/components/CertificateRenderer';

interface CertificateSettings {
  layout: 'classic' | 'modern' | 'minimal' | 'elegant';
  orientation: 'landscape' | 'portrait';
  showDate: boolean;
  showCourseHours: boolean;
  showInstructorName: boolean;
  showCredentialId: boolean;
  borderStyle: 'none' | 'simple' | 'elegant' | 'ornate';
}

interface CertificateTemplate {
  id?: string;
  courseId: string;
  title: string;
  subtitle: string;
  description: string;
  signatureText: string;
  signatureImage: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  settings: CertificateSettings;
  isActive: boolean;
}

const defaultSettings: CertificateSettings = {
  layout: 'classic',
  orientation: 'landscape',
  showDate: true,
  showCourseHours: true,
  showInstructorName: true,
  showCredentialId: true,
  borderStyle: 'elegant',
};

const defaultTemplate: Omit<CertificateTemplate, 'courseId'> = {
  title: 'Certificate of Completion',
  subtitle: 'This is to certify that',
  description: 'has successfully completed the course',
  signatureText: '',
  signatureImage: null,
  logoUrl: null,
  backgroundUrl: null,
  primaryColor: '#4f0099',
  secondaryColor: '#22ad5c',
  settings: defaultSettings,
  isActive: true,
};

export default function CertificateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [templateExists, setTemplateExists] = useState(false);
  
  // Form state
  const [template, setTemplate] = useState<Omit<CertificateTemplate, 'courseId'>>(defaultTemplate);
  
  // File upload refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // S3 upload hooks
  const logoUpload = useS3Upload({
    onComplete: (result) => {
      if (result.success && result.url) {
        setTemplate(prev => ({ ...prev, logoUrl: result.url! }));
        toast.success('Logo uploaded!');
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const signatureUpload = useS3Upload({
    onComplete: (result) => {
      if (result.success && result.url) {
        setTemplate(prev => ({ ...prev, signatureImage: result.url! }));
        toast.success('Signature uploaded!');
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const backgroundUpload = useS3Upload({
    onComplete: (result) => {
      if (result.success && result.url) {
        setTemplate(prev => ({ ...prev, backgroundUrl: result.url! }));
        toast.success('Background uploaded!');
      }
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    fetchTemplate();
  }, [slug]);

  const fetchTemplate = async () => {
    try {
      // First get course info
      const courseRes = await fetch(`/api/courses/${slug}`);
      if (!courseRes.ok) throw new Error('Course not found');
      const { course } = await courseRes.json();
      setCourseId(course.id);
      setCourseName(course.title);

      // Then get certificate template
      const res = await fetch(`/api/instructor/courses/${course.id}/certificate`);
      if (res.ok) {
        const data = await res.json();
        if (data.template) {
          setTemplateExists(true);
          setTemplate({
            ...defaultTemplate,
            ...data.template,
            settings: { ...defaultSettings, ...(data.template.settings || {}) },
          });
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load certificate template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!courseId) return;

    setSaving(true);
    try {
      const method = templateExists ? 'PATCH' : 'POST';
      const res = await fetch(`/api/instructor/courses/${courseId}/certificate`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }

      setTemplateExists(true);
      toast.success('Certificate template saved!');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || 'Failed to save certificate template');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    uploadFn: (file: File) => Promise<any>,
    type: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    await uploadFn(file);
  };

  const updateSettings = (key: keyof CertificateSettings, value: any) => {
    setTemplate(prev => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  // Preview data
  const previewData: CertificateData = {
    id: 'preview',
    credentialId: 'CERT-2024-XXXXXXXX',
    studentName: 'John Doe',
    courseName: courseName || 'Course Name',
    instructorName: template.signatureText || 'Instructor Name',
    courseHours: 10,
    issuedAt: new Date().toISOString(),
    templateTitle: template.title,
    templateSubtitle: template.subtitle,
    templateDescription: template.description,
    signatureText: template.signatureText,
    signatureImage: template.signatureImage,
    logoUrl: template.logoUrl,
    backgroundUrl: template.backgroundUrl,
    primaryColor: template.primaryColor,
    secondaryColor: template.secondaryColor,
    settings: template.settings,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray dark:bg-gray-dark">
      <div className="max-w-[1600px] mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Hidden file inputs */}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileUpload(e, logoUpload.upload, 'logo')}
          className="hidden"
        />
        <input
          ref={signatureInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileUpload(e, signatureUpload.upload, 'signature')}
          className="hidden"
        />
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileUpload(e, backgroundUpload.upload, 'background')}
          className="hidden"
        />

        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4 text-dark-5 hover:text-dark dark:hover:text-white"
            onClick={() => router.push(`/instructor/courses/${slug}/sections`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Course
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-dark dark:text-white flex items-center gap-3">
                <Award className="h-8 w-8 text-primary" />
                Certificate Designer
              </h1>
              <p className="text-dark-5 mt-1">
                Create a certificate for: <span className="font-semibold text-dark dark:text-white">{courseName}</span>
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {templateExists ? 'Save Changes' : 'Create Certificate'}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Editor Panel */}
          <div className="xl:col-span-2 space-y-6">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="content" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="design" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                  <CardHeader>
                    <CardTitle className="text-dark dark:text-white">Certificate Text</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-dark dark:text-white">Title</Label>
                      <Input
                        value={template.title}
                        onChange={(e) => setTemplate(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Certificate of Completion"
                        className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark"
                      />
                    </div>
                    <div>
                      <Label className="text-dark dark:text-white">Subtitle</Label>
                      <Input
                        value={template.subtitle}
                        onChange={(e) => setTemplate(prev => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="This is to certify that"
                        className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark"
                      />
                    </div>
                    <div>
                      <Label className="text-dark dark:text-white">Description</Label>
                      <Textarea
                        value={template.description}
                        onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="has successfully completed the course"
                        className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-dark dark:text-white">Signature Name</Label>
                      <Input
                        value={template.signatureText}
                        onChange={(e) => setTemplate(prev => ({ ...prev, signatureText: e.target.value }))}
                        placeholder="Your name as instructor"
                        className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Images */}
                <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                  <CardHeader>
                    <CardTitle className="text-dark dark:text-white">Images</CardTitle>
                    <CardDescription>Upload custom branding images</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Logo */}
                    <div>
                      <Label className="text-dark dark:text-white mb-2 block">Logo</Label>
                      {template.logoUrl ? (
                        <div className="flex items-center gap-4">
                          <img
                            src={template.logoUrl}
                            alt="Logo"
                            className="h-16 object-contain bg-gray-1 dark:bg-dark-3 rounded p-2"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplate(prev => ({ ...prev, logoUrl: null }))}
                            className="text-red hover:text-red"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUpload.uploading}
                          className="w-full border-dashed"
                        >
                          {logoUpload.uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Upload Logo
                        </Button>
                      )}
                    </div>

                    {/* Signature Image */}
                    <div>
                      <Label className="text-dark dark:text-white mb-2 block">Signature Image (Optional)</Label>
                      {template.signatureImage ? (
                        <div className="flex items-center gap-4">
                          <img
                            src={template.signatureImage}
                            alt="Signature"
                            className="h-12 object-contain bg-gray-1 dark:bg-dark-3 rounded p-2"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplate(prev => ({ ...prev, signatureImage: null }))}
                            className="text-red hover:text-red"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => signatureInputRef.current?.click()}
                          disabled={signatureUpload.uploading}
                          className="w-full border-dashed"
                        >
                          {signatureUpload.uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Upload Signature
                        </Button>
                      )}
                    </div>

                    {/* Background */}
                    <div>
                      <Label className="text-dark dark:text-white mb-2 block">Background Image (Optional)</Label>
                      {template.backgroundUrl ? (
                        <div className="flex items-center gap-4">
                          <img
                            src={template.backgroundUrl}
                            alt="Background"
                            className="h-16 w-24 object-cover bg-gray-1 dark:bg-dark-3 rounded"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplate(prev => ({ ...prev, backgroundUrl: null }))}
                            className="text-red hover:text-red"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => backgroundInputRef.current?.click()}
                          disabled={backgroundUpload.uploading}
                          className="w-full border-dashed"
                        >
                          {backgroundUpload.uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <ImageIcon className="h-4 w-4 mr-2" />
                          )}
                          Upload Background
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Design Tab */}
              <TabsContent value="design" className="space-y-4 mt-4">
                <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                  <CardHeader>
                    <CardTitle className="text-dark dark:text-white">Colors</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-dark dark:text-white">Primary Color</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={template.primaryColor}
                            onChange={(e) => setTemplate(prev => ({ ...prev, primaryColor: e.target.value }))}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <Input
                            value={template.primaryColor}
                            onChange={(e) => setTemplate(prev => ({ ...prev, primaryColor: e.target.value }))}
                            className="flex-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-dark dark:text-white">Secondary Color</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={template.secondaryColor}
                            onChange={(e) => setTemplate(prev => ({ ...prev, secondaryColor: e.target.value }))}
                            className="w-12 h-10 rounded cursor-pointer"
                          />
                          <Input
                            value={template.secondaryColor}
                            onChange={(e) => setTemplate(prev => ({ ...prev, secondaryColor: e.target.value }))}
                            className="flex-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                  <CardHeader>
                    <CardTitle className="text-dark dark:text-white">Layout</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-dark dark:text-white">Orientation</Label>
                      <Select
                        value={template.settings.orientation}
                        onValueChange={(v) => updateSettings('orientation', v)}
                      >
                        <SelectTrigger className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="landscape">Landscape</SelectItem>
                          <SelectItem value="portrait">Portrait</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-dark dark:text-white">Border Style</Label>
                      <Select
                        value={template.settings.borderStyle}
                        onValueChange={(v) => updateSettings('borderStyle', v)}
                      >
                        <SelectTrigger className="mt-1 bg-gray-1 dark:bg-dark-3 border-stroke dark:border-stroke-dark">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="simple">Simple</SelectItem>
                          <SelectItem value="elegant">Elegant</SelectItem>
                          <SelectItem value="ornate">Ornate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4 mt-4">
                <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                  <CardHeader>
                    <CardTitle className="text-dark dark:text-white">Display Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-dark dark:text-white">Show Issue Date</Label>
                      <Switch
                        checked={template.settings.showDate}
                        onCheckedChange={(v) => updateSettings('showDate', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-dark dark:text-white">Show Course Hours</Label>
                      <Switch
                        checked={template.settings.showCourseHours}
                        onCheckedChange={(v) => updateSettings('showCourseHours', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-dark dark:text-white">Show Instructor Name</Label>
                      <Switch
                        checked={template.settings.showInstructorName}
                        onCheckedChange={(v) => updateSettings('showInstructorName', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-dark dark:text-white">Show Credential ID</Label>
                      <Switch
                        checked={template.settings.showCredentialId}
                        onCheckedChange={(v) => updateSettings('showCredentialId', v)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
                  <CardHeader>
                    <CardTitle className="text-dark dark:text-white">Certificate Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-dark dark:text-white">Active</Label>
                        <p className="text-sm text-dark-5">
                          Students can receive this certificate upon completion
                        </p>
                      </div>
                      <Switch
                        checked={template.isActive}
                        onCheckedChange={(v) => setTemplate(prev => ({ ...prev, isActive: v }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Panel */}
          <div className="xl:col-span-3 xl:sticky xl:top-8 xl:self-start">
            <Card className="bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-dark dark:text-white">
                  <Eye className="h-5 w-5 text-primary" />
                  Live Preview
                </CardTitle>
                <CardDescription>
                  This is how your certificate will look to students
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-4">
                <div className="overflow-auto bg-gray-1 dark:bg-dark-3 rounded-lg p-2 sm:p-4">
                  <div className="min-w-[600px]">
                    <CertificateRenderer
                      certificate={previewData}
                      showActions={false}
                      previewMode={true}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status indicator */}
            {templateExists && (
              <div className="mt-4 p-4 bg-green-light-6 dark:bg-green-dark/10 rounded-lg border border-green-light-3 dark:border-green-dark/30">
                <div className="flex items-center gap-2 text-green dark:text-green-light">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Certificate template is active</span>
                </div>
                <p className="text-sm text-green-dark dark:text-green-light-1 mt-1">
                  Students will receive this certificate when they complete your course.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}