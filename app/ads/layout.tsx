import type { Metadata } from "next";
import "./portal.css";

export const metadata: Metadata = {
  title: "Amazon Ads portal · Sensationally OT",
  description: "Invite-only Amazon Advertising desk for Sensationally OT. Spend belongs to Shakeel Amir.",
  robots: { index: false, follow: false },
};

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
