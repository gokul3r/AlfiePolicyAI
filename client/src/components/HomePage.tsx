import { Button } from "@/components/ui/button";
import logoImage from "@assets/generated_images/autoannie_ai_insurance_assistant_icon.png";

interface HomePageProps {
  onNewUser: () => void;
  onExistingUser: () => void;
}

export default function HomePage({ onNewUser, onExistingUser }: HomePageProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md mx-auto space-y-12">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <img 
              src={logoImage} 
              alt="AutoAnnie Logo" 
              className="h-24 w-auto rounded-2xl shadow-lg"
              data-testid="img-logo"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground">AutoAnnie</h1>
          <p className="text-sm text-muted-foreground">
            Your AI Insurance Companion
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={onNewUser}
            className="w-full py-6 text-base font-medium rounded-xl shadow-md hover:shadow-lg transition-shadow"
            size="lg"
            data-testid="button-new-user"
          >
            New User
          </Button>
          
          <Button
            onClick={onExistingUser}
            variant="outline"
            className="w-full py-6 text-base font-medium rounded-xl shadow-sm hover:shadow-md transition-shadow"
            size="lg"
            data-testid="button-existing-user"
          >
            Existing User
          </Button>
        </div>
      </div>
    </div>
  );
}
