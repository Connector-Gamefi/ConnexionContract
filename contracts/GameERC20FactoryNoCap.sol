//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./GameERC20Proxy.sol";
import "./GameERC20NoCapToken.sol";

contract GameERC20FactoryNoCap is Ownable, Pausable {
    /// @notice the number of ERC20 vaults
    uint256 public vaultCount;

    /// @notice the mapping of vault number to vault contract
    mapping(uint256 => address) public vaults;

    /// @notice the TokenVault logic contract
    address public immutable logic;

    constructor() {
        logic = address(new GameERC20NoCapToken());
    }

    /// @notice the function to mint a new vault
    /// @param _name the desired name of the vault
    /// @param _symbol the desired symbol of the vault
    /// @return _index the index of the vault in vaults
    function generate(
        string memory _name,
        string memory _symbol
    ) external whenNotPaused returns (uint256 _index) {
        bytes memory _initializationCallData =
        abi.encodeWithSignature(
            "initialize(string,string,address)",
            _name,
            _symbol,
            msg.sender
        );

        address vault = address(
            new GameErc20Proxy(
                logic,
                _initializationCallData
            )
        );

        vaults[vaultCount] = vault;
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
