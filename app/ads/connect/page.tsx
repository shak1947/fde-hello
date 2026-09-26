import type { Metadata } from "next";
import { GrantForm } from "./grant-form";

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
        Until the Amazon Ads credentials are set on the Vercel project, the desk says <strong>API not connected</strong> and
        shows labeled sample data. Confirm still exercises the proposal flow. It does not call Amazon and does not spend
        Shakeel Amir’s money.
      </p>
      <h2>Environment names</h2>
      <ul>
        <li><code>AMAZON_ADS_CLIENT_ID</code></li>
        <li><code>AMAZON_ADS_CLIENT_SECRET</code></li>
        <li><code>AMAZON_ADS_REFRESH_TOKEN</code></li>
        <li><code>AMAZON_ADS_PROFILE_ID</code></li>
        <li><code>AMAZON_ADS_REGION</code> — <code>na</code>, <code>eu</code>, or <code>fe</code></li>
        <li><code>ADS_MAX_DAILY_BUDGET</code> and <code>ADS_MAX_BID</code> — required before a live budget or bid write</li>
        <li><code>ADS_OAUTH_SETUP_KEY</code> — owner-only. The shared portal password cannot start the grant.</li>
      </ul>
      <h2>One-time Login with Amazon grant</h2>
      <ol className="muted">
        <li>In the Login with Amazon security profile, allow return URL <code>https://fde-hello.vercel.app/api/ads/oauth/callback</code>. For local setup also allow <code>http://localhost:3000/api/ads/oauth/callback</code>.</li>
        <li>Put the client id, client secret, region, caps, and owner setup key in Vercel. Redeploy. Do not commit the values.</li>
        <li>Sign in at <a href="/ads/enter">/ads</a>, open this page, and enter the owner setup key.</li>
        <li>Amazon sends Shak back to the callback. Copy the refresh token into <code>AMAZON_ADS_REFRESH_TOKEN</code> and the Sensationally OT profile id into <code>AMAZON_ADS_PROFILE_ID</code>. Close the tab. The consultant desk never shows that token.</li>
        <li>Redeploy. The banner changes to Live Ads API. Every write still waits for Confirm.</li>
      </ol>
      <GrantForm />
      <h2>What live mode calls</h2>
      <p className="muted">
        Sponsored Products v3: campaigns, ad groups, keywords, negative keywords, campaign negatives, product targets,
        negative ASIN targets, and product ads. Search terms use the async <code>spSearchTerm</code> report. Sponsored
        Brands and Sponsored Display are a follow-up and are refused. Archive, delete, billing, credentials, and Helium
        10 Manage writes are refused in the API.
      </p>
      <p>
        <a href="/ads">Back to the desk</a>
      </p>
    </main>
  );
}
