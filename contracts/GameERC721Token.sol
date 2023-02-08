//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

contract GameERC721Token is ERC721Upgradeable, PausableUpgradeable {
    address public owner;
    uint256 public totalSupply;

    mapping(address => bool) public signers;
    mapping(uint256 => bool) public usedNonce;
    // tokenID => eqID
    mapping(uint256 => uint256) public eqIDs;
    mapping(uint256 => bool) public eqExist;

    address public timeLocker;
    address public controller;

    string internal baseURI;

    event GameMint(address user, uint256 tokenID, uint256 eqID, uint256 nonce);
   
    constructor() {}

    function initialize(
        string memory name_,
        string memory symbol_,
        address timeLocker_,
        address controller_,
        address owner_,
        address[] memory signers_
    ) external initializer {
        // initialize inherited contracts
        __ERC721_init(name_, symbol_);
        timeLocker = timeLocker_;
        controller = controller_;
        owner = owner_;
        for (uint256 i; i < signers_.length; i++) signers[signers_[i]] = true;
    }

    /// @notice User mint an nft from game
    function gameMint(
        uint256 nonce_,
        uint256 eqID_,
        bytes memory signature_
    ) public whenNotPaused {
        require(!usedNonce[nonce_], "nonce is used");
        require(!eqExist[eqID_], "this eqID is already exists");
        require(
            verify(msg.sender, address(this), eqID_, nonce_, signature_),
            "sign is not correct"
        );
        usedNonce[nonce_] = true;

        eqIDs[totalSupply] = eqID_;
        eqExist[eqID_] = true;

        uint256 tokenID = totalSupply;
        _mint(msg.sender, tokenID);
        emit GameMint(msg.sender, tokenID, eqID_, nonce_);
    }

    function verify(
        address wallet_,
        address contract_,
        uint256 eqID_,
        uint256 nonce_,
        bytes memory signature_
    ) internal view returns (bool) {
        return
            signers[
                signatureWallet(wallet_, contract_, eqID_, nonce_, signature_)
            ];
    }

    function signatureWallet(
        address wallet_,
        address contract_,
        uint256 eqID_,
        uint256 nonce_,
        bytes memory signature_
    ) internal pure returns (address) {
        bytes32 hash = keccak256(abi.encode(wallet_, contract_, eqID_, nonce_));

        return
            ECDSAUpgradeable.recover(
                ECDSAUpgradeable.toEthSignedMessageHash(hash),
                signature_
            );
    }

    function transferOwnership(address newOwner) public onlyOwner {
        owner = newOwner;
    }

    /* ---------------- controller ---------------- */

    function pause() public onlyController {
        _pause();
    }

    function unpause() public onlyController {
        _unpause();
    }

    function transferController(address newController) public onlyOwner {
        controller = newController;
    }

    modifier onlyController() {
        require(msg.sender == controller, "Permission denied");
        _;
    }

    /* ---------------- timelocker ---------------- */

    function setSigner(address signer, bool isOk) public onlyTimelocker {
        signers[signer] = isOk;
    }

    function setTimeLocker(address timeLocker_) public onlyTimelocker {
        timeLocker = timeLocker_;
    }

    modifier onlyTimelocker() {
        require(msg.sender == timeLocker, "not timelocker");
        _;
    }

    /* ---------------- reveal ---------------- */
    
    function setBaseURI(string calldata baseURI_) public onlyOwner {
        baseURI = baseURI_;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
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

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }
}
