const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const { assert } = require('./common');
const deployer = require('../../utils/deploy');
const tokenABI = require('../../artifacts/contracts/GameERC20Token.sol/GameERC20Token.json').abi;
const { currentTime, toUnit, fastForward } = require('../utils')();

describe("GameDaoFixedNFT", async function () {
    let factory, token20, testNFT, market;

    let owner, fee, user1, user2;

    // constructor params
    const name = "Archloot";
    const symbol = "ALT";
    const cap = toWei(toBN(100000000), 'ether');
    const addressZero = '0x0000000000000000000000000000000000000000';
    const DAY = 86400;

    const price = toWei(toBN(1), 'ether').toString();
    const duration = DAY * 2;
    const tokenID = 0;
    beforeEach(async function () {
        [owner, fee, user1, user2] = await hre.ethers.getSigners();

        //  factory
        factory = await deployer.deployERC20Factory();

        //  token
        await factory.connect(owner).generate(name, symbol, cap.toString());
        const tokenAddress = await factory.vaults(0);
        token20 = new hre.ethers.Contract(tokenAddress, tokenABI, owner);

        // test NFT
        testNFT = await deployer.deployTestNFT(name, symbol);
        // market
        market = await deployer.deployFixedPriceNFT(fee.address);
    });

    it('constructor state', async () => {
        assert.equal(await market.owner(), owner.address);
        assert.equal(await market.FeeAccount(), fee.address);
        assert.equal((await market.TxFeeRatio()).toString(), toWei('0.02', 'ether').toString());
    })

    // ============== owner setting ==============
    it('triggerToken0Check test', async () => {
        await assert.revert(
            market.connect(user1).triggerToken0Check(),
            "Ownable: caller is not the owner"
        );

        await market.connect(owner).triggerToken0Check();
        assert.equal(await market.checkToken0(), true);
    })
    it('triggerToken0 test', async () => {
        await assert.revert(
            market.connect(user1).triggerToken0(testNFT.address),
            "Ownable: caller is not the owner"
        );

        await market.connect(owner).triggerToken0(testNFT.address);
        assert.equal(await market.token0List(testNFT.address), true);
    })
    it('triggerDisableErc721 test', async () => {
        await assert.revert(
            market.connect(user1).triggerDisableErc721(),
            "Ownable: caller is not the owner"
        );

        await market.connect(owner).triggerDisableErc721();
        assert.equal(await market.DisableErc721(), true);
    })
    it('transferOwnership test', async () => {
        await assert.revert(
            market.connect(user1).transferOwnership(user1.address),
            "Ownable: caller is not the owner"
        );

        await market.connect(owner).transferOwnership(user1.address);
        assert.equal(await market.owner(), user1.address);
    })

    // ============== createPool ==============
    it('createPool test', async () => {
        // mint NFT
        await testNFT.mint(0, 1, user1.address);

        // 测试 DisableErc721开关
        await market.connect(owner).triggerDisableErc721();
        await assert.revert(
            market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration),
            "ERC721 pool is disabled"
        );
        await market.connect(owner).triggerDisableErc721();

        // 测试 token0List
        await market.connect(owner).triggerToken0Check();
        await assert.revert(
            market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration),
            "invalid token0"
        );
        await market.connect(owner).triggerToken0(testNFT.address);

        // 测试 amountTotal1
        await assert.revert(
            market.connect(user1).createPool(testNFT.address, addressZero, tokenID, 0, duration),
            "the value of amountTotal1 is zero."
        );

        // 测试 duration
        await assert.revert(
            market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, 0),
            "the value of duration is zero."
        );

        await testNFT.connect(user1).setApprovalForAll(market.address, true);
        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration);

        assert.equal(await testNFT.ownerOf(tokenID), market.address);
        assert.equal(await market.getPoolCount(), 1);
    })

    // ============== creatorRedeem ==============
    it('creatorRedeem test', async () => {
        // mint NFT
        await testNFT.mint(0, 5, user1.address);
        await testNFT.connect(user1).setApprovalForAll(market.address, true);

        const index = 0;
        await assert.revert(
            market.connect(user1).creatorRedeem(index),
            "this pool does not exist"
        );

        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration);

        // 测试关闭状态，关闭后才可以赎回
        await assert.revert(
            market.connect(user1).creatorRedeem(index),
            "this pool is not closed"
        );
        await fastForward(DAY * 2);

        // 只有pool的创建者才可以赎回
        await assert.revert(
            market.connect(user2).creatorRedeem(index),
            "sender is not pool creator"
        );

        await market.connect(user1).creatorRedeem(index);

        // 一个pool将不可以赎回两次
        await assert.revert(
            market.connect(user1).creatorRedeem(index),
            "creator has claimed this pool"
        );
        assert.equal(await testNFT.ownerOf(tokenID), user1.address);
    })

    // ============== close ==============
    it('close test', async () => {
        // mint NFT
        await testNFT.mint(0, 5, user1.address);
        await testNFT.connect(user1).setApprovalForAll(market.address, true);

        // pool必须存在
        const index = 0;
        await assert.revert(
            market.connect(user1).close(index),
            "this pool does not exist"
        );

        // Pool不能关闭
        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration);
        await fastForward(DAY * 2);
        await assert.revert(
            market.connect(user1).close(index),
            "this pool is closed"
        );

        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID + 1, price, duration);
        // 池子的创建者才可以close
        await assert.revert(
            market.connect(user2).close(index + 1),
            "is not creator"
        );

        await market.connect(user1).close(index + 1);

        assert.equal(await testNFT.ownerOf(tokenID + 1), user1.address);
    })

    // ============== setNewTime ==============
    it('setNewTime test', async () => {
        // mint NFT
        await testNFT.mint(0, 5, user1.address);
        await testNFT.connect(user1).setApprovalForAll(market.address, true);
        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration);

        const nowTime = await currentTime();
        const timestamp = nowTime + DAY;
        const index = 0;
        // 池子的创建者才可以setNewTime
        await assert.revert(
            market.connect(user2).setNewTime(index, timestamp),
            "is not creator"
        );

        await assert.revert(
            market.connect(user1).setNewTime(index, timestamp - DAY - 1),
            "time is invalid"
        );

        await market.connect(user1).setNewTime(index, timestamp);
        assert.equal((await market.pools(index)).closeAt, timestamp);
    })

    // ============== setNewPrice ==============
    it('setNewPrice test', async () => {
        // mint NFT
        await testNFT.mint(0, 5, user1.address);
        await testNFT.connect(user1).setApprovalForAll(market.address, true);
        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration);

        const newPrice = 1;
        const index = 0;
        // pool不能关闭
        await fastForward(DAY * 2)
        await assert.revert(
            market.connect(user1).setNewPrice(index, newPrice),
            "this pool is closed"
        );

        // creator error
        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID + 1, price, duration);
        await assert.revert(
            market.connect(user2).setNewPrice(index + 1, newPrice),
            "is not creator"
        );
        await market.connect(user1).setNewPrice(index + 1, newPrice);

        assert.equal(((await market.pools(index + 1)).amountTotal1).toNumber(), newPrice);
    })

    // ============== swap ==============
    it('swap test', async () => {
        // mint NFT
        await testNFT.mint(0, 5, user1.address);
        await testNFT.connect(user1).setApprovalForAll(market.address, true);

        const index = 0;
        // 不能swap不存在的pool
        await assert.revert(
            market.connect(user2).swap(index, { value: price }),
            "this pool does not exist"
        );
        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID, price, duration);

        await market.connect(user2).swap(index, { value: price });
        assert.equal(await testNFT.ownerOf(tokenID), user2.address);

        // can not swap twice
        await assert.revert(
            market.connect(user2).swap(index, { value: price }),
            "this pool is swapped"
        );

        await market.connect(user1).createPool(testNFT.address, addressZero, tokenID + 1, price, duration);
        await market.connect(user1).close(index + 1);

        // can not swap closed pool
        await assert.revert(
            market.connect(user2).swap(index + 1, { value: price }),
            "this pool is closed"
        );

        //  token20 pool
        await market.connect(user1).createPool(testNFT.address, token20.address, tokenID + 2, price, duration);
        await token20.connect(owner).mint(user2.address, price);
        await token20.connect(user2).approve(market.address, price);

        await market.connect(user2).swap(index + 2);
        assert.equal(await testNFT.ownerOf(tokenID + 2), user2.address);
        const b = await token20.balanceOf(fee.address);
        assert.equal(b.toString(), toWei(toBN(1), 'ether').mul(toBN(2)).div(toBN(100)).toString());
    })
})
