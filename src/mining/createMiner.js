import * as cpuWebMiner from "@marco_ciaramella/cpu-web-miner";
import { stratum } from "./miningConfig";

export function createMiner({
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
}) {

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
  
  return { startMiner, stopMiner };
}