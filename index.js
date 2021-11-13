require('dotenv').config()
const mqtt = require('mqtt');
const app = require('express')();
const bodyParser = require('body-parser');
const fs = require('fs');
const yaml = require('yaml');

const settings = {
    mqtt: {
        host: process.env.MQTT_HOST || 'mqtt://test.mosquitto.org',
        user: process.env.MQTT_USER || '',
        password: process.env.MQTT_PASS || '',
        clientId: process.env.MQTT_CLIENT_ID || null
    },
    debug: process.env.DEBUG_MODE || false,
    apiKey: process.env.API_KEY || '',
    httpPort: process.env.PORT || 5000
}

function getMqttClient() {
    const options = {
        username: settings.mqtt.user,
        password: settings.mqtt.password
    };

    if (settings.mqtt.clientId) {
        options.clientId = settings.mqtt.clientId
    }

    return mqtt.connect(settings.mqtt.host, options);
}

const mqttClient = getMqttClient();

app.set('port', settings.httpPort);
app.use(logRequest);
app.use(authorizeUser);
app.use('/publish/:topic?/:message?/:qos?/:retain?', bodyParser.json(), parseParameters, ensureTopicSpecified);
app.use('/cmd/:topic?/:message?/:qos?/:retain?', bodyParser.json(), parseParameters, ensureTopicSpecified);
app.use('/subscribe/:topic?', bodyParser.json(), parseParameters, ensureTopicSpecified);
app.use('/', logRequest, bodyParser.text({ type: 'text/plain' }, simpleApi);

app.listen(app.get('port'), '0.0.0.0', function () {
    console.log('Node app is running on port', app.get('port'));
});

function publish(req, res){
    let options = {
      qos : req.body.qos,
      retain : req.body.retain
    };
    mqttClient.publish(req.body.topic, req.body.message || "", options);
    res.sendStatus(200);
}

app.get('/publish/:topic?/:message?/:qos?/:retain?', publish);

app.post('/publish', publish);

/**
 * Used to generate a mqtt topic/message from an simple command
 * topic: command key
 * message: option key
 */
app.get('/cmd/:topic?/:message?/:qos?/:retain?', ((req, res) => {
    const file = fs.readFileSync('./commands.yml', 'utf8');
    const cmd = yaml.parse(file)[req.body.topic];
    if (!cmd) {
        res.status(500).send('Command not found');
        return;
    }
    let options = {
      qos : req.body.qos,
      retain : req.body.retain
    };
    mqttClient.publish(cmd.topic, cmd.options[req.body.message] || req.body.message || "", options);
    res.sendStatus(200);
}));

app.get('/subscribe/:topic?', (req, res) => {
    const topic = req.body.topic;
    const mqttClient = getMqttClient();

    mqttClient.on('connect', function () {
        mqttClient.subscribe(topic);
    });

    mqttClient.on('message', function (t, m) {
        res.write(m);
    });

    req.on("close", function () {
        mqttClient.end();
    });

    req.on("end", function () {
        mqttClient.end();
    });
});


function simpleApi(req, res){
    const topic = req.path.replace(/^\//g, '');
    if (req.method === 'PUT') {
        mqttClient.publish(topic, req.body, {retain: true });
        res.sendStatus(200);
    }
    else if (req.method === 'DELETE') {
        mqttClient.publish(topic, null, {retain: true});
        res.sendStatus(200);
    }
    else if (req.method === 'POST') {
        mqttClient.publish(topic, req.body);
        res.sendStatus(200);
    }
    else if (req.method === "GET") {
        const localMqttClient = getMqttClient();
        localMqttClient.on('connect', function () {
            localMqttClient.subscribe(topic);
        });

        localMqttClient.on('message', function (t, m) {
            res.send(m.toString());
            res.end();
            localMqttClient.end();
        });
        res.setTimeout(1 * 500, () => {
            res.end();
            localMqttClient.end();
        });
    }
    else {
        res.status(500).send("wrong method");
    }
}

function logRequest(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    let message = `Received request [${req.originalUrl}] from [${ip}]`;
    if (settings.debug) {
        message += ` with payload [${JSON.stringify(req.body)}]`;
    }

    console.log(message);

    next();
}

function authorizeUser(req, res, next) {
    if (settings.apiKey && req.body["api-key"] !== settings.apiKey) {
        console.warn('Request is not authorized.');
        res.sendStatus(401);
    }
    else {
        next();
    }
}

function parseParameters(req, res, next) {
    if (req.query.topic || req.params.topic) {
        req.body.topic = req.query.topic || req.params.topic;
    }

    if (req.query.message || req.params.message) {
        req.body.message = req.query.message || req.params.message;
    }

    if (req.query["api-key"] || req.params["api-key"] || req.headers["api-key"]) {
        req.body["api-key"] = req.query["api-key"] || req.params["api-key"] || req.headers["api-key"];
    }

    if (typeof req.query.qos !== 'undefined'){
        req.body.qos = parseInt(req.query.qos, 10);
    }
    else if (typeof req.param.qos !== 'undefined'){
        req.body.qos = parseInt(req.param.qos, 10);
    }
    else if (typeof req.body.qos !== 'undefined'){
        req.body.qos = parseInt(req.body.qos, 10);
    }
    else {
        req.body.qos = 0;
    }
    if (req.body.qos < 0 || req.body.qos > 2){
        res.status(400).send("QoS is not in range 0-2");
        return;
    }

    if (typeof req.query.retain !== 'undefined'){
        req.body.retain = req.query.retain;
    }
    else if (typeof req.param.retain !== 'undefined'){
        req.body.retain = req.param.retain;
    }
    req.body.retain = req.body.retain === 'true' || parseInt(req.body.retain, 10) === 1;

    next();
}

function ensureTopicSpecified(req, res, next) {
    if (!req.body.topic) {
        res.status(500).send('Topic not specified');
    }
    else {
        next();
    }
}

// The signals we want to handle
// NOTE: although it is tempting, the SIGKILL signal (9) cannot be intercepted and handled
var signals = {
    'SIGHUP': 1,
    'SIGINT': 2,
    'SIGTERM': 15
};

// Do any necessary shutdown logic for our application here
const shutdown = (signal, value) => {
    console.log("shutdown!");
    server.close(() => {
        console.log(`server stopped by ${signal} with value ${value}`);
        process.exit(128 + value);
    });
};
// Create a listener for each of the signals that we want to handle
Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
        console.log(`process received a ${signal} signal`);
        shutdown(signal, signals[signal]);
    });
});