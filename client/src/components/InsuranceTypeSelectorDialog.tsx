import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, Truck, Home, PawPrint, Plane, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsuranceType {
  id: string;
  name: string;
  icon: typeof Car;
  gradient: string;
  iconBg: string;
  isActive: boolean;
}

const insuranceTypes: InsuranceType[] = [
  {
    id: "car",
    name: "Car",
    icon: Car,
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconBg: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    isActive: true,
  },
  {
    id: "van",
    name: "Van",
    icon: Truck,
    gradient: "from-purple-500/20 to-pink-500/20",
    iconBg: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    isActive: false,
  },
  {
    id: "home",
    name: "Home",
    icon: Home,
    gradient: "from-green-500/20 to-emerald-500/20",
    iconBg: "bg-green-500/20 text-green-600 dark:text-green-400",
    isActive: false,
  },
  {
    id: "pet",
    name: "Pet",
    icon: PawPrint,
    gradient: "from-orange-500/20 to-amber-500/20",
    iconBg: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    isActive: false,
  },
  {
    id: "travel",
    name: "Travel",
    icon: Plane,
    gradient: "from-sky-500/20 to-blue-500/20",
    iconBg: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
    isActive: false,
  },
  {
    id: "business",
    name: "Business",
    icon: Briefcase,
    gradient: "from-indigo-500/20 to-violet-500/20",
    iconBg: "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    isActive: false,
  },
];

interface InsuranceTypeSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCar: () => void;
  onSelectInactive: (insuranceName: string) => void;
}

export function InsuranceTypeSelectorDialog({
  open,
  onOpenChange,
  onSelectCar,
  onSelectInactive,
}: InsuranceTypeSelectorDialogProps) {
  const handleTypeClick = (type: InsuranceType) => {
    if (type.isActive) {
      onSelectCar();
    } else {
      onSelectInactive(type.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl p-6"
        data-testid="dialog-insurance-type-selector"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-center mb-2">
            Choose Insurance Type
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Select the type of insurance policy you'd like to add
          </p>
        </DialogHeader>

        {/* Modern Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
          {insuranceTypes.map((type, index) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => handleTypeClick(type)}
                data-testid={`button-insurance-${type.id}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300",
                  "animate-in fade-in slide-in-from-bottom-4",
                  type.isActive
                    ? "border-border bg-gradient-to-br cursor-pointer shadow-sm hover-elevate active-elevate-2"
                    : "grayscale opacity-40 cursor-pointer border-border/50 hover:opacity-50"
                )}
                style={{
                  animationDelay: `${index * 75}ms`,
                  animationFillMode: "backwards",
                }}
              >
                {/* Gradient Background */}
                {type.isActive && (
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-70",
                      type.gradient
                    )}
                  />
                )}

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  {/* Icon Circle */}
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full transition-transform group-hover:scale-110",
                      type.isActive ? type.iconBg : "bg-muted/50"
                    )}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  {/* Label */}
                  <div className="text-center">
                    <h3 className="font-semibold text-base text-foreground">
                      {type.name}
                    </h3>
                    {!type.isActive && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Coming Soon
                      </p>
                    )}
                  </div>
                </div>

                {/* Hover Glow Effect (Active Only) */}
                {type.isActive && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
