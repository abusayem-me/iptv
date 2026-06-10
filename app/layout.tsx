import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", weight: ["500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "TV Stream",
  description: "Browse and play HLS TV channels",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
