# Web3 / Blockchain / Smart Contract Knowledge Base

> Authoritative reference for Debo agents handling Ethereum, EVM-compatible chains, and Web3 development tasks.
> Sources: [Hardhat 3 docs](https://hardhat.org/docs), [Ethereum docs](https://ethereum.org/en/developers/docs/), [OpenZeppelin](https://docs.openzeppelin.com/), [Foundry Book](https://book.getfoundry.sh/)

---

## 1. Hardhat 3 (Current — `>=3.0.0-beta`)

### Setup
```bash
npm init -y
npm install --save-dev hardhat
npx hardhat init          # choose "TypeScript project" or "JavaScript project"
```

### Core Config (`hardhat.config.ts`)
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";   // recommended bundle

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL!,
      accounts: [process.env.PRIVATE_KEY!],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL!,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY },
};
export default config;
```

### Official Plugins (Hardhat 3)
| Package | Purpose | Key tags |
|---|---|---|
| `@nomicfoundation/hardhat-toolbox-viem` | Recommended bundle (viem-based) | viem, setup template |
| `@nomicfoundation/hardhat-toolbox-mocha-ethers` | Recommended bundle (ethers.js-based) | ethers, mocha |
| `@nomicfoundation/hardhat-keystore` | Encrypted keystore for secrets | key mgmt, secrets |
| `@nomicfoundation/hardhat-verify` | Auto-verify on Etherscan / Blockscout | verification |
| `@nomicfoundation/hardhat-network-helpers` | Simulate time, mine blocks, impersonate | testing, simulation |
| `@nomicfoundation/hardhat-ledger` | Ledger hardware wallet integration | hardware-wallet |
| `@nomicfoundation/hardhat-viem` | Integrate viem into Hardhat | viem, scripts |
| `@nomicfoundation/hardhat-viem-assertions` | viem-based test assertions | testing, assertions |
| `@nomicfoundation/hardhat-ethers` | Integrate ethers.js into Hardhat | ethers, scripts |

### Common Tasks
```bash
npx hardhat compile           # compile contracts → artifacts/
npx hardhat test              # run tests
npx hardhat node              # local network (port 8545, chainId 31337)
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDR> <CONSTRUCTOR_ARGS>
npx hardhat clean             # remove artifacts/ and cache/
```

---

## 2. Solidity Quick Reference

### Contract Structure
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}
```

### Key Global Variables
| Variable | Type | Description |
|---|---|---|
| `msg.sender` | `address` | Caller of the current function |
| `msg.value` | `uint256` | ETH sent with the call (wei) |
| `block.timestamp` | `uint256` | Current block timestamp (seconds) |
| `block.number` | `uint256` | Current block number |
| `tx.origin` | `address` | Original EOA that initiated the tx (avoid for auth) |

### Data Locations
- `storage` — persistent on-chain (expensive)
- `memory` — temporary during function call (cheap)
- `calldata` — immutable function args (cheapest for external functions)

### Common Patterns
```solidity
// Checks-Effects-Interactions (CEI) — prevents reentrancy
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");  // CHECK
    balances[msg.sender] -= amount;                           // EFFECT
    (bool ok, ) = msg.sender.call{value: amount}("");         // INTERACT
    require(ok, "Transfer failed");
}

// Reentrancy guard (OpenZeppelin)
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
function withdraw() external nonReentrant { ... }

// Events
event Transfer(address indexed from, address indexed to, uint256 amount);
emit Transfer(msg.sender, to, amount);
```

---

## 3. ERC Standards

| Standard | Description | Key Methods |
|---|---|---|
| ERC-20 | Fungible token | `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance` |
| ERC-721 | NFT (non-fungible) | `ownerOf`, `safeTransferFrom`, `tokenURI`, `approve` |
| ERC-1155 | Multi-token (fungible + NFT) | `safeTransferFrom`, `balanceOfBatch`, `uri` |
| ERC-4626 | Tokenized vault | `deposit`, `withdraw`, `convertToShares`, `convertToAssets` |
| ERC-2981 | NFT royalty info | `royaltyInfo` |

### OpenZeppelin Imports
```solidity
// Tokens
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

// Access
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// Security
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Upgradeable proxies
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
```

---

## 4. Testing with Hardhat + Viem

```typescript
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("MyToken", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("MyToken", [1_000_000n]);
    return { token, owner, alice, bob };
  }

  it("should mint initial supply to deployer", async function () {
    const { token, owner } = await loadFixture(deployFixture);
    const bal = await token.read.balanceOf([owner.account.address]);
    expect(bal).to.equal(1_000_000n * 10n ** 18n);
  });

  it("reverts on insufficient balance", async function () {
    const { token, alice, bob } = await loadFixture(deployFixture);
    await expect(
      token.write.transfer([bob.account.address, 1n], { account: alice.account })
    ).to.be.rejectedWith("ERC20InsufficientBalance");
  });
});
```

### Network Helpers (time/block manipulation)
```typescript
import { time, mine, impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

await time.increase(3600);               // fast-forward 1 hour
await time.increaseTo(1_800_000_000);    // set specific timestamp
await mine(100);                         // mine 100 blocks
await impersonateAccount("0x...");       // act as any address
```

