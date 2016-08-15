"use strict";
const nunjucks = require('nunjucks');
const WebSocketServer = require('ws').Server;
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const randtoken = require('rand-token').generator({
    chars: "abcdefghijklmnopqrstuvwxyz0123456789"
});
const url = require('url');
const Room = require('./lib/room.js');
var index = require('./lib/routes/server/index');
var server = require('http').createServer();

var app = express();
var clients = {};
var rooms = {};

var ws = new WebSocketServer({
    server: server,
    verifyClient: function(info) {
        console.log(info.req.url);
        var query = url.parse(info.req.url, true).query;
        var uuid = query.uuid;
        var secret = query.clientSecret;
        var room = query.room;
        var data = {
            uuid: uuid,
            secret: secret,
            room: room
        };
        console.log(data);
        if (!clients[uuid] || clients[uuid].secret !== secret || !rooms[room]) {
            console.log("Reject connection");
            return false;
        } else {
            console.log("Accept connection");
            info.req.info = data;
            return true;
        }
    }
});

nunjucks.configure(path.join(__dirname, 'res/views'), {
    autoescape: true,
    express: app,
    noCache: true,
    tags: {
        variableStart: '<$',
        variableEnd: '$>',
    }
});

//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'res/public')));
app.get('/check/:id', function(req, res) {
    res.status(clients[req.params.id] ? 200 : 404).end();
});
app.get('/client', function(req, res) {
    var uuid = req.query.uuid;
    var secret = req.query.clientSecret;
    if (clients[uuid]) {
        res.status(409).json({
            error: {
                message: "UUID already exists"
            }
        });
    } else {
        clients[uuid] = {
            secret: secret
        };
        res.status(200).end();
    }
});
app.get('/create', function(req, res) {
    var uuid = req.query.uuid;
    var secret = req.query.clientSecret;
    if (!clients[uuid] || clients[uuid].secret !== secret) {
        res.status(403).json({
            error: {
                message: "Failed to authenticate client"
            }
        });
    } else {
        var roomID = randtoken.generate(6);
        rooms[roomID] = new Room(roomID);
        console.log("Create room: " + roomID);
        res.status(200).json({
            id: roomID
        });
    }
});

app.get('/:room/queue/:id', function(req, res) {
    if(!rooms[req.params.room]) {
        return res.status(404).json({
            error: {
                message: "Room not found"
            }
        });
    }

    console.log("Queue " + req.params.id + " on room " + req.params.room);

    var parsed = rooms[req.params.room].parse(req.params.id);

    if(!parsed) {
        return res.status(400).json({
            error: {
                message: "Invalid id"
            }
        });
    }

    parsed.then((o) => {
        res.status(200).json(o);
    }, (err) => {
        res.status(400).json(err);
    });
});

app.get('/:room/next', function(req, res) {
    if(!rooms[req.params.room]) {
        return res.status(404).json({
            error: {
                message: "Room not found"
            }
        });
    }

    rooms[req.params.room].playNext();
    res.status(200).end();
});

app.use('/', index);

ws.on('connection', function(ws) {
    var info = ws.upgradeReq.info;
    rooms[info.room].addUser(info.uuid, ws);
});

server.on('request', app);
server.listen(80, function () { console.log('Listening on ' + server.address().port) });
