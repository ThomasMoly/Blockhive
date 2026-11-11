import React, { useState, useRef, useEffect, useCallback } from "react";
import "./CSS/App.css";
import * as cpuWebMiner from "@marco_ciaramella/cpu-web-miner";

const stratum = {
  server: "us-east.flockpool.com",
  port: 4444,
  worker: "RY3WyocxKLRPFGKkUX8jvRyyRKBJaugFd5",
  password: "x",
  ssl: false
};

const HEARTBEAT_MS = 10000; // how often to post a "still running" update
const DCP_QUIET_MS = 5000; // DCP must be silent this long before mining resumes
const MAX_LOG_ENTRIES = 60;

// -------------------------
// DCP EVENT HELPERS
// (DCP doesn't document payload shapes, so these read them defensively.
//  The raw events are always logged to the browser console.)
// -------------------------

// Number of slices in a "fetch" event. Returns a number, or null if unknown.
const getSliceCount = (task) => {
  if (typeof task === "number") return task;
  if (!task || typeof task !== "object") return null;
  if (Array.isArray(task.slices)) return task.slices.length;
  if (task.slices && typeof task.slices === "object") {
    // slices is grouped by job: { [jobAddress]: [slice, slice, ...] }
    // so count what's inside each group, not the number of groups.
    return Object.values(task.slices).reduce((sum, group) => {
      if (Array.isArray(group)) return sum + group.length;
      if (typeof group === "number") return sum + group;
      if (group && typeof group === "object") {
        const inner = Object.keys(group).length;
        // a single slice object vs. a map of slices
        return sum + (group.sliceNumber !== undefined ? 1 : inner || 1);
      }
      return sum + 1;
    }, 0);
  }
  if (typeof task.sliceCount === "number") return task.sliceCount;
  return null;
};

// Pull job details (id, name, description) out of a "fetch" event.
const getJobInfo = (task) => {
  const jobs = task && task.jobs;
  let id = null;
  let job = null;

  if (Array.isArray(jobs) && jobs.length) {
    job = jobs[0];
  } else if (jobs && typeof jobs === "object") {
    const keys = Object.keys(jobs);
    if (keys.length) {
      id = keys[0];
      job = jobs[id];
    }
  }

  job = job || {};
  id = id || job.address || job.id || job.jobAddress || task?.jobAddress || null;

  const name =
    job.public?.name || job.name || task?.job?.public?.name || "Unnamed DCP job";
  const description = job.public?.description || job.description || "";

  // Pay offered per slice, if the scheduler includes it
  const rawOffer =
    job.slicePaymentOffer ?? job.paymentOffer ?? job.payment ?? null;
  const offerValue =
    rawOffer && typeof rawOffer === "object"
      ? rawOffer.offerPerSlice ?? rawOffer.value ?? rawOffer.amount ?? null
      : rawOffer;
  const offerNum =
    offerValue === null || offerValue === undefined
      ? null
      : Number(String(offerValue));

  return {
    id: id ? String(id) : "Unknown",
    name,
    description,
    offerPerSlice: Number.isFinite(offerNum) ? offerNum : null,
    jobCount: jobs && typeof jobs === "object" ? Object.keys(jobs).length : 1
  };
};

// Pull a payout amount (in DCC) out of a "payment" event.
const getPaymentAmount = (ev) => {
  const raw =
    ev && typeof ev === "object"
      ? ev.payment ?? ev.amount ?? ev.value ?? ev.earned ?? null
      : ev;
  if (raw === null || raw === undefined) return null;
  const n = Number(String(raw));
  return Number.isFinite(n) ? n : null;
};

const shortId = (id) =>
  id && id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

const formatDCC = (n) => `${n.toFixed(6)} DCC`;

const timeStamp = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

