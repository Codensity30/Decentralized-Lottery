import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "dotenv/config";
import "hardhat-gas-reporter";

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

if (!PRIVATE_KEY || !ETHERSCAN_API_KEY) {
  throw new Error("Enviroments variables missing");
}

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  // networks config..........
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      saveDeployments: true,
      accounts: [PRIVATE_KEY],
    },
  },
  // gas report config.............
  gasReporter: {
    currency: "USD",
    enabled: true,
    outputFile: "gas-report.txt",
    noColors: true,
  },
  // named accounts config..........
  namedAccounts: {
    deployer: {
      default: 0,
      1: 0,
    },
    player: {
      default: 1,
    },
  },
  // etherscan config...........
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  // mocha config...........
  mocha: {
    timeout: 500000, // 500 seconds max for running tests
  },
};

export default config;
