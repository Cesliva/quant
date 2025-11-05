import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quant Estimating AI",
  description: "Steel fabrication estimating software with AI integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

