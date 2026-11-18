// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Base.sol";

/// @notice CLEAN 2 — plain ERC20, different name/supply. Fixed supply, no
/// owner, no mint, no tax, no blacklist, no transfer restrictions.
contract CleanB is ERC20Base {
    constructor() ERC20Base("Clean Token Beta", "CLEAN-B", 10_000_000 * 1e18) {}
}
