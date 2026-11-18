
export default function ComputeControls({
  isRunning,
  isBusy,
  mode,
  startAll,
  stopAll
}) {
  return (
    <div className="mining-buttons">
      {isRunning ? (
        <button className="stop-button" onClick={stopAll}>
          STOP COMPUTING
        </button>
      ) : (
        <button
          className="start-button"
          onClick={startAll}
          disabled={isBusy}
        >
          {mode === "starting"
            ? "STARTING…"
            : mode === "stopping"
            ? "STOPPING…"
            : "START COMPUTING"}
        </button>
      )}
    </div>
  );
}
