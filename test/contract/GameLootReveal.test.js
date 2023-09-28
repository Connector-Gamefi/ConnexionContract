describe("GameLootReveal", async function () {
    let reveal;

    beforeEach(async function () {
        const GameLootReveal = await hre.ethers.getContractFactory("GameLootReveal");
        reveal = await GameLootReveal.deploy();
        await reveal.deployed();
    });

    it('gen svg 1: ', async () => {
        console.log(await reveal.genSVG([[0, 1], [1, 3], [2, 2000000003], [3, 2000000030], [4, 2000000300], [5, 2000003000], [6, 2000030000], [7, 2000300000], [8, 2003000000], [9, 2030000000], [10, 2000000000]]));
    });
    it('gen svg 2: ', async () => {
        console.log(await reveal.genSVG([[0, 2], [1, 3], [2, 2000000003], [3, 2000000030], [4, 2000000300], [5, 2000003000], [6, 2000030000], [7, 2000300000], [8, 2003000000], [9, 2030000000], [10, 2000000000]]));
    });
    it('gen svg 3: ', async () => {
        console.log(await reveal.genSVG([[0, 3], [1, 3], [2, 2000000003], [3, 2000000030], [4, 2000000300], [5, 2000003000], [6, 2000030000], [7, 2000300000], [8, 2003000000], [9, 2030000000], [10, 2000000000]]));
    });
    it('gen svg 4: ', async () => {
        console.log(await reveal.genSVG([[0, 4], [1, 3], [2, 2000000003], [3, 2000000030], [4, 2000000300], [5, 2000003000], [6, 2000030000], [7, 2000300000], [8, 2003000000], [9, 2030000000], [10, 2000000000]]));
    });
    it('gen svg 5: ', async () => {
        console.log(await reveal.genSVG([[0, 0], [1, 3], [2, 2000000003], [3, 2000000030], [4, 2000000300], [5, 2000003000], [6, 2000030000], [7, 2000300000], [8, 2003000000], [9, 2030000000], [10, 2000000000]]));
    });
})