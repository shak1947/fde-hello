import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sensationally OT",
  description: "Sensationally OT sites, including the invite-only Amazon Ads portal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
