import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect Amazon Ads API · Sensationally OT",
  robots: { index: false, follow: false },
};

export default function ConnectPage() {
  return (
    <main className="doc">
      <p className="eyebrow">Sensationally OT</p>
      <h1>Connect the Amazon Ads API</h1>
      <p className="muted">
        Until these variables are set on the Vercel project, the portal runs in simulated mode. Campaigns
        you see are sample Sensationally OT data. Confirmations update that simulator and the audit log.
        They do not spend Shakeel Amir’s money.
      </p>
      <h2>Required for live writes</h2>
      <ul>
        <li><code>AMAZON_ADS_CLIENT_ID</code> — Login with Amazon client id</li>
        <li><code>AMAZON_ADS_CLIENT_SECRET</code></li>
        <li><code>AMAZON_ADS_REFRESH_TOKEN</code> — refresh token for Shak’s ads account</li>
        <li><code>AMAZON_ADS_PROFILE_ID</code> — advertising profile id (the API scope)</li>
      </ul>
      <h2>Optional</h2>
      <ul>
        <li><code>AMAZON_ADS_REGION</code> — <code>NA</code> (default), <code>EU</code>, or <code>FE</code></li>
        <li><code>AMAZON_ADS_API_BASE</code> — override the regional advertising host</li>
        <li><code>AMAZON_ADS_TOKEN_URL</code> — default <code>https://api.amazon.com/auth/o2/token</code></li>
      </ul>
      <h2>What live mode calls</h2>
      <p className="muted">
        Sponsored Products v3 only: list and create/update campaigns, ad groups, and keywords. The client
        refuses every other path, including deletes. New campaigns can start paused. Budget and on/off
        changes still wait for Confirm in the portal. Performance totals in the table stay blank in live
        mode because Amazon’s reporting API is a separate async job; the result panel shows the mutation
        Amazon accepted.
      </p>
      <p>
        <a href="/ads">Back to the desk</a>
      </p>
    </main>
  );
}
