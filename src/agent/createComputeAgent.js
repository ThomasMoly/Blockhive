
export function createComputeAgent({
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
}) {

  const queuePivot = (fn) => {
    pivotQueueRef.current = pivotQueueRef.current
      .then(fn)
      .catch((err) => {
        console.error("Pivot error:", err);
        addLog(`Pivot error: ${err?.message || err}`, "error");
      });

    return pivotQueueRef.current;
  };

  const pivotToDCP = () =>
    queuePivot(async () => {
      if (modeRef.current !== "running") return;

      setActiveTask("switching");

      await stopMiner();

      setMinerStatus("Paused for DCP");
      setActiveTask("dcp");
    });

  const pivotToMining = () =>
    queuePivot(async () => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }

      if (modeRef.current !== "running") return;
      if (pendingSlicesRef.current > 0) return;
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
        addLog(
          `Could not resume miner: ${err?.message || err}`,
          "error"
        );
      }
    });

  return {
    queuePivot,
    pivotToDCP,
    pivotToMining
  };
}
