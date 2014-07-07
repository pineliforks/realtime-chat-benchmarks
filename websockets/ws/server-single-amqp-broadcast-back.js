/**
 *
 *  server-single-amqp-broadcast-back
 *
 *  Non-clustered node server responsible for broadcasting any
 *  received messages back to the client by first communicating
 *  through AMQP
 *
 */

require("http").globalAgent.maxSockets = Infinity;
var colors = require('colors');
var winston = require('winston');
var async = require('async');
var _ = require('lodash');
var amqp = require('amqp');
var WebSocketServer = require('ws').Server;

WebSocketServer.prototype.broadcast = function(data) {
    // Broadcasts messages to all clients
    console.log("Broadcasting " + data + " to " + numClients + " clients.");

    for (var i in this.clients) {
        this.clients[i].send(data);
    }

    console.log("Finished broadcasting " + data + " to " + numClients + " clients.");
};

var logger = new (winston.Logger) ({
    transports: [
        new (winston.transports.File) ({
            filename: 'logs/clients-messages-single.log',
            level: 'verbose'
        })
    ]
});

console.log("\t\t\tWS Server starting".bold.blue);
console.log("================================================================");

// Stats overview
// --------------------------------------
function format (val){
    return Math.round(((val / 1024 / 1024) * 1000) / 1000) + 'mb';
}

var statsId = setInterval(function () {
    console.log('Memory Usage :: '.bold.green.inverse +
        ("\tRSS: " + format(process.memoryUsage().rss)).blue +
        ("\tHeap Total: " + format(process.memoryUsage().heapTotal)).yellow +
        ("\t\tHeap Used: " + format(process.memoryUsage().heapUsed)).magenta
    );
}, 1500);

// Begin AMQP connection stuff
var connection = amqp.createConnection({
    host: 'localhost'
});

// Set up AMQP connection
connection.on('ready', function() {
    // When an AMQP connection has been established, start the
    // WebSocket server

    var wsServer = new WebSocketServer({port: 3000});

    // Websocket server stuff
    // --------------------------------------
    var numClients = 0,
        numCloses = 0,
        numErrors = 0;

    wsServer.on('connection', function (ws) {
        // When a client connects, increase num
        numClients++;

        if (numClients % 500 === 0) {
            console.log(("Client connected! : ".bold + numClients).green);
        }

        ws.on('message', function (message) {
            console.log("Received data from client: " + message);

            var data = JSON.parse(message),
                roomId = data.roomId,
                socketId = data.socketId,
                content = data.message;
            if (content) {
                // This is a proper message that needs to be broadcast back to all
                // clients in the same room
                logger.verbose("Broadcasting message: " + message + " at " + (new Date()).getTime(), {
                    message: message,
                    time: new Date().getTime()
                });

                // Exchange has already been set on socket so just publish something to
                // the exchange
                // Need to find the right exchange to publish to
                var exchange = connection.exchange('room' + roomId, {
                    type: 'fanout'
                }, function() {
                    console.log("Got exchange #" + roomId);

                    exchange.publish('key', {
                        roomId: roomId,
                        content: content
                    }, {
                        contentType: 'application/json'
                    });
                });

                // Send a message to the room's exchange so that the appropriate queues
                // are notified
            } else {
                // Initial response from client, just the room information
                // Here we create an exchange for the room and queue for the socket

                // Set roomId on socket w/e
                ws.roomId = roomId;
                // and AMQP Exchange
                ws.exchange = connection.exchange('room' + roomId, {
                    type: 'fanout'
                }, function() {
                    console.log("room" + roomId + " exchange set to socket");
                });

                connection.queue('queue-' + socketId, function(q) {
                    q.bind(ws.exchange, 'key'); // key not needed bc fanout

                    q.subscribe(function(msg) {
                        // When a message is received in the queue, send that back
                        // to the appropriate web socket
                        console.log(msg);
                        console.log("Message received on queue " + q.name + ": " + msg);

                        ws.send(msg.content);
                    });
                });
            }
        });


        ws.on('close', function () {
            numClients--;
            numCloses++;
            console.log(('Client closed; total number of closes: ' + numCloses).bold.red);
            ws.close();
        });

        ws.on('error', function(e) {
            numErrors++;
            console.log(("Total number of errors: " + numErrors).bold.red);
            console.log(('Client #%d error: %s', thisId, e.message).bold.red);
        });
    });

/*
    var ex = connection.exchange('messages-exchange', {
        type: 'fanout'
    }, function() {
        console.log("#messages exchange created");

        var queue = connection.queue('messages-queue', function(q) {
            // Connect to queue, bind to message-exchange
            q.bind(ex, 'messages-key');

            q.subscribe(function(msg) {
                // When a message is received, broadcast to all clients
                console.log("Message received: " + msg);
            });
        });
    });
*/
});