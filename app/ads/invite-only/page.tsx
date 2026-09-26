import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invite only · Sensationally OT Ads",
  robots: { index: false, follow: false },
};

export default function InviteOnlyPage() {
  return (
    <main className="doc">
      <p className="eyebrow">Sensationally OT</p>
      <h1>This desk is invite-only</h1>
      <p className="muted">
        The desk opens only after the shared password. There is no public sign-up. Shakeel Amir can also
        invite the offshore consultant from the Clerk dashboard for the existing fde-hello application.
      </p>
      <h2>Invite a consultant</h2>
      <ol className="muted">
        <li>Open the Clerk dashboard for the fde-hello instance.</li>
        <li>Turn on Restricted mode so only invited people can join (Configure → Restrictions).</li>
        <li>Users → Invite, and send the consultant’s email.</li>
        <li>They open <a href="/ads/enter">/ads/enter</a>, enter the shared password, then sign in with that email if Clerk is enabled.</li>
        <li>Optional: set <code>ADS_PORTAL_ALLOWED_EMAILS</code> to a comma-separated list. With <code>CLERK_SECRET_KEY</code> set, anyone else with a session is rejected.</li>
      </ol>
      <p>
        <a href="/ads">Back to sign-in</a>
      </p>
    </main>
  );
}
