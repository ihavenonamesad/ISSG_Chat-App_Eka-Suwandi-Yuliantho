const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> "
});

let username = "";
const secretKey = "shared_secret_key"; 

function createHash(message) {
    return crypto.createHmac("sha256", secretKey).update(message).digest("hex");
}

socket.on("connect", () => {
    console.log("Connected to the server");

    rl.question("Enter your username: ", (input) => {
        username = input.trim() || "Anonymous";
        console.log(`Welcome, ${username} to the chat`);
        rl.prompt();

        rl.on("line", (message) => {
            if (message.trim()) {
                const messageHash = createHash(message);
                socket.emit("message", { username, message, hash: messageHash });
            }
            rl.prompt();
        });
    });
});

socket.on("message", (data) => {
    const {username: senderUsername, message: senderMessage, hash: receivedHash} = data;
    const calculatedHash = createHash(senderMessage);
    if (calculatedHash === receivedHash) {
        if (senderUsername !== username) {
            console.log(`${senderUsername}: ${senderMessage}`);
        }
    } else {
        console.log(`[Warning] The message from ${senderUsername} may have been tampered with!`);
    }
});

socket.on("disconnect", () => {
    console.log("Server disonnected. Exiting...");
    rl.close();
    process.exit(0);
});


rl.on("SIGINT", () => {
    console.log("\nExiting...");
    socket.disconnect();
    rl.close();
    process.exit(0);
})