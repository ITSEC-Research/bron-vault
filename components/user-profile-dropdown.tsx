"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, ChevronDown, Shield, Eye, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type UserRole = 'admin' | 'analyst'

interface UserData {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export default function UserProfileDropdown() {
  const [user, setUser] = useState<UserData | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/auth/get-user", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        setUser({
          ...data.user,
          role: data.user.role || 'admin'
        });
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

  if (!user) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-3 py-2 h-auto bg-transparent hover:bg-secondary border-none"
          >
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-sm text-foreground font-medium">
              {user.name}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 glass-modal">
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <Badge 
                variant={user.role === 'admin' ? 'default' : 'secondary'}
                className={`text-[10px] px-1.5 py-0 h-5 ${
                  user.role === 'admin' 
                    ? 'bg-primary/20 text-primary border-primary/30' 
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}
              >
                {user.role === 'admin' ? (
                  <><Shield className="w-3 h-3 mr-1" />Admin</>
                ) : (
                  <><Eye className="w-3 h-3 mr-1" />Analyst</>
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenuItem asChild>
            <Link 
              href="/user-settings"
              className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-secondary"
            >
              <Settings className="w-4 h-4" />
              User Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={logoutLoading}
            className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-secondary"
          >
            <LogOut className="w-4 h-4" />
            {logoutLoading ? "Logging out..." : "Logout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
} 