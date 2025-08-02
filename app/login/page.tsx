"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [checkingUsers, setCheckingUsers] = useState(true);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Check if any users exist on component mount
  useEffect(() => {
    checkUserCount();
  }, []);

  const checkUserCount = async () => {
    try {
      const response = await fetch("/api/auth/check-users");
      const data = await response.json();

      if (data.success) {
        setIsRegisterMode(data.needsInitialSetup);
      }
    } catch (error) {
      console.error("Failed to check user count:", error);
      // Default to login mode on error
      setIsRegisterMode(false);
    } finally {
      setCheckingUsers(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register-first-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: "Registration Success! 🎉",
          description: `Welcome, ${data.user?.name}! You can now login with your credentials.`,
          variant: "default",
        });

        // Switch to login mode after successful registration
        setIsRegisterMode(false);
        setName(""); // Clear name field
        setPassword(""); // Clear password for security
      } else {
        toast({
          title: "Registration Failed",
          description: data.error || "Registration failed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Network Error",
        description: "A network error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // important for httpOnly cookie to be set
      });
      const data = await res.json();
      if (data.success) {
        console.log("Login successful, showing toast...");

        // Show success toast
        toast({
          title: "Login Success! 🎉",
          description: `Welcome, ${data.user?.name || data.user?.email || 'User'}!`,
          variant: "default",
        });

        console.log("Toast triggered, waiting before redirect...");

        // Redirect to dashboard or redirect param
        const redirect = searchParams.get("redirect") || "/dashboard";

        // Force a longer delay to ensure toast is shown before redirect
        setTimeout(() => {
          console.log("Redirecting to:", redirect);
          window.location.replace(redirect);
        }, 3000); // Increased delay to see toast
      } else {
        // Show error toast instead of setting error state
        toast({
          title: "Login Failed",
          description: data.error || "Login failed. Please check your credentials.",
          variant: "destructive",
        });
      }
    } catch (err) {
      // Show network error toast
      toast({
        title: "Network Error",
        description: "A network error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking user count
  if (checkingUsers) {
    return (
      <div className="flex flex-col min-h-screen bg-bron-bg-primary">
        <header className="border-b border-bron-border bg-bron-bg-secondary">
          <div className="flex h-16 items-center px-4">
            <div className="ml-4">
              <h1 className="text-xl font-semibold text-bron-text-primary">broń Vault</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center bg-bron-bg-primary">
          <Card className="w-full max-w-md bg-bron-bg-tertiary border-bron-border shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bron-accent-blue mx-auto mb-4"></div>
                <p className="text-bron-text-secondary">Checking system status...</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-bron-bg-primary">
      <header className="border-b border-bron-border bg-bron-bg-secondary">
        <div className="flex h-16 items-center px-4">
          <div className="ml-4">
            <h1 className="text-xl font-semibold text-bron-text-primary">
              broń Vault - {isRegisterMode ? "Initial Setup" : "Login"}
            </h1>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center bg-bron-bg-primary">
        <Card className="w-full max-w-md bg-bron-bg-tertiary border-bron-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-bron-text-primary text-2xl text-center">
              {isRegisterMode ? "Create First User" : "Login"}
            </CardTitle>
            {isRegisterMode && (
              <p className="text-bron-text-secondary text-sm text-center mt-2">
                No users found. Please create the first administrator account.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-6">
              {isRegisterMode && (
                <div>
                  <label className="block text-bron-text-primary mb-1" htmlFor="name">Full Name</label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="bg-bron-bg-secondary border-bron-border text-bron-text-primary"
                    placeholder="Administrator"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-bron-text-primary mb-1" htmlFor="email">Email</label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-bron-bg-secondary border-bron-border text-bron-text-primary"
                  placeholder="admin@bronvault.local"
                  required
                />
              </div>
              <div>
                <label className="block text-bron-text-primary mb-1" htmlFor="password">
                  Password {isRegisterMode && <span className="text-xs text-bron-text-secondary">(min. 6 characters)</span>}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-bron-bg-secondary border-bron-border text-bron-text-primary"
                  placeholder="Password"
                  minLength={isRegisterMode ? 6 : undefined}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-bron-accent-red hover:bg-bron-accent-red-hover text-white"
                disabled={loading}
              >
                {loading ? (isRegisterMode ? "Creating Account..." : "Logging in...") : (isRegisterMode ? "Create Account" : "Login")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 