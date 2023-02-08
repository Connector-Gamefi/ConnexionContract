// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./GameLoot.sol";

contract GameLootEquipment is GameLoot, Ownable {
    mapping(address => bool) public signers;
    address public treasure;
    address public vault;

    // function control
    address public seller;
    address public gameMinter;

    // Access control
    address public timeLocker;

    mapping(uint256 => bool) public usedNonce;
    mapping(uint256 => bool) public hasRevealed;

    uint256 public totalSupply;

    string private blindBoxURI;
    bytes32 public root;

    event Revealed(uint256 tokenID);

    constructor(
        address revealSVG_,
        string memory name_,
        string memory symbol_,
        address treasure_,
        address vault_,
        address timeLocker_,
        address[] memory _signers,
        uint256 cap_
    ) GameLoot(revealSVG_, name_, symbol_, cap_) {
        treasure = treasure_;
        vault = vault_;
        timeLocker = timeLocker_;
        for (uint256 i; i < _signers.length; i++) signers[_signers[i]] = true;
    }

    receive() external payable {}

    /* ---------------- mint ---------------- */

    function mint(address reciever, uint256 amount) external payable {
        require(
            msg.sender == seller || msg.sender == gameMinter,
            "Permission denied"
        );
        for (uint256 i; i < amount; i++) {
            _safeMint(reciever, totalSupply);
        }
    }

    /* ---------------- reveal ---------------- */

    /// @notice reveal mystery box
    function revealBySign(
        uint256 tokenID_,
        uint256 nonce_,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes memory signature_
    ) public {
        require(msg.sender == ownerOf(tokenID_), "token is not yours");
        require(!usedNonce[nonce_], "nonce is used");
        require(!hasRevealed[tokenID_], "has revealed");
        require(attrIDs_.length == attrValues_.length, "param length error");
        require(
            verify(
                address(this),
                tokenID_,
                nonce_,
                attrIDs_,
                attrValues_,
                signature_
            ),
            "sign is not correct"
        );
        usedNonce[nonce_] = true;
        hasRevealed[tokenID_] = true;

        _attachBatch(tokenID_, attrIDs_, attrValues_);
        emit Revealed(tokenID_);
    }

    /// @notice reveal mystery box
    function revealByMerkle(
        uint256 tokenID_,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes32[] calldata proofs_
    ) public {
        require(msg.sender == ownerOf(tokenID_), "token is not yours");
        require(!hasRevealed[tokenID_], "has revealed");
        require(attrIDs_.length == attrValues_.length, "param length error");
        bytes32 leaf = keccak256(
            abi.encode(tokenID_, attrIDs_, attrValues_)
        );
        require(
            MerkleProof.verify(proofs_, root, leaf),
            "Merkle proof is wrong"
        );
        hasRevealed[tokenID_] = true;

        _attachBatch(tokenID_, attrIDs_, attrValues_);
        emit Revealed(tokenID_);
    }

    function verify(
        address contract_,
        uint256 tokenID_,
        uint256 nonce_,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes memory signature_
    ) internal view returns (bool) {
        return
            signers[
                signatureWallet(
                    contract_,
                    tokenID_,
                    nonce_,
                    attrIDs_,
                    attrValues_,
                    signature_
                )
            ];
    }

    function signatureWallet(
        address contract_,
        uint256 tokenID_,
        uint256 nonce_,
        uint128[] memory attrIDs_,
        uint128[] memory attrValues_,
        bytes memory signature_
    ) internal pure returns (address) {
        bytes32 hash = keccak256(
            abi.encode(contract_, tokenID_, nonce_, attrIDs_, attrValues_)
        );

        return ECDSA.recover(ECDSA.toEthSignedMessageHash(hash), signature_);
    }

    function setBlindBoxURI(string calldata blindBoxURI_) public onlyOwner {
        blindBoxURI = blindBoxURI_;
    }

    function tokenURI(uint256 tokenID)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenID), "this id is not exists");
        if (hasRevealed[tokenID]) {
            return super.tokenURI(tokenID);
        } else {
            return string(abi.encodePacked(blindBoxURI, toString(tokenID)));
        }
    }

    /* ---------------- timelocker ---------------- */

    function setSigner(address signer, bool isOk) public onlyTimelocker {
        signers[signer] = isOk;
    }

    function setSeller(address seller_) public onlyTimelocker {
        seller = seller_;
    }

    function setGameMinter(address gameMinter_) public onlyTimelocker {
        gameMinter = gameMinter_;
    }

    function setReveal(address revealSVG_) public onlyTimelocker {
        revealSVG = revealSVG_;
    }

    function setTreasure(address treasure_) public onlyTimelocker {
        treasure = treasure_;
    }

    modifier onlyTimelocker() {
        require(msg.sender == timeLocker, "not timelocker");
        _;
    }

    function setTimeLocker(address timeLocker_) public onlyTimelocker {
        timeLocker = timeLocker_;
    }

    /* ---------------- attribute operate ---------------- */

    function setRevealed(uint256 tokenID) external {
        require(
            msg.sender == gameMinter || msg.sender == seller,
            "Permission denied"
        );
        hasRevealed[tokenID] = true;
        emit Revealed(tokenID);
    }

    function attach(
        uint256 tokenID_,
        uint128 attrID_,
        uint128 _value
    ) public override onlyAttrController {
        _attach(tokenID_, attrID_, _value);
    }

    function attachBatch(
        uint256 tokenID_,
        uint128[] memory attrIDs_,
        uint128[] memory _values
    ) public override onlyAttrController {
        _attachBatch(tokenID_, attrIDs_, _values);
    }

    function remove(uint256 tokenID_, uint256 attrIndex_)
        public
        override
        onlyAttrController
    {
        _remove(tokenID_, attrIndex_);
    }

    function removeBatch(uint256 tokenID_, uint256[] memory attrIndexes_)
        public
        override
        onlyAttrController
    {
        _removeBatch(tokenID_, attrIndexes_);
    }

    function update(
        uint256 tokenID_,
        uint256 attrIndex_,
        uint128 value_
    ) public override onlyAttrController {
        _update(tokenID_, attrIndex_, value_);
    }

    function updateBatch(
        uint256 tokenID_,
        uint256[] memory attrIndexes_,
        uint128[] memory values_
    ) public override onlyAttrController {
        _updateBatch(tokenID_, attrIndexes_, values_);
    }

    /* ---------------- owner ---------------- */

    function setCap(uint256 cap) public onlyOwner {
        _cap = cap;
    }

    function setVault(address vault_) public onlyOwner {
        vault = vault_;
    }

    function withdraw() public onlyOwner {
        payable(vault).transfer(address(this).balance);
    }

    function setRoot(bytes32 root_) public onlyOwner {
        root = root_;
    }

    /* ---------------- other function ---------------- */

    function exists(uint256 tokenId) public view returns(bool){
        return _exists(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        if (from == address(0)) {
            totalSupply++;
        }
    }

    /* ---------------- modifiers ---------------- */

    modifier onlyAttrController() {
        require(
            msg.sender == treasure ||
                msg.sender == gameMinter ||
                msg.sender == seller,
            "Permission denied"
        );
        _;
    }
}
