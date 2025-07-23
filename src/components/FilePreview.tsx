import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, File, Image, Video, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileUploadData } from './FileUpload';

interface FilePreviewProps {
  fileData: FileUploadData;
  showPreview?: boolean;
  className?: string;
}

export function FilePreview({ fileData, showPreview = true, className }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = fileData.fileType.startsWith('image/');
  const isVideo = fileData.fileType.startsWith('video/');
  const isPdf = fileData.fileType === 'application/pdf';
  const isDocument = fileData.fileType.includes('document') || 
                    fileData.fileType.includes('text/') ||
                    fileData.fileType.includes('csv');

  useEffect(() => {
    if (showPreview && (isImage || isVideo) && fileData.uploadStatus === 'completed') {
      loadPreview();
    }
  }, [showPreview, isImage, isVideo, fileData.uploadStatus, fileData.storagePath]);

  const loadPreview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(fileData.storagePath, 3600); // 1 hour expiry

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (err) {
      console.error('Error loading preview:', err);
      setError('Failed to load preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .download(fileData.storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileData.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  const handleOpenExternal = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(fileData.storagePath, 3600);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('Error opening file:', err);
    }
  };

  const getFileIcon = () => {
    if (isImage) return <Image className="h-4 w-4" />;
    if (isVideo) return <Video className="h-4 w-4" />;
    if (isPdf) return <FileText className="h-4 w-4" />;
    if (isDocument) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = () => {
    switch (fileData.uploadStatus) {
      case 'completed':
        return 'bg-success text-success-foreground';
      case 'uploading':
        return 'bg-muted text-muted-foreground';
      case 'failed':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Preview Section */}
      {showPreview && (isImage || isVideo) && fileData.uploadStatus === 'completed' && (
        <div className="aspect-video bg-muted flex items-center justify-center">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading preview...
            </div>
          )}
          
          {error && (
            <div className="text-destructive text-sm">
              {error}
            </div>
          )}
          
          {previewUrl && !isLoading && !error && (
            <>
              {isImage && (
                <img
                  src={previewUrl}
                  alt={fileData.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              )}
              {isVideo && (
                <video
                  src={previewUrl}
                  controls
                  className="max-w-full max-h-full"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </>
          )}
        </div>
      )}

      {/* File Info Section */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-muted rounded">
            {getFileIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{fileData.fileName}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formatFileSize(fileData.fileSize)}
              </span>
              <Badge className={cn("text-xs", getStatusColor())}>
                {fileData.uploadStatus}
              </Badge>
            </div>
            
            {fileData.metadata?.uploadedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Uploaded {new Date(fileData.metadata.uploadedAt).toLocaleString()}
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-1">
            {fileData.uploadStatus === 'completed' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 w-8 p-0"
                >
                  <Download className="h-3 w-3" />
                </Button>
                
                {(isPdf || isDocument) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenExternal}
                    className="h-8 w-8 p-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                
                {showPreview && (isImage || isVideo) && !previewUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadPreview}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}