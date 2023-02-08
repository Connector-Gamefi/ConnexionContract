//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./GameERC721Proxy.sol";
import "./GameERC721Token.sol";

contract GameERC721Factory is Ownable, Pausable {
    /// @notice the number of ERC20 vaults
    uint256 public vaultCount;

    /// @notice the mapping of vault number to vault contract
    mapping(uint256 => address) public vaults;

    /// @notice the TokenVault logic contract
    address public immutable logic;

    event Generate(address nft, uint256 index);

    constructor() {
        logic = address(new GameERC721Token());
    }

    /// @notice the function to mint a new vault
    /// @param _name the desired name of the vault
    /// @param _symbol the desired symbol of the vault
    /// @param _timeLocker the timeLock contract address of the vault
    /// @param _controller the controller address of the vault
    /// @param _signers the signer addresses of the vault
    /// @return _index the index of the vault in vaults
    function generate(
        string memory _name,
        string memory _symbol,
        address _timeLocker,
        address _controller,
        address[] memory _signers
    ) external whenNotPaused returns (uint256 _index) {
        bytes memory _initializationCallData = abi.encodeWithSignature(
            "initialize(string,string,address,address,address,address[])",
            _name,
            _symbol,
            _timeLocker,
            _controller,
            msg.sender,
            _signers
        );

        address vault = address(
            new GameERC721Proxy(logic, _initializationCallData)
        );

        vaults[vaultCount] = vault;
        emit Generate(vault, vaultCount);
        vaultCount++;

        return vaultCount - 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
