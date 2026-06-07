import PageHeader from "../components/PageHeader";

export default function Policies() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Studio Policies"
        title="Before You Book"
        subtitle="Our salon studio standards keep your experience safe, seamless, and luxurious."
      />

      <div className="policy-list">
        <article className="policy-card">
          <h3>Deposits</h3>
          <p>
            A percentage deposit is required to hold your appointment. Your booking reference must
            appear in the transfer memo. Slots are held for 24 hours pending deposit confirmation.
          </p>
        </article>

        <article className="policy-card">
          <h3>Cancellation & Rescheduling</h3>
          <p>
            Please provide at least 48 hours notice to reschedule. Late cancellations or no-shows
            may forfeit the deposit. We understand emergencies — contact us on WhatsApp as soon as
            possible.
          </p>
        </article>

        <article className="policy-card">
          <h3>Late Arrivals</h3>
          <p>
            Arriving more than 15 minutes late may require a shortened service or rescheduling to
            respect the next client&apos;s time.
          </p>
        </article>

        <article className="policy-card">
          <h3>Patch Test</h3>
          <p>
            New clients may require a patch test 24–48 hours before full application if you have
            sensitive eyes or adhesive allergies.
          </p>
        </article>

        <article className="policy-card">
          <h3>Aftercare</h3>
          <ul>
            <li>Avoid water, steam, and sweat for 24 hours</li>
            <li>Do not rub, pick, or use oil-based products near lashes</li>
            <li>Brush gently with a clean spoolie</li>
            <li>Book fills every 2–3 weeks to maintain your set</li>
          </ul>
        </article>

        <article className="policy-card">
          <h3>Photos & Consent</h3>
          <p>
            We may request permission to photograph your lashes for our gallery and social media.
            You may decline at any time.
          </p>
        </article>
      </div>
    </div>
  );
}
