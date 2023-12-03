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
        this.requestHistory = [];
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
        this.ui.chatBox = $('#chatBox');

        this.ui.toggleConnectBtn.on('click', this.onToggleConnect.bind(this));
        this.ui.userList.on('click', '.start-a-chat', this.onStartChatClick.bind(this));
        this.ui.userList.on('click', '.user-accept', this.onAcceptClick.bind(this));
        this.ui.userList.on('click', '.user-chat', this.onChatClick.bind(this));
        this.ui.userList.on('click', '.see-chat', this.seeChat.bind(this));
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
        this.ui.userList.find(`#${userId} .see-chat`).removeClass('d-none');
        this.ui.userList.find(`#${userId} .user-accept`).addClass('d-none');
        this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');
    }

    this.onChatClick = function (event) {
        const userId = $(event.target).data('user-id');
    
        const inputBox = `
            <div class="modal fade" id="chatModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="exampleModalLabel">Chat com ${userId}</h5>
                            <button type="button" class="btn btn-close" data-dismiss="modal" aria-label="Fechar">
                            </button>
                        </div>
                        <div class="modal-body">
                            <ul id="chatMessages" class="list-group"></ul>
                            <div class="input-group mb-3 flex-nowrap">
                                <input type="text" class="form-control" id="messageInput" placeholder="Digite sua mensagem" aria-label="Recipient's username" aria-describedby="button-addon2" style="background-color: transparent; color: white;">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" type="button" id="button-addon2">Enviar</button>
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Fechar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    
        $(document.body).append(inputBox);
    
        const me = this;
    
        $('#chatModal #messageInput').on('keyup', function (event) {
            if (event.keyCode === 13) {
                $('#chatModal #button-addon2').click();
            }
        });
    
        $('#chatModal').on('shown.bs.modal', function () {
            $('#chatModal #messageInput').focus();
        });
    
        $('#chatModal #button-addon2').on('click', function () {
            const message = $('#chatModal #messageInput').val();
            if (message.trim() !== '') {
                const topic = me.chatUsers[userId];
                const messageObj = {sender: me.id, content: message, timestamp: new Date().getTime()};
                me.client.publish(topic, JSON.stringify(messageObj));
                $('#chatModal #messageInput').val('');
    
                console.log('Mensagem enviada:', message);
            }
    
            $('#chatModal').modal('hide');
        });
    
        $('#chatModal').modal('show');
    }
    
    
    
    

    this.onSendMessage = function (event) {
        const userId = $(event.target).parent().parent().attr('id');
        const userTopic = this.chatUsers[userId];
        const content = $(event.target).parent().find('input').val();

        const message = JSON.stringify({sender: this.id, content: content, timestamp: new Date().getTime()});
        this.client.publish(userTopic, message);

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


        const {sender, content, timestamp} = JSON.parse(message.toString());

        if (!this.messageHistory[topic]) {
            this.messageHistory[topic] = [];
        }

        this.messageHistory[topic].push({sender, content, timestamp: new Date(timestamp).toLocaleString()});
    }

    this.seeChat = function (event) {
    const userId = this.id; 
    const topic = this.chatUsers[$(event.target).data('user-id')];
    const chat = this.messageHistory[topic];
    const chatBox = $(`<div class="chat-box"></div>`);

    if (!chat) return;

    chat.forEach(message => {
        const isCurrentUser = message.sender === userId;
        const messageClass = isCurrentUser ? 'current-user-message' : 'other-user-message';

        chatBox.append(`
            <div class="form-group row card mt-1 chat-message ${messageClass}">
                <div class="useravatar">
                    <span class="rounded-circle d-flex justify-content-center align-items-center bg-dark text-white" style="width: 35px; height: 35px; font-size: 1.2rem; margin-bottom: 5px;">
                        <i class="fas fa-user"></i> ${message.sender.charAt(0).toUpperCase() + message.sender.charAt(1).toUpperCase()}
                    </span>
                </div>
                <div class="message-bubble col">
                    <h5 class="card-text">${message.content}</h5>
                    <div class="card-footer text-muted" style="color: #000000 !important;">
                        <p class="card-time">${message.timestamp}</p>
                    </div>
                </div>
            </div>`);
    });

    this.ui.chatBox.html(chatBox);
};

    

    this.onUsersMessage = function (message) {
        const [userId, status] = message.toString().split(' ');
        if (this.id === userId) return;

        if (!this.knownUsers[userId]) {
            this.client.publish(C.USERS, this.connectMessage);
            this.knownUsers[userId] = status;
            this.ui.userList.append(
                `<li id="${userId}" role="button" class="list-group-item mb-3">
                <div class="d-flex justify-content-between">
                    <div class="d-flex flex-column">
                        <span class="rounded-circle d-flex justify-content-center align-items-center bg-dark text-white" style="width: 35px; height: 35px; font-size: 1.2rem; margin-bottom: 5px;">
                            <i class="fas fa-user"></i> ${userId.charAt(0).toUpperCase() + userId.charAt(1).toUpperCase()}
                        </span>
                        <span class="badge ${status === 'online' ? 'badge badge-success' : 'badge-danger'} badge-pill bg-success">${status}</span>
                    </div>
                    <div>
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-accept d-none" style="background-color:#FF5733">Aceitar solicitacao</button>
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right start-a-chat" style="background-color:#FF5733">Iniciar chat</button>
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-chat d-none" style="background-color:#FF5733" >Chat</button>
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right see-chat d-none" style="background-color:#FF5733">Ver conversas</button>
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

        this.requestHistory.push(`${userId} solicitou as ${new Date().toLocaleString()}`);

        if (this.requestedUsers[userId]) {
            this.requestedUsers[userId] = false;
            this.chatUsers[userId] = message.toString();
            this.client.subscribe(message.toString());
            this.ui.userList.find(`#${userId} .user-chat`).removeClass('d-none');
            this.ui.userList.find(`#${userId} .see-chat`).removeClass('d-none');
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
                    <button class="verMembros btn btn-primary" data-group-name="${grupo.nome}" type="button" class="btn btn-primary btn-sm float-right  ">Ver grupo</button>    
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
        const nomeDoGrupo = $(event.taarget).data('group-name');
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