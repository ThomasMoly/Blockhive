
import React, { useState, useRef, useEffect, useCallback } from "react";
import "./CSS/App.css";
import Tutorial from "./Tutorial";

import HeroSection from "./components/HeroSection";
import ComputePanel from "./components/ComputePanel";

import { createMiner } from "./mining/createMiner";
import { createComputeAgent } from "./agent/createComputeAgent";
import { createDCPWorker } from "./compute/createDCPWorker";
import { createHeartbeat } from "./livekeep/createHeartbeat";

const HEARTBEAT_MS = 10000;
const DCP_QUIET_MS = 5000;
const MAX_LOG_ENTRIES = 60;

// -------------------------
// DISPLAY HELPERS
// -------------------------

const shortId = (id) =>
  id && id.length > 14
    ? `${id.slice(0, 8)}…${id.slice(-4)}`
    : id;

const formatDCC = (n) => `${n.toFixed(6)} DCC`;

const timeStamp = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

export default function App() {
  // -------------------------
  // APPLICATION STATE
  // -------------------------

  const [view, setView] = useState("home");
  const [mode, setMode] = useState("idle");
  const [activeTask, setActiveTask] = useState(null);

  // Miner
  const [hashrate, setHashrate] = useState(0);
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
  const [sliceProgress, setSliceProgress] = useState({});

  // Payouts
  const [lastPayout, setLastPayout] = useState(null);
  const [totalEarned, setTotalEarned] = useState(0);
  const [payoutCount, setPayoutCount] = useState(0);

  // Activity log
  const [log, setLog] = useState([]);

  // -------------------------
  // REFS
  // -------------------------

  const modeRef = useRef("idle");
  const workerRef = useRef(null);
  const minerOnRef = useRef(false);
  const workerOnRef = useRef(false);

  const hashrateRef = useRef(0);
  const hashrateKnownRef = useRef(false);
  const workerActivityRef = useRef("Not started");

  const pendingSlicesRef = useRef(0);
  const heartbeatRef = useRef(null);
  const pivotQueueRef = useRef(Promise.resolve());

  const sandboxCounterRef = useRef(0);
  const milestoneRef = useRef({});
  const lastDcpActivityRef = useRef(0);
  const resumeTimerRef = useRef(null);

  // -------------------------
  // HELPERS
  // -------------------------

  const dcp = window.dcp;

  const changeMode = (nextMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  const addLog = useCallback((message, type = "info") => {
    setLog((prev) =>
      [
        {
          id: Date.now() + Math.random(),
          time: timeStamp(),
          message,
          type
        },
        ...prev
      ].slice(0, MAX_LOG_ENTRIES)
    );
  }, []);

  const updateWorkerActivity = (text) => {
    workerActivityRef.current = text;
    setWorkerActivity(text);
  };

  // -------------------------
  // MINER MODULE
  // -------------------------

  const { startMiner, stopMiner } = createMiner({
    addLog,
    timeStamp,

    setHashrate,
    setHashrateKnown,
    setSharesFound,
    setLastShareTime,
    setMinerStatus,
    setActiveTask,

    minerOnRef,
    hashrateRef,
    hashrateKnownRef
  });

  // -------------------------
  // COMPUTE AGENT MODULE
  // -------------------------

  const {
    queuePivot,
    pivotToDCP,
    pivotToMining
  } = createComputeAgent({
    addLog,
    startMiner,
    stopMiner,

    modeRef,
    minerOnRef,
    pendingSlicesRef,
    lastDcpActivityRef,
    resumeTimerRef,
    pivotQueueRef,

    setActiveTask,
    setMinerStatus,
    setCurrentJob,
    setSliceProgress,
    milestoneRef,
    updateWorkerActivity,

    DCP_QUIET_MS
  });

  // -------------------------
  // DCP WORKER MODULE
  // -------------------------

  const { startWorker, stopWorker } = createDCPWorker({
    dcp,
    addLog,
    timeStamp,
    shortId,
    formatDCC,

    workerRef,
    workerOnRef,
    minerOnRef,
    modeRef,

    pendingSlicesRef,
    sandboxCounterRef,
    milestoneRef,
    lastDcpActivityRef,
    resumeTimerRef,

    setWorkerStatus,
    updateWorkerActivity,
    setJobsFound,
    setSlicesCompleted,
    setCurrentJob,
    setSliceProgress,
    setPayoutCount,
    setLastPayout,
    setTotalEarned,

    pivotToDCP,
    pivotToMining
  });

  // -------------------------
  // HEARTBEAT MODULE
  // -------------------------

  const { startHeartbeat, stopHeartbeat } = createHeartbeat({
    heartbeatRef,
    modeRef,
    workerOnRef,
    minerOnRef,
    workerActivityRef,
    pendingSlicesRef,
    hashrateRef,
    hashrateKnownRef,

    addLog,
    HEARTBEAT_MS
  });

  // Cleanup when App unmounts
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, []);

  // -------------------------
  // COMBINED START / STOP
  // -------------------------

  const startAll = async () => {
    if (modeRef.current !== "idle") return;

    changeMode("starting");
    addLog("Starting Blockhive compute…", "info");

    // Start the DCP worker first
    try {
      await startWorker();
    } catch (error) {
      console.error("Failed to start DCP worker:", error);

      workerRef.current = null;
      workerOnRef.current = false;

      setWorkerStatus("Failed");
      updateWorkerActivity("Failed to start worker");

      addLog(
        `Failed to start worker: ${error?.message || error}`,
        "error"
      );
    }

    // Mine only if no DCP slices are pending
    if (pendingSlicesRef.current === 0) {
      try {
        startMiner();
      } catch (error) {
        console.error("Failed to start miner:", error);

        setMinerStatus("Failed");

        addLog(
          `Failed to start miner: ${error?.message || error}`,
          "error"
        );
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

        addLog(
          `Failed to stop miner: ${error?.message || error}`,
          "error"
        );
      }
    });

    setMinerStatus("Off");

    try {
      await stopWorker();
    } catch (error) {
      console.error("Failed to stop DCP worker:", error);

      addLog(
        `Failed to stop worker: ${error?.message || error}`,
        "error"
      );
    }

    setActiveTask(null);
    changeMode("idle");

    addLog("All compute stopped", "info");
  };

  // -------------------------
  // DISPLAY
  // -------------------------

  if (view === "tutorial") {
    return <Tutorial onBack={() => setView("home")} />;
  }

  return (
    <main className="homepage">
      <div className="hero-container">
        <HeroSection
          onSetupWallet={() => setView("tutorial")}
        />

        <ComputePanel
          mode={mode}
          activeTask={activeTask}

          minerStatus={minerStatus}
          hashrate={hashrate}
          hashrateKnown={hashrateKnown}
          sharesFound={sharesFound}
          lastShareTime={lastShareTime}
          minerOn={minerOnRef.current}

          workerStatus={workerStatus}
          workerActivity={workerActivity}
          jobsFound={jobsFound}
          slicesCompleted={slicesCompleted}

          currentJob={currentJob}
          sliceProgress={sliceProgress}

          totalEarned={totalEarned}
          lastPayout={lastPayout}
          payoutCount={payoutCount}

          log={log}

          shortId={shortId}
          formatDCC={formatDCC}

          startAll={startAll}
          stopAll={stopAll}
        />
      </div>
    </main>
  );
}
