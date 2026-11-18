// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Base.sol";

/// @notice CLEAN 1 — plain ERC20. Fixed supply, no owner, no mint, no tax,
/// no blacklist, no transfer restrictions of any kind.
contract CleanA is ERC20Base {
    constructor() ERC20Base("Clean Token Alpha", "CLEAN-A", 1_000_000 * 1e18) {}
}
