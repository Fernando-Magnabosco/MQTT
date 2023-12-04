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
        this.ui.groupInfo = $('#groupInfo');

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
        this.client.publish(userId + C.CONTROL, `newchat:${this.id}`);
        console.log('publishing to ' + userId + C.CONTROL);
        this.requestedUsers[userId] = true;
    }

    this.onAcceptClick = function (event) {
        const userId = $(event.target).data('user-id');
        const newTopic = `${this.id}_${userId}_${new Date().getTime()}`;
        this.client.subscribe(newTopic);
        this.chatUsers[userId] = newTopic;
        this.client.publish(userId + C.CONTROL, `newchat:` + newTopic);
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
        const topic = this.chatUsers[$(event.target).data('user-id') || $(event.target).data('group-id')];
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
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-accept d-none"">Aceitar solicitacao</button>
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right start-a-chat"">Iniciar chat</button>
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right user-chat d-none"" >Chat</button>
                        <button data-user-id="${userId}" type="button" class="btn btn-primary btn-sm float-right see-chat d-none"">Ver conversas</button>
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
        const grupo = JSON.parse(message.toString());
        this.groups[grupo.nome] = grupo;
        if (grupo.usuarios.includes(this.id)) {
            this.client.subscribe(grupo.nome);
            this.chatUsers[grupo.nome] = grupo.nome;
        }
        this.renderGroups();
    }

    this.onRequest = function (message) {
        const [subject, content] = message.toString().split(':');
        const options = {
            'newchat': this.newChat.bind(this),
            'membergroup': this.memberGroup.bind(this),
        }

        options[subject](content);
    }

    this.newChat = function (content) {
        const [userId] = content.split('_');
        this.requestHistory.push(`${userId} solicitou as ${new Date().toLocaleString()}`);

        if (this.requestedUsers[userId]) {
            this.requestedUsers[userId] = false;
            this.chatUsers[userId] = content;
            this.client.subscribe(content);
            this.ui.userList.find(`#${userId} .user-chat`).removeClass('d-none');
            this.ui.userList.find(`#${userId} .see-chat`).removeClass('d-none');
            this.ui.userList.find(`#${userId} .user-accept`).addClass('d-none');
            this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');
            return;
        }

        this.ui.userList.find(`#${userId} .user-accept`).removeClass('d-none');
        this.ui.userList.find(`#${userId} .start-a-chat`).addClass('d-none');
    }

    this.memberGroup = function (content) {
        const [userId, groupName] = content.split('_');
        const group = this.groups[groupName];
        const grupoDiv = $(`<div class="request-group card">
        <span> ${userId} quer  participar do grupo ${groupName} </span> <br>
        
        <div class="d-flex justify-content-between">
        <button class="btn btn-primary btn-sm float-right aceitar" data-group-name="${groupName}" data-user-id="${userId}" type="button">Aceitar</button>
        <button class="btn btn-primary btn-sm float-right recusar" data-group-name="${groupName}" data-user-id="${userId}" type="button">Recusar</button>
        </div>
        </div>`);

        const aceitar = grupoDiv.find('.aceitar');
        const recusar = grupoDiv.find('.recusar');

        aceitar.on('click', this.onAceitarClick.bind(this));
        recusar.on('click', this.onRecusarClick.bind(this));

        this.ui.groupInfo.html(grupoDiv);
        this.requestHistory.push(`${userId} solicitou ser membro do grupo ${groupName} as ${new Date().toLocaleString()}`);
    }

    this.onAceitarClick = function (event) {
        const userId = $(event.target).data('user-id');
        const groupName = $(event.target).data('group-name');
        const group = this.groups[groupName];
        group.usuarios.push(userId);
        this.ui.groupInfo.html('');

        this.client.publish(C.GROUPS, JSON.stringify(group));
    }

    this.onRecusarClick = function (event) {
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
        this.chatUsers[nomeDoGrupo] = nomeDoGrupo;
        this.groups[nomeDoGrupo] = grupo;
        this.renderGroup(grupo, true);
    }

    this.onRequestHistoryClick = function (event) {
        console.log(this.requestHistory);
    }

    this.renderGroups = function () {
        this.ui.groupList.html('');
        for (const grupo in this.groups) {
            this.renderGroup(this.groups[grupo], this.groups[grupo].usuarios.includes(this.id));
        }
    }

    this.renderGroup = function (grupo, isMember = true) {
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
                    ${isMember ?
                `<button data-group-name="${grupo.nome}" type="button" class="btn btn-primary btn-sm float-right chatGrupo">Chat</button>
                <button data-group-id="${grupo.nome}" type="button" class="btn btn-primary btn-sm float-right verChat"">Ver conversas</button>
                `
                : ''}
                </div>
            </li>`);

        const last = this.ui.groupList.find('li:last-child');
        const btnVerMembros = last.find('.verMembros');
        const btnSerMembro = last.find('.serMembro');
        const btnChatGrupo = last.find('.chatGrupo');
        const btnVerChat = last.find('.verChat');
        btnVerMembros.on('click', this.onVerMembrosClick.bind(this));
        btnSerMembro.on('click', this.onSerMembroClick.bind(this));
        btnChatGrupo.on('click', this.onChatGrupoClick.bind(this));
        btnVerChat.on('click', this.seeChat.bind(this));
    }

    this.onVerMembrosClick = function (event) {
        const nomeDoGrupo = $(event.target).data('group-name');
        const grupoDiv = $(`<div class="grupo card" >
        <span> Grupo  ${nomeDoGrupo} </span> <br>
        <span> Dono: ${this.groups[nomeDoGrupo].dono} </span>
        <span> Membros: </span>     
        <div class="list-group"> </div>`);
        const grupo = this.groups[nomeDoGrupo];
        const listGroup = grupoDiv.find('.list-group');
        grupo.usuarios.forEach(usuario => {
            listGroup.append(`<span class="list-group-item">${usuario}</span>`);
        });


        this.ui.groupInfo.html(grupoDiv);
    }

    this.onSerMembroClick = function (event) {
        const nomeDoGrupo = $(event.target).data('group-name');
        const donoDoGrupo = $(event.target).data('dono');

        this.client.publish(donoDoGrupo + C.CONTROL, `membergroup:${this.id}_${nomeDoGrupo}`);

    }

    this.onChatGrupoClick = function (event) {
        const groupId = $(event.target).data('group-name');

        const inputBox = `
            <div class="modal fade" id="chatModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="exampleModalLabel">Chat com ${groupId}</h5>
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
                const topic = groupId;
                const messageObj = {sender: me.id, content: message, timestamp: new Date().getTime()};
                me.client.publish(topic, JSON.stringify(messageObj));
                $('#chatModal #messageInput').val('');

                console.log('Mensagem enviada:', message);
            }

            $('#chatModal').modal('hide');
        });

        $('#chatModal').modal('show');
    }
}


const me = new User();
const uuid = Math.random().toString(36).substring(7);
me.init(uuid);