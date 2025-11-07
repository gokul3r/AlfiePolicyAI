import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (extractedData: any, missingFields: string[]) => void;
  onCancel: () => void;
}

export default function UploadDialog({
  open,
  onOpenChange,
  onExtracted,
  onCancel,
}: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB in bytes

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF file only.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 6MB. Please choose a smaller file.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setUploadProgress(0);

    // Simulate progress animation
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 800);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Extraction Successful",
          description: data.message || "Document processed successfully!",
        });

        // Reset state before passing data to parent
        setIsExtracting(false);
        setSelectedFile(null);
        setUploadProgress(0);

        // Pass extracted data and missing fields to parent
        onExtracted(data.extracted_fields, data.not_extracted_fields || []);
      } else {
        throw new Error(data.message || "Extraction failed");
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      toast({
        title: "Extraction Failed",
        description: error.message || "Unable to extract data from the document. Please try again.",
        variant: "destructive",
      });
      setIsExtracting(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setIsExtracting(false);
    setUploadProgress(0);
    onCancel();
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6" data-testid="dialog-upload">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-bold text-center" data-testid="text-upload-title">
            Upload Policy Document
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Upload your insurance policy document (PDF only, max 6MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {!isExtracting ? (
            <>
              {/* File Upload Area */}
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 hover-elevate">
                <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => document.getElementById("file-upload")?.click()}
                    data-testid="button-choose-file"
                  >
                    Choose PDF File
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  PDF only • Max 6MB
                </p>
              </div>

              {/* Selected File Info */}
              {selectedFile && (
                <div className="flex items-center gap-3 p-4 bg-muted rounded-xl" data-testid="container-selected-file">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid="text-filename">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-filesize">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1 rounded-xl"
                  size="lg"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile}
                  className="flex-1 rounded-xl"
                  size="lg"
                  data-testid="button-upload"
                >
                  Upload & Extract
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Extraction Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="space-y-2">
                  <p className="text-center font-medium" data-testid="text-extracting">
                    Extracting details...
                  </p>
                  <Progress value={uploadProgress} className="h-2" data-testid="progress-extraction" />
                  <p className="text-center text-sm text-muted-foreground">
                    This may take 8-10 seconds
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Info Alert */}
          <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              We'll automatically extract your policy details. You can review and edit them before saving.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
