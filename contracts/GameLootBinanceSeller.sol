// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IGameLoot.sol";

interface IEquipment {
    function mint(address reciever, uint256 amount) external payable;

    function setRevealed(uint256 tokenID) external;

    function totalSupply() external view returns (uint256);
}

contract GameLootBinanceSeller is Ownable, IERC721Receiver {
    address public equipment;
    IERC721 public binanceNFTFirst;
    IERC721 public binanceNFTSecond;

    bytes32 public rootFirst;
    bytes32 public rootSecond;

    bool public firstSwitch;
    bool public secondSwitch;

    mapping(address => bool) public signers;
    mapping(uint256 => bool) public usedNonce;

    event ClaimFirst(
        address equipment,
        uint256 tokenID,
        uint256 bnTokenID,
        address user
    );
    event ClaimSecond(
        address equipment,
        uint256 tokenID,
        uint256 bnTokenID,
        address user
    );

    constructor(
        address equipment_,
        address binanceNFTFirst_,
        address binanceNFTSecond_,
        address[] memory signers_
    ) {
        equipment = equipment_;
        binanceNFTFirst = IERC721(binanceNFTFirst_);
        binanceNFTSecond = IERC721(binanceNFTSecond_);
        for (uint256 i; i < signers_.length; i++) signers[signers_[i]] = true;
    }

    function OpenBlindBoxFirst(
        uint256 tokenID,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes32[] calldata proofs
    ) public {
        require(firstSwitch, "first batch is not open");
        // merkle verify
        bytes32 leaf = keccak256(abi.encode(tokenID, attrIDs_, attrValues_));
        require(
            MerkleProof.verify(proofs, rootFirst, leaf),
            "Merkle proof is wrong"
        );

        // transferFrom will check tokenID owner.
        binanceNFTFirst.transferFrom(msg.sender, address(this), tokenID);
        require(
            binanceNFTFirst.ownerOf(tokenID) == address(this),
            "blindbox has not been locked"
        );

        // mint
        uint256 tokenID_ = IEquipment(equipment).totalSupply();
        IGameLoot(equipment).attachBatch(tokenID_, attrIDs_, attrValues_);
        IEquipment(equipment).mint(msg.sender, 1);
        IEquipment(equipment).setRevealed(tokenID_);

        emit ClaimFirst(equipment, tokenID_, tokenID, msg.sender);
    }

    function OpenBlindBoxSecondByMerkle(
        uint256 tokenID,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes32[] calldata proofs
    ) public {
        require(secondSwitch, "second batch is not open");
        // merkle verify
        bytes32 leaf = keccak256(abi.encode(tokenID, attrIDs_, attrValues_));
        require(
            MerkleProof.verify(proofs, rootSecond, leaf),
            "Merkle proof is wrong"
        );

        // transferFrom will check tokenID owner.
        binanceNFTSecond.transferFrom(msg.sender, address(this), tokenID);
        require(
            binanceNFTSecond.ownerOf(tokenID) == address(this),
            "blindbox has not been locked"
        );

        // mint
        uint256 tokenID_ = IEquipment(equipment).totalSupply();
        IGameLoot(equipment).attachBatch(tokenID_, attrIDs_, attrValues_);
        IEquipment(equipment).mint(msg.sender, 1);
        IEquipment(equipment).setRevealed(tokenID_);

        emit ClaimSecond(equipment, tokenID_, tokenID, msg.sender);
    }

    function OpenBlindBoxSecondBySign(
        uint256 tokenID,
        uint256 nonce_,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes memory signature_
    ) public {
        require(secondSwitch, "second batch is not open");
        require(!usedNonce[nonce_], "nonce is used");
        require(
            verify(
                address(this),
                tokenID,
                nonce_,
                attrIDs_,
                attrValues_,
                signature_
            ),
            "sign is not correct"
        );
        usedNonce[nonce_] = true;

        // transferFrom will check tokenID owner.
        binanceNFTSecond.transferFrom(msg.sender, address(this), tokenID);
        require(
            binanceNFTSecond.ownerOf(tokenID) == address(this),
            "blindbox has not been locked"
        );

        // mint
        uint256 tokenID_ = IEquipment(equipment).totalSupply();
        IGameLoot(equipment).attachBatch(tokenID_, attrIDs_, attrValues_);
        IEquipment(equipment).mint(msg.sender, 1);
        IEquipment(equipment).setRevealed(tokenID_);

        emit ClaimSecond(equipment, tokenID_, tokenID, msg.sender);
    }

    function verify(
        address contract_,
        uint256 tokenID,
        uint256 nonce_,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes memory signature_
    ) internal view returns (bool) {
        return
            signers[
                signatureWallet(
                    contract_,
                    tokenID,
                    nonce_,
                    attrIDs_,
                    attrValues_,
                    signature_
                )
            ];
    }

    function signatureWallet(
        address contract_,
        uint256 tokenID,
        uint256 nonce_,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes memory signature_
    ) internal pure returns (address) {
        bytes32 hash = keccak256(
            abi.encode(contract_, tokenID, nonce_, attrIDs_, attrValues_)
        );

        return ECDSA.recover(ECDSA.toEthSignedMessageHash(hash), signature_);
    }

    /* ----------- owner ----------- */

    function setRootFirst(bytes32 rootFirst_) public onlyOwner {
        rootFirst = rootFirst_;
    }

    function setRootSecond(bytes32 rootSecond_) public onlyOwner {
        rootSecond = rootSecond_;
    }

    function setEquipment(address equipment_) public onlyOwner {
        equipment = equipment_;
    }

    function turnFristBatch() public onlyOwner {
        firstSwitch = !firstSwitch;
    }

    function turnSecondBatch() public onlyOwner {
        secondSwitch = !secondSwitch;
    }

    function setSigner(address signer, bool isOk) public onlyOwner {
        signers[signer] = isOk;
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) public pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
