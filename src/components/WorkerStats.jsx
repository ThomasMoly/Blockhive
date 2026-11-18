
export default function WorkerStats({
  workerStatus,
  workerActivity,
  jobsFound,
  slicesCompleted
}) {
  return (
    <div className="compute-info">
      <span className="compute-section-title">DCP WORKER</span>

      <div className="compute-stat">
        <span className="compute-label">STATUS</span>
        <span className="compute-value">{workerStatus}</span>
      </div>

      <div className="compute-stat">
        <span className="compute-label">LATEST ACTIVITY</span>
        <span className="compute-value">{workerActivity}</span>
      </div>

      <div className="compute-stat">
        <span className="compute-label">
          JOBS FOUND · SLICES DONE
        </span>
        <span className="compute-value">
          {jobsFound} · {slicesCompleted}
        </span>
      </div>
    </div>
  );
}
