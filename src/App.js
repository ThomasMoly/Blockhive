import React, {useState, useRef} from "react";
import './CSS/App.css';
import * as cpuWebMiner from "@marco_ciaramella/cpu-web-miner";

const stratum = {
        server: "gulf.moneroocean.stream",
        port: 10128,
        worker: "888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRxbANsAnjyPbb3iQ1YBRk1UXcdRsiKc9dhwMVgN5S9cQUiyoogDavup3H",
        password: "x",
        ssl: false // true when pool uses SSL, false otherwise
    }


export default function App() {
  const [hashrate, setHashrate] = useState(0);
  const [mode, setMode] = useState("idle");
  const workerRef = useRef(null);
  const dcp = window.dcp;
  const modeRef = useRef("idle");

  const changeMode = (nextMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  const startMining = () => {
      if (modeRef.current !== "idle") return;

    changeMode("starting-miner");

    cpuWebMiner.start(
        cpuWebMiner.ghostrider,
        stratum,
        null,
        14,
        work => {console.log(work);
          console.log(navigator.hardwareConcurrency);
        },
        hashrate => {
          console.log("Hashrate received:", hashrate);
          setHashrate(Number(hashrate.hashrateKHs));},
        error => console.log(error));
        
        changeMode("mining");
    };

   const stopMining = async () => {
    if (modeRef.current !== "mining") return;

    changeMode("stopping");

    try {
      await cpuWebMiner.stop();
      setHashrate(0);

      changeMode("idle");
    } catch (error) {
      console.error("Failed to stop mining:", error);
      changeMode("mining");
    }
  };

  const startWorker = async() => {
    if (modeRef.current !== "idle") return;
 
    changeMode("starting-dcp");

    if (!dcp.identity.check()) {
        const id = await new dcp.wallet.Keystore(  // web-worker-demo-id
           "0x5356d59ec41a45672e4be75a8761e1721f7b48941226f2775722907238f805be",""
        );
        await dcp.identity.set(id);
	  };

		workerRef.current = new dcp.worker.DistributiveWorker({
		  paymentAddress: new dcp.wallet.Address(
			'0x08d9468dddc9238b08cd72e6b6fdbadf03ae466d'
		  ),
		});

		workerRef.current.on("fetch", (ev) => {
      console.log("[fetch]", ev);
    });

    workerRef.current.on("error", (err) => {
      console.error("[error]", err);
    });

    workerRef.current.on("payment", (ev) => {
      console.log("[payment]", ev);
    });

		await workerRef.current.start();
    changeMode("computing");

    console.log('DCP Worker started');
  }

  const stopWorker = async () => {
    if (modeRef.current !== "computing") return;

    changeMode("stopping");

    try {
      await workerRef.current.stop();

      workerRef.current = null;

      console.log("DCP Worker stopped");

      changeMode("idle");
    } catch (error) {
      console.error("Failed to stop DCP worker:", error);
      changeMode("computing");
    }
  };
	

   return (
    <main className="homepage">
      <script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
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
              mode === "mining" || mode === "computing"
                    ? "active"
                    : "inactive"
                  }`}
            ></span>

            <span>
                STATUS: {mode.toUpperCase()}
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
          
        </section>

      </div>
    </main>
  );
}