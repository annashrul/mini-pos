"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyEmailOtp, resendVerificationEmail } from "@/server/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Mail, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState(searchParams.get("otp") || "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    setResendSuccess(false);

    const result = await verifyEmailOtp(email, otp);
    if (result.error || !result.loginToken) {
      setStatus("error");
      setErrorMessage(result.error || "Verifikasi gagal.");
      return;
    }

    const loginResult = await signIn("verification-otp-login", {
      token: result.loginToken,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    if (loginResult?.error) {
      setStatus("error");
      setErrorMessage("OTP valid, tetapi auto login gagal. Silakan login manual.");
      return;
    }
    setStatus("success");
    router.replace(loginResult?.url || "/dashboard");
    router.refresh();
  };

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendSuccess(false);
    setErrorMessage("");
    const result = await resendVerificationEmail(email);
    setResending(false);
    if (result.error) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }
    setResendSuccess(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        {status === "loading" && (
          <div className="space-y-4 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Memverifikasi OTP...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Verifikasi Berhasil!</h1>
            <p className="text-sm text-muted-foreground">
              Akun Anda sudah aktif. Mengarahkan ke dashboard...
            </p>
          </div>
        )}

        {status !== "success" && status !== "loading" && (
          <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-center">Verifikasi OTP</h1>
            <p className="text-sm text-muted-foreground text-center">
              Masukkan OTP 6 digit yang kami kirim ke email Anda.
            </p>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="otp">Kode OTP</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  required
                />
              </div>
              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 flex items-start gap-2">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {resendSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  OTP baru berhasil dikirim.
                </div>
              )}
              <Button className="w-full rounded-xl" type="submit">
                Verifikasi & Login
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={handleResend}
              disabled={resending || !email}
            >
              {resending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Kirim Ulang OTP
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-xl">
              <Link href="/login">Kembali ke Login</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
