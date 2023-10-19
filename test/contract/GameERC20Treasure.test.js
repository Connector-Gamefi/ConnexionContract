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
    let factory, token, treasureReciever, treasureSender, timelocker, timelocker1;

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
        treasureReciever = await deployer.deployERC20TreasureReciever(token.address, controller.address, timelocker.address);
        treasureSender = await deployer.deployERC20TreasureSender([signer.address], token.address, controller.address, timelocker.address);
    });

    it('constructor should be success: ', async () => {
        assert.equal(await treasureSender.signers(signer.address), true);
        assert.equal(await treasureSender.token(), token.address);
        assert.equal(await treasureSender.timeLocker(), timelocker.address);

        assert.equal(await token.owner(), owner.address);
    });

    it('topUp test', async () => {
        const amount = toBN(toWei("100000000", "ether"));
        const nonce = 0;
        await token.connect(owner).mint(user1.address, amount.toString());

        await assert.revert(
            treasureReciever.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce),
            "ERC20: transfer amount exceeds allowance"
        );

        await token.connect(user1).approve(treasureReciever.address, toWei('100000000000000000000', 'ether'));
        await treasureReciever.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce);

        await treasureReciever.connect(controller).pause();
        await assert.revert(
            treasureReciever.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce + 1),
            "Pausable: paused"
        );

        await treasureReciever.connect(controller).unpause();
        await treasureReciever.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce + 1);
        assert.equal((await token.balanceOf(treasureReciever.address)).toString(), amount.div(toBN(3)).mul(toBN(2)).toString());
    })

    it('withdraw test', async () => {
        const amount = toBN(toWei("100000000", "ether"));
        const nonce = 0;
        await token.connect(owner).mint(user1.address, amount.toString());

        await token.connect(user1).approve(treasureReciever.address, toWei('100000000000000000000', 'ether'));
        await treasureReciever.connect(user1).topUp(amount.div(toBN(3)).toString(), nonce);

        await treasureReciever.connect(owner).withdraw(amount.div(toBN(3)).toString(), treasureSender.address);
  
        assert.equal((await token.balanceOf(treasureReciever.address)).toString(), 0);
        assert.equal((await token.balanceOf(treasureSender.address)).toString(), amount.div(toBN(3)).toString());
    })

    it('upChain test: ', async () => {
        /*
        * topUp
        * */
        const amount = toBN(toWei("10000000", "ether"));
        let nonce = 0;
        // await token.connect(owner).mint(user1.address, amount.toString());
        await token.connect(owner).mint(treasureSender.address, amount.mul(toBN(2)).toString());

        // await token.connect(user1).approve(treasureSender.address, toWei('100000000000000000000', 'ether'));
        // await expect(treasureSender.connect(user1).topUp(amount.toString(), nonce))
        //     .to.emit(treasureSender, "TopUp")
        //     .withArgs(user1.address, amount.toString(), nonce);

        /*
        * upChain
        * */
        nonce++;
        //  generate hash
        const originalDataUpChain = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "uint256", "uint256", "bytes4"],
            [user1.address, treasureSender.address, token.address, amount.toString(), nonce, web3Utils.hexToBytes(upChainSelector)]
        );
        const hashUpChain = hre.ethers.utils.keccak256(originalDataUpChain);
        const signData = await signer.signMessage(web3Utils.hexToBytes(hashUpChain));
        const signDataUpChainError = await user1.signMessage(web3Utils.hexToBytes(hashUpChain));

        await assert.revert(
            treasureSender.connect(user1).upChain(amount.toString(), nonce, signDataUpChainError),
            "sign is not correct"
        );

        // wrong amount
        await assert.revert(
            treasureSender.connect(user1).upChain(0, nonce, signDataUpChainError),
            "sign is not correct"
        );

        await treasureSender.connect(controller).pause();
        await assert.revert(
            treasureSender.connect(user1).upChain(amount.toString(), nonce, signData),
            "Pausable: paused"
        );
        await treasureSender.connect(controller).unpause();
        await expect(treasureSender.connect(user1).upChain(amount.toString(), nonce, signData))
            .to.emit(treasureSender, "UpChain")
            .withArgs(user1.address, amount.toString(), nonce);
        assert.equal((await token.balanceOf(user1.address)).toString(), amount.toString());

        await assert.revert(
            treasureSender.connect(user1).upChain(amount.toString(), nonce, signData),
            "nonce already used"
        );
    })

    /* ============ controller ============ */
    it('pause test', async () => {
        await assert.revert(treasureSender.connect(user1).pause(), "only controller");
        await treasureSender.connect(controller).pause();
        assert.equal(await treasureSender.paused(), true);
    });

    it('unpause test', async () => {
        await assert.revert(treasureSender.connect(user1).unpause(), "only controller");
        await assert.revert(treasureSender.connect(controller).unpause(), "Pausable: not paused");
        await treasureSender.connect(controller).pause();
        await treasureSender.connect(controller).unpause();
        assert.equal(await treasureSender.paused(), false);
    });

    /* ============ timelock ============ */
    it('setSigner test', async () => {
        const target = treasureSender.address;
        const value = '0';
        const setSignerSign = "setSigner(address,bool)";
        const setSignerData = web3.eth.abi.encodeParameters(['address', 'bool'], [user2.address, true]);

        await assert.revert(treasureSender.connect(user1).setSigner(user1.address, true), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);

        await fastForward(DAY * 4);

        await timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta);
    })

    it('setTimeLocker test', async () => {
        const target = treasureSender.address;
        const value = '0';
        const setTimeLockerSign = "setTimeLocker(address)";
        const setTimeLockerData = web3.eth.abi.encodeParameter('address', timelocker1.address);

        await assert.revert(treasureSender.connect(user1).setTimeLocker(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        await fastForward(DAY * 4);

        await timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        // check new timelocker
        assert.equal(await treasureSender.timeLocker(), timelocker1.address);

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
        assert.equal(await treasureSender.timeLocker(), timelocker.address);
    })

    /* ============ owner ============ */
    it('unLockEther test', async () => {
        // send some eth to treasure
        const value = hre.ethers.BigNumber.from(toUnit(1).toString());
        await user1.sendTransaction({ to: treasureSender.address, value: value });
        const treasureBalance = await hre.ethers.provider.getBalance(treasureSender.address);
        assert.equal(treasureBalance.toString(), value.toString());

        let ownerBalance = await owner.getBalance();

        // withdraw eth
        await assert.revert(treasureSender.connect(user1).unLockEther(), "Ownable: caller is not the owner");
        await treasureSender.connect(owner).unLockEther();

        // check owner balance (slightly less than, because of gas)
        // assert.equal((await owner.getBalance()).toString(), ownerBalance.add(value).toString());
    });

    it('setController test', async () => {
        await assert.revert(treasureSender.connect(user1).setController(user1.address), "Ownable: caller is not the owner");
        await treasureSender.connect(owner).setController(user2.address);
        assert.equal(await treasureSender.controller(), user2.address);
    });
})


