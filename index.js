"use strict";
const uuidv4 = require('node-uuid').v4;
const uuid = uuidv4();
const state = uuidv4();
const randtoken = require('rand-token');
const SpotifyControl = require("spotify-control");
const express = require("express");
const nunjucks = require('nunjucks');
const path = require('path');
const open = require('open');
const request = require('request');
const fs = require('fs');

console.log("UUID: " + uuid);

var spotify = null;
var connected = false;
var server = "http://" + fs.readFileSync("./hostname.txt").toString();
var clientSecret = randtoken.uid(64);
var serverSecret = null;

request.get("https://open.spotify.com/token", function(err, res, body) {
    spotify = new SpotifyControl({
        token: JSON.parse(body).t
    });
    spotify.connect().then(function() {
        console.log("Spotify connected");
        connected = true;
        res.end("Success! You can close this window");
    }, function() {
        res.end("Failed to connect!");
    })
});

request.get({
    url: server + "/client",
    qs: {
        uuid: uuid,
        clientSecret: clientSecret
    }
}, function(err, res, body) {
    if(!err && res.statusCode == 200) {
        console.log("Announced");
    } else {
        console.error(JSON.parse(body));
    }
})

var app = express();

nunjucks.configure(path.join(__dirname, 'res/views'), {
    autoescape: true,
    express: app,
    noCache: true,
    tags: {
        variableStart: '<$',
        variableEnd: '$>',
    }
});

app.use(function(req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

app.get("/uuid", function(req, res) {
    if(!connected) {
        res.status(503).json({
            error: "Spotify not initialized!"
        });
        return;
    }
    res.json({
        uuid: uuid,
        clientSecret: clientSecret
    });
});

app.get("/token", function(req, res) {
    if(req.query.token) {
        try {
            console.log(req.query.token);
            var token = JSON.parse(req.query.token);
        } catch(err) {
            res.end("Malformed token. Be sure you copied the whole thing! " + err.message);
            return;
        }
        spotify = new SpotifyControl({
            token: token.t
        });
        spotify.connect().then(function() {
            console.log("Spotify connected");
            connected = true;
            res.end("Success! You can close this window");
        }, function() {
            res.end("Failed to connect!");
        })
    } else {
        res.render("token.html");
    }
});

app.get("/play/:id", function(req, res) {
    if(!connected) {
        res.status(503).json({
            error: "Spotify not initialized!"
        });
        return;
    }
    spotify.play(req.params.id).then(function(status) {
        res.json(status);
    }, function(err) {
        console.error(err);
    });
});

app.listen(3030, function() {
    console.log("Listening on port 3030");
});

// open("http://localhost:3030/token");
// open("https://open.spotify.com/token");
