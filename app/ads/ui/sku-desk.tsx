"use client";

export type KitCampaignRow = {
  campaignId: string;
  name: string;
  state: string;
  dailyBudget: number;
  spend: number | null;
  sales: number | null;
  acos: number | null;
  simulated: boolean;
};

export type KitCard = {
  kitId: string | null;
  name: string;
  sku: string;
  asin: string;
  campaigns: KitCampaignRow[];
  enabled: number;
  paused: number;
  dailyBudget: number;
  spend: number | null;
  sales: number | null;
  acos: number | null;
};

export function SkuDesk({ kits, sampleData }: { kits: KitCard[]; sampleData: boolean }) {
  return (
    <section className="panel">
      <h2>Kits</h2>
      <p className="muted">
        Sensationally OT is a two-kit catalog. Campaigns sit under Mermaid dough or Farm dough. This desk is the
        record for Shak and the PPC manager. Amazon’s Ads console is not where this account is managed.
        {sampleData ? " Sample figures are not live." : ""}
      </p>
      <div className="kits">
        {kits.map((kit) => (
          <article className={kit.kitId ? "kit" : "kit loose"} key={kit.kitId ?? "loose"}>
            <h3>{kit.name}</h3>
            {kit.kitId ? (
              <p className="muted">
                SKU {kit.sku} · ASIN {kit.asin}
              </p>
            ) : (
              <p className="question">Name the kit before treating this spend as the plan.</p>
            )}
            <p>
              {kit.enabled} on · {kit.paused} paused · ${kit.dailyBudget.toFixed(2)}/day
              {kit.spend == null ? "" : ` · spend $${kit.spend.toFixed(2)}`}
              {kit.sales == null ? "" : ` · sales $${kit.sales.toFixed(2)}`}
              {kit.acos == null ? "" : ` · ACoS ${kit.acos}%`}
            </p>
            {kit.campaigns.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>State</th>
                    <th>Budget</th>
                    <th>Spend</th>
                    <th>Sales</th>
                    <th>ACoS</th>
                  </tr>
                </thead>
                <tbody>
                  {kit.campaigns.map((campaign) => (
                    <tr key={campaign.campaignId}>
                      <td>
                        {campaign.name}
                        {campaign.simulated ? <span className="tag">Sample</span> : null}
                      </td>
                      <td>{campaign.state}</td>
                      <td>${campaign.dailyBudget.toFixed(2)}</td>
                      <td>{money(campaign.spend)}</td>
                      <td>{money(campaign.sales)}</td>
                      <td>{campaign.acos == null ? "—" : `${campaign.acos}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No campaigns on this kit yet.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function money(value: number | null): string {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}
