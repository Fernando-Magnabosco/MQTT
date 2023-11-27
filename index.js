import constants from './constants.js';
var C = new constants();

function User () {
    this.knownUsers;
    this.requestedUsers;
    this.chatUsers;
    this.client;
    this.requestHistory;
    this.messageHistory;
    this.id;
    this.connectMessage;
    this.disconnectMessage;
    this.groups;

    this.ui = {
        userList: null,
        groupList: null,
        userId: null,
        toggleConnectBtn: null,

    }

    this.init = function (id) {
        // Initialize MQTT client
        this.knownUsers = {};
        this.requestedUsers = {};
        this.chatUsers = {};
        this.requestHistory = {};
        this.messageHistory = {};
        this.id = id;
        this.connectMessage = this.id + ' ' + C.ONLINE;
        this.disconnectMessage = this.id + ' ' + C.OFFLINE;
        this.groups = {};
        this.connect();
        this.initUI();
    }

    this.connect = function () {
        this.client = mqtt.connect(C.MQTT_BROKER);
        // Set up event handlers for the client
        this.client.on('connect', this.onConnect.bind(this));
        this.client.on('message', this.onMessage.bind(this));
    }

    this.disconnect = function () {
        this.client.publish(C.USERS, this.disconnectMessage);
        this.client.end();
    }

    this.initUI = function () {
        this.ui.userList = $('#userList');
        this.ui.groupList = $('#groupList');
        this.ui.userId = $('#userId');
        this.ui.toggleConnectBtn = $('#toggleConnectBtn');
        this.ui.createGroupBtn = $('#createGroupBtn');
        this.ui.requestHitoryBtn = $('#requestHistoryBtn');

        this.ui.toggleConnectBtn.on('click', this.onToggleConnect.bind(this));
        this.ui.userList.on('click', '.start-a-chat', this.onStartChatClick.bind(this));
        this.ui.userList.on('click', '.user-accept', this.onAcceptClick.bind(this));
        this.ui.userList.on('click', '.user-chat', this.onChatClick.bind(this));
        this.ui.createGroupBtn.on('click', this.onCreateGroupClick.bind(this));
        this.ui.requestHitoryBtn.on('click', this.onRequestHistoryClick.bind(this));
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
        this.chatUsers[userId] = newTopic;
        this.client.publish(userId + C.CONTROL, newTopic);
        this.ui.userList.find(`#${userId} .user-chat`).removeClass('d-none');
        this.ui.userList.find(`#${userId} .user-accept`).addClass('d-none');
        this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');
    }

    this.onChatClick = function (event) {
        const userId = $(event.target).data('user-id');

        const inputBox = $(`<div class="input-group mb-3">
        <input type="text" class="form-control" placeholder="Digite sua mensagem" aria-label="Recipient's username" aria-describedby="button-addon2">
        <button class="btn btn-outline-secondary" type="button" id="button-addon2">Enviar</button>
        </div>`);
        inputBox.on('click', '#button-addon2', this.onSendMessage.bind(this));
        this.ui.userList.find(`#${userId}`).append(inputBox);
    }

    this.onSendMessage = function (event) {
        const userId = $(event.target).parent().parent().attr('id');
        const userTopic = this.chatUsers[userId];
        const message = $(event.target).parent().find('input').val();
        this.client.publish(userTopic, message);

        if (!this.messageHistory[userId]) {
            this.messageHistory[userId] = [];
        }
        this.messageHistory[userId].push(message);
        console.log(this.messageHistory);

        $(event.target).parent().remove();
    }

    this.onConnect = function () {
        console.log('Connected to MQTT broker');

        this.client.subscribe(C.USERS);
        this.client.subscribe(C.GROUPS);
        this.client.subscribe(this.id + C.CONTROL);
        this.client.publish(C.USERS, this.connectMessage);

        this.ui.userId.text(this.id);
    }

    this.onMessage = function (topic, message) {
        const controlTopicHandlers = {
            [C.USERS]: this.onUsersMessage.bind(this),
            [C.CHAT]: this.onChatMessage.bind(this),
            [C.GROUPS]: this.onGroupMessage.bind(this),
            [this.id + C.CONTROL]: this.onRequest.bind(this)
        }

        console.log('Received message:', topic, message.toString());

        if (controlTopicHandlers[topic]) {
            controlTopicHandlers[topic](message);
            return
        }

        const [sender, receiver, timestamp] = topic.split('_');
        if (this.id !== receiver) return;

        if (!this.messageHistory[sender]) {
            this.messageHistory[sender] = [];
        }

        this.messageHistory[sender].push(message.toString());
        console.log(this.messageHistory);

    }

    this.onUsersMessage = function (message) {
        const [userId, status] = message.toString().split(' ');
        if (this.id === userId) return;

        if (!this.knownUsers[userId]) {
            this.client.publish(C.USERS, this.connectMessage);
            this.knownUsers[userId] = status;
            this.ui.userList.append(
                `<li id="${userId}" role="button" class="list-group-item">
                    <div class="d-flex justify-content-between">
                        <div>
                            <span>${userId}</span>
                            <span class="badge ${status === 'online' ? 'bg-primary' : 'bg-danger'} badge-pill">${status}</span>
                        </div>
                        <div>
                            <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-accept d-none">Aceitar solicitacao</button>
                            <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right start-a-chat">Comecar novo chat</button>
                            <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-chat d-none">Chat</button>
                        </div>
                    </div>
                </li>`);
        }

        if (status === C.OFFLINE) {
            this.ui.userList.find(`#${userId}`).find('.badge').removeClass('bg-primary').addClass('bg-danger').text(status);
            return;
        }
        this.ui.userList.find(`#${userId}`).find('.badge').removeClass('bg-danger').addClass('bg-primary').text(status);
    }

    this.onChatMessage = function (message) {

    }

    this.onGroupMessage = function (message) {
        console.log(message);
        const grupo = JSON.parse(message.toString());
        if (grupo.usuarios.indexOf(this.id) !== -1) return;
        this.renderGroup(grupo, false);
    }

    this.onRequest = function (message) {
        const [userId] = message.toString().split('_');

        this.requestHistory.push(userId + new Date().getTime());

        if (this.requestedUsers[userId]) {
            this.requestedUsers[userId] = false;
            this.chatUsers[userId] = message.toString();
            this.client.subscribe(message.toString());
            this.ui.userList.find(`#${userId} .user-chat`).removeClass('d-none');
            this.ui.userList.find(`#${userId} .user-accept`).addClass('d-none');
            this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');
            return;
        }

        this.ui.userList.find(`#${userId} .user-accept`).removeClass('d-none');
        this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');
    }

    this.onToggleConnect = function (event) {
        if (this.ui.toggleConnectBtn.hasClass('btn-success')) {

            this.connect();
            this.ui.toggleConnectBtn.removeClass('btn-success').addClass('btn-danger').text('Desconectar');
            return;
        }

        this.disconnect();
        this.ui.toggleConnectBtn.removeClass('btn-danger').addClass('btn-success').text('Conectar');
    }

    this.onCreateGroupClick = function (event) {
        const nomeDoGrupo = $('#groupName').val();
        const grupo = {nome: nomeDoGrupo, usuarios: [this.id], dono: this.id};
        this.client.publish(C.GROUPS, JSON.stringify(grupo));
        this.renderGroup(grupo);
    }

    this.onRequestHistoryClick = function (event) {
        console.log(this.requestHistory);
    }

    this.renderGroup = function (grupo, isMember = true) {
        if (this.groups[grupo.nome]) return;
        this.groups[grupo.nome] = grupo;
        this.ui.groupList.append(
            `<li id="${grupo.nome}" role="button" class="list-group-item">
                <div class="d-flex justify-content-between">
                    <div>
                        <span>${grupo.nome}</span>
                    </div>
                    <div>
                    <span> ${grupo.dono} </span>
                    </div>
                    ${!isMember ?
                `<div class="serMembro btn btn-primary" data-group-name="${grupo.nome}" data-dono="${grupo.dono}"type="button" class="btn btn-primary btn-sm float-right">Ser membro</div>`

                : ''}
                    <button class="verMembros btn btn-primary" data-group-name="${grupo.nome}" type="button" class="btn btn-primary btn-sm float-right">Ver grupo</button>    
                </div>
            </li>`);

        // group list ultimo elemento
        const last = this.ui.groupList.find('li:last-child');
        const btnVerMembros = last.find('.verMembros');
        const btnSerMembro = last.find('.serMembro');
        btnVerMembros.on('click', this.onVerMembrosClick.bind(this));
        btnSerMembro.on('click', this.onSerMembroClick.bind(this));
    }

    this.onVerMembrosClick = function (event) {
        const nomeDoGrupo = $(event.target).data('group-name');
        console.log(nomeDoGrupo, this.groups[nomeDoGrupo]);
    }

    this.onSerMembroClick = function (event) {
        const nomeDoGrupo = $(event.target).data('group-name');
        const donoDoGrupo = $(event.target).data('dono');

        this.client.publish(donoDoGrupo + C.CONTROL, nomeDoGrupo);

    }

    setInterval(() => {
        // console.log(this.chatUsers);

    }, 1000);

}


const me = new User();
const uuid = Math.random().toString(36).substring(7);
me.init(uuid);