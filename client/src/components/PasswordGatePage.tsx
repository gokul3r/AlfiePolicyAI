import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Sparkles, Shield, Lock } from "lucide-react";
import logoImage from "@assets/generated_images/autoannie_ai_insurance_assistant_icon.png";

interface PasswordGatePageProps {
  onAccessGranted: () => void;
}

const ACCESS_KEY = "AA@ITCTO";

export default function PasswordGatePage({ onAccessGranted }: PasswordGatePageProps) {
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const handleContinue = () => {
    if (accessKey === ACCESS_KEY) {
      sessionStorage.setItem("autoannie_access_granted", "true");
      onAccessGranted();
    } else {
      setError("Invalid access key. Please try again.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleCancel = () => {
    setAccessKey("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleContinue();
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />
        
        <div className="absolute inset-0 opacity-30">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        <div className="absolute top-10 left-1/4 opacity-20">
          <Brain className="w-16 h-16 text-purple-300" />
        </div>
        <div className="absolute bottom-20 left-20 opacity-20">
          <Sparkles className="w-12 h-12 text-blue-300" />
        </div>
        <div className="absolute top-1/3 right-20 opacity-20">
          <Shield className="w-14 h-14 text-indigo-300" />
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md mx-auto">
          <div 
            className="backdrop-blur-xl bg-white/10 rounded-3xl p-8 shadow-2xl border border-white/20"
          >
            <div className="text-center space-y-4 mb-8">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-500/50 rounded-2xl blur-xl" />
                  <img 
                    src={logoImage} 
                    alt="AutoAnnie Logo" 
                    className="relative h-20 w-auto rounded-2xl shadow-lg"
                    data-testid="img-gate-logo"
                  />
                </div>
              </div>
              <h1 className="text-4xl font-bold text-white tracking-tight">
                AutoAnnie
              </h1>
              <p className="text-lg text-purple-200/80 font-medium">
                Innovation Lab
              </p>
            </div>

            <div className={`space-y-6 ${isShaking ? "animate-shake" : ""}`}>
              <div className="space-y-2">
                <Label 
                  htmlFor="accessKey" 
                  className="text-sm font-medium text-white/90 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Access Key
                </Label>
                <Input
                  id="accessKey"
                  type="password"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your access key"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 h-12 rounded-xl"
                  data-testid="input-access-key"
                />
                {error && (
                  <p className="text-sm text-red-400 mt-1" data-testid="text-error">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleContinue}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/25"
                  data-testid="button-continue"
                >
                  Continue
                </Button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-center text-xs text-white/40">
                Protected demo environment
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
