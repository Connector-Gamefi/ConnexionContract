// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

struct Right {
    uint256 amount;
    // unlocks per second
    uint256 speed;
    uint256 lastTime;
}

contract Investor {
    using SafeERC20 for IERC20;

    address immutable public token;
    uint256 public startTime;
    address public owner;

    // investor right
    mapping(address => Right) public rights;

    constructor(
        address[] memory investors,
        uint256[] memory amounts,
        uint256 period,
        address token_
    ) {
        owner = msg.sender;
        startTime = block.timestamp;
        token = token_;
        for (uint256 i = 0; i < investors.length; i++) {
            uint256 speed = amounts[i] / period;
            rights[investors[i]] = Right({
                amount: amounts[i],
                speed: speed,
                lastTime: 0
            });
        }
        IERC20(token_).approve(address(this),type(uint256).max);
    }

    // unlock
    function unlock() public {
        // time
        uint t;
        if (rights[msg.sender].lastTime == 0) {
            t = block.timestamp - startTime;
        } else {
            t = block.timestamp - rights[msg.sender].lastTime;
        }
        rights[msg.sender].lastTime = block.timestamp;

        // amount
        uint amount = t * rights[msg.sender].speed;
        if (amount > rights[msg.sender].amount)
            amount = rights[msg.sender].amount;
        rights[msg.sender].amount -= amount;

        IERC20(token).safeTransferFrom(address(this), msg.sender, amount);
    }

    function setRight(
        address investor,
        uint256 amount_,
        uint256 period_
    ) public onlyOwner {
        if (rights[investor].amount == 0) {
            uint256 speed = amount_ / period_;
            rights[investor] = Right({
                amount: amount_,
                speed: speed,
                lastTime: block.timestamp
            });
        }
    }

    function transferOwnership(address pendingOwner) public onlyOwner {
        owner = pendingOwner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }
}
