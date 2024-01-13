import { Raffle } from "../../typechain-types";

import { assert, expect } from "chai";
import { ethers, network, deployments } from "hardhat";
import { developmentChains } from "../../config/extended-hardhat-config";

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Staging Tests", function () {
      let raffle: Raffle, raffleEntranceFee: bigint;

      beforeEach(async function () {
        const rfl = await deployments.get("Raffle");
        raffle = await ethers.getContractAt("Raffle", rfl.address);
        raffleEntranceFee = await raffle.getEntranceFees();
      });

      describe("fulfillRandomWords", function () {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
          // enter the raffle
          console.log("Setting up test...");
          const startingTimeStamp = await raffle.getLastTimeStamp();
          const accounts = await ethers.getSigners();

          console.log("Setting up Listener...");
          await new Promise<void>(async (resolve, reject) => {
            // setup listener before we enter the raffle
            // Just in case the blockchain moves REALLY fast
            raffle.once(raffle.getEvent("WinnerPicked"), async () => {
              console.log("WinnerPicked event fired!");
              try {
                // add our asserts here
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance =
                  await accounts[0].provider.getBalance(accounts[0].address);
                const endingTimeStamp = await raffle.getLastTimeStamp();

                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(Number(raffleState), 0);
                let bal = winnerStartingBalance + raffleEntranceFee;
                assert.equal(winnerEndingBalance.toString(), bal.toString());
                assert(endingTimeStamp > startingTimeStamp);
                resolve();
              } catch (error) {
                console.log(error);
                reject(error);
              }
            });
            // Then entering the raffle
            console.log("Entering Raffle...");
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1);
            console.log("Ok, time to wait...");
            const winnerStartingBalance = await accounts[0].provider.getBalance(
              accounts[0].address
            );

            // and this code WONT complete until our listener has finished listening!
          });
        });
      });
    });
