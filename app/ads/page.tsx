import { clerkBrowserScript, publishableKey } from "@/lib/ads/auth";
import { AdsPortal } from "./ui/portal";

export const dynamic = "force-dynamic";

export default function AdsPage() {
  const key = publishableKey();
  return <AdsPortal publishableKey={key} scriptSrc={clerkBrowserScript(key)} />;
}
