
export function createHeartbeat({
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
}) {

  const startHeartbeat = () => {
    if (heartbeatRef.current) return;

    heartbeatRef.current = setInterval(() => {
      if (modeRef.current !== "running") return;

      const worker = workerOnRef.current
        ? workerActivityRef.current
        : "Off";

      const miner = minerOnRef.current
        ? hashrateKnownRef.current
          ? `${hashrateRef.current.toFixed(2)} KH/s`
          : "Mining (waiting for first measurement)"
        : "Off";

      addLog(
        `Heartbeat — DCP: ${worker} | Miner: ${miner} | Pending slices: ${pendingSlicesRef.current}`,
        "info"
      );
    }, HEARTBEAT_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  return {
    startHeartbeat,
    stopHeartbeat
  };
}
