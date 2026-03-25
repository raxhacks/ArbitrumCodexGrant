const { ethers } = require("ethers");

// ==================== CONFIGURATION ====================
const NUM_WALLETS = 1; // Number of wallets to generate

// ==================== MAIN ====================
function generateWallets() {
    console.log("==================== WALLET GENERATOR ====================\n");

    for (let i = 0; i < NUM_WALLETS; i++) {
        const wallet = ethers.Wallet.createRandom();

        console.log(`--- Wallet ${i + 1} ---`);
        console.log("Address:", wallet.address);
        console.log("Private key:", wallet.privateKey);
        console.log("Public key:", wallet.publicKey);
        if (wallet.mnemonic) {
            console.log("Mnemonic:", wallet.mnemonic.phrase);
            console.log("Path:", wallet.mnemonic.path);
        }
        console.log("");
    }

    console.log("==================== WARNING ====================");
    console.log("Store your private key and mnemonic securely.");
    console.log("Never share them or commit them to version control.");
    console.log("Anyone with access to these can control your funds.");
}

generateWallets();
