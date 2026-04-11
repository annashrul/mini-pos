"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Loader2, Mail, RefreshCw } from "lucide-react";
import { validateLogin } from "@/server/actions/auth";
import { resendVerificationEmail } from "@/server/actions/register";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";
  const justVerified = searchParams.get("verified") === "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setLoading(true);

    // Pre-validate to get specific error messages
    const check = await validateLogin(email, password);
    if (check.error) {
      if (check.error === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      } else {
        setError(check.error);
      }
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (result?.error) {
      setError("Email atau password salah");
      setLoading(false);
    } else {
      router.replace(result?.url || "/dashboard");
      router.refresh();
    }
  };

  const handleResendVerification = async () => {
    if (resending) return;
    setResending(true);
    setResendSuccess(false);
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.success) setResendSuccess(true);
    else if (result.error) setError(result.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-primary/25">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">NusaPOS</CardTitle>
          <CardDescription>Masuk ke akun Anda untuk melanjutkan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {justVerified && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-xl border border-green-200">
                Email berhasil diverifikasi! Silakan masuk dengan akun Anda.
              </div>
            )}
            {justRegistered && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-xl border border-green-200">
                Pendaftaran berhasil! Silakan masuk dengan akun Anda.
              </div>
            )}
            {needsVerification && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
                <div className="flex items-start gap-2">
                  <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Email belum diverifikasi</p>
                    <p className="text-xs text-amber-600 mt-0.5">Silakan cek inbox email Anda, lalu masukkan OTP verifikasi untuk mengaktifkan akun.</p>
                  </div>
                </div>
                {resendSuccess && (
                  <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg py-1.5 px-2">Email verifikasi berhasil dikirim ulang!</p>
                )}
                <Button type="button" variant="outline" size="sm" className="w-full rounded-lg text-xs border-amber-300 text-amber-700 hover:bg-amber-100" onClick={handleResendVerification} disabled={resending}>
                  {resending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                  Kirim Ulang Email Verifikasi
                </Button>
                <Button asChild type="button" variant="ghost" size="sm" className="w-full rounded-lg text-xs text-amber-800">
                  <Link href={`/verify-email?email=${encodeURIComponent(email)}`}>Masukkan OTP</Link>
                </Button>
              </div>
            )}
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@pos.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full rounded-xl h-11" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground mt-4">
              Belum punya akun?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Daftar di sini
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
