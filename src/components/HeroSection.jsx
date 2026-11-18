
export default function HeroSection({ onSetupWallet }) {
  return (
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

      <button
        className="hero-button secondary"
        onClick={onSetupWallet}
      >
        SET UP YOUR WALLET
      </button>
    </section>
  );
}
