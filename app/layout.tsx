import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ostrava Tram Live",
  description: "Live prototype for Ostrava public transport vehicle positions."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
