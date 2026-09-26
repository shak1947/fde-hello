import type { Metadata } from "next";
import { PasswordForm } from "./form";

export const metadata: Metadata = {
  title: "Sign in · Amazon Ads portal",
  robots: { index: false, follow: false },
};

export default function EnterPage() {
  return (
    <main className="gate">
      <section className="gate-card">
        <p className="eyebrow">Sensationally OT</p>
        <h1>Amazon Ads desk</h1>
        <p className="muted">
          This desk is closed to anyone without the shared password. Spend on the account stays Shakeel
          Amir’s.
        </p>
        <PasswordForm />
      </section>
    </main>
  );
}
