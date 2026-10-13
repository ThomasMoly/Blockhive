# Blockhive Compute

Blockhive Compute is a browser-based cryptocurrency mining application built using React. The project aims to utilize users' computing resources for cryptocurrency mining and eventually expand into distributed computing workloads.

## Current Features

- React-based frontend with a Blockhive-inspired interface.
- Start and Stop Mining functionality.
- Browser-based CPU mining using the GhostRider algorithm.
- Integration with `cpu-web-miner` for Raptoreum mining.
- Real-time mining hashrate monitoring.
- Mining status indicator.

## Technologies

- **Frontend:** React, JavaScript, CSS
- **Mining Library:** [cpu-web-miner](https://github.com/MarcoCiaramella/cpu-web-miner)
- **Mining Algorithm:** GhostRider
- **Cryptocurrency:** Raptoreum (RTM)

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/ThomasMoly/Blockhive.git
cd Blockhive
npm install
```

Start the React application:

```bash
npm start
```

Configure your mining pool and wallet address before starting the miner.

## Future Development

- CPU resource allocation and thread management.
- Mining performance and resource utilization monitoring.
- Integration of useful distributed computing workloads.
- Intelligent routing between cryptocurrency mining and computational tasks based on profitability.

## Project Status

**Early Development / Proof of Concept**

Browser-based GhostRider mining has been tested successfully, with mining jobs received and nonzero hashrates reported. Mining pool share acceptance and broader system reliability still require verification.