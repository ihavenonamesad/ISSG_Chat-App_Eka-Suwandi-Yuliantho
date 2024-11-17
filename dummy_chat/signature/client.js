const io = require("socket.io-client");
const readline = require("readline"); 
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({ 
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

const options = {
  modulusLength: 2048, 
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
};

const { privateKey: senderPrivateKey, publicKey: senderPublicKey } = crypto.generateKeyPairSync("rsa", options);

let registeredUsername = "";
let username = "";
const users = new Map();

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => { 
    username = input; 
    registeredUsername = input;

    console.log(`Welcome, ${username}, to the chat`);

    socket.emit("registerPublicKey", {
      username,
      publicKey: senderPublicKey,
    });

    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        if ((match = message.match(/^!impersonate (\w+)$/))) {
          const targetUsername = match[1];
          if (users.has(targetUsername)) 
            { 
              username = targetUsername;
              console.log(`impersonating ${username}`);
            } 
            else 
            {
              console.log(`No such user "${targetUsername}" exists.`);
            }
        } else if (message.match(/^!exit$/)) { 
          username = registeredUsername;
          console.log(`Now you are ${username}`);
        } else {
          try {
            const signature = crypto.sign("sha256", Buffer.from(message), senderPrivateKey);

            socket.emit("message", { 
              username,
              message,
              signature: signature.toString("base64"),
            });
          } catch (err) {
            console.error("Error signing the message:", err.message); 
          }
        }
      }
      rl.prompt();
    });
  });
});

socket.on("init", (keys) => {
  keys.forEach(([user, key]) => users.set(user, key));
  console.log(`\nThere are currently ${users.size} users in the chat`); 
  rl.prompt();
});

socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey);
  console.log(`${username} joined the chat`);
  rl.prompt();
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage, signature } = data;

  if (!senderUsername || !senderMessage || !signature) { 
    console.error("Error: Incomplete message received.", data); 
    return;
  }
  if (users.has(senderUsername)) { 
    const publicKey = users.get(senderUsername); 

    try {
      const isVerified = crypto.verify( 
        "sha256",
        Buffer.from(senderMessage),
        publicKey,
        Buffer.from(signature, "base64")
      );

      if (isVerified) {
        console.log(`${senderUsername}: ${senderMessage}`);
      } else {
        console.log(`Warning: Message from ${senderUsername} failed verification. This user may be fake.`);
      } 
    } catch (err) {
      console.error(`Error verifying message from ${senderUsername}:`, err.message);
    }
  } else {
    console.log(`Warning: Public key for ${senderUsername} not found. This user may be fake.`);
  }
  rl.prompt();
});

socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});
