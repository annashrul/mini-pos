import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";
import { FetchProgressProvider } from "@/components/providers/fetch-progress-provider";
import { BranchProvider } from "@/components/providers/branch-provider";
import { ServiceWorkerRegister } from "@/components/providers/sw-register";

const fontSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    variable: "--font-sans",
    weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
    title: "NusaPOS — Point of Sale",
    description: "Enterprise Point of Sale System for Retail & Wholesale",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="id">
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#2BBECB" />
            </head>
            <body className={`${fontSans.variable} font-sans antialiased`}>
                <SessionProvider>
                    <ServiceWorkerRegister />
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
