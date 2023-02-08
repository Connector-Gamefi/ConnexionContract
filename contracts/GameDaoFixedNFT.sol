// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract GameDaoFixedNFT is
    IERC721ReceiverUpgradeable,
    Initializable,
    OwnableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public TxFeeRatio;
    address public FeeAccount;
    bool public DisableErc721;

    struct Pool {
        // address of pool creator
        address payable creator;
        // address of sell token
        address token0;
        // address of buy token
        address token1;
        // token id of token0
        uint256 tokenId;
        // total amount of token0
        uint256 amountTotal0;
        // total amount of token1
        uint256 amountTotal1;
        // the timestamp in seconds the pool will be closed
        uint256 closeAt;
    }

    Pool[] public pools;

    // pool index => pool password, if password is not set, the default value is zero
    mapping(uint256 => uint256) public passwordP;
    // pool index => a flag that if creator is claimed the pool
    mapping(uint256 => bool) public creatorClaimedP;
    mapping(uint256 => bool) public swappedP;

    // check if token0 in whitelist
    bool public checkToken0;
    // token0 address => true or false
    mapping(address => bool) public token0List;

    // pool index => swapped amount of token0
    mapping(uint256 => uint256) public swappedAmount0P;
    // pool index => swapped amount of token1
    mapping(uint256 => uint256) public swappedAmount1P;

    event Created(Pool pool, uint256 index);
    event Swapped(address sender, uint256 index, uint256 amount0);
    event Claimed(address sender, uint256 index);
    event Closed(address sender, uint256 index);
    event NewPrice(address sender, uint256 index, uint256 price);
    event NewTime(address sender, uint256 index, uint256 timestamp);

    function initialize(address _feeAccount) public initializer {
        __Ownable_init();

        TxFeeRatio = 0.02 ether;
        FeeAccount = _feeAccount;
    }

    function createPool(
        // address of token0
        address token0,
        // address of token1
        address token1,
        // token id of token0
        uint256 tokenId,
        // total amount of token1
        uint256 amountTotal1,
        // duration time
        uint256 duration
    ) external payable {
        require(!DisableErc721, "ERC721 pool is disabled");
        if (checkToken0) {
            require(token0List[token0], "invalid token0");
        }
        uint256 amountTotal0 = 1;
        _create(token0, token1, tokenId, amountTotal0, amountTotal1, duration);
    }

    function _create(
        address token0,
        address token1,
        uint256 tokenId,
        uint256 amountTotal0,
        uint256 amountTotal1,
        uint256 duration
    ) private {
        require(amountTotal1 != 0, "the value of amountTotal1 is zero.");
        require(duration != 0, "the value of duration is zero.");

        // transfer tokenId of token0 to this contract
        IERC721Upgradeable(token0).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // creator pool
        Pool memory pool;
        pool.creator = payable(msg.sender);
        pool.token0 = token0;
        pool.token1 = token1;
        pool.tokenId = tokenId;
        pool.amountTotal0 = amountTotal0;
        pool.amountTotal1 = amountTotal1;
        pool.closeAt = block.timestamp + duration;

        uint256 index = pools.length;

        pools.push(pool);

        emit Created(pool, index);
    }

    function swap(uint256 index)
        external
        payable
        isPoolExist(index)
        isPoolNotClosed(index)
        isPoolNotSwap(index)
    {
        Pool storage pool = pools[index];

        // mark pool is swapped
        swappedP[index] = true;

        uint256 txFee = (pool.amountTotal1 * TxFeeRatio) / (1 ether);
        uint256 _actualAmount1 = pool.amountTotal1 - txFee;
        // transfer amount of token1 to creator
        if (pool.token1 == address(0)) {
            require(pool.amountTotal1 <= msg.value, "invalid ETH amount");

            if (_actualAmount1 > 0) {
                // transfer ETH to creator
                pool.creator.transfer(_actualAmount1);
            }
            if (txFee > 0) {
                // transaction fee to fee account
                payable(FeeAccount).transfer(txFee);
            }
        } else {
            IERC20Upgradeable(pool.token1).safeTransferFrom(
                msg.sender,
                address(this),
                pool.amountTotal1
            );
            // transfer token1 to creator
            IERC20Upgradeable(pool.token1).safeTransfer(
                pool.creator,
                _actualAmount1
            );
            IERC20Upgradeable(pool.token1).safeTransfer(FeeAccount, txFee);
        }

        // transfer tokenId of token0 to sender
        IERC721Upgradeable(pool.token0).safeTransferFrom(
            address(this),
            msg.sender,
            pool.tokenId
        );

        emit Swapped(msg.sender, index, pool.amountTotal0);
    }

    function close(uint256 index)
        external
        isPoolExist(index)
        isPoolNotClosed(index)
        isPoolNotSwap(index)
    {
        require(isCreator(msg.sender, index), "is not creator");
        pools[index].closeAt = block.timestamp - 1;

        Pool memory pool = pools[index];
        IERC721Upgradeable(pool.token0).safeTransferFrom(
            address(this),
            pool.creator,
            pool.tokenId
        );
        emit Closed(msg.sender, index);
    }

    function creatorRedeem(uint256 index)
        external
        isPoolExist(index)
        isPoolClosed(index)
        isPoolNotSwap(index)
    {
        require(isCreator(msg.sender, index), "sender is not pool creator");
        require(!creatorClaimedP[index], "creator has claimed this pool");
        creatorClaimedP[index] = true;

        Pool memory pool = pools[index];
        IERC721Upgradeable(pool.token0).safeTransferFrom(
            address(this),
            pool.creator,
            pool.tokenId
        );

        emit Claimed(msg.sender, index);
    }

    function setNewTime(uint256 index, uint256 timeStamp)
        external
        isPoolNotSwap(index)
    {
        require(isCreator(msg.sender, index), "is not creator");
        require(timeStamp > block.timestamp, "time is invalid");
        pools[index].closeAt = timeStamp;
        emit NewTime(msg.sender, index, timeStamp);
    }

    function setNewPrice(uint256 index, uint256 price)
        external
        isPoolNotClosed(index)
        isPoolNotSwap(index)
    {
        require(isCreator(msg.sender, index), "is not creator");
        pools[index].amountTotal1 = price;
        emit NewPrice(msg.sender, index, price);
    }

    function triggerToken0Check() external onlyOwner {
        checkToken0 = !checkToken0;
    }

    function triggerToken0(address token) external onlyOwner {
        token0List[token] = !(token0List[token]);
    }

    function triggerDisableErc721() external onlyOwner {
        DisableErc721 = !DisableErc721;
    }

    function isCreator(address target, uint256 index)
        internal
        view
        returns (bool)
    {
        if (pools[index].creator == target) {
            return true;
        }
        return false;
    }

    function getPoolCount() external view returns (uint256) {
        return pools.length;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    modifier isPoolClosed(uint256 index) {
        require(
            pools[index].closeAt <= block.timestamp,
            "this pool is not closed"
        );
        _;
    }

    modifier isPoolNotClosed(uint256 index) {
        require(pools[index].closeAt > block.timestamp, "this pool is closed");
        _;
    }

    modifier isPoolNotSwap(uint256 index) {
        require(!swappedP[index], "this pool is swapped");
        _;
    }

    modifier isPoolExist(uint256 index) {
        require(index < pools.length, "this pool does not exist");
        _;
    }
}
