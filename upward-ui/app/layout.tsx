import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Upward — Free Learning Platform",
    template: "%s | Upward",
  },
  description:
    "Upward is a free learning platform. Browse courses and bundles, enroll instantly, track your progress and earn certificates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", inter.variable, "font-sans")}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="text-muted-foreground border-t py-8 text-center text-sm">
            Upward — free learning for everyone. All content is free, enrollment is instant.
          </footer>
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
