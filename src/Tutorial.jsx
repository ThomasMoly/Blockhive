import React, { useState } from "react";
import "./CSS/Tutorial.css";

// --- Explicit imports (tree-shakeable, bundled by webpack/Vite) ---
import step1  from "./assets/cake-tutorial/step-1.jpeg";
import step2  from "./assets/cake-tutorial/step-2.jpeg";
import step3  from "./assets/cake-tutorial/step-3.jpeg";
import step4  from "./assets/cake-tutorial/step-4.jpeg";
import step5  from "./assets/cake-tutorial/step-5.jpeg";
import step6  from "./assets/cake-tutorial/step-6.jpeg";
import step7  from "./assets/cake-tutorial/step-7.jpeg";
import step8  from "./assets/cake-tutorial/step-8.jpeg";
import step9  from "./assets/cake-tutorial/step-9.jpeg";
import step10 from "./assets/cake-tutorial/step-10.jpeg";

const steps = [
  {
    src: step1,
    title: "Download Cake Wallet",
    body:
      "Install Cake Wallet from the official app store for your platform. " +
      "Make sure you download the verified publisher's app to avoid imposters.",
  },
  {
    src: step2,
    title: "Open the App",
    body:
      "Launch Cake Wallet. You will land on the Welcome screen, where you " +
      "will be prompted to set up a PIN to protect your wallet.",
  },
  {
    src: step3,
    title: "Set Your PIN",
    body:
      "Choose a 4-digit PIN, or switch to the 6-digit option for stronger " +
      "protection. Memorise this PIN — you will need it every time you " +
      "reopen the app.",
  },
  {
    src: step4,
    title: "Create a New Wallet",
    body:
      "Once your PIN is set, you are ready to create a wallet. Tap the " +
      "button on screen to begin the setup process.",
  },
  {
    src: step5,
    title: "Select Monero (XMR)",
    body:
      "Choose Monero (XMR) as your wallet currency. Blockhive's browser " +
      "miner pays out in XMR, so this is the wallet type you need.",
  },
  {
    src: step6,
    title: "Customise Your Wallet",
    body:
      "Name your wallet and, if you wish, change the recovery phrase " +
      "language. Leave the Polyseed (16 words) option at its default " +
      "setting.",
  },
  {
    src: step7,
    title: "Acknowledge & Back Up Your Phrase",
    body:
      "Read and accept the security notices, then carefully record your " +
      "recovery phrase — keeping each word in its numbered order. Store " +
      "it securely offline; anyone with these words controls your funds.",
  },
  {
    src: step8,
    title: "Verify Your Recovery Phrase",
    body:
      "Confirm that you recorded your phrase correctly by selecting the " +
      "requested words at their matching positions. This guards against " +
      "losing access to your wallet.",
  },
  {
    src: step9,
    title: "Wallet Verification Complete",
    body:
      "Once verification succeeds, your wallet is ready. Proceed to open " +
      "it and start using it.",
  },
  {
    src: step10,
    title: "Open Your Wallet & Receive XMR",
    body:
      "This is your Monero wallet — where Blockhive pays out your mining " +
      "rewards. Tap Receive to view and copy your wallet address; you will " +
      "paste this address into the browser miner.",
  },
  {
    title: "You're Ready to Mine",
    body:
      "With your address copied, return to the Blockhive mining panel, " +
      "paste it in, and start earning XMR for your contributed computing " +
      "power.",
  },
];

export default function Tutorial({ onBack }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const total = steps.length;

  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  return (
    <main className="tutorial-page">
      <div className="tutorial-page-inner">
        <header className="tutorial-page-header">
          <button className="tutorial-back" onClick={onBack}>
            ← BACK
          </button>
          <h1>SET UP YOUR CAKE WALLET</h1>
          <span className="tutorial-page-counter">
            STEP {index + 1} OF {total}
          </span>
        </header>

        <div className="tutorial-slide">
          <div className="tutorial-slide-image">
            <img src={step.src} alt={step.title} />
          </div>

          <div className="tutorial-slide-text">
            <span className="tutorial-step-eyebrow">
              STEP {String(index + 1).padStart(2, "0")}
            </span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>

            <div className="tutorial-slide-actions">
              <button className="tutorial-nav-btn" onClick={prev}>
                ← PREVIOUS
              </button>
              <button className="tutorial-nav-btn primary" onClick={next}>
                {index === total - 1 ? "START OVER" : "NEXT STEP →"}
              </button>
            </div>

            <div className="tutorial-progress">
              {steps.map((_, i) => (
                <button
                  key={i}
                  className={`tutorial-progress-seg ${
                    i === index ? "active" : i < index ? "done" : ""
                  }`}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}