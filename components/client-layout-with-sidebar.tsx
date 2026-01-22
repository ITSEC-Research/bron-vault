"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import AppHeader from "@/components/app-header";

export default function ClientLayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  // Determine page title based on pathname
  let title = "Broń Vault";
  if (pathname === "/dashboard") title = "Broń Vault - Dashboard";
  else if (pathname === "/") title = "Broń Vault - Search";
  else if (pathname === "/upload") title = "Broń Vault - Upload";
  else if (pathname === "/debug-zip") title = "Broń Vault - Debug ZIP";

  // Don't render sidebar/header if on login or db-sync page
  if (pathname === "/login" || pathname === "/db-sync") {
    return (
      <main className="flex-1 bg-background">{children}</main>
    );
  }

  return (
    <>
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <AppHeader title={title} />
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </>
  );
} 