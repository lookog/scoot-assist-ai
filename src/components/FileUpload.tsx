import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { X, Upload, File, Image, Video, FileText, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  sessionId: string;
  onFileUpload?: (fileData: FileUploadData) => void;
  className?: string;
  compact?: boolean;
}

export interface FileUploadData {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  uploadStatus: 'uploading' | 'completed' | 'failed';
  metadata?: any;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const SUPPORTED_FILE_TYPES = {
  'image/jpeg': { icon: Image, label: 'JPEG Image' },
  'image/png': { icon: Image, label: 'PNG Image' },
  'image/gif': { icon: Image, label: 'GIF Image' },
  'image/webp': { icon: Image, label: 'WebP Image' },
  'video/mp4': { icon: Video, label: 'MP4 Video' },
  'video/webm': { icon: Video, label: 'WebM Video' },
  'video/mov': { icon: Video, label: 'MOV Video' },
  'application/pdf': { icon: FileText, label: 'PDF Document' },
  'application/msword': { icon: FileText, label: 'Word Document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, label: 'Word Document' },
  'text/plain': { icon: FileText, label: 'Text File' },
  'text/csv': { icon: FileText, label: 'CSV File' },
};

export function FileUpload({ sessionId, onFileUpload, className, compact = false }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, { progress: number; file: File }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be under 20MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    }
    
    if (!Object.keys(SUPPORTED_FILE_TYPES).includes(file.type)) {
      return `File type ${file.type} is not supported. Supported types: Images, Videos, PDFs, Documents`;
    }
    
    return null;
  };

  const uploadFile = useCallback(async (file: File): Promise<FileUploadData | null> => {
    if (!user) return null;

    const fileId = crypto.randomUUID();
    const fileName = file.name;
    const storagePath = `${user.id}/${sessionId}/${fileId}-${fileName}`;

    // Create upload record
    const { data: uploadRecord, error: recordError } = await supabase
      .from('file_uploads')
      .insert({
        id: fileId,
        user_id: user.id,
        session_id: sessionId,
        file_name: fileName,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        upload_status: 'uploading',
        metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        }
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error creating upload record:', recordError);
      return null;
    }

    // Upload to storage
    const { error: storageError } = await supabase.storage
      .from('chat-files')
      .upload(storagePath, file);

    if (storageError) {
      console.error('Error uploading file:', storageError);
      // Update record to failed
      await supabase
        .from('file_uploads')
        .update({ upload_status: 'failed' })
        .eq('id', fileId);
      return null;
    }

    // Update record to completed
    const { error: updateError } = await supabase
      .from('file_uploads')
      .update({ upload_status: 'completed' })
      .eq('id', fileId);

    if (updateError) {
      console.error('Error updating upload status:', updateError);
    }

    return {
      id: fileId,
      fileName,
      fileSize: file.size,
      fileType: file.type,
      storagePath,
      uploadStatus: 'completed',
      metadata: uploadRecord.metadata,
    };
  }, [user, sessionId]);

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;

    const validFiles = Array.from(files).filter(file => {
      const error = validateFile(file);
      if (error) {
        toast({
          description: `${file.name}: ${error}`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    // Add files to uploading state
    const newUploadingFiles = new Map(uploadingFiles);
    validFiles.forEach(file => {
      const fileId = crypto.randomUUID();
      newUploadingFiles.set(fileId, { progress: 0, file });
    });
    setUploadingFiles(newUploadingFiles);

    // Upload files
    for (const file of validFiles) {
      try {
        const fileData = await uploadFile(file);
        if (fileData && onFileUpload) {
          onFileUpload(fileData);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast({
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    // Clear uploading state
    setUploadingFiles(new Map());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const getFileIcon = (fileType: string) => {
    const fileInfo = SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES];
    const IconComponent = fileInfo?.icon || File;
    return <IconComponent className="h-4 w-4" />;
  };

  // Compact mode - just a button
  if (compact) {
    return (
      <div className={className}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Object.keys(SUPPORTED_FILE_TYPES).join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="px-3"
          disabled={uploadingFiles.size > 0}
        >
          <Paperclip className="h-4 w-4" />
          {uploadingFiles.size > 0 && (
            <div className="ml-1 w-4 h-4">
              <div className="w-full h-full border-2 border-muted rounded-full border-t-primary animate-spin" />
            </div>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={Object.keys(SUPPORTED_FILE_TYPES).join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Card
        className={cn(
          "border-2 border-dashed border-border transition-colors cursor-pointer",
          isDragOver && "border-primary bg-primary/5",
          "hover:border-primary/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="p-6 text-center">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">
            Drop files here or click to select
          </p>
          <p className="text-xs text-muted-foreground">
            Support: Images, Videos, PDFs, Documents (max 20MB)
          </p>
        </div>
      </Card>

      {/* Uploading Files */}
      {uploadingFiles.size > 0 && (
        <div className="mt-4 space-y-2">
          {Array.from(uploadingFiles.entries()).map(([fileId, { file }]) => (
            <Card key={fileId} className="p-3">
              <div className="flex items-center gap-3">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={100} className="w-16" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newFiles = new Map(uploadingFiles);
                      newFiles.delete(fileId);
                      setUploadingFiles(newFiles);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}