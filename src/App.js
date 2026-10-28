
import React, { useState, useRef } from "react";
import "./CSS/App.css";
import * as cpuWebMiner from "@marco_ciaramella/cpu-web-miner";

const stratum = {
    server: "us-east.flockpool.com",
    port: 4444,
    worker: "RY3WyocxKLRPFGKkUX8jvRyyRKBJaugFd5",
    password: "x",
    ssl: false
};

export default function App() {
  const [hashrate, setHashrate] = useState(0);
  const [mode, setMode] = useState("idle");
  const [workerActivity, setWorkerActivity] = useState("Waiting for jobs");

  const workerRef = useRef(null);
  const modeRef = useRef("idle");

  const dcp = window.dcp;

  const changeMode = (nextMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  // -------------------------
  // CRYPTO MINER
  // -------------------------

  const startMining = () => {
    if (modeRef.current !== "idle") return;

    changeMode("starting-miner");
    setHashrate(0);

    try {
      cpuWebMiner.start(
        cpuWebMiner.ghostrider,
        stratum,
        null,
        14,

        // Incoming mining jobs
        (work) => {
          console.log("Mining work received:", work);

          // No protocol conversions for now.
          // We can revisit MoneroOcean compatibility later.
        },

        // Hashrate updates
        (result) => {
          console.log("Hashrate received:", result);

          const rate = Number(result.hashrateKHs);
          setHashrate(Number.isFinite(rate) ? rate : 0);
        },

        // Mining errors
        (error) => {
          console.error("Mining error:", error);
        }
      );

      changeMode("mining");
    } catch (error) {
      console.error("Failed to start miner:", error);
      changeMode("idle");
    }
  };

  const stopMining = async () => {
    if (modeRef.current !== "mining") return;

    changeMode("stopping-miner");

    try {
      await cpuWebMiner.stop();

      setHashrate(0);
      changeMode("idle");

      console.log("Miner stopped");
    } catch (error) {
      console.error("Failed to stop miner:", error);
      changeMode("mining");
    }
  };

  // -------------------------
  // DCP WORKER
  // -------------------------

  const startWorker = async () => {
    if (modeRef.current !== "idle") return;

    changeMode("starting-dcp");
    setWorkerActivity("Starting worker");

    try {
      if (!dcp) {
        throw new Error("DCP client is not loaded");
      }

      if (!dcp.identity.check()) {
        const id = await new dcp.wallet.Keystore(
          "0x5356d59ec41a45672e4be75a8761e1721f7b48941226f2775722907238f805be",
          ""
        );

        await dcp.identity.set(id);
      }

      workerRef.current = new dcp.worker.DistributiveWorker({
        paymentAddress: new dcp.wallet.Address(
          "0x08d9468dddc9238b08cd72e6b6fdbadf03ae466d"
        )
      });

      workerRef.current.on("fetch", (ev) => {
        console.log("[fetch]", ev);
        setWorkerActivity("Workload fetched");
      });

      workerRef.current.on("error", (err) => {
        console.error("[error]", err);
        setWorkerActivity("Worker error");
      });

      workerRef.current.on("payment", (ev) => {
        console.log("[payment]", ev);
        setWorkerActivity("Payment event received");
      });

      await workerRef.current.start();

      changeMode("computing");
      setWorkerActivity("Worker running — awaiting jobs");

      console.log("DCP Worker started");
    } catch (error) {
      console.error("Failed to start DCP worker:", error);

      setWorkerActivity("Failed to start worker");
      workerRef.current = null;
      changeMode("idle");
    }
  };

  const stopWorker = async () => {
    if (modeRef.current !== "computing") return;

    changeMode("stopping-dcp");
    setWorkerActivity("Stopping worker");

    try {
      await workerRef.current.stop();

      workerRef.current = null;
      setWorkerActivity("Worker stopped");
      changeMode("idle");

      console.log("DCP Worker stopped");
    } catch (error) {
      console.error("Failed to stop DCP worker:", error);

      setWorkerActivity("Failed to stop worker");
      changeMode("computing");
    }
  };

  // -------------------------
  // DISPLAY MODES
  // -------------------------

  const isMining = [
    "starting-miner",
    "mining",
    "stopping-miner"
  ].includes(mode);

  const isDCP = [
    "starting-dcp",
    "computing",
    "stopping-dcp"
  ].includes(mode);

  const isIdle = mode === "idle";

  // -------------------------
  // JSX
  // -------------------------

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
            XYR is a Bitcoin market intelligence platform that
            identifies market states using statistical methods –
            helping traders distinguish high-risk from low-risk
            scenarios with clarity.
          </p>

          <a href="/dashboard" className="hero-button">
            ENTER THE XYR DASHBOARD
          </a>
        </section>

        {/* RIGHT SIDE */}
        <section
          className={`mining-panel ${
            isMining
              ? "miner-mode"
              : isDCP
              ? "dcp-mode"
              : "idle-mode"
          }`}
        >
          <div className="mining-heading">
            <span className="eyebrow-line"></span>
            BLOCKHIVE COMPUTE
          </div>

          <h2>
            {isMining
              ? "CRYPTO MINING"
              : isDCP
              ? "DISTRIBUTED COMPUTE"
              : "BEGIN COMPUTING"}
          </h2>

          <p className="mining-description">
            {isMining
              ? "Contribute your processing power to a cryptocurrency mining pool."
              : isDCP
              ? "Contribute your computing resources to the DCP network."
              : "Choose how you want to contribute your computing resources."}
          </p>

          {/* STATUS */}
          <div className="mining-status">
            <span
              className={`status-dot ${
                mode === "mining" || mode === "computing"
                  ? "active"
                  : "inactive"
              }`}
            ></span>

            <span>STATUS: {mode.toUpperCase()}</span>
          </div>

          {/* MINING INFORMATION */}
          {isMining && (
            <div className="compute-info">
              <div className="compute-stat">
                <span className="compute-label">
                  CURRENT HASHRATE
                </span>

                <div className="hashrate-value">
                  {hashrate.toFixed(2)}
                  <span className="hashrate-unit"> KH/s</span>
                </div>
              </div>

              <div className="compute-stat">
                <span className="compute-label">
                  ALGORITHM
                </span>

                <span className="compute-value">
                  GhostRider
                </span>
              </div>

              <div className="compute-stat">
                <span className="compute-label">
                  POOL SERVER
                </span>

                <span className="compute-value">
                  {stratum.server}
                </span>
              </div>
            </div>
          )}

          {/* DCP INFORMATION */}
          {isDCP && (
            <div className="compute-info">
              <div className="compute-stat">
                <span className="compute-label">
                  WORKER STATUS
                </span>

                <span className="compute-value">
                  {mode === "starting-dcp"
                    ? "Starting"
                    : mode === "stopping-dcp"
                    ? "Stopping"
                    : "Running"}
                </span>
              </div>

              <div className="compute-stat">
                <span className="compute-label">
                  NETWORK
                </span>

                <span className="compute-value">
                  DCP
                </span>
              </div>

              <div className="compute-stat">
                <span className="compute-label">
                  LATEST ACTIVITY
                </span>

                <span className="compute-value">
                  {workerActivity}
                </span>
              </div>
            </div>
          )}

          {/* IDLE INFORMATION */}
          {isIdle && (
            <div className="compute-info">
              <div className="compute-stat">
                <span className="compute-label">
                  COMPUTE STATUS
                </span>

                <span className="compute-value">
                  No active process
                </span>
              </div>
            </div>
          )}

          {/* MINING BUTTONS */}
          <div className="compute-controls">

      {/* MINING BUTTONS */}
      <div className="compute-button-group">
        <div className="mining-buttons">
          <button
            className="start-button"
            onClick={startMining}
            disabled={mode !== "idle"}
          >
            START MINING
          </button>

          <button
            className="stop-button"
            onClick={stopMining}
            disabled={mode !== "mining"}
          >
            STOP MINING
          </button>
        </div>
      </div>

      {/* DCP WORKER BUTTONS */}
      <div className="compute-button-group">
        <div className="mining-buttons">
          <button
            className="start-button"
            onClick={startWorker}
            disabled={mode !== "idle"}
          >
            START WORKER
          </button>

          <button
            className="stop-button"
            onClick={stopWorker}
            disabled={mode !== "computing"}
          >
            STOP WORKER
          </button>
        </div>
      </div>

    </div>
        </section>
      </div>
    </main>
  );
}
