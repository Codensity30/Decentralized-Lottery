import { network } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const BASEFEE = "100000000000000000";
const GASPRICELINK = 1000000000;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  if (chainId == 31337) {
    deployments.log("Deploying mocks as we are in local network!");

    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      args: [BASEFEE, GASPRICELINK],
      log: true,
    });

    deployments.log("Mocks Deployed!");
    deployments.log(
      "----------------------------------------------------------"
    );
    deployments.log(
      "You are deploying to a local network, you'll need a local network running to interact"
    );
    deployments.log(
      "Please run `npx hardhat console --network localhost` to interact with the deployed smart contracts!"
    );
    deployments.log(
      "----------------------------------------------------------"
    );
  }
};

export default func;
func.tags = ["all", "VRFCoordinatorV2Mock"];
