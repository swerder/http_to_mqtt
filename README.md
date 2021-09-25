# HTTP to MQTT bridge
Receive requests using HTTP and transfer them to your MQTT broker. The HTTP to MQTT bridge is written using Node JS with [Express](https://expressjs.com/) for HTTP server and [MQTT.js](https://www.npmjs.com/package/mqtt) client.

By default, the `http_to_mqtt` will listen on port 5000 and connect to a test mqtt server.  
The MQTT Broker (and other settings) can be specified by environment variables or .env file.

## Settings (Environment Variables)
```dotenv
MQTT_HOST=mqtt://test.mosquitto.org
MQTT_USER=
MQTT_PASS=
MQTT_CLIENT_ID=
API_KEY=MY_SECRET_KEY
DEBUG_MODE=false
PORT=5000
```
PS: Leave API_KEY empty for disabling it

## Docker Run
```sh
docker run -p 5000:5000 \
-e MQTT_HOST=mqtt://test.mosquitto.org \
-e API_KEY=MY_SECRET_KEY \
uilton/http_to_mqtt:latest
```

Optionally, if you plan to use the cmd endpoint, you must create a volume to `/usr/src/app/commands.yml` file

Eg:
```sh
docker run -p 5000:5000 \
-e MQTT_HOST=mqtt://test.mosquitto.org \
-e API_KEY=MY_SECRET_KEY \
-v path/to/commands.yml:/usr/src/app/commands.yml:ro \
uilton/http_to_mqtt:latest
```

## Publish to a topic
Publish a message to the topic 'MyTopic' (api-key is not necessary if it's not defined as environment variable)

Sending as POST with topic, message and api-key as body
```bash
curl -H "Content-Type: application/json" "http://localhost:5000/publish"  -d '{"topic" : "MyTopic", "message" : "hi", "api-key": "MY_SECRET_KEY" }'
```

OR

Sending as POST with 'topic' and 'message' as body and 'API-KEY' as Header
```bash
curl -H "Content-Type: application/json" -H "API-KEY: MY_SECRET_KEY" "http://localhost:5000/publish"  -d '{"topic" : "MyTopic", "message" : "hi" }'
```

OR

Sending as GET (/publish/:topic/:message) and with 'api-key' as Query Parameter
```bash
curl "http://localhost:5000/publish/MyTopic/hi?api-key=MY_SECRET_KEY"
```

OR

Sending as GET (/publish/:topic/:message) and with 'API-KEY' as HEADER
```bash
curl -H "API-KEY: MY_SECRET_KEY" "http://localhost:5000/publish/MyTopic/hi"
```

OR

Sending as GET (/publish) with topic and message as Query Parameter and 'API-KEY' as HEADER
```bash
curl -H "API-KEY: MY_SECRET_KEY" "http://localhost:5000/publish?topic=MyTopic&message=hi"
```

Response:
```
OK
```

## Publish to a topic, but replacing the received topic / message to something else

My goal with this endpoint is to create a generic applet on ifttt that can be configured to do different things, but can be used just to remap a topic or a key to something else, same for message, like remap 'on' to '1', for example.

```bash
curl "http://localhost:5000/cmd/command_name/on?api-key=MY_SECRET_KEY"
```

Based on `commands_sample.yml` it will be translated to topic `example/topic` with a message `1`

Response:
```
OK
```

All the request variations from the `publish` API, as above, also apply here.

`commands.yml`
```yaml
command_name: # name used to identify this command, will be matched by the topic parameter
  topic: example/topic # topic that will replace the topic passed as parameter
  options:
    'on': '1' # when message parameter is 'on', it will translate it to '1'
    'off': '0' # when message parameter is 'off', it will translate it to '0'
    # if the message parameter is not in the options list, it will be sent as is

another_command:
  topic: example/topic2
  options:
    '1': 'on' # when message parameter is '1', it will translate it to 'on'
    '0': 'off' # when message parameter is '0', it will translate it to 'off'
```

## Subscribe to a topic

You can subscribe to a topic.  `http_to_mqtt` will keep the connection open and wait for messages from the MQTT Broker and will send them as response when received.

Listen for messages in the topic 'MyTopic'.  Use `-ivs --raw` to see messages come in as they are received.

Sending as GET with 'topic' and 'api-key' as Query Parameter
```bash
curl -ivs --raw "http://localhost:5000/subscribe?topic=MyTopic&api-key=MY_SECRET_KEY"
```

OR

Sending as GET (/subscribe/:topic) with 'topic' as Path Parameter and 'API-KEY' as HEADER
```bash
curl -H "API-KEY: MY_SECRET_KEY" -ivs --raw "http://localhost:5000/subscribe/MyTopic"
```

output:
```
*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 5000 (#0)
> GET /subscribe?topic=MyTopic HTTP/1.1
> Host: localhost:5000
> User-Agent: curl/7.54.1
> Accept: */*
>
```

Whenever a message is published to the topic MyTopic curl will output the message.

Use mosquitto_pub to publish a message (or send as http request, as above):
```bash
mosquitto_pub -t 'MyTopic' -m 'I sent this message using Mosquitto'
```

curl output:
```
<
23
I sent this message using Mosquitto
```