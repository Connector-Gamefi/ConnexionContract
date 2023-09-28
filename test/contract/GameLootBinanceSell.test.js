const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const { expect } = require('chai');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const { MerkleTree } = require('merkletreejs');
const timeL = require('../utils/timelocker');
const deployer = require('../../utils/deploy');

describe("BinanceSell", async function () {
    let equipment, binanceSeller, binanceFirstNFT, binanceSecondNFT, reveal;

    let owner, user1, signer;

    // constructor args
    const addressZero = '0x0000000000000000000000000000000000000000';
    const cap = 90;
    const symbol = "Archloot";
    const name = "Archloot";
    const DAY = 86400;

    beforeEach(async function () {
        [owner, user1, signer] = await hre.ethers.getSigners();

        // binanceNFT
        const TestNFT = await hre.ethers.getContractFactory("TestNFT");
        binanceFirstNFT = await TestNFT.deploy(name, symbol);
        await binanceFirstNFT.deployed();
        binanceSecondNFT = await TestNFT.deploy(name, symbol);
        await binanceSecondNFT.deployed();

        reveal = await deployer.deployReveal();
        // timelocker
        timelocker = await deployer.deployTimelocker(1)
        // equipment
        equipment = await deployer.deployEquipment(
            reveal.address, name, symbol, addressZero, addressZero, timelocker.address, [addressZero], cap)
        // binanceSeller
        binanceSeller = await deployer.deployBinanceSell(
            equipment.address, binanceFirstNFT.address, binanceSecondNFT.address, [signer.address]);

        // set seller to equipment
        const sign = "setSeller(address)";
        const calldata = web3.eth.abi.encodeParameter('address', binanceSeller.address);
        const now = await currentTime();
        const eta = now + 2;
        await timeL.timelockerSet(timelocker, owner, equipment.address, 0, sign, calldata, eta, DAY)
    })

    it('constructor should be success: ', async () => {
        assert.equal(await binanceSeller.binanceNFTFirst(), binanceFirstNFT.address);
        assert.equal(await binanceSeller.binanceNFTSecond(), binanceSecondNFT.address);
        assert.equal(await binanceSeller.equipment(), equipment.address);
    });

    // =========== owner ===========
    it('set root: ', async () => {
        let root = web3Utils.sha3("test sault");

        await binanceSeller.setRootFirst(root);
        await binanceSeller.setRootSecond(root);

        assert.equal(await binanceSeller.rootFirst(), root);
        assert.equal(await binanceSeller.rootSecond(), root);

        await assert.revert(binanceSeller.connect(user1).setRootFirst(root), "Ownable: caller is not the owner");
        await assert.revert(binanceSeller.connect(user1).setRootSecond(root), "Ownable: caller is not the owner");
    });

    it('set equipment: ', async () => {
        await assert.revert(binanceSeller.connect(user1).setEquipment(user1.address), "Ownable: caller is not the owner");
        await binanceSeller.setEquipment(owner.address);
        assert.equal(await binanceSeller.connect(owner).equipment(), owner.address);
    });

    it('turn switch: ', async () => {
        const firstSwitchState = await binanceSeller.firstSwitch();
        const secondSwitchState = await binanceSeller.secondSwitch();

        await binanceSeller.turnFristBatch();
        await binanceSeller.turnSecondBatch();

        assert.equal(await binanceSeller.firstSwitch(), !firstSwitchState);
        assert.equal(await binanceSeller.secondSwitch(), !secondSwitchState);

        await assert.revert(binanceSeller.connect(user1).turnFristBatch(), "Ownable: caller is not the owner");
        await assert.revert(binanceSeller.connect(user1).turnSecondBatch(), "Ownable: caller is not the owner");
    });

    it('set setSigner: ', async () => {
        await assert.revert(binanceSeller.connect(user1).setSigner(user1.address, true), "Ownable: caller is not the owner");
        await binanceSeller.setSigner(user1.address, true);
        assert.equal(await binanceSeller.signers(user1.address), true);
    });

    // =========== Open Blind Box ===========
    it('OpenBlindBoxFirst: ', async () => {
        // TokenID: 100301375776 - 100301375975
        const start = 100301375776;
        const end = 100301375975;
        await binanceFirstNFT.mint(start, end, user1.address)

        // attr test data
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        // caculate leaves node
        let leaves = [];
        for (let tokenID = start; tokenID <= end; tokenID++) {
            const data = web3.eth.abi.encodeParameters(['uint256', 'uint128[]', 'uint128[]'], [tokenID, attrIDs, attrValues]);
            const leaf = web3Utils.sha3(data);
            leaves.push(leaf);
        }
        let tree = new MerkleTree(leaves, web3Utils.sha3, { sort: true });
        // get root
        let root = tree.getHexRoot();

        // calculate merkle proof of leaf
        let proofs = [];
        for (let index = 0; index < leaves.length; index++) {
            const leaf = leaves[index];
            proofs.push(tree.getHexProof(leaf));
        }

        await binanceSeller.setRootFirst(root);
        await binanceSeller.turnFristBatch();

        // approve to binanceSeller
        await binanceFirstNFT.connect(user1).approve(binanceSeller.address, start);
        // open blindbox
        const tokenID_ = equipment.totalSupply;
        await expect(binanceSeller.connect(user1).OpenBlindBoxFirst(start, attrIDs, attrValues, proofs[0]))
            .to.emit(binanceSeller, "ClaimFirst")
            .withArgs(equipment.address, tokenID_, start, user1.address);
        // verify balance
        const b = await binanceFirstNFT.balanceOf(user1.address);
        assert.equal(await binanceFirstNFT.balanceOf(binanceSeller.address), 1);
        assert.equal(b.toNumber(), 199);
        assert.equal(await equipment.balanceOf(user1.address), 1);
        assert.equal(await equipment.exists(0), true);
        // console.log(await equipment.tokenURI(0));

        // open same tokenID twice  
        await assert.revert(binanceSeller.connect(user1).OpenBlindBoxFirst(start, attrIDs, attrValues, proofs[0]), "ERC721: transfer from incorrect owner");
        // use other merkle proof
        await assert.revert(binanceSeller.connect(user1).OpenBlindBoxFirst(start + 1, attrIDs, attrValues, proofs[2]), "Merkle proof is wrong");
    });

    it('OpenBlindBoxSecond by merkle: ', async () => {
        // TokenID: 20000000000 - 20000000199
        const start = 20000000000;
        const end = 20000000199;
        await binanceSecondNFT.mint(start, end, user1.address)

        // attr test data
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        // caculate leaves node
        let leaves = [];
        for (let tokenID = start; tokenID <= end; tokenID++) {
            const data = web3.eth.abi.encodeParameters(['uint256', 'uint128[]', 'uint128[]'], [tokenID, attrIDs, attrValues]);
            const leaf = web3Utils.sha3(data);
            leaves.push(leaf);
        }
        let tree = new MerkleTree(leaves, web3Utils.sha3, { sort: true });
        // get root
        let root = tree.getHexRoot();

        // calculate merkle proof of leaf
        let proofs = [];
        for (let index = 0; index < leaves.length; index++) {
            const leaf = leaves[index];
            proofs.push(tree.getHexProof(leaf));
        }

        await binanceSeller.setRootSecond(root);
        await binanceSeller.turnSecondBatch();

        // approve to binanceSeller
        await binanceSecondNFT.connect(user1).approve(binanceSeller.address, start);
        // open blindbox
        const tokenID_ = equipment.totalSupply;
        await expect(binanceSeller.connect(user1).OpenBlindBoxSecondByMerkle(start, attrIDs, attrValues, proofs[0]))
            .to.emit(binanceSeller, "ClaimSecond")
            .withArgs(equipment.address, tokenID_, start, user1.address);
        // verify balance
        const b = await binanceSecondNFT.balanceOf(user1.address);
        assert.equal(await binanceSecondNFT.balanceOf(binanceSeller.address), 1);
        assert.equal(b.toNumber(), 199);
        assert.equal(await equipment.balanceOf(user1.address), 1);

        // open same tokenID twice
        await assert.revert(binanceSeller.connect(user1).OpenBlindBoxSecondByMerkle(start, attrIDs, attrValues, proofs[0]), "ERC721: transfer from incorrect owner");
        // use other merkle proof
        await assert.revert(binanceSeller.connect(user1).OpenBlindBoxSecondByMerkle(start + 1, attrIDs, attrValues, proofs[2]), "Merkle proof is wrong");
    });

    it('OpenBlindBoxSecond by sign: ', async () => {
        // TokenID: 20000000000 - 20000000199
        const start = 20000000000;
        const end = 20000000199;
        await binanceSecondNFT.mint(start, end, user1.address)

        // attr test data
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        let nonce = 0;
        //  generate hash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint256[]", "uint256[]"],
            [binanceSeller.address, start, nonce, attrIDs, attrValues]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        await binanceSeller.turnSecondBatch();

        // approve to binanceSeller
        await binanceSecondNFT.connect(user1).setApprovalForAll(binanceSeller.address, true);
        // open blindbox by sign
        const tokenID_ = equipment.totalSupply;
        await expect(binanceSeller.connect(user1).OpenBlindBoxSecondBySign(start, nonce, attrIDs, attrValues, signData))
            .to.emit(binanceSeller, "ClaimSecond")
            .withArgs(equipment.address, tokenID_, start, user1.address);
        // verify balance
        const b = await binanceSecondNFT.balanceOf(user1.address);
        assert.equal(await binanceSecondNFT.balanceOf(binanceSeller.address), 1);
        assert.equal(b.toNumber(), 199);
        assert.equal(await equipment.balanceOf(user1.address), 1);

        // use same sign twice
        await assert.revert(binanceSeller.connect(user1).OpenBlindBoxSecondBySign(start, nonce, attrIDs, attrValues, signData), "nonce is used");

        // use wrong params
        const originalData2 = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint256[]", "uint256[]"],
            [binanceSeller.address, start + 1, ++nonce, attrIDs, attrValues]
        );
        const hash2 = hre.ethers.utils.keccak256(originalData2);
        const signData2 = await signer.signMessage(web3.utils.hexToBytes(hash2));
        await assert.revert(binanceSeller.connect(user1).OpenBlindBoxSecondBySign(start, nonce, attrIDs, attrValues, signData2), "sign is not correct");
    });
})