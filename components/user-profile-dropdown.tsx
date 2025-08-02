"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, Lock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChangePasswordModal from "./change-password-modal";

interface UserData {
  id: number;
  email: string;
  name: string;
}

export default function UserProfileDropdown() {
  const [user, setUser] = useState<UserData | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  // Simple component without HMR issues
  useEffect(() => {
    // No special HMR handling needed
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/auth/get-user", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleChangePasswordClick = () => {
    setChangePasswordOpen(true);
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 bg-bron-bg-tertiary rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-bron-text-muted" />
        </div>
        <span className="text-sm text-bron-text-muted">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-3 py-2 h-auto bg-transparent hover:bg-bron-bg-tertiary border-none"
          >
            <div className="w-8 h-8 bg-bron-bg-tertiary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-bron-text-primary" />
            </div>
            <span className="text-sm text-bron-text-primary font-medium">
              {user.name}
            </span>
            <ChevronDown className="w-4 h-4 text-bron-text-muted" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-bron-bg-secondary border-bron-border">
          <div className="px-3 py-2 border-b border-bron-border">
            <p className="text-sm font-medium text-bron-text-primary">{user.name}</p>
            <p className="text-xs text-bron-text-muted">{user.email}</p>
          </div>
          <DropdownMenuItem 
            onClick={handleChangePasswordClick}
            className="flex items-center gap-2 cursor-pointer text-bron-text-primary hover:bg-bron-bg-tertiary"
          >
            <Lock className="w-4 h-4" />
            Change Password
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-bron-border" />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={logoutLoading}
            className="flex items-center gap-2 cursor-pointer text-bron-text-primary hover:bg-bron-bg-tertiary"
          >
            <LogOut className="w-4 h-4" />
            {logoutLoading ? "Logging out..." : "Logout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
} 