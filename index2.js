function User () {
    this.knownUsers;
    this.client;
    this.id;

    this.init = function (id) {
        // Initialize MQTT client
        this.knownUsers = {};
        this.client = mqtt.connect(MQTT_BROKER);
        this.id = id;

        // Set up event handlers for the client
        this.client.on('connect', this.onConnect.bind(this));
        this.client.on('message', this.onMessage.bind(this));
    }

    this.onConnect = function () {
        console.log('Connected to MQTT broker');

        this.client.subscribe(USERS);
        this.client.publish(USERS, this.id + ONLINE);
    }

    this.onMessage = function (topic, message) {
        const topicHandlers = {
            USERS: this.onUsersMessage.bind(this),
            CHAT: this.onChatMessage.bind(this)
        }

        topicHandlers[topic](message);
    }

    this.onUsersMessage = function (message) {
        console.log(message.toString());
        const userId = message.toString();
        if (!this.knownUsers[userId]) {
            this.client.publish(USERS, this.id);
        }
        this.knownUsers[userId] = true;
    }

    this.onChatMessage = function (message) {
        console.log(message.toString());
    }

    setInterval(() => {
        console.log(this.knownUsers);
    }, 1000);
}


const me = new User();
const uuid = Math.random().toString(36).substring(7);
me.init(uuid);