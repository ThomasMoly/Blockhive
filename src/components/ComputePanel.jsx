
import MinerStats from "./MinerStats";
import WorkerStats from "./WorkerStats";
import CurrentJob from "./CurrentJob";
import PayoutStats from "./PayoutStats";
import ActivityLog from "./ActivityLog";
import ComputeControls from "./ComputeControls";

export default function ComputePanel({
  mode,
  activeTask,
  minerStatus,
  hashrate,
  hashrateKnown,
  sharesFound,
  lastShareTime,
  minerOn,
  workerStatus,
  workerActivity,
  jobsFound,
  slicesCompleted,
  currentJob,
  sliceProgress,
  totalEarned,
  lastPayout,
  payoutCount,
  log,
  shortId,
  formatDCC,
  startAll,
  stopAll
}) {
  const isRunning = mode === "running";
  const isBusy = mode === "starting" || mode === "stopping";
  const isIdle = mode === "idle";

  const nowDoing =
    activeTask === "dcp"
      ? "RUNNING DCP JOB"
      : activeTask === "mining"
      ? "MINING · SEARCHING FOR DCP JOBS"
      : activeTask === "switching"
      ? "SWITCHING…"
      : mode.toUpperCase();

  const panelMode = isIdle
    ? "idle-mode"
    : activeTask === "dcp"
    ? "dcp-mode"
    : "miner-mode";

  return (
    <section className={`mining-panel ${panelMode}`}>
      <div className="mining-heading">
        <span className="eyebrow-line"></span>
        BLOCKHIVE COMPUTE
      </div>

      <h2>
        {isIdle
          ? "BEGIN COMPUTING"
          : activeTask === "dcp"
          ? "DISTRIBUTED COMPUTE"
          : "CRYPTO MINING"}
      </h2>

      <p className="mining-description">
        {isIdle
          ? "Mine crypto while searching for DCP jobs. When a job is found, mining pauses and your CPU switches to the job, then goes back to mining when it's done."
          : activeTask === "dcp"
          ? "Mining is paused while your computer works on a DCP job."
          : "Mining crypto while the DCP worker searches for jobs."}
      </p>

      {/* STATUS */}
      <div className="mining-status">
        <span
          className={`status-dot ${isRunning ? "active" : "inactive"}`}
        ></span>
        <span>STATUS: {nowDoing}</span>
      </div>

      {/* MINER + WORKER INFO */}
      <div className="compute-grid">
        <MinerStats
          minerStatus={minerStatus}
          hashrate={hashrate}
          hashrateKnown={hashrateKnown}
          sharesFound={sharesFound}
          lastShareTime={lastShareTime}
          minerOn={minerOn}
        />

        <WorkerStats
          workerStatus={workerStatus}
          workerActivity={workerActivity}
          jobsFound={jobsFound}
          slicesCompleted={slicesCompleted}
        />
      </div>

      {/* CURRENT DCP JOB */}
      <CurrentJob
        currentJob={currentJob}
        isRunning={isRunning}
        shortId={shortId}
        formatDCC={formatDCC}
      />

      {/* PAYOUTS */}
      <PayoutStats
        totalEarned={totalEarned}
        lastPayout={lastPayout}
        payoutCount={payoutCount}
        formatDCC={formatDCC}
      />

      {/* LIVE ACTIVITY */}
      <ActivityLog
        isRunning={isRunning}
        activeTask={activeTask}
        sliceProgress={sliceProgress}
        minerOn={minerOn}
        hashrateKnown={hashrateKnown}
        hashrate={hashrate}
        log={log}
      />

      {/* START / STOP BUTTONS */}
      <ComputeControls
        isRunning={isRunning}
        isBusy={isBusy}
        mode={mode}
        startAll={startAll}
        stopAll={stopAll}
      />
    </section>
  );
}
