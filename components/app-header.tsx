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
    <header className="border-b border-bron-border bg-bron-bg-secondary">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <SidebarTrigger className="text-bron-text-primary hover:bg-bron-bg-tertiary mr-4" />
          <h1 className="text-xl font-semibold text-bron-text-primary">{title || 'broń Vault'}</h1>
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