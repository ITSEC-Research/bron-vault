"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFocusTrap } from "@/lib/accessibility";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Type-safe toast usage
  const { toast } = useToast();

  // Focus trap for accessibility
  const focusTrapRef = useFocusTrap(open);

  // Ensure we're mounted (client-side only)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
    } catch (_error) {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        ref={focusTrapRef as any}
        className="fixed left-[50%] top-[50%] z-[100] w-full max-w-md translate-x-[-50%] translate-y-[-50%] mx-4"
      >
        <div className="glass-modal rounded-lg p-6 shadow-lg max-h-[90vh] overflow-y-auto">
          <div className="mb-4">
            <h2
              id="change-password-title"
              className="text-lg font-semibold text-foreground"
            >
              Change Password
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-password" className="text-foreground">
                Current Password
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="glass-input"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="text-foreground">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-foreground">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="glass-input"
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleChangePassword}
                disabled={loading}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? "Changing..." : "Change Password"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border text-foreground hover:text-foreground hover:bg-secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal to document.body using Portal to escape parent container constraints
  return createPortal(modalContent, document.body);
} 