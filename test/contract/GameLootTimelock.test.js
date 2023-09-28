const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');
const { expect } = require('chai');

describe("GameLootTimelock", async function () {
    let equipment, seller, gameMinter, timelocker, timelocker1;

    let owner, controller, user, signer, vault, tem;

    // constructor args
    const addressZero = '0x0000000000000000000000000000000000000000';
    const cap = 90;
    const DAY = 86400;
    const name = "Archloot";
    const symbol = "Archloot";
    const maxSupply = 10000;
    const price = 1;

    beforeEach(async function () {
        [owner, controller, user, signer, vault, tem] = await hre.ethers.getSigners();
        const signers = [signer.address];

        timelocker = await deployer.deployTimelocker(DAY * 2)
        timelocker1 = await deployer.deployTimelocker(DAY * 2)
        equipment = await deployer.deployEquipment(
            addressZero, name, symbol, addressZero, addressZero, timelocker.address, [addressZero], cap);
        seller = await deployer.deploySeller(equipment.address, addressZero, maxSupply, price, signers);
        gameMinter = await deployer.deployGameMinter(equipment.address, timelocker.address, controller.address, signers);
    });

    it('equipment test', async () => {
        const target = equipment.address;
        const value = '0';
        const setSignerSign = "setSigner(address,bool)";
        const setSellerSign = "setSeller(address)";
        const setGameMinter = "setGameMinter(address)";
        const setReveal = "setReveal(address)";
        const setTreasure = "setTreasure(address)";

        const setSignerData = web3.eth.abi.encodeParameters(['address', 'bool'], [tem.address, true]);
        const setSellerData = web3.eth.abi.encodeParameter('address', tem.address);
        const setGameMinterData = web3.eth.abi.encodeParameter('address', tem.address);
        const setRevealData = web3.eth.abi.encodeParameter('address', tem.address);
        const setTreasureData = web3.eth.abi.encodeParameter('address', tem.address);
        let now = await currentTime();
        let eta = now + DAY * 3;

        // queue tx
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);
        await timelocker.connect(owner).queueTransaction(target, value, setSellerSign, setSellerData, eta);
        await timelocker.connect(owner).queueTransaction(target, value, setGameMinter, setGameMinterData, eta);
        await timelocker.connect(owner).queueTransaction(target, value, setReveal, setRevealData, eta);
        await timelocker.connect(owner).queueTransaction(target, value, setTreasure, setTreasureData, eta);
        await fastForward(DAY * 4);

        // execute tx
        await timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta);
        await timelocker.connect(owner).executeTransaction(target, value, setSellerSign, setSellerData, eta);
        await timelocker.connect(owner).executeTransaction(target, value, setGameMinter, setGameMinterData, eta);
        await timelocker.connect(owner).executeTransaction(target, value, setReveal, setRevealData, eta);
        await timelocker.connect(owner).executeTransaction(target, value, setTreasure, setTreasureData, eta);

        now = await currentTime();
        eta = now + DAY * 3;
        //txHash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "string", "bytes", "uint256"],
            [target, value, setSignerSign, setSignerData, eta]
        );
        const txHash = hre.ethers.utils.keccak256(originalData);
        await expect(timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta))
            .to.emit(timelocker, "QueueTransaction")
            .withArgs(txHash, target, value, setSignerSign, setSignerData, eta);

        // wrong time
        await fastForward(DAY * 2);
        await assert.revert(
            timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta),
            "GameLootTimelocker: Transaction hasn't surpassed time lock."
        );

        await fastForward(DAY * 2);
        // wrong params
        await assert.revert(
            timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta - 1),
            "GameLootTimelocker: Transaction hasn't been queued."
        );
        // cacel wrong test
        await expect(timelocker.connect(owner).cancelTransaction(target, value, setSignerSign, setSignerData, eta))
            .to.emit(timelocker, "CancelTransaction")
            .withArgs(txHash, target, value, setSignerSign, setSignerData, eta);
        await assert.revert(
            timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta),
            "GameLootTimelocker: Transaction hasn't been queued."
        );

        // past time
        now = await currentTime();
        eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);
        await fastForward(DAY * 20);
        await assert.revert(
            timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta),
            "GameLootTimelocker: Transaction is stale."
        );
    });

    it('change timelock test', async () => {
        const target = equipment.address;
        const value = '0';
        const setTimeLockerSign = "setTimeLocker(address)";
        const setTimeLockerData = web3.eth.abi.encodeParameter('address', timelocker1.address);
        let now = await currentTime();
        let eta = now + DAY * 3;

        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);
        await fastForward(DAY * 4);
        //txHash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "string", "bytes", "uint256"],
            [target, value, setTimeLockerSign, setTimeLockerData, eta]
        );
        const txHash = hre.ethers.utils.keccak256(originalData);
        await expect(timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta))
            .to.emit(timelocker, "ExecuteTransaction")
            .withArgs(txHash, target, value, setTimeLockerSign, setTimeLockerData, eta);
        //  check if timelock address is right
        assert.equal(await equipment.timeLocker(), timelocker1.address);

        //  past timelocker call revert
        now = await currentTime();
        eta = now + DAY * 3;
        const setTimeLockerData_ = web3.eth.abi.encodeParameter('address', timelocker.address);
        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta);
        await fastForward(DAY * 4);
        await assert.revert(
            timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta),
            "not timelocker"
        );

        //  right timelocker call
        now = await currentTime();
        eta = now + DAY * 3;
        await timelocker1.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta);
        await fastForward(DAY * 4);
        await timelocker1.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData_, eta);

        //  check if timelock address is right
        assert.equal(await equipment.timeLocker(), timelocker.address);
    });

    it('null signature tx test', async () => {
        const target = user.address;
        const value = '1000000';
        const setNullSign = "";
        const setTimeLockerData = web3.eth.abi.encodeParameter('address', timelocker1.address);
        let now = await currentTime();
        let eta = now + DAY * 3;

        await timelocker.connect(owner).queueTransaction(target, value, setNullSign, setTimeLockerData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setNullSign, setTimeLockerData, eta,{value:value});

    });

    /* ========== admin ========== */

    it('setAdmin test', async () => {
        await assert.revert(timelocker.connect(user).setAdmin(user.address), "GameLootTimelocker: Call must come from admin.");
        await timelocker.connect(owner).setAdmin(user.address);
        assert.equal(await timelocker.admin(), user.address);
    });

})
