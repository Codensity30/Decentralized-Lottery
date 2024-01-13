import { run } from "hardhat";

async function verify(contractAddress: string, args: (string | bigint)[]) {
  console.log("Verifying Contract...");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (error) {
    console.log(error);
  }
}

export default verify;
