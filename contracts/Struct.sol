// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

struct AttributeData {
    uint128 attrID;
    uint128 attrValue;
}

struct AttrMetadataStruct {
    uint256 attrID;
    string name;
}

interface IGameERC20Token {
    function mint(address account, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}