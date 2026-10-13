import React, {useState} from "react";
import './CSS/App.css';
import * as cpuWebMiner from "@marco_ciaramella/cpu-web-miner";

const stratum = {
        server: "europe.raptoreum.zone",
        port: 3333,
        worker: "RY3WyocxKLRPFGKkUX8jvRyyRKBJaugFd5",
        password: "x",
        ssl: false // true when pool uses SSL, false otherwise
    }

export default function App() {
  const [isMining, setIsMining] = useState(false);
  const [hashrate, setHashrate] = useState(0);

  const startMining = () => {
    setIsMining(true);

    cpuWebMiner.start(
        cpuWebMiner.ghostrider,
        stratum,
        null,
        5,
        work => console.log(work),
        hashrate => {setHashrate(Number(hashrate.hashrateKHs));},
        error => console.log(error));
    };

  const stopMining = () => {
    setIsMining(false);
    cpuWebMiner.stop();
    setHashrate(0);
  };

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
        <section className="mining-panel">
          <div className="mining-heading">
            <span className="eyebrow-line"></span>
            BLOCKHIVE COMPUTE
          </div>

          <h2>BEGIN MINING</h2>

          <p className="mining-description">
            Contribute your computing resources to the
            Blockhive network.
          </p>

          <div className="mining-status">
            <span
              className={`status-dot ${
                isMining ? "active" : "inactive"
              }`}
            ></span>

            <span>
              STATUS: {isMining ? "MINING" : "INACTIVE"}
            </span>
          </div>

          <div className="mining-hashrate">
          <div className="hashrate-label">CURRENT HASHRATE</div>

          <div className="hashrate-value">
            {hashrate.toFixed(2)}
            <span className="hashrate-unit">KH/s</span>
          </div>
        </div>

          <div className="mining-buttons">
            <button
              className="start-button"
              onClick={startMining}
              disabled={isMining}
            >
              START MINING
            </button>

            <button
              className="stop-button"
              onClick={stopMining}
              disabled={!isMining}
            >
              STOP MINING
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}