// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IEquipment {
    function mint(address reciever, uint256 amount) external payable;
}

contract GameLootSeller is Ownable {
    IEquipment public equipment;

    // Access control
    address public timeLocker;

    mapping(address => bool) public signers;

    uint128 public maxPresale;
    uint128 public maxSupply;
    uint128 public saleAmount;
    uint128 public price;
    uint128 public pubPer;
    uint128 public prePer;
    bool public publicStart;
    bool public presaleStart;
    mapping(address => uint256) public hasMinted;
    mapping(address => uint256) public hasPresale;

    mapping(uint256 => bool) public usedNonce;

    constructor(
        address equipment_,
        address timeLocker_,
        uint128 maxSupply_,
        uint128 price_,
        address[] memory signers_
    ) {
        equipment = IEquipment(equipment_);
        timeLocker = timeLocker_;
        maxSupply = maxSupply_;
        price = price_;
        for (uint256 i; i < signers_.length; i++) signers[signers_[i]] = true;
    }

    /* ---------------- sale ---------------- */

    /// @notice public mint
    function pubSale(uint256 amount_) public payable {
        require(publicStart, "public mint is not start");
        require(tx.origin == msg.sender, "forbidden tx");
        require(hasMinted[msg.sender] + amount_ <= pubPer, "exceed");
        require(msg.value >= price * amount_, "tx value is not correct");
        if (saleAmount + amount_ > maxSupply)
            amount_ = uint128(maxSupply - saleAmount);

        hasMinted[msg.sender] += amount_;
        saleAmount += uint128(amount_);

        equipment.mint{value: msg.value}(msg.sender, amount_);
    }

    /// @notice presale
    /// @dev Need to sign
    function preSale(
        uint128 amount_,
        uint256 nonce_,
        bytes memory signature_
    ) public payable {
        require(presaleStart, "presale is not start");
        require(hasPresale[msg.sender] + amount_ <= prePer, "exceed");
        require(msg.value >= price * amount_, "tx value is not correct");
        require(saleAmount <= maxPresale, "presale out");
        require(!usedNonce[nonce_], "nonce is used");
        require(
            verify(msg.sender, address(this), nonce_, signature_),
            "sign is not correct"
        );
        if (saleAmount + amount_ > maxPresale)
            amount_ = uint128(maxPresale - saleAmount);

        usedNonce[nonce_] = true;
        saleAmount += uint128(amount_);

        hasPresale[msg.sender] += amount_;

        equipment.mint{value: msg.value}(msg.sender, amount_);
    }

    function verify(
        address wallet_,
        address contract_,
        uint256 nonce_,
        bytes memory signature_
    ) internal view returns (bool) {
        return signers[signatureWallet(wallet_, contract_, nonce_, signature_)];
    }

    function signatureWallet(
        address wallet_,
        address contract_,
        uint256 nonce_,
        bytes memory signature_
    ) internal pure returns (address) {
        bytes32 hash = keccak256(abi.encode(wallet_, contract_, nonce_));
        return ECDSA.recover(ECDSA.toEthSignedMessageHash(hash), signature_);
    }

    /* ---------------- timelocker ---------------- */

    function setSigner(address signer, bool isOk) public onlyTimelocker {
        signers[signer] = isOk;
    }

    function setPrice(uint128 price_) public onlyTimelocker {
        price = price_;
    }

    function setMaxSupply(uint128 maxSupply_) public onlyTimelocker {
        require(maxPresale <= maxSupply_, "maxSupply is too small");
        maxSupply = maxSupply_;
    }

    function setTimeLocker(address timeLocker_) public onlyTimelocker {
        timeLocker = timeLocker_;
    }

    modifier onlyTimelocker() {
        require(msg.sender == timeLocker, "is not timelocker");
        _;
    }

    /* ---------------- other setting ---------------- */

    function openPresale() public onlyOwner {
        presaleStart = true;
    }

    function closePresale() public onlyOwner {
        presaleStart = false;
    }

    function openPublicSale() public onlyOwner {
        publicStart = true;
    }

    function closePublicSale() public onlyOwner {
        publicStart = false;
    }

    function setMaxPresale(uint128 maxPresale_) public onlyOwner {
        require(maxPresale_ <= maxSupply, "presale amount exceed");
        maxPresale = maxPresale_;
    }

    function setPubPer(uint128 pubPer_) public onlyOwner {
        pubPer = pubPer_;
    }

    function setPrePer(uint128 prePer_) public onlyOwner {
        prePer = prePer_;
    }
}
