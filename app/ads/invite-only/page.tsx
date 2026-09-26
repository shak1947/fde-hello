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
        The desk opens only after the shared password set in <code>ADS_PORTAL_PASSWORD</code>. There is no
        public sign-up. Share that password with the consultant out of band. Do not put it in git or in this
        page.
      </p>
      <h2>Open the desk</h2>
      <ol className="muted">
        <li>Set <code>ADS_PORTAL_PASSWORD</code> on the Vercel project for Production and Preview, then redeploy.</li>
        <li>The consultant opens <a href="/ads/enter">/ads/enter</a> and enters that password.</li>
        <li>A match sets an httpOnly session cookie and opens <a href="/ads">/ads</a>. A wrong password is rejected.</li>
      </ol>
      <p>
        <a href="/ads/enter">Back to sign-in</a>
      </p>
    </main>
  );
}
