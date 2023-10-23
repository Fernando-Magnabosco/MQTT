import constants from './constants.js';
var C = new constants();

function User () {
    this.knownUsers;
    this.client;
    this.id;
    this.connectMessage;
    this.disconnectMessage;

    this.init = function (id) {
        // Initialize MQTT client
        this.knownUsers = {};
        this.client = mqtt.connect(C.MQTT_BROKER);
        this.id = id;
        this.connectMessage = this.id + ' ' + C.ONLINE;
        this.disconnectMessage = this.id + ' ' + C.OFFLINE;

        // Set up event handlers for the client
        this.client.on('connect', this.onConnect.bind(this));
        this.client.on('message', this.onMessage.bind(this));
    }

    this.onConnect = function () {
        console.log('Connected to MQTT broker');

        this.client.subscribe(C.USERS);
        this.client.publish(C.USERS, this.connectMessage);
    }

    this.onMessage = function (topic, message) {
        const topicHandlers = {
            USERS: this.onUsersMessage.bind(this),
            CHAT: this.onChatMessage.bind(this)
        }

        topicHandlers[topic](message);
    }

    this.onUsersMessage = function (message) {
        const [userId, status] = message.toString().split(' ');
        if (!this.knownUsers[userId]) {
            this.client.publish(C.USERS, this.connectMessage);
        }
        this.knownUsers[userId] = status;
    }

    this.onChatMessage = function (message) {

    }

    this.onDisconnect = function () {
        this.client.publish(C.USERS, this.disconnectMessage);
    }

    setInterval(() => {
        console.log(this.knownUsers);
    }, 1000);
}


const me = new User();
const uuid = Math.random().toString(36).substring(7);
me.init(uuid);