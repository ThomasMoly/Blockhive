
import { stratum } from "../mining/miningConfig";

export default function MinerStats({
  minerStatus,
  hashrate,
  hashrateKnown,
  sharesFound,
  lastShareTime,
  minerOn
}) {
  return (
    <div className="compute-info">
      <span className="compute-section-title">MINER</span>

      <div className="compute-stat">
        <span className="compute-label">STATUS</span>
        <span className="compute-value">{minerStatus}</span>
      </div>

      <div className="compute-stat">
        <span className="compute-label">CURRENT HASHRATE</span>

        {hashrateKnown ? (
          <div className="hashrate-value">
            {hashrate.toFixed(2)}
            <span className="hashrate-unit"> KH/s</span>
          </div>
        ) : (
          <span className="compute-value muted">
            {minerOn
              ? "Measuring… (waiting for first share)"
              : "—"}
          </span>
        )}
      </div>

      <div className="compute-stat">
        <span className="compute-label">SHARES FOUND</span>
        <span className="compute-value">
          {sharesFound}
          {lastShareTime ? ` · last at ${lastShareTime}` : ""}
        </span>
      </div>

      <div className="compute-stat">
        <span className="compute-label">POOL</span>
        <span className="compute-value">
          {stratum.server} · GhostRider
        </span>
      </div>
    </div>
  );
}
