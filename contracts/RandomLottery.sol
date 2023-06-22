//workflow
//raffle/lottery
//enter the lottery (paying some amount)
//pick a random winner
//winner to be selected at every x minutes
//chainlink Oracle -> randomness,randomness,automated execution

// SPDX-License-Identifier:MIT
pragma solidity ^0.8.7;
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
error lottery__NotEnoughEth();
error Lottery_TransferFailed();
error lottery__notOpen();
error lottery__upKeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 lotteryState
);

/**
 * @title a sample lottery contract
 * @author helloiampratyus
 * @notice this contract is for creating  untamperable decentralized smart contract
 * @dev this implements chainlink automation and chainlink vrf
 */

//one of the player should be paid

contract RandomLottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum lotteryState {
        OPEN,
        CALCULATING
    }
    // uint256 0=OPEN,uint256 1=CALCULATING
    //state variable
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant request_Block_Confirmations = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant num_Words = 1;
    //lottery variable
    address private s_recentWinner;
    lotteryState private s_lotteryState; //to pending ,open closed,calculating
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;
    //events
    event lotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    //winnerPicking
    event winnerPicked(address indexed winner);

    constructor(
        uint64 subscriptionId,
        bytes32 gasLane,
        address vrfCoordinatorV2,
        uint256 entranceFee,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = lotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert lottery__NotEnoughEth();
        }
        if (s_lotteryState != lotteryState.OPEN) {
            revert lottery__notOpen();
        }
        s_players.push(payable(msg.sender));

        //events
        /*
EVM(etherneum virtual machine) the things happens on blockchain evm writes it's with specific data structure called loG WE can read this blockchain nodes inside log 
f get logs inside log there is event event allow you to print stuff to this log .event and log isn't accesible through smart contract but we can print important data for us
buffering means listning of event happening. graph uses for event.
event example
event storedNumber(
uint256 indexed oldNumber,
uint256 indexed newNumber,
uint256 addedNumber,
address sender
);
indexed parameter is much easier searchable than non index
topics==indexed parameter 
non Indexed =abi coded
we have to emit the event to store data in the loging data structure of evm
emitting 
emit storedNumber(
    favoriteNumber,
    _favoriteNumber,
    _favoriteNumber+favoriteNumber,
  msg.sender
    );
*/
        // emit an event when we update a dynamic array or mapping
        //named event with the function name reversed
        emit lotteryEnter(msg.sender);
    }

    /**
     *
     * @dev this is the function that the the chainlink keeper nodes call
     * they look for the "upKeepNeeded" to return true.
     * the following should be true in order to return true:
     * 1. Our time Interval should have passed,
     * 2.the lottery should have at least 1 player ,
     * 3.our subscription is funded with LINK
     * 4.the lottery should be in open* state
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = (lotteryState.OPEN == s_lotteryState);
        //(block.timestamp-last block timestamp)>interval
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayer = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayer && hasBalance);
        return (upkeepNeeded, "0x0");
    }

    //function randomWinner
    //chainlink vrf
    function performUpkeep(bytes calldata) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert lottery__upKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }
        //gas efficient
        //Request the random number
        //once we get it ,do something with it
        //transaction process
        s_lotteryState = lotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            request_Block_Confirmations,
            i_callbackGasLimit,
            num_Words
        );
        emit RequestedLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, //requestId,
        uint256[] memory randomWords
    ) internal override {
        //modulo function use

        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_lotteryState = lotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        //all money transfer to winner
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery_TransferFailed();
        }
        emit winnerPicked(recentWinner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getplayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (lotteryState) {
        return s_lotteryState;
    }

    function getNumWords() public pure returns (uint256) {
        return num_Words;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimestamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestBlockConfirmation() public pure returns (uint256) {
        return request_Block_Confirmations;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
