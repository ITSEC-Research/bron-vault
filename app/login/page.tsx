"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, User, ArrowRight, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [checkingUsers, setCheckingUsers] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSchema, setCheckingSchema] = useState(true);
  
  // 2FA states
  const [requires2FA, setRequires2FA] = useState(false);
  const [pending2FAToken, setPending2FAToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Check database schema on component mount
  useEffect(() => {
    checkDatabaseSchema();
  }, []);

  const checkDatabaseSchema = async () => {
    try {
      const response = await fetch("/api/db-sync");
      const data = await response.json();

      if (data.success && !data.isValid) {
        // Schema mismatch - redirect to db-sync page
        router.push("/db-sync");
        return;
      }
      
      // Schema is valid, proceed to check users
      setCheckingSchema(false);
      checkUserCount();
    } catch (error) {
      console.error("Failed to check database schema:", error);
      // On error, still proceed to login (maybe fresh install)
      setCheckingSchema(false);
      checkUserCount();
    }
  };

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
    } catch (_err) {
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
        // Check if 2FA is required
        if (data.requires2FA) {
          setPending2FAToken(data.pending2FAToken);
          setRequires2FA(true);
          setLoading(false);
          return;
        }
        
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
    } catch (_err) {
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

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FAToken || !totpCode) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          pending2FAToken: pending2FAToken, 
          code: totpCode,
          isBackupCode: useBackupCode 
        }),
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Login Success! 🎉",
          description: `Welcome, ${data.user?.name || data.user?.email || 'User'}!`,
          variant: "default",
        });
        
        const redirect = searchParams.get("redirect") || "/dashboard";
        setTimeout(() => {
          window.location.replace(redirect);
        }, 2000);
      } else {
        toast({
          title: "Verification Failed",
          description: data.error || "Invalid code. Please try again.",
          variant: "destructive",
        });
      }
    } catch (_err) {
      toast({
        title: "Network Error",
        description: "A network error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setPending2FAToken(null);
    setTotpCode("");
    setUseBackupCode(false);
  };

  // Show loading while checking schema and user count
  if (checkingSchema || checkingUsers) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-red-500/20 via-orange-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-blue-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Glass Card */}
        <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 animate-spin-slow rounded-full bg-gradient-to-r from-red-500/50 via-orange-500/50 to-red-500/50 blur-lg" />
              <div className="relative p-4 rounded-full bg-[#0a0a0a] border border-white/10">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              </div>
            </div>
            <p className="text-white/60 font-medium">
              {checkingSchema ? "Checking database schema..." : "Checking system status..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show 2FA verification form
  if (requires2FA) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-red-500/20 via-orange-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-red-500/15 via-orange-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 w-full max-w-md mx-4">
          {/* Card Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 rounded-3xl blur-xl opacity-75" />
          
          {/* Glass Card */}
          <div className="relative bg-[#0f0f0f]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-400" />
            
            <div className="p-8 sm:p-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="mx-auto mb-4">
                  <img src="/images/logo.png" alt="Broń Vault Logo" className="h-16 w-auto mx-auto drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Two-Factor Authentication</h2>
                <p className="text-white/50 text-sm">
                  {useBackupCode 
                    ? "Enter one of your backup codes" 
                    : "Enter the 6-digit code from your authenticator app"}
                </p>
              </div>

              <form onSubmit={handle2FAVerify} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-red-500/70" />
                    {useBackupCode ? "Backup Code" : "Verification Code"}
                  </label>
                  <Input
                    type="text"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\s/g, ''))}
                    className="w-full h-12 px-4 bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em] placeholder:text-white/30 placeholder:tracking-normal placeholder:text-base rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all font-mono"
                    placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
                    maxLength={useBackupCode ? 9 : 6}
                    autoFocus
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-red-400 hover:to-orange-400 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setUseBackupCode(!useBackupCode)}
                    className="text-white/50 hover:text-white/70 text-sm transition-colors"
                  >
                    {useBackupCode ? "Use authenticator app instead" : "Use a backup code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-white/50 hover:text-white/70 text-sm transition-colors"
                  >
                    ← Back to login
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-[#0a0a0a] relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Main Gradient Orbs - All Red Tones */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-gradient-to-br from-red-500/25 via-red-600/15 to-transparent rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-red-600/20 via-red-500/10 to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-r from-red-500/15 to-red-700/10 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '0.5s' }} />

        {/* Grid Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Floating Particles - All Red Tones */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500/40 rounded-full animate-float" />
        <div className="absolute top-3/4 left-1/3 w-1.5 h-1.5 bg-red-400/40 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/4 w-2.5 h-2.5 bg-red-600/40 rounded-full animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 right-1/3 w-1 h-1 bg-red-500/40 rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-center relative p-12">
        {/* Logo and Branding - slight upward offset for visual centering */}
        <div className="relative z-10 max-w-md text-center -mt-12">
          {/* Animated Logo Container */}
          <div className="relative mx-auto mb-8 w-40 h-40 flex items-center justify-center">
            {/* Outer Ring - Slow Rotation */}
            <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-spin-slow" />
            {/* Middle Ring - Medium Rotation */}
            <div className="absolute inset-4 rounded-full border border-orange-500/30 animate-spin-reverse" />
            {/* Inner Glow */}
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-red-500/30 via-orange-500/15 to-transparent blur-2xl" />
            {/* Logo */}
            <div className="relative z-10">
              <div className="absolute -inset-4 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
              <img
                src="/images/logo.png"
                alt="broń Vault Logo"
                className="relative w-24 h-auto drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]"
              />
            </div>
          </div>

          {/* Brand Name */}
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">Broń</span>
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-red-400 bg-clip-text text-transparent"> Vault</span>
          </h1>

          {/* Tagline */}
          <p className="text-white/40 text-lg font-light tracking-wide mb-8">
            Where Stolen Data Meets Structured Investigation
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {['Stealer Log Parser', 'Asset Discovery', 'Unified View'].map((feature, index) => (
              <div
                key={feature}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Decorative Lines */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        {/* Mobile Logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <div className="relative">
              <div className="absolute -inset-2 bg-red-500/20 rounded-full blur-xl animate-pulse" />
              <img
                src="/images/logo.png"
                alt="broń Vault Logo"
                className="relative w-16 h-auto drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              />
            </div>
            <h1 className="text-3xl font-bold">
              <span className="text-white">Broń</span>
              <span className="text-red-500"> Vault</span>
            </h1>
          </div>
          <p className="text-white/40 text-sm">Where Stolen Data Meets Structured Investigation</p>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md relative">
          {/* Card Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 rounded-3xl blur-xl opacity-75" />

          {/* Glass Card */}
          <div className="relative bg-[#0f0f0f]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Card Header Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-400" />

            <div className="p-8 sm:p-10">
              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  {isRegisterMode ? "Create Admin Account" : "Welcome Back"}
                </h2>
                <p className="text-white/50 text-sm">
                  {isRegisterMode
                    ? "Set up the first administrator account to get started"
                    : "Access your investigation workspace"}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-5">
                {/* Name Field (Register Mode) */}
                {isRegisterMode && (
                  <div className="space-y-2">
                    <label className="text-white/70 text-sm font-medium flex items-center gap-2" htmlFor="name">
                      <User className="w-4 h-4 text-red-500/70" />
                      Full Name
                    </label>
                    <div className="relative group">
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full h-12 px-4 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
                      placeholder="Administrator"
                      required
                    />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2" htmlFor="email">
                    <Mail className="w-4 h-4 text-red-500/70" />
                    Email Address
                  </label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full h-12 px-4 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
                      placeholder="admin@bronvault.local"
                      required
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2" htmlFor="password">
                    <Lock className="w-4 h-4 text-red-500/70" />
                    Password
                    {isRegisterMode && <span className="text-white/30 text-xs ml-auto">(min. 6 characters)</span>}
                  </label>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full h-12 px-4 pr-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all selection:bg-red-500/50 selection:text-white"
                      placeholder="••••••••"
                      minLength={isRegisterMode ? 6 : undefined}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 mt-2 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-red-400 hover:to-orange-400 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 group relative overflow-hidden"
                  disabled={loading}
                >
                  {/* Button Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {isRegisterMode ? "Creating Account..." : "Signing in..."}
                      </>
                    ) : (
                      <>
                        {isRegisterMode ? "Create Account" : "Sign In"}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </Button>
              </form>

              {/* Footer */}
              {!isRegisterMode && (
                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                  <p className="text-white/30 text-xs">
                    Parse. Discover. Investigate.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Attribution */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-white/30 text-xs">
            © 2025 Broń Vault. Licensed under the Apache License, Version 2.0.
          </p>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 15s linear infinite;
        }
        /* Selection highlight for better UX */
        input::selection {
          background-color: rgba(239, 68, 68, 0.5) !important;
          color: white !important;
        }
        input::-moz-selection {
          background-color: rgba(239, 68, 68, 0.5) !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
} 