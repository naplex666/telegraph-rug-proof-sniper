// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Base.sol";

/// @notice HONEYPOT 1 — sell-blocked. Anyone can buy (receive tokens), but only
/// the owner can sell (transfer TO the pair). Everyone else's sell reverts.
/// The `pair` address is a stand-in for the DEX pair, set at deploy time.
contract HoneySellBlocked is ERC20Base {
    address public owner;
    address public pair;

    constructor(address _pair) ERC20Base("HoneyTrap Blocked", "HTRAP", 1_000_000 * 1e18) {
        owner = msg.sender;
        pair = _pair;
    }

    function _transfer(address from, address to, uint256 value) internal override {
        if (to == pair && from != owner) {
            revert("Sell blocked: only owner can sell");
        }
        super._transfer(from, to, value);
    }
}