export default function App() {
  // "idle" | "starting" | "running" | "stopping"
  const [mode, setMode] = useState("idle");

  // What the computer is doing right now: "mining" | "dcp" | "switching" | null
  const [activeTask, setActiveTask] = useState(null);

  // Miner
  const [hashrate, setHashrate] = useState(0);
  // The miner library only reports hashrate when a share is found,
  // so until the first share the rate is unknown (not zero).
  const [hashrateKnown, setHashrateKnown] = useState(false);
  const [sharesFound, setSharesFound] = useState(0);
  const [lastShareTime, setLastShareTime] = useState(null);
  const [minerStatus, setMinerStatus] = useState("Off");

  // DCP worker
  const [workerStatus, setWorkerStatus] = useState("Off");
  const [workerActivity, setWorkerActivity] = useState("Not started");
  const [jobsFound, setJobsFound] = useState(0);
  const [slicesCompleted, setSlicesCompleted] = useState(0);
  const [currentJob, setCurrentJob] = useState(null);
  // Live % per running slice: { [sandboxId]: number | null }
  const [sliceProgress, setSliceProgress] = useState({});

  // Payouts
  const [lastPayout, setLastPayout] = useState(null);
  const [totalEarned, setTotalEarned] = useState(0);
  const [payoutCount, setPayoutCount] = useState(0);

  const [log, setLog] = useState([]);

  const modeRef = useRef("idle");
  const workerRef = useRef(null);
  const minerOnRef = useRef(false);
  const workerOnRef = useRef(false);
  const hashrateRef = useRef(0);
  const hashrateKnownRef = useRef(false);
  const workerActivityRef = useRef("Not started");
  const pendingSlicesRef = useRef(0);
  const heartbeatRef = useRef(null);
  const pivotQueueRef = useRef(Promise.resolve()); // runs switches one at a time
  const sandboxCounterRef = useRef(0);
  const milestoneRef = useRef({}); // last 25% milestone logged per sandbox
  const lastDcpActivityRef = useRef(0); // last time a sandbox reported progress
  const resumeTimerRef = useRef(null);

  const dcp = window.dcp;

  // -------------------------
  // HELPERS
  // -------------------------

  const changeMode = (nextMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  // type: "info" | "mining" | "worker" | "job" | "payout" | "error"
  const addLog = useCallback((message, type = "info") => {
    setLog((prev) =>
      [
        { id: Date.now() + Math.random(), time: timeStamp(), message, type },
        ...prev
      ].slice(0, MAX_LOG_ENTRIES)
    );
  }, []);

  const updateWorkerActivity = (text) => {
    workerActivityRef.current = text;
    setWorkerActivity(text);
  };

  // Make sure mining/DCP switches never overlap each other
  const queuePivot = (fn) => {
    pivotQueueRef.current = pivotQueueRef.current
      .then(fn)
      .catch((err) => console.error("Pivot error:", err));
    return pivotQueueRef.current;
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (minerOnRef.current) {
        addLog(
          hashrateKnownRef.current
            ? `Mining — ${hashrateRef.current.toFixed(2)} KH/s · DCP worker searching for jobs`
            : "Mining — measuring hashrate (waiting for first share) · DCP worker searching for jobs",
          "mining"
        );
      } else if (pendingSlicesRef.current > 0) {
        addLog(
          `Working on DCP job — ${pendingSlicesRef.current} slice(s) remaining`,
          "job"
        );
      } else if (workerOnRef.current) {
        addLog(`Worker: ${workerActivityRef.current}`, "worker");
      }
    }, HEARTBEAT_MS);
  };

  useEffect(() => () => stopHeartbeat(), []);

  // -------------------------
  // CRYPTO MINER
  // -------------------------

  const startMiner = () => {
    if (minerOnRef.current) return;

    setMinerStatus("Connecting");
    addLog(`Connecting to pool ${stratum.server}:${stratum.port}`, "mining");

    cpuWebMiner.start(
      cpuWebMiner.ghostrider,
      stratum,
      null,
      14,

      // New work from the pool
      (work) => {
        console.log("Mining work received:", work);
        setMinerStatus("Mining");
      },

      // Hashrate updates
      // (fires only when a share is found and submitted to the pool)
      (result) => {
        console.log("Hashrate received:", result);
        const rate = Number(result?.hashrateKHs);
        const safeRate = Number.isFinite(rate) ? rate : 0;
        const firstShare = !hashrateKnownRef.current;
        hashrateRef.current = safeRate;
        hashrateKnownRef.current = true;
        setHashrate(safeRate);
        setHashrateKnown(true);
        setSharesFound((n) => n + 1);
        setLastShareTime(timeStamp());
        setMinerStatus("Mining");
        addLog(
          `Share found & submitted — ${safeRate.toFixed(2)} KH/s${
            firstShare ? " (first measurement)" : ""
          }`,
          "mining"
        );
      },

      // Mining errors
      (error) => {
        console.error("Mining error:", error);
        setMinerStatus("Error");
        addLog(`Miner error: ${error?.message || error}`, "error");
      }
    );

    minerOnRef.current = true;
    setActiveTask("mining");
    addLog("Mining started", "mining");
  };

  const stopMiner = async (reason = "Mining stopped") => {
    if (!minerOnRef.current) return;
    await cpuWebMiner.stop();
    minerOnRef.current = false;
    hashrateRef.current = 0;
    hashrateKnownRef.current = false;
    setHashrate(0);
    setHashrateKnown(false);
    addLog(reason, "mining");
  };

  // -------------------------
  // PIVOTING
  // -------------------------

  // DCP job found -> pause mining so the CPU is free for the job
  const pivotToDCP = () =>
    queuePivot(async () => {
      if (!minerOnRef.current) return;
      setActiveTask("switching");
      try {
        await stopMiner("Mining paused — switching to DCP job");
        setMinerStatus("Paused (DCP job running)");
      } catch (err) {
        addLog(`Could not pause miner: ${err?.message || err}`, "error");
      }
      setActiveTask("dcp");
    });

  // DCP job finished -> go back to mining while the worker keeps searching.
  // Only resumes once no slice has reported progress for DCP_QUIET_MS,
  // so a slice that's still running never overlaps with mining.
  const pivotToMining = () =>
    queuePivot(async () => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      if (modeRef.current !== "running") return;
      if (pendingSlicesRef.current > 0) return; // another job came in
      if (minerOnRef.current) return;

      const quietFor = Date.now() - lastDcpActivityRef.current;
      if (quietFor < DCP_QUIET_MS) {
        updateWorkerActivity("Waiting for remaining slices to finish");
        resumeTimerRef.current = setTimeout(
          pivotToMining,
          DCP_QUIET_MS - quietFor + 250
        );
        return;
      }

      setActiveTask("switching");
      setCurrentJob(null);
      setSliceProgress({});
      milestoneRef.current = {};
      updateWorkerActivity("Searching for DCP jobs");
      try {
        addLog("DCP job finished — resuming mining", "mining");
        startMiner();
      } catch (err) {
        setMinerStatus("Failed");
        setActiveTask(null);
        addLog(`Could not resume miner: ${err?.message || err}`, "error");
      }
    });

  // -------------------------
  // DCP WORKER
  // -------------------------

  const startWorker = async () => {
    if (!dcp) throw new Error("DCP client is not loaded");

    setWorkerStatus("Starting");
    updateWorkerActivity("Starting worker");
    addLog("Starting DCP worker", "worker");

    if (!dcp.identity.check()) {
      const id = await new dcp.wallet.Keystore(
        "0x5356d59ec41a45672e4be75a8761e1721f7b48941226f2775722907238f805be",
        ""
      );
      await dcp.identity.set(id);
    }

    const worker = new dcp.worker.DistributiveWorker({
      paymentAddress: new dcp.wallet.Address(
        "0x8112904ce31d222457b2714bb96253b13ee51500" // your DCP account — payouts go here
      )
    });

    // Worker checked the scheduler for work
    worker.on("fetch", (task) => {
      console.log("[fetch]", task);
      const count = getSliceCount(task);

      // A "fetch" fires every time the worker checks for work, even when
      // nothing comes back. Only treat it as a job when real slices arrived.
      if (!count || count <= 0) {
        if (pendingSlicesRef.current === 0) {
          updateWorkerActivity(`No DCP jobs available — still searching (checked ${timeStamp()})`);
        }
        return;
      }

      const info = getJobInfo(task);
      const slices = count;

      // Print the full job details so the pay field can be checked
      Object.entries(task.jobs || {}).forEach(([jobId, job]) => {
        console.log(`[job details] ${jobId}`, JSON.stringify(job, null, 2));
      });
      console.log("[job info read by app]", info);
      const isNewJob = pendingSlicesRef.current === 0;

      pendingSlicesRef.current += slices;

      if (isNewJob) {
        setJobsFound((n) => n + 1);
        setCurrentJob({
          ...info,
          totalSlices: slices,
          completedSlices: 0,
          startedAt: timeStamp()
        });
        addLog(
          `DCP job found: "${info.name}" (ID ${shortId(info.id)}) — ${slices} slice(s)`,
          "job"
        );
        if (info.description) addLog(`Job description: ${info.description}`, "job");
        if (info.offerPerSlice !== null) {
          addLog(
            `Offered pay: ${formatDCC(info.offerPerSlice)} per slice (≈ ${formatDCC(
              info.offerPerSlice * slices
            )} for ${slices} slice(s))`,
            "payout"
          );
        }
      } else {
        setCurrentJob((job) =>
          job ? { ...job, totalSlices: job.totalSlices + slices } : job
        );
        addLog(`Fetched ${slices} more slice(s) for the DCP job`, "job");
      }

      updateWorkerActivity(
        `Working on DCP job — ${pendingSlicesRef.current} slice(s) remaining`
      );
      pivotToDCP();
    });

    // Live progress (0–100%) from each sandbox running a slice
    worker.on("sandbox", (sandbox) => {
      if (!sandbox || typeof sandbox.on !== "function") return;

      sandboxCounterRef.current += 1;
      const sandboxId = sandboxCounterRef.current;

      sandbox.on("progress", (ev) => {
        console.log("[sandbox progress]", ev);
        const raw = typeof ev === "object" && ev !== null ? ev.progress ?? ev.value : ev;
        const pct = Number(raw);
        const value = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : null;

        setSliceProgress((prev) => ({ ...prev, [sandboxId]: value }));
        lastDcpActivityRef.current = Date.now();

        // DCP is computing -> make sure the miner is off
        if (minerOnRef.current && modeRef.current === "running") {
          pivotToDCP();
        }

        if (value === null) return;

        // Log every 25% so the feed isn't flooded
        const last = milestoneRef.current[sandboxId] ?? 0;
        if (value < last - 10) milestoneRef.current[sandboxId] = 0; // new slice in same sandbox
        const milestone = Math.floor(value / 25) * 25;
        if (milestone > (milestoneRef.current[sandboxId] ?? 0)) {
          milestoneRef.current[sandboxId] = milestone;
          addLog(`Slice ${sandboxId}: ${milestone}% complete`, "job");
        }
      });
    });

    // A slice result was sent back to the scheduler
    worker.on("result", (ev) => {
      console.log("[result]", ev);
      pendingSlicesRef.current = Math.max(0, pendingSlicesRef.current - 1);
      setSlicesCompleted((n) => n + 1);
      setCurrentJob((job) =>
        job ? { ...job, completedSlices: job.completedSlices + 1 } : job
      );

      if (pendingSlicesRef.current > 0) {
        updateWorkerActivity(
          `Slice submitted — ${pendingSlicesRef.current} slice(s) remaining`
        );
        addLog("DCP slice completed and submitted", "job");
      } else {
        updateWorkerActivity("All slices submitted — wrapping up");
        addLog("DCP job complete — all slices submitted", "job");
        pivotToMining(); // waits until every slice has gone quiet
      }
    });

    // Payout for completed work
    worker.on("payment", (ev) => {
      console.log("[payment]", ev);
      const amount = getPaymentAmount(ev);

      setPayoutCount((n) => n + 1);
      setLastPayout({ amount, time: timeStamp() });

      if (amount !== null) {
        setTotalEarned((t) => t + amount);
        addLog(`Payout received: +${formatDCC(amount)}`, "payout");
      } else {
        addLog("Payout received (amount not reported)", "payout");
      }
    });

    worker.on("error", (err) => {
      console.error("[error]", err);
      addLog(`Worker error: ${err?.message || err}`, "error");

      // If the job failed, don't leave the CPU sitting idle
      if (pendingSlicesRef.current > 0) {
        pendingSlicesRef.current = 0;
        setCurrentJob(null);
        setSliceProgress({});
        milestoneRef.current = {};
        updateWorkerActivity("Job errored — searching for next job");
        pivotToMining();
      }
    });

    worker.on("end", () => {
      console.log("[end]");
    });

    await worker.start();

    workerRef.current = worker;
    workerOnRef.current = true;
    setWorkerStatus("Running");
    updateWorkerActivity("Searching for DCP jobs");
    addLog("DCP worker running — searching for jobs", "worker");
  };

  const stopWorker = async () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    if (!workerOnRef.current || !workerRef.current) return;
    await workerRef.current.stop();
    workerRef.current = null;
    workerOnRef.current = false;
    pendingSlicesRef.current = 0;
    setCurrentJob(null);
    setSliceProgress({});
    milestoneRef.current = {};
    setWorkerStatus("Off");
    updateWorkerActivity("Stopped");
    addLog("DCP worker stopped", "worker");
  };

  // -------------------------
  // COMBINED START / STOP
  // -------------------------

  const startAll = async () => {
    if (modeRef.current !== "idle") return;
    changeMode("starting");
    addLog("Starting Blockhive compute…", "info");

    // Start the worker first so it begins searching for jobs
    try {
      await startWorker();
    } catch (error) {
      console.error("Failed to start DCP worker:", error);
      workerRef.current = null;
      workerOnRef.current = false;
      setWorkerStatus("Failed");
      updateWorkerActivity("Failed to start worker");
      addLog(`Failed to start worker: ${error?.message || error}`, "error");
    }

    // Mine while there's no DCP job (unless one was already found)
    if (pendingSlicesRef.current === 0) {
      try {
        startMiner();
      } catch (error) {
        console.error("Failed to start miner:", error);
        setMinerStatus("Failed");
        addLog(`Failed to start miner: ${error?.message || error}`, "error");
      }
    }

    if (minerOnRef.current || workerOnRef.current) {
      changeMode("running");
      startHeartbeat();
    } else {
      changeMode("idle");
      addLog("Nothing could be started", "error");
    }
  };

  const stopAll = async () => {
    if (modeRef.current !== "running") return;
    changeMode("stopping");
    stopHeartbeat();
    addLog("Stopping Blockhive compute…", "info");

    await queuePivot(async () => {
      try {
        await stopMiner();
      } catch (error) {
        console.error("Failed to stop miner:", error);
        addLog(`Failed to stop miner: ${error?.message || error}`, "error");
      }
    });
    setMinerStatus("Off");

    try {
      await stopWorker();
    } catch (error) {
      console.error("Failed to stop DCP worker:", error);
      addLog(`Failed to stop worker: ${error?.message || error}`, "error");
    }

    setActiveTask(null);
    changeMode("idle");
    addLog("All compute stopped", "info");
  };

  // -------------------------
  // DISPLAY
  // -------------------------

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
    <main className="homepage">
      <div className="hero-container">
        {/* LEFT SIDE */}
        <section className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-line"></span>
            DISTRIBUTED COMPUTE FRAMEWORK
          </div>

          <h1>
            <span>BUILT FOR</span>
            <span className="heading-gray">MINERS</span>
          </h1>

          <p>
            XYR is a Bitcoin market intelligence platform that identifies
            market states using statistical methods – helping traders
            distinguish high-risk from low-risk scenarios with clarity.
          </p>

          <a href="/dashboard" className="hero-button">
            ENTER THE XYR DASHBOARD
          </a>
        </section>

        {/* RIGHT SIDE */}
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
                    {minerOnRef.current
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
                <span className="compute-label">JOBS FOUND · SLICES DONE</span>
                <span className="compute-value">
                  {jobsFound} · {slicesCompleted}
                </span>
              </div>
            </div>
          </div>

          {/* CURRENT DCP JOB */}
          <div className="compute-info job-card">
            <span className="compute-section-title">CURRENT DCP JOB</span>

            {currentJob ? (
              <>
                <div className="compute-stat">
                  <span className="compute-label">JOB NAME</span>
                  <span className="compute-value">{currentJob.name}</span>
                </div>

                <div className="compute-stat">
                  <span className="compute-label">JOB ID</span>
                  <span className="compute-value" title={currentJob.id}>
                    {shortId(currentJob.id)}
                  </span>
                </div>

                <div className="compute-stat">
                  <span className="compute-label">OFFERED PAY</span>
                  <span className="compute-value">
                    {currentJob.offerPerSlice !== null
                      ? `${formatDCC(currentJob.offerPerSlice)} per slice`
                      : "Not reported by scheduler"}
                  </span>
                </div>

                {currentJob.description && (
                  <div className="compute-stat">
                    <span className="compute-label">DESCRIPTION</span>
                    <span className="compute-value">
                      {currentJob.description}
                    </span>
                  </div>
                )}

                <div className="compute-stat">
                  <span className="compute-label">PROGRESS</span>
                  <span className="compute-value">
                    {currentJob.completedSlices} / {currentJob.totalSlices}{" "}
                    slices · started {currentJob.startedAt}
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

          {/* PAYOUTS */}
          <div className="compute-info payout-card">
            <span className="compute-section-title">DCP PAYOUTS</span>

            <div className="payout-row">
              <div className="compute-stat">
                <span className="compute-label">TOTAL EARNED</span>
                <span className="payout-value">{formatDCC(totalEarned)}</span>
              </div>

              <div className="compute-stat">
                <span className="compute-label">LAST PAYOUT</span>
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
                <span className="compute-label">PAYOUTS</span>
                <span className="compute-value">{payoutCount}</span>
              </div>
            </div>
          </div>

          {/* LIVE ACTIVITY FEED */}
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
                      {!minerOnRef.current
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
                  <li key={entry.id} className={`log-entry log-${entry.type}`}>
                    <span className="log-time">{entry.time}</span>
                    <span className="log-message">{entry.message}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* SINGLE START / STOP BUTTON */}
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
        </section>
      </div>
    </main>
  );
}
