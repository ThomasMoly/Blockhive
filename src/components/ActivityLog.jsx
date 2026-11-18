
export default function ActivityLog({
  isRunning,
  activeTask,
  sliceProgress,
  minerOn,
  hashrateKnown,
  hashrate,
  log
}) {
  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <span className="compute-label">LIVE ACTIVITY</span>
        {isRunning && <span className="live-indicator">● LIVE</span>}
      </div>

      {/* What's using the CPU right now */}
      {isRunning && (
        <div className="live-now">
          {activeTask === "dcp" ? (
            Object.keys(sliceProgress).length === 0 ? (
              <div className="live-now-row">
                <span className="live-now-label">DCP JOB</span>
                <span className="live-now-value">Preparing slices…</span>
              </div>
            ) : (
              Object.entries(sliceProgress).map(([id, pct]) => (
                <div className="slice-row" key={id}>
                  <div className="live-now-row">
                    <span className="live-now-label">SLICE {id}</span>
                    <span className="live-now-value">
                      {pct === null ? "Starting…" : `${pct.toFixed(1)}%`}
                    </span>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct ?? 0}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="live-now-row">
              <span className="live-now-label">MINING</span>
              <span className="live-now-value mining">
                {!minerOn
                  ? "Starting…"
                  : hashrateKnown
                  ? `${hashrate.toFixed(2)} KH/s`
                  : "Measuring…"}
              </span>
            </div>
          )}
        </div>
      )}

      <ul className="activity-log-list">
        {log.length === 0 ? (
          <li className="log-entry log-info">
            <span className="log-message">
              No activity yet. Press start to begin.
            </span>
          </li>
        ) : (
          log.map((entry) => (
            <li
              key={entry.id}
              className={`log-entry log-${entry.type}`}
            >
              <span className="log-time">{entry.time}</span>
              <span className="log-message">{entry.message}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
