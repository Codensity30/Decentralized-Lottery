// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

error Raffle__SendMoreToEnterRaffle();
error Raffle__TransactionFailed();
error Raffle__NotWinnerTime();
error Raffle__RaffleNotOpen();

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum RaffleState {
        OPEN,
        COMPUTING
    }

    // CHAINLINK VRF VARIABLES -----------------------------
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    // RAFFLE VARIABLES ---------------------------
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint private immutable i_entranceFees;
    address payable[] private s_players;
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint private s_lastTimeStamp;
    uint256 private immutable i_interval;

    // EVENTS -----------------------------
    event EnteredRaffle(address indexed _player);
    event WinnerPicked(address indexed _winner);
    event WinnerRequested(uint indexed _requestId);

    // CONSTRUCTOR -------------------------------------
    constructor(
        uint _entranceFees,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit,
        uint256 _interval
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        i_entranceFees = _entranceFees;
        i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        i_keyHash = _keyHash;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        i_interval = _interval;
        s_lastTimeStamp = block.timestamp;
    }

    // RAFFLE FUNCTIONS -------------------------------------

    // To enter the raffle
    function enterRaffle() public payable {
        if (msg.value < i_entranceFees) {
            revert Raffle__SendMoreToEnterRaffle();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__RaffleNotOpen();
        }
        s_players.push(payable(msg.sender));
        emit EnteredRaffle(msg.sender);
    }

    // To trigger the logic to get the winner
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool hasPlayers = s_players.length > 0;
        bool hasBanlance = address(this).balance > 0;
        bool isOpen = s_raffleState == RaffleState.OPEN;
        bool istimePassed = (block.timestamp - s_lastTimeStamp) > i_interval;

        upkeepNeeded = (hasPlayers && hasBanlance && isOpen && istimePassed);
        return (upkeepNeeded, "0x0");
    }

    // To get the random numbers
    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");

        if (!upkeepNeeded) {
            revert Raffle__NotWinnerTime();
        }
        s_raffleState = RaffleState.COMPUTING;
        uint requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit WinnerRequested(requestId);
    }

    // To select the winner and pay him the balance
    function fulfillRandomWords(
        uint,
        uint256[] memory _randomWords
    ) internal override {
        uint indexOfWinner = _randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransactionFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    // VIEW FUNCTIONS TO ACCESS GLOBAL VARIABLES -------------------
    function getEntranceFees() public view returns (uint) {
        return i_entranceFees;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getNumberOfPlayers() public view returns (uint) {
        return s_players.length;
    }

    function getEstimatedTimeLeftInWin() public view returns (uint) {
        return (i_interval - (block.timestamp - s_lastTimeStamp));
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getPlayer(uint _index) public view returns (address) {
        return s_players[_index];
    }

    function getLastTimeStamp() public view returns (uint) {
        return s_lastTimeStamp;
    }
}
