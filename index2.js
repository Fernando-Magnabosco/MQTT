import constants from './constants.js';
var C = new constants();

function User () {
    this.knownUsers;
    this.requestedUsers;
    this.chatUsers;
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
        this.requestedUsers = {};
        this.chatUsers = {};
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
        this.ui.userList.on('click', '.start-a-chat', this.onStartChatClick.bind(this));
        this.ui.userList.on('click', '.user-accept', this.onAcceptClick.bind(this));
    }

    this.onStartChatClick = function (event) {
        const userId = $(event.target).data('user-id');
        this.client.publish(userId + C.CONTROL, this.id);
        console.log('publishing to ' + userId + C.CONTROL);
        this.requestedUsers[userId] = true;
    }

    this.onAcceptClick = function (event) {
        const userId = $(event.target).data('user-id');
        const newTopic = `${this.id}_${userId}_${new Date().getTime()}`;
        this.client.subscribe(newTopic);
        this.client.publish(userId + C.CONTROL, newTopic);
        this.ui.userList.find(`#${userId} .user-chat`).removeClass('d-none');
        this.ui.userList.find(`#${userId} .user-accept`).addClass('d-none');
        this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');  
    }

    this.onConnect = function () {
        console.log('Connected to MQTT broker');

        this.client.subscribe(C.USERS);
        this.client.subscribe(this.id + C.CONTROL);
        this.client.publish(C.USERS, this.connectMessage);

        this.ui.userId.text(this.id);
    }

    this.onMessage = function (topic, message) {
        const controlTopicHandlers = {
            [C.USERS]: this.onUsersMessage.bind(this),
            [C.CHAT]: this.onChatMessage.bind(this),
            [this.id + C.CONTROL]: this.onRequest.bind(this)
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
            this.knownUsers[userId] = status;
            this.ui.userList.append(`<li id="${userId}" role="button" class="list-group-item">
            <div class="d-flex justify-content-between">
            <span>${userId}</span>
            <div>
            <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-accept d-none">Aceitar solicitacao</button>
            <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right start-a-chat">Comecar novo chat</button>
            <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-chat d-none">Chat</button>
            </div>
            </div>
            </li>`);
        }

        if (status === C.OFFLINE) {
            this.ui.userList.find(`#${userId}`).remove();
            return;
        }


    }

    this.onChatMessage = function (message) {

    }

    this.onRequest = function (message) {
        const [userId] = message.toString().split('_');

        if (this.requestedUsers[userId]) {
            this.requestedUsers[userId] = false;
            this.chatUsers[userId] = true;
            this.client.subscribe(message.toString());
            this.ui.userList.find(`#${userId} .user-chat`).removeClass('d-none');
            this.ui.userList.find(`#${userId} .user-accept`).addClass('d-none');
            this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');
            return;
        }

        this.ui.userList.find(`#${userId} .user-accept`).removeClass('d-none');
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