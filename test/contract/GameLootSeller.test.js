const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');

describe("GameLootSeller", async function () {
    let treasure, equipment, seller, gameMinter, timelocker, revealSVG, registry;

    let owner, controller, signer, vault, user1, user2;
    let signers;

    /* --------- constructor args --------- */
    // 2 days
    const DAY = 86400;
    const cap = 90;
    const symbol = "Archloot";
    const name = "Archloot";
    const maxSupply = 10000;
    const ether = toBN(toWei('1', 'ether'));
    const price = 1;

    beforeEach(async function () {
        [owner, controller, signer, vault, user1, user2] = await hre.ethers.getSigners();
        signers = [signer.address];

        // deploy
        timelocker = await deployer.deployTimelocker(DAY * 2);
        treasure = await deployer.deployTreasure(controller.address, timelocker.address, signers);
        revealSVG = await deployer.deployReveal();
        equipment = await deployer.deployEquipment(
            revealSVG.address, name, symbol, treasure.address, vault.address, timelocker.address, signers, cap)
        seller = await deployer.deploySeller(equipment.address, timelocker.address, maxSupply, price, signers);

        /* ------------- set seller and gameMinter into equipment ------------- */
        //  init timelock params
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
    });

    it('sell setting should be as expected: ', async () => {
        /* ------------- only owner ------------- */
        await seller.connect(owner).openPresale();
        await assert.revert(seller.connect(user1).openPresale(), "Ownable: caller is not the owner");
        await seller.connect(owner).closePresale();
        await assert.revert(seller.connect(user1).closePresale(), "Ownable: caller is not the owner");
        await seller.connect(owner).openPublicSale();
        await assert.revert(seller.connect(user1).openPublicSale(), "Ownable: caller is not the owner");
        await seller.connect(owner).closePublicSale();
        await assert.revert(seller.connect(user1).closePublicSale(), "Ownable: caller is not the owner");
        await seller.connect(owner).setMaxPresale(5000);
        await assert.revert(seller.connect(user1).setMaxPresale(5000), "Ownable: caller is not the owner");
        await seller.connect(owner).setPubPer(2);
        await assert.revert(seller.connect(user1).setPubPer(2), "Ownable: caller is not the owner");
        await seller.connect(owner).setPrePer(1);
        await assert.revert(seller.connect(user1).setPrePer(1), "Ownable: caller is not the owner");

        // compare
        assert.equal(await seller.maxPresale(), 5000);
        assert.equal(await seller.pubPer(), 2);
        assert.equal(await seller.prePer(), 1);

        /* ------------- only timelocker ------------- */
        const GameLootTimelocker = await hre.ethers.getContractFactory("GameLootTimelocker");
        const timelocker1 = await GameLootTimelocker.connect(owner).deploy(DAY * 2);
        await timelocker1.deployed();

        // init timelocker params
        const target = seller.address;
        const value = '0';
        const setSignerSign = "setSigner(address,bool)";
        const setPriceSign = "setPrice(uint128)";
        const setMaxSupplySign = "setMaxSupply(uint128)";

        const setSignerData = web3.eth.abi.encodeParameters(['address', 'bool'], [user1.address, true]);
        const setPriceData = web3.eth.abi.encodeParameter('uint128', ether);
        const setMaxSupplyData = web3.eth.abi.encodeParameter('uint128', 10000);

        const now = await currentTime();
        const eta = now + DAY * 3;


        //  queue
        await timelocker.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);
        await timelocker.connect(owner).queueTransaction(target, value, setPriceSign, setPriceData, eta);
        await timelocker.connect(owner).queueTransaction(target, value, setMaxSupplySign, setMaxSupplyData, eta);
        await timelocker1.connect(owner).queueTransaction(target, value, setSignerSign, setSignerData, eta);
        await timelocker1.connect(owner).queueTransaction(target, value, setPriceSign, setPriceData, eta);
        await timelocker1.connect(owner).queueTransaction(target, value, setMaxSupplySign, setMaxSupplyData, eta);

        await fastForward(DAY * 4);

        //  execute
        // await assert.revert(await timelocker1.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta)," �y� is not timelocker");
        // await assert.revert(await timelocker1.connect(owner).executeTransaction(target, value, setPriceSign, setPriceData, eta)," �y� is not timelocker");
        // await assert.revert(await timelocker1.connect(owner).executeTransaction(target, value, setMaxSupplySign, setMaxSupplyData, eta)," �y� is not timelocker");
        await timelocker.connect(owner).executeTransaction(target, value, setSignerSign, setSignerData, eta);
        await timelocker.connect(owner).executeTransaction(target, value, setPriceSign, setPriceData, eta);
        await timelocker.connect(owner).executeTransaction(target, value, setMaxSupplySign, setMaxSupplyData, eta);
    })

    it('public sell should be success: ', async () => {
        await seller.connect(owner).openPublicSale();
        await seller.connect(owner).setPubPer(2);

        const amount = 2;
        await seller.connect(user1).pubSale(amount, { value: amount * price });

        assert.equal(await equipment.balanceOf(user1.address), amount);
    })

    it('pre sale should be success: ', async () => {
        await seller.connect(owner).openPresale();
        await seller.connect(owner).setMaxPresale(maxSupply / 2);
        await seller.connect(owner).setPrePer(2);

        const nonce = 0;
        const amount = 2;

        //  generate hash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256"],
            [user1.address, seller.address, nonce]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        await seller.connect(user1).preSale(amount, nonce, signData, { value: amount * price })
        assert.equal(await equipment.balanceOf(user1.address), amount);
    })
})