"use client";

import { useEffect, useState } from "react";

interface ForceRefreshWrapperProps {
  children: React.ReactNode;
  refreshKey?: string;
}

export default function ForceRefreshWrapper({ children, refreshKey }: ForceRefreshWrapperProps) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    // Force refresh on mount and when refreshKey changes
    setKey(prev => prev + 1);
  }, [refreshKey]);

  useEffect(() => {
    // Force refresh on hot reload in development
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const handleBeforeUnload = () => {
        setKey(prev => prev + 1);
      };

      // Add passive listener for better performance
      window.addEventListener('beforeunload', handleBeforeUnload, { passive: true });

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, []);

  return <div key={key}>{children}</div>;
}
