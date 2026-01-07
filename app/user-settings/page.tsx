"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Lock, 
  Shield, 
  Key, 
  Copy, 
  Check, 
  Loader2, 
  AlertTriangle,
  Eye,
  EyeOff,
  QrCode,
  Save,
  Download,
  ClipboardList
} from "lucide-react";

export default function UserSettingsPage() {
  const { loading: authLoading } = useAuth(true);

  if (authLoading) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 bg-transparent">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <User className="h-8 w-8" />
            User Settings
          </h1>
          <p className="text-muted-foreground mt-2">Manage your account security settings</p>
        </div>

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="items-center justify-center rounded-md p-1 text-muted-foreground grid w-full grid-cols-2 glass-card h-8">
            <TabsTrigger
              value="password"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Lock className="h-3 w-3 mr-1" />
              Password
            </TabsTrigger>
            <TabsTrigger
              value="2fa"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Shield className="h-3 w-3 mr-1" />
              Two-Factor Auth
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-4">
            <PasswordTab />
          </TabsContent>

          <TabsContent value="2fa" className="mt-4">
            <TwoFactorTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function PasswordTab() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Password changed successfully",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to change password",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground text-lg">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your account password. Choose a strong password with at least 6 characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="glass-input pr-10"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input pr-10"
                placeholder="Enter new password"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input"
              placeholder="Confirm new password"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Password
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFactorTab() {
  const { toast } = useToast();
  
  const [totpStatus, setTotpStatus] = useState<{ totpEnabled: boolean; hasSecret: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchTOTPStatus();
  }, []);

  const fetchTOTPStatus = async () => {
    try {
      const res = await fetch("/api/auth/setup-totp", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setTotpStatus(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch TOTP status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupTOTP = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup-totp", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setSetupData(data.data);
        toast({
          title: "2FA Setup Started",
          description: "Scan the QR code with your authenticator app",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to setup 2FA",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableTOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verifyCode || verifyCode.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/enable-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Two-factor authentication enabled!",
        });
        setSetupData(null);
        setVerifyCode("");
        await fetchTOTPStatus();
      } else {
        toast({
          title: "Error",
          description: data.error || "Invalid code",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisableTOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disablePassword) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/disable-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Two-factor authentication disabled",
        });
        setDisablePassword("");
        await fetchTOTPStatus();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to disable 2FA",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground text-lg">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account using an authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !setupData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : totpStatus?.totpEnabled ? (
          /* 2FA is enabled */
          <div className="space-y-4">
            <Alert className="bg-green-500/10 border-green-500/20">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                Two-factor authentication is enabled
              </AlertDescription>
            </Alert>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium text-foreground text-sm">Disable 2FA</h4>
              <p className="text-sm text-muted-foreground">
                Enter your password to disable two-factor authentication
              </p>
            </div>

            <form onSubmit={handleDisableTOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disable-password">Password</Label>
                <div className="relative">
                  <Input
                    id="disable-password"
                    type={showDisablePassword ? "text" : "password"}
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="glass-input pr-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowDisablePassword(!showDisablePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showDisablePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="destructive" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Disabling...
                    </>
                  ) : (
                    "Disable 2FA"
                  )}
                </Button>
              </div>
            </form>
          </div>
        ) : setupData ? (
          /* Setting up 2FA */
          <div className="space-y-6">
            <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-500">
                Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </AlertDescription>
            </Alert>

            {/* QR Code */}
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-xl">
                <img src={setupData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Can&apos;t scan? Enter this code manually:</p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="px-3 py-1 bg-muted rounded text-sm font-mono">
                    {setupData.secret}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(setupData.secret)}
                  >
                    {copiedCode === setupData.secret ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Backup Codes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground flex items-center gap-2 text-sm">
                  <Key className="h-4 w-4" />
                  Backup Codes
                </h4>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allCodes = setupData.backupCodes.map(code => `${code.slice(0, 4)}-${code.slice(4)}`).join('\n');
                      navigator.clipboard.writeText(allCodes);
                      setCopiedCode('all');
                      setTimeout(() => setCopiedCode(null), 2000);
                      toast({
                        title: "Copied!",
                        description: "All backup codes copied to clipboard",
                      });
                    }}
                    className="h-8"
                  >
                    {copiedCode === 'all' ? (
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <ClipboardList className="h-3 w-3 mr-1" />
                    )}
                    Copy All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allCodes = setupData.backupCodes.map(code => `${code.slice(0, 4)}-${code.slice(4)}`).join('\n');
                      const content = `BronVault 2FA Backup Codes\n${'='.repeat(30)}\n\nKeep these codes safe. Each code can only be used once.\n\n${allCodes}\n\nGenerated: ${new Date().toISOString()}`;
                      const blob = new Blob([content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'bronvault-backup-codes.txt';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast({
                        title: "Downloaded!",
                        description: "Backup codes saved to file",
                      });
                    }}
                    className="h-8"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Save these codes in a safe place. You can use them to login if you lose access to your authenticator.
              </p>
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg">
                {setupData.backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-2 py-1 bg-background rounded"
                  >
                    <code className="text-sm font-mono">{code.slice(0, 4)}-{code.slice(4)}</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(code)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedCode === code ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Verify and Enable */}
            <form onSubmit={handleEnableTOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-code">Enter code from authenticator</Label>
                <Input
                  id="verify-code"
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="glass-input text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSetupData(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    "Enable 2FA"
                  )}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* 2FA not enabled */
          <div className="space-y-4">
            <Alert className="bg-muted/50 border-muted">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Two-factor authentication is not enabled. We recommend enabling it for better security.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={handleSetupTOTP} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Setup 2FA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
