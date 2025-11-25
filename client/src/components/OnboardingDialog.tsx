import { FileText, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingDialogProps {
  onUploadDocuments?: () => void;
  onEnterManually?: () => void;
}

export default function OnboardingDialog({ onUploadDocuments, onEnterManually }: OnboardingDialogProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-card rounded-2xl p-8 space-y-6 shadow-lg animate-in fade-in zoom-in-95 duration-400">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-onboarding-heading">
              How do you want to get onboarded to AutoAnnie
            </h2>
          </div>

          <div className="space-y-4 pt-4">
            <Button
              onClick={onUploadDocuments}
              className="w-full py-6 text-base font-medium rounded-xl shadow-md hover:shadow-lg transition-shadow"
              size="lg"
              data-testid="button-upload-documents"
            >
              <FileText className="w-5 h-5 mr-2" />
              Upload policy documents
            </Button>
            
            <Button
              onClick={onEnterManually}
              variant="outline"
              className="w-full py-6 text-base font-medium rounded-xl shadow-sm hover:shadow-md transition-shadow"
              size="lg"
              data-testid="button-enter-manually"
            >
              <Edit className="w-5 h-5 mr-2" />
              Enter details manually
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
