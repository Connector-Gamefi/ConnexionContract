const hre = require('hardhat');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider);
const { toBN, toWei } = require('web3-utils');
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');
const { expect } = require('chai');
let tokenABI = require('../../artifacts/contracts/GameERC721Token.sol/GameERC721Token.json').abi;
const logicABI = {
    "inputs": [],
    "name": "logic",
    "outputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
};
tokenABI.push(logicABI);

describe("GameERC721Token", async function () {
    let factory, logicAddress, token, timelocker, timelocker1;

    let owner, user, haker, user1, controller, signer;
    let signers;

    // constructor params
    const name = "Archloot";
    const symbol = "Archloot";
    const DAY = 86400;

    beforeEach(async function () {
        [owner, user, haker, user1, controller, signer] = await hre.ethers.getSigners();
        signers = [signer.address];

        timelocker = await deployer.deployTimelocker(DAY * 2);
        timelocker1 = await deployer.deployTimelocker(DAY * 2);
        //  factory
        factory = await deployer.deployERC721Factory();
        logicAddress = factory.logicAddress;

        //  token
        await factory.connect(owner).generate(name, symbol, timelocker.address, controller.address, signers);
        const tokenAddress = await factory.vaults(0);
        token = new hre.ethers.Contract(tokenAddress, tokenABI, owner);
    });

    it('constructor state', async () => {
        assert.equal(await token.name(), name);
        assert.equal(await token.symbol(), symbol);
        assert.equal(await token.timeLocker(), timelocker.address);
        assert.equal(await token.controller(), controller.address);
        assert.equal(await token.owner(), owner.address);
        assert.equal(await token.logic(), logicAddress);
        assert.equal(await token.signers(signer.address), true);
    })

    // ============== initialize ==============
    it('initialize', async () => {
        await assert.revert(
            token.connect(user).initialize(name, symbol, timelocker.address, controller.address, owner.address, signers),
            "Initializable: contract is already initialized"
        );
    })

    // ============== Owner setting ==============
    it('transferOwnership test', async () => {
        await assert.revert(
            token.connect(user).transferOwnership(user.address),
            "only owner"
        );

        await token.connect(owner).transferOwnership(user.address);
        assert.equal(await token.owner(), user.address);
    })
    it('transferController test', async () => {
        await assert.revert(
            token.connect(user).transferController(haker.address),
            "only owner"
        );

        await token.connect(owner).transferController(user.address);
        assert.equal(await token.controller(), user.address);
    })

    // ============== controller test ==============
    it('pause test: ', async () => {
        await assert.revert(token.connect(user1).pause(), "Permission denied");
        await token.connect(controller).pause();
        assert.equal(await token.paused(), true);
    })
    it('unpause test: ', async () => {
        await token.connect(controller).pause();
        await assert.revert(token.connect(user1).unpause(), "Permission denied");
        await token.connect(controller).unpause();
        assert.equal(await token.paused(), false);
    })

    // ============== Timelocker setting ==============
    it('setSigner test', async () => {
        const target = token.address;
        const value = '0';
        const setSignerSign = "setSigner(address,bool)";
        const setSignerData = web3.eth.abi.encodeParameters(['address', 'bool'], [user.address, true]);

        await assert.revert(token.connect(user1).setSigner(user1.address, true), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);
        await fastForward(DAY * 4);
        await timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta);

        assert.equal(await token.signers(user.address), true);
    })

    it('setTimeLocker test', async () => {
        const target = token.address;
        const value = '0';
        const setTimeLockerSign = "setTimeLocker(address)";
        const setTimeLockerData = web3.eth.abi.encodeParameter('address', timelocker1.address);

        await assert.revert(token.connect(user1).setTimeLocker(user1.address), "not timelocker");

        let now = await currentTime();
        let eta = now + DAY * 3;
        await timelocker.connect(owner).queueTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        await fastForward(DAY * 4);

        await timelocker.connect(owner).executeTransaction(target, value, setTimeLockerSign, setTimeLockerData, eta);

        // check new timelocker
        assert.equal(await token.timeLocker(), timelocker1.address);

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
        assert.equal(await token.timeLocker(), timelocker.address);
    })

    // ============== gameMint ==============
    it('gameMint', async () => {
        let nonce = 0;
        let eqID = 1;

        //  generate hash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256"],
            [user1.address, token.address, eqID, nonce]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        const totalSupply = await token.totalSupply();
        await expect(token.connect(user1).gameMint(nonce, eqID, signData))
            .to.emit(token, "GameMint")
            .withArgs(user1.address, totalSupply, eqID, nonce);
        // assert.eventEqual(token.connect(user1).gameMint(nonce, eqID, signData),"GameMint",[user1.address,totalSupply,eqID,nonce])
        // await expect(token.connect(user1).gameMint(nonce, eqID, signData)).to.emit(token, "GameMint");

        assert.equal(await token.balanceOf(user1.address), 1);

        // test revert
        // paused revert
        await token.connect(controller).pause();
        await assert.revert(
            token.connect(user1).gameMint(nonce, eqID, signData), "Pausable: paused");
        await token.connect(controller).unpause();
        // nonce use twice
        await assert.revert(
            token.connect(user1).gameMint(nonce, eqID, signData), "nonce is used");
        // use wrong params
        const originalData2 = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256"],
            [user1.address, token.address, ++eqID, ++nonce]
        );
        const hash2 = hre.ethers.utils.keccak256(originalData2);
        const signData2 = await signer.signMessage(web3.utils.hexToBytes(hash2));
        await assert.revert(
            token.connect(user1).gameMint(nonce, eqID - 1, signData2), "this eqID is already exists");
        await assert.revert(
            token.connect(user1).gameMint(nonce, eqID, signData), "sign is not correct");
    })

    // ============== reveal ==============
    it('setBaseURI test: ', async () => {
        // mint
        let nonce = 0;
        let eqID = 1;
        //  generate hash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256"],
            [user1.address, token.address, eqID, nonce]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        await token.connect(user1).gameMint(nonce, eqID, signData);

        const tokenURI = await token.tokenURI(0);
        assert.equal(tokenURI, '');

        const baseURI = "http://test/"
        await assert.revert(token.connect(user1).setBaseURI(baseURI), "only owner");
        await token.connect(owner).setBaseURI(baseURI);
        assert.equal(await token.tokenURI(0), baseURI + 0);
    })
})