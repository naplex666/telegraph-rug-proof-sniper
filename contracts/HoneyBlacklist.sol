// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Base.sol";

/// @notice HONEYPOT 3 — owner blacklist. The owner can blacklist any address
/// at any time; blacklisted addresses cannot send or receive. In a real rug
/// the deployer blacklists sellers right after they buy.
contract HoneyBlacklist is ERC20Base {
    address public owner;
    mapping(address => bool) public blacklisted;

    constructor() ERC20Base("HoneyTrap Blacklist", "HBLK", 1_000_000 * 1e18) {
        owner = msg.sender;
    }

    function setBlacklisted(address user, bool flag) external {
        require(msg.sender == owner, "only owner");
        blacklisted[user] = flag;
    }

    function _transfer(address from, address to, uint256 value) internal override {
        require(!blacklisted[from] && !blacklisted[to], "blacklisted");
        super._transfer(from, to, value);
    }
}
