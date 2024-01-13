import { assert, expect } from "chai";
import { deployments, ethers, network } from "hardhat";
import { developmentChains } from "../../config/extended-hardhat-config";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle: Raffle,
        raffleContract: Raffle,
        accounts: HardhatEthersSigner[],
        player: HardhatEthersSigner,
        vrfCoordinatorV2Mock: VRFCoordinatorV2Mock,
        raffleEntranceFee: bigint,
        raffleInterval: bigint;

      // before testing deploy both the contracts
      beforeEach(async () => {
        accounts = await ethers.getSigners();
        player = accounts[1];
        await deployments.fixture("all");
        const vrf = await deployments.get("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Mock = await ethers.getContractAt(
          "VRFCoordinatorV2Mock",
          vrf.address
        );
        const raf = await deployments.get("Raffle");
        raffleContract = await ethers.getContractAt("Raffle", raf.address);
        raffle = raffleContract.connect(player);
        raffleEntranceFee = await raffle.getEntranceFees();
        raffleInterval = await raffle.getInterval();
      });

      describe("constructor", function () {
        it("Initalizes the contract correctly", async () => {
          const raffleState = await raffle.getRaffleState();
          assert.equal(String(raffleState), "0");
        });
      });

      describe("Enter Raffle", function () {
        it("reverts when you don't have entrance fees", async () => {
          await expect(
            raffle.enterRaffle({ value: 0 })
          ).to.be.revertedWithCustomError(
            raffle,
            "Raffle__SendMoreToEnterRaffle"
          );
        });

        it("records player when they enter", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const contractPlayer = await raffle.getPlayer(0);
          assert.equal(player.address, contractPlayer);
        });

        it("emits event on enter", async () => {
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.emit(raffle, "EnteredRaffle");
        });

        it("doesn't allow entrance when raffle is calculating", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await raffle.performUpkeep("0x"); // performing upkeep to change the state to computing
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWithCustomError(raffle, "Raffle__RaffleNotOpen");
        });
      });

      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async () => {
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert(!upkeepNeeded);
        });

        it("returns false if raffle isn't open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await raffle.performUpkeep("0x"); // changes the state to calculating
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert.equal(raffleState.toString() == "1", upkeepNeeded == false);
        });

        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) - 5,
          ]); // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {
        it("can only run if checkupkeep is true", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await raffle.performUpkeep("0x");
          assert(tx);
        });

        it("reverts if checkup is false", async () => {
          await expect(
            raffle.performUpkeep("0x")
          ).to.be.revertedWithCustomError(raffle, "Raffle__NotWinnerTime");
        });

        it("updates the raffle state and emits a requestId", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep("0x"); // emits requestId
          const txReceipt = await txResponse.wait(1); // waits 1 block
          const raffleState = await raffle.getRaffleState(); // updates state
          const requestId = txReceipt?.logs[0].topics[1];
          assert(Number(requestId) > 0);
          assert(Number(raffleState) == 1); // 0 = open, 1 = calculating
        });
      });

      describe("fulfillRandomWords", function () {
        beforeEach(async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(raffleInterval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });

        it("can only be called after performupkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.getAddress()) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.getAddress()) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
        });

        it("picks a winner, resets, and sends money", async () => {
          const additionalEntrances = 3; // to test
          const startingIndex = 2;
          let startingBalance: bigint;
          for (
            let i = startingIndex;
            i < startingIndex + additionalEntrances;
            i++
          ) {
            raffle = raffleContract.connect(accounts[i]); // Returns a new instance of the Raffle contract connected to player
            await raffle.enterRaffle({ value: raffleEntranceFee });
          }
          const startingTimeStamp = await raffle.getLastTimeStamp(); // stores starting timestamp (before we fire our event)

          // This will be more important for our staging tests...
          await new Promise<void>(async (resolve, reject) => {
            raffle.once(raffle.getEvent("WinnerPicked"), async () => {
              // event listener for WinnerPicked
              console.log("WinnerPicked event fired!");
              // assert throws an error if it fails, so we need to wrap
              // it in a try/catch so that the promise returns event
              // if it fails.
              try {
                // Now lets get the ending values...
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerBalance = await accounts[2].provider.getBalance(
                  accounts[2].address
                );
                const endingTimeStamp = await raffle.getLastTimeStamp();
                await expect(raffle.getPlayer(0)).to.be.reverted;
                // Comparisons to check if our ending values are correct:
                assert.equal(recentWinner.toString(), accounts[2].address);
                assert.equal(Number(raffleState), 0);
                startingBalance =
                  startingBalance +
                  (raffleEntranceFee * BigInt(additionalEntrances) +
                    raffleEntranceFee);
                assert.equal(
                  winnerBalance.toString(),
                  startingBalance.toString() // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve(); // if try passes, resolves the promise
              } catch (e) {
                reject(e); // if try fails, rejects the promise
              }
            });

            // kicking off the event by mocking the chainlink keepers and vrf coordinator
            try {
              const tx = await raffle.performUpkeep("0x");
              const txReceipt = await tx.wait(1);
              startingBalance = await accounts[2].provider.getBalance(
                accounts[2].getAddress()
              );
              if (!txReceipt) {
                throw new Error("Tax receipt not exists");
              }
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                BigInt(txReceipt?.logs[0].topics[2]),
                raffle.getAddress()
              );
            } catch (e) {
              reject(e);
            }
          });
        });
      });
    });
