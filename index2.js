// // location.port = 5002;
// console.log(location);
// // Create a client instance
// var client = new Paho.MQTT.Client(location.hostname, 1884, "clientId");
// client.debug = true;
// // set callback handlers
// client.onConnectionLost = onConnectionLost;
// client.onMessageArrived = onMessageArrived;



// // connect the client
// client.connect({onSuccess: onConnect, mqttVersion: 3});


// // called when the client connects
// function onConnect () { 
//   // Once a connection has been made, make a subscription and send a message.
//   console.log("onConnect");
//   client.subscribe("World");
//     const message = new Paho.MQTT.Message("Hello");
//   message.destinationName = "World";
//   client.send(message);
// }

// // called when the client loses its connection
// function onConnectionLost(responseObject) {
//   if (responseObject.errorCode !== 0) {
//     console.log("onConnectionLost:"+responseObject.errorMessage);
//   }
// }

// // called when a message arrives
// function onMessageArrived(message) {
//   console.log("onMessageArrived:"+message.payloadString);
// }


// Initialize MQTT client
var client = mqtt.connect('ws://localhost:8080');

// Set up event handlers for the client
client.on('connect', function () {
    console.log('Connected to MQTT broker');
    // Subscribe to a topic when connected
    client.subscribe('World');
    client.publish('World', 'Hello mqtt');
});

client.on('message', function (topic, message) {
    if('iam ontheline ' + document.getElementsByClassName('user-id')[0].value == message.toString()) {
        return
    }
    console.log(message.toString());        
});

// on key press send message
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        client.publish('World', 'Hello mqtt');
        console.log("Pedro Manfio Lill");
    }
});


setInterval(
    () => {
        //grab the input value
        const [myID] = document.getElementsByClassName('user-id'); 
        
        client.publish('World', 'iam ontheline ' + myID.value);
    }, 1000
)