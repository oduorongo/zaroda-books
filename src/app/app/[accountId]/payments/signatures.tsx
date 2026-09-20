/**
 * The signature block at the foot of a payment voucher.
 *
 * Two hands sign it. The school certifies that the goods or services were
 * received and that the charge is a proper one; the payee acknowledges that
 * the money reached them. An auditor querying a payment asks for the payee's
 * signature, so a voucher printed without a line for it has to be reprinted.
 *
 * One component, used by the single voucher and by the year's voucher book,
 * so the two cannot drift apart.
 */
export function VoucherSignatures() {
  const line: React.CSSProperties = {
    borderBottom: "1px solid var(--rule-strong)",
    height: "1.6rem",
    marginBottom: ".3rem",
  };

  return (
    <div style={{ marginTop: "1.75rem" }}>
      <p className="note" style={{ margin: "0 0 1.25rem", lineHeight: 1.6 }}>
        Certified that the goods or services were received and that the expenditure is a proper
        charge against the votes shown.
      </p>

      <div className="voucher-signatures">
        <div>
          <div className="eyebrow" style={{ marginBottom: ".5rem" }}>Certified by</div>
          <div style={line} />
          <div className="note">Name and signature</div>
          <div style={{ ...line, marginTop: ".9rem" }} />
          <div className="note">Designation and date</div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
            Received by — payee
          </div>
          <div style={line} />
          <div className="note">Name and signature</div>
          <div style={{ ...line, marginTop: ".9rem" }} />
          <div className="note">ID number and date</div>
        </div>
      </div>
    </div>
  );
}
