import constants from './constants.js';
var C = new constants();

function User () {
    this.knownUsers;
    this.client;
    this.id;
    this.connectMessage;
    this.disconnectMessage;

    this.ui = {
        userList: null,
        userId: null
    }

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

        this.initUI();
    }

    this.initUI = function () {
        this.ui.userList = $('#userList');
        this.ui.userId = $('#userId');
        this.ui.userList.on('click', 'li', this.onUserClick.bind(this));
    }

    this.onUserClick = function (event) {
        const userId = event.target.id;
        console.log(userId);
    }

    this.onConnect = function () {
        console.log('Connected to MQTT broker');

        this.client.subscribe(C.USERS);
        this.client.subscribe(this.id + C.OWN);
        this.client.publish(C.USERS, this.connectMessage);

        this.ui.userId.text(this.id);
    }

    this.onMessage = function (topic, message) {
        const controlTopicHandlers = {
            [C.USERS]: this.onUsersMessage.bind(this),
            [C.CHAT]: this.onChatMessage.bind(this),
            [this.id + C.OWN]: this.onRequest.bind(this)
        }
        if (controlTopicHandlers[topic]) {
            controlTopicHandlers[topic](message);
            return;
        }
    }

    this.onUsersMessage = function (message) {
        const [userId, status] = message.toString().split(' ');
        if (this.id === userId) return;

        if (!this.knownUsers[userId]) {
            this.client.publish(C.USERS, this.connectMessage);
        }
        this.knownUsers[userId] = status;

        if (status === C.OFFLINE) {
            this.ui.userList.find(`#${userId}`).remove();
            return;
        }

        this.ui.userList.append(`<li id="${userId}" role="button">${userId}</li>`);

    }

    this.onChatMessage = function (message) {

    }

    this.onRequest = function (message) {

    }

    this.onDisconnect = function () {
        this.client.publish(C.USERS, this.disconnectMessage);
    }

    // setInterval(() => {
    //     console.log(this.knownUsers);
    // }, 1000);
}


const me = new User();
const uuid = Math.random().toString(36).substring(7);
me.init(uuid);