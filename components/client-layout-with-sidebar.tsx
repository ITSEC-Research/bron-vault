"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import AppHeader from "@/components/app-header";

export default function ClientLayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine page title based on pathname
  let title = "broń Vault";
  if (pathname === "/dashboard") title = "broń Vault - Dashboard";
  else if (pathname === "/") title = "broń Vault - Search";
  else if (pathname === "/upload") title = "broń Vault - Upload";
  else if (pathname === "/debug-zip") title = "broń Vault - Debug ZIP";

  // Don't render sidebar/header if on login page
  if (pathname === "/login") {
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