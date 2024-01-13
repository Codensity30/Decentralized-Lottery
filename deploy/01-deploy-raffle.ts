import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Address, DeployFunction } from "hardhat-deploy/types";
import { ethers, network } from "hardhat";
import { VRFCoordinatorV2Mock } from "../typechain-types/@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock";
import {
  VERIFICATION_BLOCK_CONFIRMATIONS,
  developmentChains,
  networkConfig,
} from "../config/extended-hardhat-config";
import verify from "../utils/verify";

const FUND_AMOUNT = ethers.parseEther("1");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  if (!chainId) {
    throw new Error("ChainId is not specified");
  }

  // GETTING VRF MOCKS ---------------------------------------
  // if we are in local/hardhat enviroment
  let subscriptionId,
    vrfCoordinatorV2Mock: VRFCoordinatorV2Mock,
    vrfCoordinatorV2Address: Address;
  if (chainId == 31337) {
    // getting the mock contract
    const vrfContract = await deployments.get("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Mock = await ethers.getContractAt(
      "VRFCoordinatorV2Mock",
      vrfContract.address
    );
    // getting the address of the mock contract
    vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress();
    // creating new subscription for the vrf mock
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait();
    if (!transactionReceipt) {
      throw new Error("Subscription Failed");
    }
    subscriptionId = BigInt(transactionReceipt.logs[0].topics[1]);
    // funding the subscription
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
  } else {
    // @ts-ignore
    vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2;
    subscriptionId = networkConfig[chainId].subscriptionId;
  }

  // GETTING ARGS READY WHICH IS REQUIRED TO DEPLOY RAFFLE ----------------------
  const waitBlockConfirmations = developmentChains.includes(network.name)
    ? 1
    : VERIFICATION_BLOCK_CONFIRMATIONS;

  const args = [
    networkConfig[chainId]["raffleEntranceFee"],
    vrfCoordinatorV2Address,
    networkConfig[chainId]["gasLane"],
    subscriptionId,
    networkConfig[chainId]["callbackGasLimit"],
    networkConfig[chainId]["keepersUpdateInterval"],
  ];

  // DEPLOYING RAFFLE -------------------------------------------
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: waitBlockConfirmations,
  });

  // whitelisting the raffle contract in mocks ---------------------
  if (developmentChains.includes(network.name)) {
    const vrfContract = await deployments.get("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Mock = await ethers.getContractAt(
      "VRFCoordinatorV2Mock",
      vrfContract.address
    );
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
  }

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    deployments.log("Verifying...");
    await verify(raffle.address, args);
  }

  deployments.log("Enter lottery with command:");
  const networkName = network.name == "hardhat" ? "localhost" : network.name;
  deployments.log("----------------------------------------------------");
};

export default func;
func.tags = ["all", "Raffle"];
