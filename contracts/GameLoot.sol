// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./IGameLoot.sol";
import "./Base64.sol";
import "./Struct.sol";

interface IReveal {
    function genSVG(AttributeData[] memory attrData)
        external
        pure
        returns (string memory);
}

interface IRegistry {
    function attributesName (AttributeData[] memory attrData)
        external
        pure
        returns (AttrMetadataStruct[] memory);
}

abstract contract GameLoot is ERC721, IGameLoot {
    address public revealSVG;
    // tokenID => attribute data
    mapping(uint256 => AttributeData[]) internal _attrData;

    uint256 internal _cap;

    event AttributeAttached(uint256 tokenID, uint128 attrID, uint128 value);
    event AttributeAttachedBatch(
        uint256 tokenID,
        uint128[] attrIDs,
        uint128[] values
    );
    event AttributeUpdated(uint256 tokenID, uint256 attrIndex, uint128 value);
    event AttributeUpdatedBatch(
        uint256 tokenID,
        uint256[] attrIndexes,
        uint128[] values
    );
    event AttributeRemoved(uint256 tokenID, uint128 attrID);
    event AttributeRemoveBatch(uint256 tokenID, uint128[] attrIDs);

    constructor(
        address revealSVG_,
        string memory name_,
        string memory symbol_,
        uint256 cap_
    ) ERC721(name_, symbol_) {
        _cap = cap_;
        revealSVG = revealSVG_;
    }

    function attributes(uint256 _tokenID)
        public
        view
        virtual
        returns (AttributeData[] memory)
    {
        return _attrData[_tokenID];
    }

    function _attach(
        uint256 tokenID,
        uint128 attrID,
        uint128 value
    ) internal virtual {
        require(
            _attrData[tokenID].length + 1 <= _cap,
            "GameLoot: too many attributes"
        );
        _attrData[tokenID].push(AttributeData(attrID, value));
        emit AttributeAttached(tokenID, attrID, value);
    }

    function _attachBatch(
        uint256 tokenID,
        uint128[] memory attrIDs,
        uint128[] memory values
    ) internal virtual {
        require(
            _attrData[tokenID].length + attrIDs.length <= _cap,
            "GameLoot: too many attributes"
        );
        for (uint256 i; i < attrIDs.length; i++) {
            _attrData[tokenID].push(AttributeData(attrIDs[i], values[i]));
        }
        emit AttributeAttachedBatch(tokenID, attrIDs, values);
    }

    function _update(
        uint256 tokenID,
        uint256 attrIndex,
        uint128 value
    ) internal virtual {
        _attrData[tokenID][attrIndex].attrValue = value;
        emit AttributeUpdated(tokenID, attrIndex, value);
    }

    function _updateBatch(
        uint256 tokenID,
        uint256[] memory attrIndexes,
        uint128[] memory values
    ) internal virtual {
        for (uint256 i; i < attrIndexes.length; i++) {
            _attrData[tokenID][attrIndexes[i]].attrValue = values[i];
        }
        emit AttributeUpdatedBatch(tokenID, attrIndexes, values);
    }

    function _remove(uint256 tokenID, uint256 attrIndex) internal virtual {
        uint128 id = _attrData[tokenID][attrIndex].attrID;
        _attrData[tokenID][attrIndex] = _attrData[tokenID][
            _attrData[tokenID].length - 1
        ];
        _attrData[tokenID].pop();
        emit AttributeRemoved(tokenID, id);
    }

    function _removeBatch(uint256 tokenID, uint256[] memory attrIndexes)
        internal
        virtual
    {
        uint128[] memory ids = new uint128[](attrIndexes.length);
        for (uint256 i; i < attrIndexes.length; i++) {
            ids[i] = _attrData[tokenID][attrIndexes[i]].attrID;
            _attrData[tokenID][attrIndexes[i]] = _attrData[tokenID][
                _attrData[tokenID].length - 1
            ];
            _attrData[tokenID].pop();
        }
        emit AttributeRemoveBatch(tokenID, ids);
    }

    function getCap() public view returns (uint256) {
        return _cap;
    }

    function tokenURI(uint256 tokenID)
        public
        view
        virtual
        override
        returns (string memory)
    {
        return IReveal(revealSVG).genSVG(_attrData[tokenID]);
    }

    function attributesName(uint256 tokenID, address registry)
        public
        view
        returns (AttrMetadataStruct[] memory)
    {
        return IRegistry(registry).attributesName(_attrData[tokenID]);
    }

    function decimals() public pure returns (uint8) {
        return 8;
    }

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
