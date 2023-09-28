const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3();
const { assert } = require('./common');
const deployer = require('../../utils/deploy');
const { currentTime, toUnit, fastForward } = require('../utils')();
const { expect } = require('chai');

describe("GameERC20Treasure", async function () {
    let factory, token, treasure, timelocker, timelocker1;

    let owner, user1, user2, signer, controller;

    const upChainSelector = web3.eth.abi.encodeFunctionSignature("upChain(uint256,uint256,bytes)");
    const topUpSelector = web3.eth.abi.encodeFunctionSignature("topUp(uint256,uint256,bytes)");

    // constructor params
    const name = "Archloot";
    const symbol = "ALT";
    const cap = toWei(toBN(100000000), 'ether');
    const DAY = 86400;

    beforeEach(async function () {
        [owner, user1, user2, signer, controller] = await hre.ethers.getSigners();

        //  factory
        factory = await deployer.deployERC20Factory();

        //  erc20 token
        await factory.generate(name, symbol, cap.toString());
        const vaultID = 0;
        const tokenAddress = await factory.vaults(vaultID);
        const GameERC20Token = await hre.ethers.getContractFactory("GameERC20Token");
        token = new hre.ethers.Contract(tokenAddress, GameERC20Token.interface, owner);

        //  treasure
        timelocker = await deployer.deployTimelocker(DAY * 2)
        timelocker1 = await deployer.deployTimelocker(DAY * 2)
        treasure = await deployer.deployERC20Treasure([signer.address], token.address, controller.address, timelocker.address);
    });

    it('constructor should be success: ', async () => {
        assert.equal(await treasure.signers(signer.address), true);
        assert.equal(await treasure.token(), token.address);
        assert.equal(await treasure.timeLocker(), timelocker.address);

        assert.equal(await token.owner(), owner.address);
    });

    it('topUp test', async () => {
        const amount = toBN(toWei("100000000", "ether"));
        const nonce = 0;
        await token.connect(owner).mint(user1.address, amount.toString());

        await assert.revert(
            treasure.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce),
            "ERC20: transfer amount exceeds allowance"
        );

        await token.connect(user1).approve(treasure.address, toWei('100000000000000000000', 'ether'));
        await treasure.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce);

        await assert.revert(
            treasure.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce),
            "nonce already used"
        );

        await treasure.connect(controller).pause();
        await assert.revert(
            treasure.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce + 1),
            "Pausable: paused"
        );

        await treasure.connect(controller).unpause();
        await treasure.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce + 1);
        assert.equal((await token.balanceOf(treasure.address)).toString(), amount.div(toBN(3)).mul(toBN(2)).toString());
    })

    it('upChain test: ', async () => {
        /*
        * topUp
        * */
        const amount = toBN(toWei("10000000", "ether"));
        let nonce = 0;
        await token.connect(owner).mint(user1.address, amount.toString());

        await token.connect(user1).approve(treasure.address, toWei('100000000000000000000', 'ether'));
        await expect(treasure.connect(user1).topUp(amount.toString(), nonce))
            .to.emit(treasure, "TopUp")
            .withArgs(user1.address, amount.toString(), nonce);
        /*
        * upChain
        * */
        nonce++;
        //  generate hash
        const originalDataUpChain = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "uint256", "uint256", "bytes4"],
            [user1.address, treasure.address, token.address, amount.toString(), nonce, web3Utils.hexToBytes(upChainSelector)]
        );
        const hashUpChain = hre.ethers.utils.keccak256(originalDataUpChain);
        const signData = await signer.signMessage(web3Utils.hexToBytes(hashUpChain));
        const signDataUpChainError = await user1.signMessage(web3Utils.hexToBytes(hashUpChain));

        await assert.revert(
            treasure.connect(user1).upChain(amount.toString(), nonce - 1, signData),
            "nonce already used"
        );

        await assert.revert(
            treasure.connect(user1).upChain(amount.toString(), nonce, signDataUpChainError),
            "sign is not correct"
        );

        // wrong amount
        await assert.revert(
            treasure.connect(user1).upChain(0, nonce, signDataUpChainError),
            "sign is not correct"
        );

        await treasure.connect(controller).pause();
        await assert.revert(
            treasure.connect(user1).upChain(amount.toString(), nonce, signData),
            "Pausable: paused"
        );
        await treasure.connect(controller).unpause();
        await expect(treasure.connect(user1).upChain(amount.toString(), nonce, signData))
            .to.emit(treasure, "UpChain")
            .withArgs(user1.address, amount.toString(), nonce);
        assert.equal((await token.balanceOf(user1.address)).toString(), amount.toString());
    })

    /* ============ controller ============ */
    it('pause test', async () => {
        await assert.revert(treasure.connect(user1).pause(), "only controller");
        await treasure.connect(controller).pause();
        assert.equal(await treasure.paused(), true);
    });

    it('unpause test', async () => {
        await assert.revert(treasure.connect(user1).unpause(), "only controller");
        await assert.revert(treasure.connect(controller).unpause(), "Pausable: not paused");
        await treasure.connect(controller).pause();
        await treasure.connect(controller).unpause();
        assert.equal(await treasure.paused(), false);
    });

    /* ============ timelock ============ */
    it('setSigner test', async () => {
        const target = treasure.address;
        const value = '0';
        const setSignerSign = "setSigner(address,bool)";
        const setSignerData = web3.eth.abi.encodeParameters(['address', 'bool'], [user2.address, true]);

        await assert.revert(treasure.connect(user1).setSigner(user1.address, true), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);

        await fastForward(DAY * 4);

        await timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta);
    })

    it('setTimeLocker test', async () => {
        const target = treasure.address;
        const value = '0';
        const setTimeLockerSign = "setTimeLocker(address)";
        const setTimeLockerData = web3.eth.abi.encodeParameter('address', timelocker1.address);

        await assert.revert(treasure.connect(user1).setTimeLocker(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        await fastForward(DAY * 4);

        await timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        // check new timelocker
        assert.equal(await treasure.timeLocker(), timelocker1.address);

        // past timelocker try to call
        const setTimeLockerData_ = web3.eth.abi.encodeParameter('address', timelocker.address);
        now = await currentTime();
        eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta);
        await fastForward(DAY * 4);
        await assert.revert(timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta), "not timelocker");

        // new timelocker try to call
        now = await currentTime();
        eta = now + DAY * 3;
        await timelocker1.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta);
        await fastForward(DAY * 4);
        await timelocker1.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta);
        assert.equal(await treasure.timeLocker(), timelocker.address);
    })

    /* ============ owner ============ */
    it('unLockEther test', async () => {
        // send some eth to treasure
        const value = hre.ethers.BigNumber.from(toUnit(1).toString());
        await user1.sendTransaction({ to: treasure.address, value: value });
        const treasureBalance = await hre.ethers.provider.getBalance(treasure.address);
        assert.equal(treasureBalance.toString(), value.toString());

        let ownerBalance = await owner.getBalance();

        // withdraw eth
        await assert.revert(treasure.connect(user1).unLockEther(), "Ownable: caller is not the owner");
        await treasure.connect(owner).unLockEther();

        // check owner balance (slightly less than, because of gas)
        // assert.equal((await owner.getBalance()).toString(), ownerBalance.add(value).toString());
    });

    it('setController test', async () => {
        await assert.revert(treasure.connect(user1).setController(user1.address), "Ownable: caller is not the owner");
        await treasure.connect(owner).setController(user2.address);
        assert.equal(await treasure.controller(), user2.address);
    });
})


