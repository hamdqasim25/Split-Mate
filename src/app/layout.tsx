import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/app-header";
import { initializeTheme } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPLITMate | Shared Expenses Made Simple",
  description:
    "Track shared group expenses, manage balances, and confirm repayments with SPLITMate. Only the group owner needs an account.",
};

/** Inline the self-contained theme bootstrap before paint to avoid a theme flash.
 * It sets root attributes before hydration, so that deliberate mismatch is suppressed.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: `(${initializeTheme.toString()})();` }} /></head>
      <body className="min-h-full flex flex-col">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
