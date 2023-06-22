const { getNamedAccounts, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");
const {
    developementChains,
    networkConfig,
} = require("../helper_hardhat_lottery");

!developementChains.includes(network.name)
    ? describe.skip
    : describe("lottery unit test", async function () {
          let RandomLottery,
              vrfCoordinatorV2Mock,
              lotteryEntranceFee,
              deployer,
              interval;
          chainId = network.config.chainId;
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              RandomLottery = await ethers.getContract(
                  "RandomLottery",
                  deployer
              );
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              );
              lotteryEntranceFee = await RandomLottery.getEntranceFee();
              interval = await RandomLottery.getInterval();
          });
          describe("constructor", async function () {
              it("initializing the lottery correctly", async function () {
                  const lotteryState = await RandomLottery.getLotteryState();

                  assert.equal(lotteryState.toString(), "0");
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainId]["interval"]
                  );
              });
          });
          describe("enterLottery", async function () {
              it("revert if you not pay enough", async function () {
                  await expect(RandomLottery.enterLottery()).to.be.revertedWith(
                      "lottery__NotEnoughEth"
                  );
              });
              it("records players when they enter", async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  const playerFromContract = await RandomLottery.getplayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emit event when event is emitting", async function () {
                  await expect(
                      RandomLottery.enterLottery({
                          value: lotteryEntranceFee,
                      })
                  ).to.emit(RandomLottery, "lotteryEnter");
              });
              it("does not allow into the lottery when it is in calculating state", async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await RandomLottery.performUpkeep([]);
                  await expect(
                      RandomLottery.enterLottery({ value: lotteryEntranceFee })
                  ).to.be.revertedWith("lottery__notOpen");
              });
          });
          describe("checkUpkeep", async function () {
              it("return falls if people have not sent any eth", async function () {
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } =
                      await RandomLottery.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              it("It return false when lottery is not open", async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await RandomLottery.performUpkeep([]);
                  const lotteryState = await RandomLottery.getLotteryState();
                  const { upkeepNeeded } =
                      await RandomLottery.callStatic.checkUpkeep([]);
                  assert.equal(lotteryState.toString(), "1");
                  assert.equal(upkeepNeeded.toString(), "false");
              });
              it("it returns false if not enough time is passed", async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() - 5,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await RandomLottery.checkUpkeep(
                      "0x"
                  );
                  assert(!upkeepNeeded);
              });
              it("it returns true if if enough time has passed has player and lottery is in open state", async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await RandomLottery.checkUpkeep(
                      "0x"
                  );
                  assert(upkeepNeeded);
              });
          });
          describe("performUpkeep", function () {
              it("can only run if checkupkeep is true", async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);

                  const tx = await RandomLottery.performUpkeep("0x");
                  assert(tx);
              });
              it("revert with error if checkUpkeep failed", async function () {
                  await expect(
                      RandomLottery.performUpkeep("0x")
                  ).to.be.revertedWith("lottery__upKeepNotNeeded");
              });
              it("update the lotterystate emit the emit the event and calls the vrf coordinator", async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const transactionResponse = await RandomLottery.performUpkeep(
                      "0x"
                  );
                  const transactionReceipt = await transactionResponse.wait(1);
                  const requestId = transactionReceipt.events[1].args.requestId;
                  const lotteryState = await RandomLottery.getLotteryState();
                  assert(lotteryState.toString() == "1");
                  assert(requestId > 0);
              });
          });
          describe("fulfillRandomWords", async function () {
              beforeEach(async function () {
                  await RandomLottery.enterLottery({
                      value: lotteryEntranceFee,
                  });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
              });
              it("only calls after performpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(
                          "0",
                          RandomLottery.address
                      )
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(
                          "1",
                          RandomLottery.address
                      )
                  ).to.be.revertedWith("nonexistent request");
              });
              it("it picks a winner ,reset the lottery,and send the money", async function () {
                  const additionalEntrants = 4;
                  const startingAccountIndex = 1;
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedLottery =
                          await RandomLottery.connect(accounts[i]);
                      await accountConnectedLottery.enterLottery({
                          value: lotteryEntranceFee,
                      });
                  }
                  const startingTimeStamp =
                      await RandomLottery.getLatestTimestamp();
                  //performUpkeep (mock being chainkeepers)
                  //fulfillRandomWords (mock being the chainlink VRF)
                  //we shall have to wait for the fulfillRandomWords to be colled\
                  await new Promise(async (resolve, reject) => {
                      RandomLottery.once("winnerPicked", async () => {
                          console.log("found the event");

                          try {
                              console.log(accounts[2].address);
                              console.log(accounts[0].address);
                              console.log(accounts[1].address);
                              console.log(accounts[3].address);
                              console.log(accounts[4].address);

                              //console.log(accounts[5].address);
                              //console.log(accounts[6].address);
                              const recentWinner =
                                  await RandomLottery.getRecentWinner();
                              console.log(recentWinner);
                              const lotteryState =
                                  await RandomLottery.getLotteryState();
                              const winnerEndingBalance =
                                  await accounts[1].getBalance();
                              const endingTimeStamp =
                                  await RandomLottery.getLatestTimestamp();
                              const numPlayers =
                                  await RandomLottery.getNumberOfPlayers();

                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(lotteryState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStrartingBalance.add(
                                      lotteryEntranceFee
                                          .mul(additionalEntrants)
                                          .add(lotteryEntranceFee.toString())
                                          .toString()
                                  )
                              );
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });
                      //setting up the listner
                      //below firing of event is done and listner will pick i up and resolve
                      const tx = await RandomLottery.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      const winnerStrartingBalance =
                          await accounts[1].getBalance();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          RandomLottery.address
                      );
                  });
              });
          });
      });
