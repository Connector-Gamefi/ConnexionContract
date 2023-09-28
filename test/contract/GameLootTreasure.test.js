const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');
const { expect } = require('chai');

describe("GameLootTreasure", async function () {
    let treasure, timelocker, timelocker1;
    let equipment;
    let seller;

    let owner, user, signer, vault, user1, user2;

    // constructor args
    const addressZero = '0x0000000000000000000000000000000000000000';
    const cap = 90;
    const symbol = "Archloot";
    const name = "Archloot";
    const DAY = 86400;
    const maxSupply = 10000;
    const price = 1;

    beforeEach(async function () {
        [owner, controller, signer, vault, user1, user2] = await hre.ethers.getSigners();
        const signers = [signer.address];

        timelocker = await deployer.deployTimelocker(DAY * 2);
        timelocker1 = await deployer.deployTimelocker(DAY * 2);
        treasure = await deployer.deployTreasure(controller.address, timelocker.address, signers);
        equipment = await deployer.deployEquipment(
            addressZero, name, symbol, treasure.address, addressZero, timelocker.address, [signer.address], cap);
        seller = await deployer.deploySeller(equipment.address, addressZero, maxSupply, price, signers);

        // set seller
        const target = equipment.address;
        const value = '0';
        const setSellerSign = "setSeller(address)";
        const setSellerData = web3.eth.abi.encodeParameter('address', seller.address);
        const now = await currentTime();
        const eta = now + DAY * 3;

        // queue tx
        await timelocker.connect(owner).queueTransaction(target, value, setSellerSign, setSellerData, eta);
        await fastForward(DAY * 4);

        // execute tx
        await timelocker.connect(owner).executeTransaction(target, value, setSellerSign, setSellerData, eta);

        // mint some nft
        await seller.connect(owner).openPublicSale();
        await seller.connect(owner).setPubPer(20);

        const amount = 20;
        await seller.connect(user1).pubSale(amount, { value: amount * price });
        await seller.connect(user2).pubSale(amount, { value: amount * price });
    });

    it('topUp', async () => {
        const tokenID = 0;
        const nonce = 0;

        await treasure.connect(controller).pause();

        await assert.revert(
            treasure.connect(user1).topUp(equipment.address, tokenID, nonce),
            "Pausable: paused"
        );

        await treasure.connect(controller).unpause();
        await assert.revert(
            treasure.connect(user1).topUp(equipment.address, tokenID, nonce),
            "ERC721: caller is not token owner nor approved"
        );

        await equipment.connect(user1).setApprovalForAll(treasure.address, true);

        await assert.revert(
            treasure.connect(user1).topUp(equipment.address, 20, nonce),
            "ERC721: caller is not token owner nor approved"
        );

        await treasure.connect(user1).topUp(equipment.address, tokenID, nonce);
        await assert.revert(
            treasure.connect(user1).topUp(equipment.address, tokenID, nonce),
            "nonce already used"
        );
    })

    it('topUpBatch', async () => {
        const nonce = 0;
        const tokenIDs = [0, 1, 2, 3, 4]
        const addresses = [equipment.address, equipment.address, equipment.address, equipment.address, equipment.address]

        await treasure.connect(controller).pause();

        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce),
            "Pausable: paused"
        );

        await treasure.connect(controller).unpause();

        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce),
            "ERC721: caller is not token owner nor approved"
        );

        const tokenIDsErr = [0, 1, 2, 3, 20]
        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDsErr, nonce),
            "ERC721: caller is not token owner nor approved"
        );

        await equipment.connect(user1).setApprovalForAll(treasure.address, true);
        await treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce);
        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce),
            "nonce already used"
        );
    })

    it('upChain should be success: ', async () => {
        const nonce = 0;
        const tokenID = 0;

        // fill attrs data
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint128[]", "uint128[]"],
            [equipment.address, tokenID, nonce, attrIDs, attrValues]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        await equipment.connect(user1).revealBySign(tokenID, nonce, attrIDs, attrValues, signData);

        /*
        * body topUp
        * */
        await equipment.connect(user1).setApprovalForAll(treasure.address, true);
        await expect(treasure.connect(user1).topUp(equipment.address, tokenID, nonce))
            .to.emit(treasure, "TopUp")
            .withArgs(user1.address, equipment.address, tokenID, nonce);
        /*
        * upChain
        * */
        const nonce_ = 1;
        const attrIDs_ = [10, 11, 12];
        const attrValues_ = [20, 20, 20];
        const attrIndexesUpdate_ = [0, 1, 8];
        const attrValuesUpdate_ = [100, 200, 300];
        const attrIndexesRM_ = [9, 7];

        //  generate hash
        const originalData_ = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "uint256", "uint256", "uint256[]", "uint256[]", "uint256[]", "uint256[]", "uint256[]"],
            [user1.address, treasure.address, equipment.address, tokenID, nonce_, attrIDs_, attrValues_, attrIndexesUpdate_, attrValuesUpdate_, attrIndexesRM_]
        );
        const hash_ = hre.ethers.utils.keccak256(originalData_);
        const signData_ = await signer.signMessage(web3Utils.hexToBytes(hash_));

        await expect(treasure.connect(user1).upChain(equipment.address, tokenID, nonce_, attrIDs_, attrValues_, attrIndexesUpdate_, attrValuesUpdate_, attrIndexesRM_, signData_))
            .to.emit(treasure, "UpChain")
            .withArgs(user1.address, equipment.address, tokenID, nonce_);

        const attrData = await equipment.attributes(tokenID);
        // console.log(attrData);
        assert.equal(attrData.length, 11);
    })

    it('upChainBatch should be success: ', async () => {
        const nonce = 0;
        const tokenIDs = [0, 1, 2, 3, 4];

        // fill attrs data
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
        for (let i = 0; i < 5; i++) {
            const originalData = hre.ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "uint256", "uint128[]", "uint128[]"],
                [equipment.address, tokenIDs[i], nonce + i, attrIDs, attrValues]
            );
            const hash = hre.ethers.utils.keccak256(originalData);
            const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

            await equipment.connect(user1).revealBySign(tokenIDs[i], nonce + i, attrIDs, attrValues, signData);
        }

        /*
        * topUpBatch
        * */
        const addresses = [equipment.address, equipment.address, equipment.address, equipment.address, equipment.address]

        await equipment.connect(user1).setApprovalForAll(treasure.address, true);
        await expect(treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce))
            .to.emit(treasure, "TopUpBatch")
            .withArgs(user1.address, addresses, tokenIDs, nonce);
        /*
        * upChainBatch
        * */
        const nonce_ = 2;
        const attrIDs_ = [10, 11, 12];
        const attrValues_ = [20, 20, 20];
        const attrIDsUpdate_ = [0, 1, 8];
        const attrValuesUpdate_ = [100, 200, 300];
        const attrIndexesRM_ = [9, 7];

        //  generate hash
        const originalData_ = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address[]", "uint256[]", "uint256", "uint128[][]", "uint128[][]", "uint256[][]", "uint128[][]", "uint256[][]"],
            [user1.address, treasure.address, [equipment.address, equipment.address], [0, 1], nonce_, [attrIDs_, attrIDs_], [attrValues_, attrValues_], [attrIDsUpdate_, attrIDsUpdate_], [attrValuesUpdate_, attrValuesUpdate_], [attrIndexesRM_, attrIndexesRM_]]
        );
        const hash_ = hre.ethers.utils.keccak256(originalData_);
        const signData_ = await signer.signMessage(web3Utils.hexToBytes(hash_));

        await expect(treasure.connect(user1).upChainBatch([equipment.address, equipment.address], [0, 1], nonce_, [attrIDs_, attrIDs_], [attrValues_, attrValues_], [attrIDsUpdate_, attrIDsUpdate_], [attrValuesUpdate_, attrValuesUpdate_], [attrIndexesRM_, attrIndexesRM_], signData_))
            .to.emit(treasure, "UpChainBatch")
            .withArgs(user1.address, [equipment.address, equipment.address], [0, 1], nonce_);
        const attrData = await equipment.attributes(0);

        assert.equal(attrData.length, 11);
        assert.equal(attrData[0].attrValue.toNumber(), 100);
        assert.equal(attrData[1].attrValue.toNumber(), 200);
        assert.equal(attrData[8].attrValue.toNumber(), 300);
    })

    /* 
        ------------- Controller setting -------------
    */
    it('pause ', async () => {
        await assert.revert(treasure.connect(user1).pause(), "only controller");
        await treasure.connect(controller).pause();
        assert.equal(await treasure.paused(), true);
    })

    it('unpause ', async () => {
        await treasure.connect(controller).pause();
        await assert.revert(treasure.connect(user1).unpause(), "only controller");
        await treasure.connect(controller).unpause();
        assert.equal(await treasure.paused(), false);
    })

    /* 
        ------------- Owner setting -------------
    */
    it('setController ', async () => {
        await assert.revert(treasure.connect(user1).setController(user1.address), "Ownable: caller is not the owner");
        await treasure.connect(owner).setController(user1.address);
        assert.equal(await treasure.controller(), user1.address);
    })

    it('unLockEther ', async () => {
        await assert.revert(treasure.connect(user1).unLockEther(), "Ownable: caller is not the owner");
        await treasure.connect(owner).unLockEther();
    })

    /* 
        ------------- timelock setting -------------
    */
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

    /* 
        ------------- chore -------------
    */
    it('onERC721Received test', async () => {
        const t = await treasure.onERC721Received(user1.address, user1.address, 1, '0x00');
        assert.equal(t.toString(), '0x150b7a02');
    })
})