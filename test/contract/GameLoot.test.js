const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const Web3 = require('web3');
const { expect } = require('chai');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');
const { MerkleTree } = require('merkletreejs');

describe("GameLoot", async function () {
    let treasure, equipment, seller, gameMinter, timelocker, revealSVG, timelocker1;

    let owner, controller, signer, vault, user1, user2;
    let signers;

    /* --------- constructor args --------- */
    // 2 days
    const DAY = 86400;
    const cap = 90;
    const symbol = "Archloot";
    const name = "Archloot";
    const maxSupply = 10000;
    const price = 1;

    beforeEach(async function () {
        [owner, controller, signer, vault, user1, user2] = await hre.ethers.getSigners();
        signers = [signer.address];

        // deploy
        timelocker = await deployer.deployTimelocker(DAY * 2)
        timelocker1 = await deployer.deployTimelocker(DAY * 2)
        treasure = await deployer.deployTreasure(controller.address, timelocker.address, signers);
        revealSVG = await deployer.deployReveal();
        equipment = await deployer.deployEquipment(
            revealSVG.address, name, symbol, treasure.address, vault.address, timelocker.address, signers, cap)
        seller = await deployer.deploySeller(equipment.address, timelocker.address, maxSupply, price, signers);
        gameMinter = await deployer.deployGameMinter(equipment.address, timelocker.address, controller.address, signers);

        /* ------------- set seller and gameMinter into equipment ------------- */
        //  init timelock params
        const target = equipment.address;
        const value = '0';
        const setSellerSign = "setSeller(address)";
        const setGameMinterSign = "setGameMinter(address)";
        const setSellerData = web3.eth.abi.encodeParameter('address', seller.address);
        const setGameMinterData = web3.eth.abi.encodeParameter('address', gameMinter.address);
        const now = await currentTime();
        const eta = now + DAY * 3;

        // queue tx
        await timelocker.connect(owner).queueTransaction(target, value, setSellerSign, setSellerData, eta);
        await timelocker.connect(owner).queueTransaction(target, value, setGameMinterSign, setGameMinterData, eta);

        await fastForward(DAY * 4);

        // execute tx
        await timelocker.connect(owner).executeTransaction(target, value, setSellerSign, setSellerData, eta);
        await timelocker.connect(owner).executeTransaction(target, value, setGameMinterSign, setGameMinterData, eta);
    });

    it('constructor should be success: ', async () => {
        /* ------------- treasure ------------- */
        assert.equal(await treasure.signers(signer.address), true);
        assert.equal(await treasure.controller(), controller.address);
        assert.equal(await treasure.timeLocker(), timelocker.address);

        /* ------------- timelocker ------------- */
        assert.equal(await timelocker.delay(), DAY * 2);

        /* ------------- equipment ------------- */
        // assert.equal(await equipment.revealSVG(), revealSVG.address);
        assert.equal(await equipment.name(), name);
        assert.equal(await equipment.symbol(), symbol);
        assert.equal(await equipment.treasure(), treasure.address);
        assert.equal(await equipment.vault(), vault.address);
        assert.equal(await equipment.timeLocker(), timelocker.address);
        assert.equal(await equipment.signers(signer.address), true);
        assert.equal(await equipment.getCap(), cap);
        assert.equal(await equipment.seller(), seller.address);
        assert.equal(await equipment.gameMinter(), gameMinter.address);

        /* ------------- seller ------------- */
        assert.equal(await seller.equipment(), equipment.address);
        assert.equal(await seller.timeLocker(), timelocker.address);
        assert.equal(await seller.signers(signer.address), true);

        /* ------------- gameMinter ------------- */
        assert.equal(await gameMinter.equipment(), equipment.address);
        assert.equal(await gameMinter.timeLocker(), timelocker.address);
        assert.equal(await gameMinter.signers(signer.address), true);
    });

    /* 
        ------------- Timelocker setting -------------
    */
    it('setSigner test', async () => {
        const target = equipment.address;
        const value = '0';
        const setSignerSign = "setSigner(address,bool)";
        const setSignerData = web3.eth.abi.encodeParameters(['address', 'bool'], [user2.address, true]);

        await assert.revert(equipment.connect(user1).setSigner(user1.address, true), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta);

        assert.equal(await equipment.signers(user2.address), true);
    })

    it('setSeller test', async () => {
        const target = equipment.address;
        const value = '0';
        const setSellerSign = "setSeller(address)";
        const setSellerData = web3.eth.abi.encodeParameter('address', user2.address);

        await assert.revert(equipment.connect(user1).setSeller(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setSellerSign, setSellerData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setSellerSign, setSellerData, eta);

        assert.equal(await equipment.seller(), user2.address);
    })

    it('setGameMinter test', async () => {
        const target = equipment.address;
        const value = '0';
        const setGameMinterSign = "setGameMinter(address)";
        const setGameMinterData = web3.eth.abi.encodeParameter('address', user2.address);

        await assert.revert(equipment.connect(user1).setGameMinter(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setGameMinterSign, setGameMinterData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setGameMinterSign, setGameMinterData, eta);

        assert.equal(await equipment.gameMinter(), user2.address);
    })

    it('setReveal test', async () => {
        const target = equipment.address;
        const value = '0';
        const setRevealMinterSign = "setReveal(address)";
        const setRevealMinterData = web3.eth.abi.encodeParameter('address', user2.address);

        await assert.revert(equipment.connect(user1).setReveal(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setRevealMinterSign, setRevealMinterData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setRevealMinterSign, setRevealMinterData, eta);

        assert.equal(await equipment.revealSVG(), user2.address);
    })

    it('setTreasure test', async () => {
        const target = equipment.address;
        const value = '0';
        const setTreasureMinterSign = "setTreasure(address)";
        const setTreasureMinterData = web3.eth.abi.encodeParameter('address', user2.address);

        await assert.revert(equipment.connect(user1).setTreasure(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setTreasureMinterSign, setTreasureMinterData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setTreasureMinterSign, setTreasureMinterData, eta);

        assert.equal(await equipment.treasure(), user2.address);
    })

    it('setTimeLocker test', async () => {
        const target = equipment.address;
        const value = '0';
        const setTimeLockerSign = "setTimeLocker(address)";
        const setTimeLockerData = web3.eth.abi.encodeParameter('address', timelocker1.address);

        await assert.revert(equipment.connect(user1).setTimeLocker(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        await fastForward(DAY * 4);

        await timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        // check new timelocker
        assert.equal(await equipment.timeLocker(), timelocker1.address);

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
        assert.equal(await equipment.timeLocker(), timelocker.address);
    })

    /* 
        ------------- Owner setting -------------
    */
    it('set cap: ', async () => {
        const newCap = 100;
        await assert.revert(equipment.connect(user1).setCap(newCap), "Ownable: caller is not the owner");
        await equipment.connect(owner).setCap(newCap);
        assert.equal(await equipment.getCap(), newCap);
    })
    it('set vault: ', async () => {
        const newVault = user2.address;
        await assert.revert(equipment.connect(user1).setVault(newVault), "Ownable: caller is not the owner");
        await equipment.connect(owner).setVault(newVault);
        assert.equal(await equipment.vault(), newVault);
    })
    it('set root: ', async () => {
        const newRoot = web3.utils.sha3('test sault');
        await assert.revert(equipment.connect(user1).setRoot(newRoot), "Ownable: caller is not the owner");
        await equipment.connect(owner).setRoot(newRoot);
        assert.equal(await equipment.root(), newRoot);
    })
    it('withdraw: ', async () => {
        await assert.revert(equipment.connect(user1).withdraw(), "Ownable: caller is not the owner");
        await equipment.connect(owner).withdraw();
    })
    it('set BlindBoxURI: ', async () => {
        const testURI = "http://test";
        await assert.revert(equipment.connect(user1).setBlindBoxURI(testURI), "Ownable: caller is not the owner");
        await equipment.connect(owner).setBlindBoxURI(testURI);
    })

    /* 
        ------------- attribute controller -------------
    */
    it('set revealed: ', async () => {
        const tokenID = 1;
        await assert.revert(equipment.connect(user1).setRevealed(tokenID), "Permission denied");
    })
    it('set attach: ', async () => {
        const tokenID = 1;
        const attrID = 1;
        const value = 1;
        //Following function have already been tested. Had confliction with defalut
        // await equipment.connect(user1).attachTest(tokenID, attrID, value);
        // await assert.revert(equipment.connect(user1).attachTest(tokenID, attrID, value), "Permission denied");
    })
    it('set attachBatch: ', async () => {
        const tokenID = 1;
        const attrIDs = [1];
        const values = [1];
        await assert.revert(equipment.connect(user1).attachBatch(tokenID, attrIDs, values), "Permission denied");
    })
    it('set remove: ', async () => {
        const tokenID = 1;
        const index = 1;
        await assert.revert(equipment.connect(user1).remove(tokenID, index), "Permission denied");
        // await equipment.connect(user1).attachTest(tokenID, index, 1);
        // await equipment.connect(user1).remove(tokenID, 0);
    })
    it('set removeBatch: ', async () => {
        const tokenID = 1;
        const attrIndexes = [1];
        await assert.revert(equipment.connect(user1).removeBatch(tokenID, attrIndexes), "Permission denied");
    })
    it('set update: ', async () => {
        const tokenID = 1;
        const attrIndex = 1;
        const value = 2;
        await assert.revert(equipment.connect(user1).update(tokenID, attrIndex, value), "Permission denied");
        // await equipment.connect(user1).attachTest(tokenID, attrIndex, value);
        // await equipment.connect(user1).update(tokenID, 0, value);
    })
    it('set updateBatch: ', async () => {
        const tokenID = 1;
        const attrIndexes = [1];
        const values = [1];
        await assert.revert(equipment.connect(user1).updateBatch(tokenID, attrIndexes, values), "Permission denied");
    })

    /* 
        ------------- mint -------------
    */
    it('mint: ', async () => {
        const reciever = user1.address;
        const amount = 1;
        await assert.revert(equipment.connect(user1).mint(reciever, amount), "Permission denied");
    })

    /* 
        ------------- reveal -------------
    */
    it('reveal by sign: ', async () => {
        // mint some nft
        await seller.connect(owner).openPublicSale();
        await seller.connect(owner).setPubPer(2);

        const amount = 2;
        await seller.connect(user1).pubSale(amount, { value: amount * price });

        // reveal
        const nonce = 0;
        const tokenID = 0;
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

        //  generate hash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint128[]", "uint128[]"],
            [equipment.address, tokenID, nonce, attrIDs, attrValues]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));
        await expect(await equipment.connect(user1).revealBySign(tokenID, nonce, attrIDs, attrValues, signData))
            .to.emit(equipment, "Revealed")
            .withArgs(tokenID);
        // test revert
        await assert.revert(equipment.connect(user1).revealBySign(tokenID, nonce, attrIDs, attrValues, signData), "nonce is used");
        await assert.revert(equipment.tokenURI(111), "this id is not exists");
        // owner limit
        await assert.revert(equipment.connect(user2).revealBySign(
            tokenID, nonce, attrIDs, attrValues, signData), "token is not yours");
        // nonce test
        await assert.revert(equipment.connect(user1).revealBySign(
            tokenID, nonce, attrIDs, attrValues, signData), "nonce is used");
        // reveal twice test
        const originalData2 = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint128[]", "uint128[]"],
            [equipment.address, tokenID, nonce + 1, attrIDs, attrValues]
        );
        const hash2 = hre.ethers.utils.keccak256(originalData2);
        const signData2 = await signer.signMessage(web3.utils.hexToBytes(hash2));
        await assert.revert(equipment.connect(user1).revealBySign(
            tokenID, nonce + 1, attrIDs, attrValues, signData2), "has revealed");
        // test wrong sign
        const originalData3 = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint128[]", "uint128[]"],
            [equipment.address, tokenID + 1, nonce + 1, attrIDs, attrValues]
        );
        const hash3 = hre.ethers.utils.keccak256(originalData3);
        const signData3 = await signer.signMessage(web3.utils.hexToBytes(hash3));
        // wrong params
        await assert.revert(equipment.connect(user1).revealBySign(
            tokenID + 1, nonce + 1, attrIDs, [10, 11], signData3), "param length error");
        // signData3 is right but use signData2
        await assert.revert(equipment.connect(user1).revealBySign(
            tokenID + 1, nonce + 1, attrIDs, attrValues, signData2), "sign is not correct");
    })
    it('reveal by merkle: ', async () => {
        // mint two nft
        await seller.connect(owner).openPublicSale();
        await seller.connect(owner).setPubPer(2);

        const amount = 2;
        await seller.connect(user1).pubSale(amount, { value: amount * price });

        // reveal
        const start = 0;
        const end = 1;
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

        // caculate leaves node
        let leaves = [];
        for (let tokenID = start; tokenID <= end; tokenID++) {
            const data = web3.eth.abi.encodeParameters(['uint256', 'uint128[]', 'uint128[]'], [tokenID, attrIDs, attrValues]);
            const leaf = web3.utils.sha3(data);
            leaves.push(leaf);
        }
        let tree = new MerkleTree(leaves, web3.utils.sha3, { sort: true });
        // get root
        let root = tree.getHexRoot();

        // calculate merkle proof of leaf
        let proofs = [];
        for (let index = 0; index < leaves.length; index++) {
            const leaf = leaves[index];
            proofs.push(tree.getHexProof(leaf));
        }

        await equipment.setRoot(root);

        let tokenID = 0;
        //function tested
        await expect(equipment.connect(user1).revealByMerkle(tokenID, attrIDs, attrValues, proofs[tokenID]))
            .to.emit(equipment, "Revealed")
            .withArgs(tokenID);
        // test revert
        // owner limit
        await assert.revert(equipment.connect(user2).revealByMerkle(
            tokenID, attrIDs, attrValues, proofs[tokenID]), "token is not yours");
        // reveal twice test
        await assert.revert(equipment.connect(user1).revealByMerkle(
            tokenID, attrIDs, attrValues, proofs[tokenID]), "has revealed");
        // wrong params
        await assert.revert(equipment.connect(user1).revealByMerkle(
            ++tokenID, attrIDs, [1, 2], proofs[tokenID]), "param length error");
        // wrong proof  -> proofs[tokenID] is right but use proofs[tokenID - 1]
        await assert.revert(equipment.connect(user1).revealByMerkle(
            tokenID, attrIDs, attrValues, proofs[tokenID - 1]), "Merkle proof is wrong");
    })
})
