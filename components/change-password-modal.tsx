"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFocusTrap, announceToScreenReader } from "@/lib/accessibility";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Type-safe toast usage
  const { toast } = useToast();

  // Focus trap for accessibility
  const focusTrapRef = useFocusTrap(open);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLoading(false);
    }
  }, [open]);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New password and confirm password do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Password changed successfully",
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to change password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div
        ref={focusTrapRef as any}
        className="bg-bron-bg-secondary border border-bron-border rounded-lg p-6 w-full max-w-md mx-4"
      >
        <div className="mb-4">
          <h2
            id="change-password-title"
            className="text-lg font-semibold text-bron-text-primary"
          >
            Change Password
          </h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="current-password" className="text-bron-text-primary">
              Current Password
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-bron-bg-tertiary border-bron-border text-bron-text-primary"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <Label htmlFor="new-password" className="text-bron-text-primary">
              New Password
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-bron-bg-tertiary border-bron-border text-bron-text-primary"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password" className="text-bron-text-primary">
              Confirm New Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-bron-bg-tertiary border-bron-border text-bron-text-primary"
              placeholder="Confirm new password"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleChangePassword}
              disabled={loading}
              className="flex-1 bg-bron-accent-red hover:bg-bron-accent-red-hover text-white"
            >
              {loading ? "Changing..." : "Change Password"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-bron-border text-white hover:text-white hover:bg-neutral-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 