// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HourToken.sol";

contract SeriesFactory {
    address public immutable escrow;

    struct SeriesInfo {
        bytes32 gpuClass;
        address token;
        uint64 windowStart;
        uint64 windowEnd;
        string symbol;
    }

    SeriesInfo[] public allSeries;

    event SeriesCreated(
        uint256 indexed seriesId,
        bytes32 indexed gpuClass,
        address token,
        uint64 windowStart,
        uint64 windowEnd,
        string symbol
    );

    constructor(address _escrow) {
        escrow = _escrow;
    }

    function createSeries(
        bytes32 gpuClass,
        string calldata symbol,
        uint64 windowStart,
        uint64 windowEnd
    ) external returns (uint256 seriesId, address token) {
        require(windowEnd > windowStart, "Invalid window");
        
        HourToken newToken = new HourToken(symbol, escrow);
        token = address(newToken);

        seriesId = allSeries.length;
        allSeries.push(SeriesInfo({
            gpuClass: gpuClass,
            token: token,
            windowStart: windowStart,
            windowEnd: windowEnd,
            symbol: symbol
        }));

        emit SeriesCreated(seriesId, gpuClass, token, windowStart, windowEnd, symbol);
    }

    function series(uint256 seriesId) external view returns (
        bytes32 gpuClass,
        address token,
        uint64 windowStart,
        uint64 windowEnd,
        string memory symbol
    ) {
        require(seriesId < allSeries.length, "Invalid seriesId");
        SeriesInfo storage s = allSeries[seriesId];
        return (s.gpuClass, s.token, s.windowStart, s.windowEnd, s.symbol);
    }

    function seriesCount() external view returns (uint256) {
        return allSeries.length;
    }
}
