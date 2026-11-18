import {
  getSliceCount,
  getJobInfo,
  getPaymentAmount
} from "./dcpHelpers";

export function createDCPWorker({
  dcp,
  addLog,
  timeStamp,
  shortId,
  formatDCC,

  workerRef,
  workerOnRef,
  pendingSlicesRef,
  sandboxCounterRef,
  milestoneRef,
  minerOnRef,  // ADD
  modeRef,
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
}) {

  // Paste your EXISTING startWorker function here.
  
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

  // Paste your EXISTING stopWorker function here.
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

  return { startWorker, stopWorker };
}
