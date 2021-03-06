/* =========================================================================
 *
 *  mqtt/server.js
 *
 *  Sets up a MQTT server using mosca
 *
 *
 * ========================================================================= */
var cluster = require('cluster'),
    colors = require('colors'),
    winston = require('winston');

var totalClients = 0;

function format (val){
    return Math.round(((val / 1024 / 1024) * 1000) / 1000) + 'mb';
}

function format2 (val){
    return val+ '';
}

var statsId = setInterval(function () {
    console.log('Memory Usage :: '.bold.green.inverse +
        ("\tRSS: " + format(process.memoryUsage().rss)).blue +
        ("\tHeap Total: " + format(process.memoryUsage().heapTotal)).yellow +
        ("\tHeap Used: " + format(process.memoryUsage().heapUsed)).magenta +
        ("\t\tNr Clients: " + format2(totalClients).white)
    );
}, 1500);

var mosca = require('mosca');

var ascoltatore = {
    type: 'mqtt',
    json: false,
    mqtt: require('mqtt'),
    host: 'localhost'
    
};

var settings = {
    port: 8884,
    backend: ascoltatore
};


var server = new mosca.Server(settings);

server.on('ready', function setup() {
    winston.info("Mosca server is up and running");
});

server.on('clientConnected', function(client) {
    totalClients++;
    console.log("Client #" + client.id + " connected to server. Num Clients : " + 
        totalClients); 
});

var start, end, maxNrItems;

// fired when a message is received
server.on('published', function(packet, client) {
    console.log("Reveived message", packet.payload);
});

server.on('clientDisconnected', function(client) {
    totalClients--;
    // console.log(
    //     ("Client #" + client.id + " connected to server. Num Clients : " + 
    //     totalClients).red); 
});

server.on('error', function(err) {
    totalClients--;
    console.log("Error : num clients" + totalClients);
});
