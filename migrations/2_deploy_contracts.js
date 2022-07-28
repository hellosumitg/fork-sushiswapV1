const Factory = artifacts.require('uniswapv2/UniswapV2Factory.sol'); // this contract is used to create `Pair-Token`(i.e where or using which the actual trading takes place)
const Router = artifacts.require('uniswapv2/UniswapV2Router02.sol');
const WETH = artifacts.require('WETH.sol');
const MockERC20 = artifacts.require('MockERC20.sol'); // for deploying MockERC20 Token of `sushiswap`, so that we can deploy some uniswap pool with them
const SushiToken = artifacts.require('SushiToken.sol'); // governance token of `sushiswap`
const MasterChef = artifacts.require('MasterChef.sol'); // where we can stake our `Liquidity Provider Token` and in exchange we get rewarded with `SushiToken`
const SushiBar = artifacts.require('SushiBar.sol'); // where we can stake our `SushiToken` to get even more `SushiToken`
const SushiMaker = artifacts.require('SushiMaker.sol'); // contract used by `SushiBar` to get its `SushiToken` Treasury. 
// It basically converts the `tradingFee` of different `Pair-Token` or `Pair-Market` of `SushiSwap` into `SushiToken` and send this `SushiToken` to `SushiBar`
// which inturn distributed to all the `staker` of `SushiToken`
const Migrator = artifacts.require('Migrator.sol'); // this allows to do a `Liquidity Attack`

module.exports = async function(deployer, _network, addresses) {
  const [admin, _] = addresses;

  // Deploying WETH and creating several instances
  await deployer.deploy(WETH);
  const weth = await WETH.deployed(); // here referencing the deployed `WETH` once the transaction have been mine
  const tokenA = await MockERC20.new('Token A', 'TKA', web3.utils.toWei('1000')); // i.e total of `1000 * 10 ** 18` wei of token A
  const tokenB = await MockERC20.new('Token B', 'TKB', web3.utils.toWei('1000')); // i.e total of `1000 * 10 ** 18` wei of token B

  // Deploying uniswap's factory smart contract so as to create some Pair Tokens(i.e market for `uniswap`)
  await deployer.deploy(Factory, admin);
  const factory = await Factory.deployed();
  await factory.createPair(weth.address, tokenA.address);
  await factory.createPair(weth.address, tokenB.address);
  await deployer.deploy(Router, factory.address, weth.address);
  const router = await Router.deployed();

  // Deploying sushiswap's smart contract and creating its reference
  await deployer.deploy(SushiToken);
  const sushiToken = await SushiToken.deployed(); // referencing to deployed `SushiToken`

  await deployer.deploy(
    MasterChef, 
    sushiToken.address,
    admin, // admin address for getting some extra rights 
    // Now we are going to specify the number of `sushiTokens` that will be created for each block
    // as these tokens will be shared among all the addresses that stake the liquidity provider in MasterChef
    web3.utils.toWei('100'), // for example lets take `100*10**18` wei of `SushiToken` for each block
    // Let's say `1` will be our `First or Start block` as we are going to deploy on the local development blockchain but the value of first block might be different in the case of `Mainnet`
    1, // Start block (i.e when the reward of `SushiToken` will start, that means before this block, No `SushiToken` will be created)
    1 // End block (i.e for the `Bonus` till this block Bonus will be provided) 
    // which means in the beginning there will be a Bonus period where some extra amount of `SushiToken` are created in order to incentivize the early adopters)
  );
  const masterChef = await MasterChef.deployed(); // referencing to deployed `MasterChef`
  await sushiToken.transferOwnership(masterChef.address); // transferring ownership of the `SushiToken` to `MasterChef`
  // because `MasterChef` will need to call the `mint()` of `SushiToken` in order to create the `SushiReward`, 
  // So since `SushiToken` inherit from the Ownable contract of Openzeppelin it has a method that is called transfer Ownership

  // Deploying `SushiBar` 
  await deployer.deploy(SushiBar, sushiToken.address);
  const sushiBar = await SushiBar.deployed();

  // Deploying `SushiMaker`
  await deployer.deploy(
    SushiMaker,
    factory.address, // factory address of `SushiSwap` not the factory address of `Uniswap`
    sushiBar.address,
    sushiToken.address, 
    weth.address
  );
  const sushiMaker = await SushiMaker.deployed();
  // Address must be updated that will receive the `tradingFee` in the factory. 
  // Hence, the `tradingFee` needs to be owned by `SushiMaker`, so that it can convert this `tradingFee` into `SushiToken`
  await factory.setFeeTo(sushiMaker.address); // as we didn't specify any address for factory before we actually deploy it, 
  // so it will by default use the first address that we had specified in the `addresses` array (i.e `admin`s address in our case)
  // so when we send a transaction without specifying the address it's as if we do this `await factory.setFeeTo(sushiMaker.address, {from: addresses[0]});`

  // Deploying `SushiSwap` Migrator (liquidity attack)
  await deployer.deploy(
    Migrator,
    masterChef.address,
    '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // address of the Uniswap's Factory
    factory.address, // factory address of `SushiSwap`
    1 // first block from when we can do the migration as we are going to deploy on the local development blockchain
    // but the value of first block might be different in the case of `Mainnet`
  );
};