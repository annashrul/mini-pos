"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Zap, Loader2, Mail, RefreshCw } from "lucide-react";
import { registerCompany, resendVerificationEmail } from "@/server/actions/register";

export default function RegisterPage() {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState("");
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const confirmPassword = formData.get("confirmPassword") as string;
        const password = formData.get("password") as string;

        if (password !== confirmPassword) {
            setError("Password dan konfirmasi password tidak cocok");
            setLoading(false);
            return;
        }

        const result = await registerCompany(formData);

        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else if ("needsVerification" in result && result.needsVerification) {
            setVerificationEmail(result.email || "");
            setLoading(false);
        } else {
            router.push("/login?registered=true");
        }
    };

    const handleResend = async () => {
        if (!verificationEmail || resending) return;
        setResending(true);
        setResendSuccess(false);
        const result = await resendVerificationEmail(verificationEmail);
        setResending(false);
        if (result.success) setResendSuccess(true);
        else if (result.error) setError(result.error);
    };

    if (verificationEmail) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                <Card className="w-full max-w-sm shadow-xl rounded-2xl text-center">
                    <CardContent className="pt-8 pb-6 px-6 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                            <Mail className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold">Cek Email Anda</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Kami telah mengirim OTP verifikasi ke <strong className="text-foreground">{verificationEmail}</strong>.
                            Cek inbox (atau folder spam), lalu masukkan OTP di halaman verifikasi.
                        </p>
                        {resendSuccess && (
                            <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg py-2 px-3">Email verifikasi berhasil dikirim ulang!</p>
                        )}
                        <div className="space-y-2 pt-2">
                            <Button variant="outline" className="w-full rounded-xl text-sm" onClick={handleResend} disabled={resending}>
                                {resending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Kirim Ulang Email
                            </Button>
                            <Button asChild variant="ghost" className="w-full rounded-xl text-sm">
                                <Link href={`/verify-email?email=${encodeURIComponent(verificationEmail)}`}>
                                    Masukkan OTP
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <Card className="w-full max-w-lg shadow-xl rounded-2xl">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-primary/25">
                        <Zap className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        Daftar NusaPOS
                    </CardTitle>
                    <CardDescription>
                        Buat akun perusahaan baru untuk mulai menggunakan NusaPOS
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
                                {error}
                            </div>
                        )}

                        {/* Company Section */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Data Perusahaan
                            </h3>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Nama Perusahaan *</Label>
                                <Input
                                    id="companyName"
                                    name="companyName"
                                    placeholder="PT Contoh Sejahtera"
                                    required
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="companyPhone">Telepon</Label>
                                    <Input
                                        id="companyPhone"
                                        name="companyPhone"
                                        placeholder="021-12345678"
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyAddress">Alamat</Label>
                                    <Input
                                        id="companyAddress"
                                        name="companyAddress"
                                        placeholder="Jakarta"
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border/60" />

                        {/* User Section */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Akun Admin
                            </h3>
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Lengkap *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="John Doe"
                                    required
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="admin@perusahaan.com"
                                    required
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password *</Label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="Min. 6 karakter"
                                        required
                                        minLength={6}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Konfirmasi Password *</Label>
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        placeholder="Ulangi password"
                                        required
                                        minLength={6}
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full rounded-xl h-11"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Membuat akun...
                                </>
                            ) : (
                                "Daftar Sekarang"
                            )}
                        </Button>

                        <div className="text-center text-sm text-muted-foreground">
                            Sudah punya akun?{" "}
                            <Link
                                href="/login"
                                className="text-primary font-medium hover:underline"
                            >
                                Masuk di sini
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