---

## 5. viem (Recommended Client Library)

```typescript
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Read client
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

// Wallet client
const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);
const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

// Read contract
const balance = await publicClient.readContract({
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  // USDC
  abi: erc20Abi,
  functionName: "balanceOf",
  args: ["0x..."],
});

// Write contract
const txHash = await walletClient.writeContract({
  address: contractAddress,
  abi,
  functionName: "transfer",
  args: ["0x...", parseEther("1.0")],
});

// Wait for receipt
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
```

---

## 6. ethers.js v6

```typescript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Deploy
const factory = new ethers.ContractFactory(abi, bytecode, signer);
const contract = await factory.deploy(...constructorArgs);
await contract.waitForDeployment();

// Interact
const erc20 = new ethers.Contract(address, erc20Abi, signer);
const tx = await erc20.transfer(recipient, ethers.parseEther("1.0"));
await tx.wait();

// Utilities
ethers.parseEther("1.0")        // → 1000000000000000000n (BigInt weis)
ethers.formatEther(1000000000000000000n)  // → "1.0"
ethers.keccak256(ethers.toUtf8Bytes("text"))
ethers.id("Transfer(address,address,uint256)")  // event topic
```

---

## 7. Foundry (Alternative to Hardhat)

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup

forge init my-project          # scaffold new project
forge build                    # compile
forge test                     # run tests (faster than Hardhat)
forge test -vvvv               # verbose (shows traces)
forge test --match-test testFoo
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
cast call <ADDR> "balanceOf(address)" <HOLDER>      # read contract
cast send <ADDR> "transfer(address,uint256)" <TO> 1ether --private-key $PK
anvil                          # local testnet (like hardhat node)
```

### Forge Test Pattern (Solidity tests)
```solidity
// test/MyToken.t.sol
pragma solidity ^0.8.28;
import "forge-std/Test.sol";
import "../src/MyToken.sol";

contract MyTokenTest is Test {
    MyToken token;
    address alice = makeAddr("alice");

    function setUp() public {
        token = new MyToken(1_000_000);
    }

    function test_InitialSupply() public view {
        assertEq(token.balanceOf(address(this)), 1_000_000 * 10**18);
    }

    function testFuzz_Transfer(uint256 amount) public {
        amount = bound(amount, 1, token.balanceOf(address(this)));
        token.transfer(alice, amount);
        assertEq(token.balanceOf(alice), amount);
    }
}
```

---

## 8. Web3.js v4

```typescript
import { Web3 } from "web3";

const web3 = new Web3(process.env.RPC_URL);
const contract = new web3.eth.Contract(abi, address);

// Reading
const balance = await contract.methods.balanceOf("0x...").call();

// Sending
const tx = await contract.methods.transfer("0x...", web3.utils.toWei("1", "ether"))
  .send({ from: account, gas: "21000" });

// Utils
web3.utils.toWei("1", "ether")     // → "1000000000000000000"
web3.utils.fromWei("1000000000000000000", "ether")  // → "1"
web3.utils.keccak256("text")
web3.utils.isAddress("0x...")
```

---

## 9. Wagmi (React Hooks for Web3)

```typescript
import { useAccount, useBalance, useReadContract, useWriteContract } from "wagmi";
import { parseEther } from "viem";

// Connect + read account
const { address, isConnected } = useAccount();
const { data: balance } = useBalance({ address });

// Read contract
const { data: tokenBalance } = useReadContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [address],
});

// Write contract
const { writeContract, isPending } = useWriteContract();
writeContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "approve",
  args: [spenderAddress, parseEther("100")],
});
```

### Wagmi Config (vite app)
```typescript
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, metaMask, walletConnect } from "wagmi/connectors";

const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [injected(), metaMask(), walletConnect({ projectId: "..." })],
  transports: { [mainnet.id]: http(), [sepolia.id]: http() },
});
```

---

## 10. DeFi Concepts

### AMM / Uniswap V3
```typescript
// Swap via Uniswap V3 universal router
const UNIVERSAL_ROUTER = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
// Key interfaces: IUniswapV3Pool, ISwapRouter, IQuoterV2
// Token path encoding: abi.encodePacked(tokenIn, fee, tokenOut)
// Fee tiers: 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%)
```

### Flash Loans (Aave V3)
```solidity
interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}
// Premium: 0.05% (5 basis points)
```

### Price Oracles — Chainlink
```solidity
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

