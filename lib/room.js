"use strict";
const request = require('request');
const randtoken = require('rand-token');

function getEndpoint(endpoint, id) {
    var url = "https://api.spotify.com/v1/" + endpoint + "/" + id;
    console.log(url);
    return new Promise(function(resolve, reject) {
        request.get(url, function(err, res, body) {
            try {
                body = JSON.parse(body);
                if(body.error) {
                    return reject(body.error);
                }
                console.log("Resolved");
                resolve(body);
            } catch(err) {
                reject(err);
            }
        });
    });
}

module.exports = class Room {
    constructor(roomID, uuid) {
        this.id = roomID;
        this.owner = uuid;
        this.users = {};
        this.queue = [];
        this.playing = null;
    }

    send(uuid) {
        var data = {
            id: this.id,
            owner: this.owner,
            users: Object.keys(this.users),
            queue: this.queue,
            playing: this.playing
        }

        try {
            this.users[uuid].send(JSON.stringify(data));
        } catch(err) {

        }
    }

    sendAll() {
        console.log("Sending to all users");
        for(var i in this.users) {
            this.send(i);
        }
    }

    parse(uri) {
        var matched = uri.match(/^(?:spotify:)?(?:(track):)?(.*)$/i);
        if(!matched) {
            return false;
        }
        var type = matched[1];
        var id = matched[2];

        if(type && type != "track") {
            return false;
        }

        return this.queueItem(id);
    }

    queueItem(trackID) {
        var self = this;
        return new Promise((resolve, reject) => {
            getEndpoint("tracks", trackID).then(track => {
                console.log("Got track");
                var o = {
                    name: track.name,
                    artist: track.artists.map(a => a.name).join(", "),
                    album: track.album.name,
                    uri: track.uri,
                    duration: track.duration_ms,
                    art: {
                        big: track.album.images[0].url,
                        medium: track.album.images[1].url,
                        small: track.album.images[2].url
                    },
                    nonce: randtoken.uid(32)
                };
                self.queue.push(o);
                self.sendAll();
                if(self.playing == null) {
                    self.playNext();
                }
                resolve(o);
            }, reject);
        });
    }

    playNext() {
        console.log("Play next");
        var self = this;
        if(this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = false;
        if(this.queue.length == 0) {
            this.playing = null;
            this.sendAll();
        } else {
            this.playing = this.queue.shift();
            console.log("Playing: " + this.playing.name);
            this.timeout = setTimeout(function() {
                self.playNext();
            }, this.playing.duration);
            this.sendAll();
        }
    }

    addUser(uuid, ws) {
        this.users[uuid] = ws;
        this.send(uuid);
    }
}
