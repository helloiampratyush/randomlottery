const { developementChains } = require("../helper_hardhat_lottery");
const base_fee = ethers.utils.parseEther("0.25"); //it cost 0.25 link per cost

const gas_price_link = 1e9; // link per gascalculated value based on the gas price of the chains
/*
   eth price=high
   ..1.chainlink node pay the gas fees to give us randomness and do external execution
   so the price of request changes based on  price of gas  in market..
   */
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const args = [base_fee, gas_price_link];
    if (developementChains.includes(network.name)) {
        log("local network detected!deploying Mocks");
        //deploy a mock vrfcoordinator.....
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        });
        log("mocks deployed");
        log("----------------");
    }
};
module.exports.tags = ["all", "mocks"];
