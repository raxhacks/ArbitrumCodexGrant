const { Web3 } = require("web3");

const NUM_WALLETS = 1; // Number of wallets to generate

function generateWallets() {
    const web3 = new Web3();

    console.log("WALLET GENERATOR\n");

    for (let i = 0; i < NUM_WALLETS; i++) {
        const account = web3.eth.accounts.create();

        console.log(`--- Wallet ${i + 1} ---`);
        console.log("Address:", account.address);
        console.log("Private key:", account.privateKey);
        console.log("");
    }

    // NOTE: web3.js does not generate mnemonic phrases. Use ethers.js
    // (Wallet.createRandom()) or a BIP-39 library if you need mnemonics.

    console.log("WARNING");
    console.log("Store your private key securely.");
    console.log("Never share it or commit it to version control.");
    console.log("Anyone with access to it can control your funds.");
}

generateWallets();
