"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthFeature } from "../hooks/useAuthFeature";
import { loginSchema, type LoginSchema } from "../schemas/auth.schema";

export function AuthLoginForm() {
    const { loading, login } = useAuthFeature();
    const form = useForm<LoginSchema>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    });

    return (
        <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
                await login(values);
            })}
        >
            <div className="space-y-1">
                <Label>Email</Label>
                <Input {...form.register("email")} type="email" placeholder="admin@pos.com" />
            </div>
            <div className="space-y-1">
                <Label>Password</Label>
                <Input {...form.register("password")} type="password" placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Memproses..." : "Masuk"}
            </Button>
        </form>
    );
}
