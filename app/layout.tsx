import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bloodline Book",
  description:
    "Bloodline Book — portraits, prints, and visual storytelling.",
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