AggregatorV3Interface priceFeed = AggregatorV3Interface(0x...);
(, int256 price, , , ) = priceFeed.latestRoundData();
// price has 8 decimals for USD feeds
```

---

## 11. Security — Common Vulnerabilities

| Vulnerability | Description | Prevention |
|---|---|---|
| **Reentrancy** | External call allows attacker to re-enter before state update | CEI pattern + `ReentrancyGuard` |
| **Integer overflow/underflow** | Arithmetic wraps (pre-0.8) | Solidity ≥0.8 has built-in checks; use `unchecked {}` sparingly |
| **tx.origin auth** | `tx.origin` can be spoofed via phishing | Use `msg.sender` for auth |
| **Front-running** | Mempool visibility lets attackers sandwich txs | Commit-reveal, slippage limits |
| **Signature replay** | Old signatures reused | EIP-712 + nonces + `chainId` |
| **Unchecked call return** | `call()` returns bool, ignore = silent failure | Always check return value |
| **Oracle manipulation** | Flash loan attacks on on-chain price feeds | Use Chainlink TWAP, multi-oracle |
| **Access control missing** | Admin functions without `onlyOwner` | `Ownable`, `AccessControl`, role checks |
| **Logic errors in ERC20** | Missing approval, wrong `transferFrom` | Test all ERC-20 edge cases |
| **Proxy storage collision** | Proxy and impl use same storage slot | Use EIP-1967 storage slots |

### Static Analysis Tools
```bash
# Slither (Python)
pip install slither-analyzer
slither contracts/MyToken.sol

# Mythril
myth analyze contracts/MyToken.sol --solv 0.8.28

# Aderyn (Rust, by Cyfrin)
cargo install aderyn
aderyn .
```

---

## 12. Deployment Workflows

### Hardhat Ignition (Hardhat 3 native)
```typescript
// ignition/modules/MyToken.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MyToken", (m) => {
  const initialSupply = m.getParameter("initialSupply", 1_000_000n);
  const token = m.contract("MyToken", [initialSupply]);
  return { token };
});
```
```bash
npx hardhat ignition deploy ignition/modules/MyToken.ts --network sepolia
```

### Script-based deploy (ethers.js)
```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy(1_000_000);
  await token.waitForDeployment();
  console.log("Token deployed to:", await token.getAddress());
}
main().catch(console.error);
```

### Verification
```bash
# Hardhat verify plugin
npx hardhat verify --network sepolia <ADDR> 1000000

# Foundry
forge verify-contract <ADDR> src/MyToken.sol:MyToken \
  --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY
```

---

## 13. Key Networks & Chain IDs

| Network | Chain ID | RPC |
|---|---|---|
| Ethereum Mainnet | 1 | `https://mainnet.infura.io/v3/<KEY>` |
| Sepolia (testnet) | 11155111 | `https://sepolia.infura.io/v3/<KEY>` |
| Polygon | 137 | `https://polygon-rpc.com` |
| Arbitrum One | 42161 | `https://arb1.arbitrum.io/rpc` |
| Optimism | 10 | `https://mainnet.optimism.io` |
| Base | 8453 | `https://mainnet.base.org` |
| BNB Smart Chain | 56 | `https://bsc-dataseed.binance.org` |
| Hardhat local | 31337 | `http://127.0.0.1:8545` |

---

## 14. RPC Providers

| Provider | Free tier | Notes |
|---|---|---|
| Infura | 100k req/day | Best for mainnet + Sepolia |
| Alchemy | 300M compute units/mo | Advanced APIs, webhooks |
| QuickNode | Limited | Low-latency endpoints |
| Ankr | 100 req/s | Multi-chain support |
| Chainstack | Limited | IPFS + archive nodes |
| Public Infra | None | Unreliable — dev only |

---

## 15. Environment Variables for Web3 Projects
```bash
# RPC
MAINNET_RPC_URL=https://mainnet.infura.io/v3/<KEY>
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<KEY>
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/<KEY>

# Signing
PRIVATE_KEY=0x...        # NEVER commit — use .env + .gitignore

# Verification
ETHERSCAN_API_KEY=
POLYGONSCAN_API_KEY=

# Optional
REPORT_GAS=true          # Hardhat gas reporter
COINMARKETCAP_API_KEY=   # For USD gas cost reporting
```

---

## 16. Common Hardhat Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `ProviderError: invalid block tag` | Calling with stale block ref | Use `"latest"` block tag |
| `Error: nonce too low` | Tx nonce out of sync | Reset metamask account or use `--pending` nonce |
| `Error: insufficient funds` | Deployer has no ETH | Fund account from faucet |
| `Error: contract not found in artifacts` | Forgot to compile | Run `npx hardhat compile` |
| `TypeError: cannot read property 'address'` | Contract not deployed yet | Ensure `waitForDeployment()` before reading address |
| `Error: missing revert data` | Revert without message | Use `--verbose` or decode with `cast` |
| `DEPLOYMENT_FAILED` (Ignition) | Artifact mismatch | Delete `.deployments/` folder, redeploy |

---

## 17. Gas Optimization Tips

- Use `uint256` not `uint8/16/32` in storage (EVM word packs only in structs)
- Mark public vars that don't need a getter as `private` + manual getter
- Use `calldata` over `memory` for external function array params
- Use `immutable` for constructor-set values (stored in bytecode)
- Use `constant` for compile-time constants (no SLOAD)
- Emit events instead of storing frequently read data on-chain
- Pack multiple `uint128` / `address` / `bool` into one storage slot in structs
- Use `++i` not `i++` in loops
- Short-circuit with `unchecked {}` for provably safe math (e.g., loop counters)
- `mapping(address => bool)` is cheaper than `address[]` for membership checks
