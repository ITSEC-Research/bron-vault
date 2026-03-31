"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setLoading(false);
    window.location.href = "/login";
  };

  return (
    <Button onClick={handleLogout} disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white">
      {loading ? "Logging out..." : "Logout"}
    </Button>
  );
} 