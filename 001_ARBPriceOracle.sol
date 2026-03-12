// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract ARBPriceOracle {
    // ARB token addresses
    address public constant sepoliaTestnetArbToken = 0x980B62Da83eFf3D4576C647993b0c1D7faf17c73; // ARB on Arbitrum Sepolia
    address public constant arbitrumOneArbToken = 0x912CE59144191C1204E64559FE8253a0e49E6548;    // ARB on Arbitrum One

    // Chainlink ARB/USD price feed addresses
    address public constant SEPOLIA_ARB_USD_FEED = 0xD1092a65338d049DB68D7Be6bD89d17a0929945e;
    address public constant ARBITRUM_ONE_ARB_USD_FEED = 0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6;

    // Chain IDs
    uint256 public constant ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
    uint256 public constant ARBITRUM_ONE_CHAIN_ID = 42161;

    // Staleness threshold (Chainlink ARB/USD heartbeat is ~3600s on Arbitrum)
    uint256 public constant MAX_STALENESS = 3600;

    /**
     * @notice Returns the latest ARB/USD price from the Sepolia testnet Chainlink oracle
     * @return price The latest price with 8 decimals
     */
    function getSepoliaTestnetArbPrice() public view returns (int256 price) {
        require(block.chainid == ARBITRUM_SEPOLIA_CHAIN_ID, "Must be on Arbitrum Sepolia");
        AggregatorV3Interface feed = AggregatorV3Interface(SEPOLIA_ARB_USD_FEED);
        (, price,, uint256 updatedAt,) = feed.latestRoundData();
        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "Stale price data");
    }

    /**
     * @notice Returns the latest ARB/USD price from the Arbitrum One mainnet Chainlink oracle
     * @return price The latest price with 8 decimals
     */
    function getArbitrumOneArbPrice() public view returns (int256 price) {
        require(block.chainid == ARBITRUM_ONE_CHAIN_ID, "Must be on Arbitrum One");
        AggregatorV3Interface feed = AggregatorV3Interface(ARBITRUM_ONE_ARB_USD_FEED);
        (, price,, uint256 updatedAt,) = feed.latestRoundData();
        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "Stale price data");
    }
}
