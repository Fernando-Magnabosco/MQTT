const readline = require('readline');
const paho = require('paho-mqtt');


console.log(paho)


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("What is your name? ", (name) => {
    console.log(`Hello ${name}!`);
    rl.close();
});
