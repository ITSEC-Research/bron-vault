"use client";

import UserProfileDropdown from "./user-profile-dropdown";
import { SidebarTrigger } from "@/components/ui/sidebar";
import ErrorBoundary from "./error-boundary";
import ForceRefreshWrapper from "./force-refresh-wrapper";

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-xl transition-all duration-300 relative overflow-hidden">
      {/* Gradient Background - Subtle */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-primary/5 to-background/60 dark:from-primary/10 dark:via-primary/6 dark:to-background/60" />
      
      <div className="relative flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-white/10 mr-4" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title || 'Broń Vault'}</h1>
        </div>
        <div className="flex items-center">
          <ForceRefreshWrapper refreshKey={title}>
            <ErrorBoundary fallback={<div className="text-red-500 text-sm">Profile error</div>}>
              <UserProfileDropdown />
            </ErrorBoundary>
          </ForceRefreshWrapper>
        </div>
      </div>
    </header>
  );
} 