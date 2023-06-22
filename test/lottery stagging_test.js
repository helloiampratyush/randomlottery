const { getNamedAccounts, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");
const {
    developementChains,
    networkConfig,
} = require("../helper_hardhat_lottery");

developementChains.includes(network.name)
    ? describe.skip
    : describe("lottery stagging test", async function () {
          let RandomLottery,
              lotteryEntranceFee,
              deployer,
              chainId = network.config.chainId;
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              RandomLottery = await ethers.getContract(
                  "RandomLottery",
                  deployer
              );

              lotteryEntranceFee = await RandomLottery.getEntranceFee();
          });
          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  // enter the raffle
                  console.log("Setting up test...");
                  const startingTimeStamp =
                      await RandomLottery.getLatestTimestamp();

                  const accounts = await ethers.getSigners();
                  const winnerStartingBalance = await accounts[0].getBalance();
                  console.log("setting up listner");
                  await new Promise(async (resolve, reject) => {
                      RandomLottery.once("winnerPicked", async () => {
                          console.log("winnerPicked event fired");
                          try {
                              const recentWinner =
                                  await RandomLottery.getRecentWinner();
                              const lotteryState =
                                  await RandomLottery.getLotteryState();
                              const winnerEndingBalance =
                                  await accounts[0].getBalance();
                              const endingTimeStamp =
                                  await RandomLottery.getLatestTimestamp();
                              await expect(RandomLottery.getplayer(0)).to.be
                                  .reverted;
                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[0].address
                              );
                              assert.equal(lotteryState.toString(), "0");
                              /*assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.toString()
                              );*/
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                      console.log("entering lottery");
                      const { tx } = await RandomLottery.enterLottery({
                          value: lotteryEntranceFee,
                      });
                      await tx.wait(1);
                  });

                  /**/
              });
          });
      });
