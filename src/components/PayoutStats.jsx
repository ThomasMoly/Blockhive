
export default function PayoutStats({
  totalEarned,
  lastPayout,
  payoutCount,
  formatDCC
}) {
  return (
    <div className="compute-info payout-card">
      <span className="compute-section-title">
        DCP PAYOUTS
      </span>

      <div className="payout-row">
        <div className="compute-stat">
          <span className="compute-label">
            TOTAL EARNED
          </span>
          <span className="payout-value">
            {formatDCC(totalEarned)}
          </span>
        </div>

        <div className="compute-stat">
          <span className="compute-label">
            LAST PAYOUT
          </span>
          <span className="compute-value">
            {lastPayout
              ? `${
                  lastPayout.amount !== null
                    ? `+${formatDCC(lastPayout.amount)}`
                    : "Amount not reported"
                } · ${lastPayout.time}`
              : "None yet"}
          </span>
        </div>

        <div className="compute-stat">
          <span className="compute-label">
            PAYOUTS
          </span>
          <span className="compute-value">
            {payoutCount}
          </span>
        </div>
      </div>
    </div>
  );
}
