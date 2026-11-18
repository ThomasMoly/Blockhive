
export default function CurrentJob({
  currentJob,
  isRunning,
  shortId,
  formatDCC
}) {
  return (
    <div className="compute-info job-card">
      <span className="compute-section-title">
        CURRENT DCP JOB
      </span>

      {currentJob ? (
        <>
          <div className="compute-stat">
            <span className="compute-label">JOB NAME</span>
            <span className="compute-value">
              {currentJob.name}
            </span>
          </div>

          <div className="compute-stat">
            <span className="compute-label">JOB ID</span>
            <span
              className="compute-value"
              title={currentJob.id}
            >
              {shortId(currentJob.id)}
            </span>
          </div>

          <div className="compute-stat">
            <span className="compute-label">
              OFFERED PAY
            </span>
            <span className="compute-value">
              {currentJob.offerPerSlice !== null
                ? `${formatDCC(currentJob.offerPerSlice)} per slice`
                : "Not reported by scheduler"}
            </span>
          </div>

          {currentJob.description && (
            <div className="compute-stat">
              <span className="compute-label">
                DESCRIPTION
              </span>
              <span className="compute-value">
                {currentJob.description}
              </span>
            </div>
          )}

          <div className="compute-stat">
            <span className="compute-label">
              PROGRESS
            </span>
            <span className="compute-value">
              {currentJob.completedSlices} /{" "}
              {currentJob.totalSlices} slices · started{" "}
              {currentJob.startedAt}
            </span>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(
                    100,
                    (currentJob.completedSlices /
                      Math.max(1, currentJob.totalSlices)) *
                      100
                  )}%`
                }}
              ></div>
            </div>
          </div>
        </>
      ) : (
        <span className="compute-value muted">
          {isRunning ? "Searching for a job…" : "No job"}
        </span>
      )}
    </div>
  );
}
