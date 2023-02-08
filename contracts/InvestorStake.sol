// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "./Struct.sol";

contract InvestorStake is Ownable, ERC1155Receiver {
    address public ticket;
    uint256 public ticketID;

    struct UserInfo {
        uint256 amount; // How many ticket tokens the user has provided.
        uint256 rewardDebt;
    }

    struct PoolInfo {
        IERC1155 ticket; // Address of ticket token contract.
        uint256 ticketID; // 1155 tokenID.
        uint256 allocPoint; // How many allocation points assigned to this pool.
        uint256 lastRewardBlock; // Last block number that rewards distribution occurs.
        uint256 rewardPerShare; // Accumulated rewards per share, times 1e12. See below.
    }

    // gameToken created per block.
    uint256 public gameTokenPerBlock;
    // gameToken
    IGameERC20Token public gameToken;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when gameToken mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    constructor(
        IGameERC20Token _gameToken,
        uint256 _gameTokenPerBlock,
        uint256 _startBlock
    ) {
        gameToken = _gameToken;
        gameTokenPerBlock = _gameTokenPerBlock;
        startBlock = _startBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(
        uint256 _allocPoint,
        IERC1155 _ticket,
        uint256 _ticketID,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;
        // cumulative weight
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(
            PoolInfo({
                ticket: _ticket,
                ticketID: _ticketID,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                rewardPerShare: 0
            })
        );
    }

    // Update the given pool's SUSHI allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint =
            totalAllocPoint -
            poolInfo[_pid].allocPoint +
            _allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // View function to see pending gameTokens on frontend.
    function pendingSushi(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 rewardPerShare = pool.rewardPerShare;
        uint256 ticketSupply = pool.ticket.balanceOf(
            address(this),
            pool.ticketID
        );
        if (block.number > pool.lastRewardBlock && ticketSupply != 0) {
            uint256 blockNum = block.number - pool.lastRewardBlock;
            uint256 gameTokenReward = (blockNum *
                gameTokenPerBlock *
                pool.allocPoint) / totalAllocPoint;
            rewardPerShare =
                rewardPerShare +
                (gameTokenReward * 1e12) /
                ticketSupply;
        }
        return (user.amount * rewardPerShare) / 1e12 - user.rewardDebt;
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 ticketSupply = pool.ticket.balanceOf(
            address(this),
            pool.ticketID
        );
        if (ticketSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 blockNum = block.number - pool.lastRewardBlock;
        uint256 gameTokenReward = (blockNum *
            gameTokenPerBlock *
            pool.allocPoint) / totalAllocPoint;
        gameToken.mint(address(this), gameTokenReward);
        pool.rewardPerShare =
            pool.rewardPerShare +
            (gameTokenReward * 1e12) /
            ticketSupply;
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for SUSHI allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.rewardPerShare) /
                1e12 -
                user.rewardDebt;
            safeGameTokenTransfer(msg.sender, pending);
        }
        // approve first
        pool.ticket.safeTransferFrom(
            address(msg.sender),
            address(this),
            pool.ticketID,
            _amount,
            "0x0"
        );
        user.amount = user.amount + _amount;
        user.rewardDebt = (user.amount * pool.rewardPerShare) / 1e12;
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = (user.amount * pool.rewardPerShare) /
            1e12 -
            user.rewardDebt;
        safeGameTokenTransfer(msg.sender, pending);
        user.amount = user.amount - _amount;
        user.rewardDebt = (user.amount * pool.rewardPerShare) / 1e12;
        // unlock ticket
        pool.ticket.safeTransferFrom(
            address(this),
            address(msg.sender),
            pool.ticketID,
            _amount,
            "0x0"
        );
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.ticket.safeTransferFrom(
            address(this),
            address(msg.sender),
            pool.ticketID,
            user.amount,
            "0x0"
        );
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe sushi transfer function, just in case if rounding error causes pool to not have enough SUSHIs.
    function safeGameTokenTransfer(address _to, uint256 _amount) internal {
        uint256 bal = gameToken.balanceOf(address(this));
        if (_amount > bal) {
            gameToken.transfer(_to, bal);
        } else {
            gameToken.transfer(_to, _amount);
        }
    }

    function onERC1155Received(
        address _operator,
        address _from,
        uint256 _id,
        uint256 _value,
        bytes calldata _data
    ) external pure override returns (bytes4) {
        return
            bytes4(
                keccak256(
                    "onERC1155Received(address,address,uint256,uint256,bytes)"
                )
            );
    }

    function onERC1155BatchReceived(
        address _operator,
        address _from,
        uint256[] calldata _ids,
        uint256[] calldata _values,
        bytes calldata _data
    ) external pure override returns (bytes4) {
        return
            bytes4(
                keccak256(
                    "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"
                )
            );
    }
}
