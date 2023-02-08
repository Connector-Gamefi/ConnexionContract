// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0; 

interface IGameLootTicket {
    function eqMint(
        address _to,
        uint256 _tokenID,
        uint256 _amount
    ) external;
}