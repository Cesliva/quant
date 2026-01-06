import type { Metadata } from "next";
import "./globals.css";
import DemoModeBanner from "@/components/layout/DemoModeBanner";

export const metadata: Metadata = {
  title: "Quant Estimating AI",
  description: "Steel fabrication estimating software with AI integration",
  icons: {
    icon: "/graphics/logos/favicon-32x32.png",
    shortcut: "/graphics/logos/favicon-32x32.png",
    apple: "/graphics/logos/favicon-32x32.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DemoModeBanner />
        {children}
      </body>
    </html>
  );
}

