const { network, ethers } = require("hardhat");

const {
    developementChains,
    networkConfig,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper_hardhat_lottery");
const { verify } = require("../utils/verify");
const {
    experimentalAddHardhatNetworkMessageTraceHook,
} = require("hardhat/config");
const fund_amount = ethers.utils.parseEther("2");
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let VRFCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;
    if (developementChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        VRFCoordinatorV2Address = vrfCoordinatorV2Mock.address;

        const transactionResponse =
            await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId = transactionReceipt.events[0].args.subId; //(EVENT)
        //fund the subscription
        //usuall you'd need the link token on a real nework
        await vrfCoordinatorV2Mock.fundSubscription(
            subscriptionId,
            fund_amount
        );
    } else {
        VRFCoordinatorV2Address =
            networkConfig[chainId]["vrfCoordinatorV2Mock"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }
    const waitBlockConfirmations = developementChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;
    const args = [
        subscriptionId,
        networkConfig[chainId]["gasLane"],
        VRFCoordinatorV2Address,
        networkConfig[chainId]["entranceFee"],
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["interval"],
    ];

    const lottery = await deploy("RandomLottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });
    if (developementChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract(
            "VRFCoordinatorV2Mock"
        );
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address);
    }

    if (!developementChains.includes(network.name)) {
        log("veryfying");
        await verify(lottery.address, args);
    }

    log("-----------------------------");
};
module.exports.tags = ["all", "lottery"];
