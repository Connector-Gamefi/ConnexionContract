
const hre = require('hardhat');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');
const { expect } = require('chai');

describe("GameLootGameMinter", async function () {
    let treasure, equipment, gameMinter, timelocker, revealSVG, timelocker1;

    let owner, controller, signer, vault, user1, user2;
    let signers;

    /* --------- constructor args --------- */
    // 2 days
    const DAY = 86400;
    const cap = 90;
    const symbol = "Archloot";
    const name = "Archloot";

    beforeEach(async function () {
        [owner, controller, signer, vault, user1, user2] = await hre.ethers.getSigners();
        signers = [signer.address];

        // deploy
        timelocker = await deployer.deployTimelocker(DAY * 2);
        timelocker1 = await deployer.deployTimelocker(DAY * 2);
        treasure = await deployer.deployTreasure(controller.address, timelocker.address, signers);
        revealSVG = await deployer.deployReveal();
        equipment = await deployer.deployEquipment(
            revealSVG.address, name, symbol, treasure.address, vault.address, timelocker.address, signers, cap);
        gameMinter = await deployer.deployGameMinter(equipment.address, timelocker.address, controller.address, signers);

        /* ------------- set gameMinter into equipment ------------- */
        //  init timelock params
        const target = equipment.address;
        const value = '0';
        const setGameMinterSign = "setGameMinter(address)";
        const setGameMinterData = web3.eth.abi.encodeParameter('address', gameMinter.address);
        const now = await currentTime();
        const eta = now + DAY * 3;

        // queue tx
        await timelocker.connect(owner).queueTransaction(target, value, setGameMinterSign, setGameMinterData, eta);

        await fastForward(DAY * 4);

        // execute tx
        await timelocker.connect(owner).executeTransaction(target, value, setGameMinterSign, setGameMinterData, eta);
    });

    /* 
        ------------- Game mint ------------- 
    */
    it('game mint should be success', async () => {
        let nonce = 0;
        let eqID = 1000000;
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
        const tokenID = await equipment.totalSupply();

        //  generate hash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256", "uint256[]", "uint256[]"],
            [user1.address, gameMinter.address, nonce, eqID, attrIDs, attrValues]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        await expect(gameMinter.connect(user1).gameMint(nonce, eqID, attrIDs, attrValues, signData))
            .to.emit(gameMinter, "GameMint")
            .withArgs(user1.address, equipment.address, tokenID, eqID, nonce);
        assert.equal(await equipment.balanceOf(user1.address), 1);
        assert.equal(await equipment.hasRevealed(0), true);
        // const at = await equipment.attributes(0); 
        // console.log(at); 

        // test revert
        // paused revert
        await gameMinter.connect(controller).pause();
        await assert.revert(
            gameMinter.connect(user1).gameMint(nonce, eqID, attrIDs, attrValues, signData), "Pausable: paused");
        await gameMinter.connect(controller).unpause();
        // nonce use twice
        await assert.revert(
            gameMinter.connect(user1).gameMint(nonce, eqID + 1, attrIDs, attrValues, signData), "nonce is used");
        // eqID use twice
        await assert.revert(
            gameMinter.connect(user1).gameMint(nonce + 1, eqID, attrIDs, attrValues, signData), "this eqID is already exists");
        // use wrong params
        const originalData2 = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256", "uint256[]", "uint256[]"],
            [user1.address, gameMinter.address, ++nonce, ++eqID, attrIDs, attrValues]
        );
        const hash2 = hre.ethers.utils.keccak256(originalData2);
        const signData2 = await signer.signMessage(web3.utils.hexToBytes(hash2));
        await assert.revert(
            gameMinter.connect(user1).gameMint(nonce, eqID, attrIDs, [1, 2], signData2), "param length error");
        await assert.revert(
            gameMinter.connect(user1).gameMint(nonce, eqID, attrIDs, attrValues, signData), "sign is not correct");
    })

    /* 
        ------------- controller test ------------- 
    */
    it('pause test: ', async () => {
        await assert.revert(gameMinter.connect(user1).pause(), "Permission denied");
        await gameMinter.connect(controller).pause();
    })
    it('unpause test: ', async () => {
        await gameMinter.connect(controller).pause();
        await assert.revert(gameMinter.connect(user1).unpause(), "Permission denied");
        await gameMinter.connect(controller).unpause();
    })
    it('transfer controller test: ', async () => {
        await assert.revert(gameMinter.connect(user1).transferController(user1.address), "Permission denied");
        await gameMinter.connect(controller).transferController(user1.address);
        assert.equal(await gameMinter.controller(), user1.address);
    })

    /* 
        ------------- Timelocker setting -------------
    */
    it('setSigner test', async () => {
        const target = gameMinter.address;
        const value = '0';
        const setSignerSign = "setSigner(address,bool)";
        const setSignerData = web3.eth.abi.encodeParameters(['address', 'bool'], [user2.address, true]);

        await assert.revert(gameMinter.connect(user1).setSigner(user1.address, true), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta);

        assert.equal(await gameMinter.signers(user2.address), true);
    })

    it('setTimeLocker test', async () => {
        const target = gameMinter.address;
        const value = '0';
        const setTimeLockerSign = "setTimeLocker(address)";
        const setTimeLockerData = web3.eth.abi.encodeParameter('address', timelocker1.address);

        await assert.revert(gameMinter.connect(user1).setTimeLocker(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        await fastForward(DAY * 4);

        await timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        // check new timelocker
        assert.equal(await gameMinter.timeLocker(), timelocker1.address);

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
        assert.equal(await gameMinter.timeLocker(), timelocker.address);
    })
})