import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";
import { FetchProgressProvider } from "@/components/providers/fetch-progress-provider";
import { BranchProvider } from "@/components/providers/branch-provider";

const fontSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    variable: "--font-sans",
    weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
    title: "POS System - Point of Sale",
    description: "Modern Point of Sale System",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="id">
            <body className={`${fontSans.variable} font-sans antialiased`}>
                <SessionProvider>
                    <BranchProvider>
                    <NextTopLoader />
                    <FetchProgressProvider />
                    {children}
                    <Toaster richColors position="top-right" />
                    </BranchProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
