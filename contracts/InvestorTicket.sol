// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InvestorTicket is IERC1155MetadataURI, ERC1155Supply, Ownable {
    using Strings for uint256;

    constructor(string memory uri_) ERC1155(uri_) {}

    function setUri(string calldata uri_) external onlyOwner {
        _setURI(uri_);
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount
    ) public onlyOwner {
        _mint(to, id, amount, "0x00");
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) public onlyOwner {
        _mintBatch(to, ids, amounts, "0x00");
    }

    function uri(uint256 id)
        public
        view
        override(ERC1155, IERC1155MetadataURI)
        returns (string memory)
    {
        require(exists(id), "ERC1155Metadata: URI query for nonexistent token");

        string memory baseURI_ = super.uri(id);
        return string(abi.encodePacked(baseURI_, id.toString()));
    }
}
