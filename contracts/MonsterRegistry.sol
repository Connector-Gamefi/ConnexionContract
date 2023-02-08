// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "./Struct.sol";
import "./Base64.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MonsterRegistry is Ownable {
    //  attribute id => attribute name
    mapping(uint256 => string) public attrMetadata;

    constructor() {}

    function fill(AttrMetadataStruct[] memory metadata) external onlyOwner {
        for (uint256 i; i < metadata.length; i++) {
            attrMetadata[metadata[i].attrID] = metadata[i].name;
        }
    }

    function update(uint256 attrID, string memory name) external onlyOwner {
        attrMetadata[attrID] = name;
    }

    function attributesName(AttributeData[] memory attrData)
        external
        view
        returns (AttrMetadataStruct[] memory)
    {
        AttrMetadataStruct[] memory metadata = new AttrMetadataStruct[](attrData.length);
        for (uint i = 0; i < attrData.length; i++) {
            metadata[i] = AttrMetadataStruct({
                    attrID: attrData[i].attrID,
                    name: attrMetadata[attrData[i].attrID]
                });
        }
        return metadata;
    }
}
