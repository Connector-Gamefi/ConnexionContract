const hre = require('hardhat');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');
const { expect } = require('chai');
let tokenABI = require('../../artifacts/contracts/GameERC721Token.sol/GameERC721Token.json').abi;

describe("GameERC721Treasure", async function () {
    let treasure, timelocker, timelocker1;
    let token;

    let owner, controller, signer, vault, user1, user2;
    let signers;

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
        signers = [signer.address];

        timelocker = await deployer.deployTimelocker(DAY * 2);
        timelocker1 = await deployer.deployTimelocker(DAY * 2);
        treasure = await deployer.deployERC721Treasure(controller.address, timelocker.address, signers);

        //  factory
        factory = await deployer.deployERC721Factory();
        logicAddress = factory.logicAddress;
        //  token
        await factory.connect(owner).generate(name, symbol, timelocker.address, controller.address, signers);
        const tokenAddress = await factory.vaults(0);
        token = new hre.ethers.Contract(tokenAddress, tokenABI, owner);

        // ============= mint some nft =============
        let nonce = 0;
        let eqID = 1;
        for (let i = 1; i <= 10; i++) {
            //  generate hash
            const originalData = hre.ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "uint256", "uint256"],
                [user1.address, token.address, eqID, nonce]
            );
            const hash = hre.ethers.utils.keccak256(originalData);
            const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

            await token.connect(user1).gameMint(nonce, eqID, signData);

            nonce++;
            eqID++;
        }
    });

    it('topUp', async () => {
        const tokenID = 0;
        const nonce = 0;

        await treasure.connect(controller).pause();

        await assert.revert(
            treasure.connect(user1).topUp(token.address, tokenID, nonce),
            "Pausable: paused"
        );

        await treasure.connect(controller).unpause();

        await assert.revert(
            treasure.connect(user1).topUp(token.address, tokenID, nonce),
            "ERC721: transfer caller is not owner nor approved"
        );

        await token.connect(user1).setApprovalForAll(treasure.address, true);

        await treasure.connect(user1).topUp(token.address, tokenID, nonce);
        await assert.revert(
            treasure.connect(user1).topUp(token.address, tokenID, nonce),
            "nonce already used"
        );
    })

    it('topUpBatch', async () => {
        const nonce = 0;
        const tokenIDs = [0, 1, 2, 3, 4]
        const addresses = [token.address, token.address, token.address, token.address, token.address]

        await treasure.connect(controller).pause();

        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce),
            "Pausable: paused"
        );

        await treasure.connect(controller).unpause();

        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce),
            "ERC721: transfer caller is not owner nor approved"
        );

        const tokenIDsErr = [0, 1, 2, 3, 20]
        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDsErr, nonce),
            "ERC721: transfer caller is not owner nor approved"
        );

        await token.connect(user1).setApprovalForAll(treasure.address, true);
        await treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce);
        await assert.revert(
            treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce),
            "nonce already used"
        );
    })

    it('upChain should be success: ', async () => {
        let nonce = 0;
        let tokenID = 0;

        /*
        * topUp
        * */
        await token.connect(user1).setApprovalForAll(treasure.address, true);
        await expect(treasure.connect(user1).topUp(token.address, tokenID, nonce))
            .to.emit(treasure, "TopUp")
            .withArgs(user1.address, token.address, tokenID, nonce);
        nonce++;

        /*
        * upChain
        * */
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "uint256", "uint256"],
            [user1.address, treasure.address, token.address, tokenID, nonce]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        await treasure.connect(controller).pause();
        await assert.revert(
            treasure.connect(user1).upChain(token.address, tokenID, nonce, signData),
            "Pausable: paused"
        );
        await treasure.connect(controller).unpause();

        await expect(treasure.connect(user1).upChain(token.address, tokenID, nonce, signData))
            .to.emit(treasure, "UpChain")
            .withArgs(user1.address, token.address, tokenID, nonce);
        assert.equal(await token.ownerOf(tokenID), user1.address);

        await assert.revert(
            treasure.connect(user1).upChain(token.address, tokenID, nonce, signData),
            "nonce already used"
        );

        const originalDataErr = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "uint256", "uint256"],
            [user1.address, treasure.address, token.address, ++tokenID, nonce]
        );
        const hashErr = hre.ethers.utils.keccak256(originalDataErr);
        const signDataErr = await signer.signMessage(web3.utils.hexToBytes(hashErr));
        nonce++;
        await assert.revert(
            treasure.connect(user1).upChain(token.address, tokenID, nonce, signDataErr),
            "sign is not correct"
        );
    })

    it('upChainBatch should be success: ', async () => {
        let nonce = 0;
        const tokenIDs = [0, 1, 2, 3, 4];

        /*
        * topUpBatch
        * */
        const addresses = [token.address, token.address, token.address, token.address, token.address]

        await token.connect(user1).setApprovalForAll(treasure.address, true);
        await expect(treasure.connect(user1).topUpBatch(addresses, tokenIDs, nonce))
            .to.emit(treasure, "TopUpBatch")
            .withArgs(user1.address, addresses, tokenIDs, nonce);
        nonce++;

        for (let i = 0; i < tokenIDs.length; i++) {
            const id = tokenIDs[i];
            assert.equal(await token.ownerOf(id), treasure.address);
        }

        /*
        * upChainBatch
        * */
        //  generate hash
        const originalData_ = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address[]", "uint256[]", "uint256"],
            [user1.address, treasure.address, addresses, tokenIDs, nonce]
        );
        const hash_ = hre.ethers.utils.keccak256(originalData_);
        const signData_ = await signer.signMessage(web3Utils.hexToBytes(hash_));

        await expect(treasure.connect(user1).upChainBatch(addresses, tokenIDs, nonce, signData_))
            .to.emit(treasure, "UpChainBatch")
            .withArgs(user1.address, addresses, tokenIDs, nonce);

        for (let i = 0; i < tokenIDs.length; i++) {
            const id = tokenIDs[i];
            assert.equal(await token.ownerOf(id), user1.address);
        }
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