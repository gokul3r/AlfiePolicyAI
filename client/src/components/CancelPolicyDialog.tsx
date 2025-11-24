import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { CancelConfirmationDialog } from "./CancelConfirmationDialog";

interface CancelPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function CancelPolicyDialog({
  open,
  onOpenChange,
  userEmail,
}: CancelPolicyDialogProps) {
  const { toast } = useToast();
  const [selectedPolicy, setSelectedPolicy] = useState<{
    policyId: string;
    policyNumber: string;
  } | null>(null);

  // Fetch all policies for the user
  const { data: policies = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/vehicle-policies", userEmail],
    enabled: open && !!userEmail,
  });

  // Cancel policy mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ policyId, email }: { policyId: string; email: string }) => {
      const response = await apiRequest("POST", "/api/cancel-policy", { 
        policyId, 
        email, 
        cancel: true 
      });
      return response.json();
    },
    onSuccess: (data: { policyNumber: string; cancelled: boolean }) => {
      toast({
        title: "Policy Cancelled",
        description: `Policy ${data.policyNumber} has been successfully cancelled.`,
      });
      // Invalidate policies query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-policies", userEmail] });
      setSelectedPolicy(null);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Unable to cancel policy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCancelClick = (policyId: string, policyNumber: string) => {
    setSelectedPolicy({ policyId, policyNumber });
  };

  const handleConfirmCancel = () => {
    if (selectedPolicy) {
      cancelMutation.mutate({
        policyId: selectedPolicy.policyId,
        email: userEmail,
      });
    }
  };

  // Group policies by type
  const groupedPolicies = policies.reduce((acc: Record<string, any[]>, policy) => {
    const type = policy.policy_type || "car";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(policy);
    return acc;
  }, {});

  const typeNames: Record<string, string> = {
    car: "Car",
    van: "Van",
    home: "Home",
    pet: "Pet",
    travel: "Travel",
    business: "Business",
  };

  const typeOrder = ["car", "van", "home", "pet", "travel", "business"];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-cancel-policy">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Cancel Policy</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading policies...
            </div>
          ) : policies.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No policies found
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {typeOrder.map((type) => {
                const typePolicies = groupedPolicies[type];
                if (!typePolicies || typePolicies.length === 0) return null;

                return (
                  <div key={type} className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      {typeNames[type]}
                    </h3>
                    <div className="space-y-2">
                      {typePolicies.map((policy) => (
                        <div
                          key={policy.policy_id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                          data-testid={`policy-item-${policy.policy_id}`}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-foreground">
                              {type === "car" && policy.vehicle_manufacturer_name
                                ? `${policy.vehicle_manufacturer_name} ${policy.vehicle_model}`
                                : policy.policy_number}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Policy: {policy.policy_number}
                            </div>
                            {policy.current_insurance_provider && (
                              <div className="text-sm text-muted-foreground">
                                Provider: {policy.current_insurance_provider}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelClick(policy.policy_id, policy.policy_number)}
                            data-testid={`button-cancel-${policy.policy_id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CancelConfirmationDialog
        open={!!selectedPolicy}
        onOpenChange={(open: boolean) => {
          if (!open && !cancelMutation.isPending) {
            setSelectedPolicy(null);
          }
        }}
        onConfirm={handleConfirmCancel}
        policyNumber={selectedPolicy?.policyNumber || ""}
        isLoading={cancelMutation.isPending}
      />
    </>
  );
}
