// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Base.sol";

/// @notice HONEYPOT 4 — hidden mint. The owner can mint unlimited new tokens
/// to themselves at any time, diluting every holder to zero. No cap, no timelock.
contract HoneyHiddenMint is ERC20Base {
    address public owner;

    constructor() ERC20Base("HoneyTrap Mint", "HMINT", 1_000_000 * 1e18) {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "only owner");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
