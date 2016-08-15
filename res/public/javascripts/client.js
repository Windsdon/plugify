var plugify = angular.module('plugify', []);

var isRoom = window.location.pathname !== "/";

function uuidv4() {
    var chars = "abcdef0123456789";
    return "xxxxxxxx-xxxx-4000-xxxx-xxxxxxxxxxxx".replace(/x/g, function() {
        return chars[Math.floor(Math.random() * chars.length)];
    });
}

function token(len) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var str = "";
    while(str.length < len) {
        str += chars[Math.floor(Math.random() * chars.length)];
    }

    return str;
}

plugify.factory('stateService', function($rootScope, $http, $timeout) {
    var state = {
        spotify: {
            noPlay: false,
            status: 'connecting'
        },
        room: isRoom,
        ready: false,
        loading: true
    };

    function process(uuid, clientSecret) {
        $timeout(function() {
            console.log("Got uuid: " + uuid);
            // $timeout(function() {
            //     state.ready = true;
            // }, 2000);
            $http({
                method: "GET",
                url: "/check/" + uuid,
                cache: false
            }).then(function(res) {
                 $timeout(function() {
                     if(!state.spotify.noPlay) {
                         state.spotify.status = 'connected';
                     }
                     console.log(res);
                     state.uuid = uuid;
                     state.clientSecret = clientSecret;
                     state.ready = true;
                 });
            }, function(err) {
                $timeout(function() {
                    state.spotify.status = 'invaliduuid';
                    state.ready = true;
                });
            });
        });
    }

    $http({
        method: "GET",
        url: "http://localhost:3030/uuid",
        cache: false
    }).then(function(res) {
        process(res.data.uuid, res.data.clientSecret);
    }, function(err) {
        $timeout(function() {
            if(err.status == 503) {
                state.spotify.status = 'tokenerror';
            } else {
                state.spotify.status = 'failed';
            }

            var uuid = uuidv4();
            var clientSecret = token(64);
            state.spotify.noPlay = true;

            $http({
                url: "/client",
                method: "GET",
                params: {
                    uuid: uuid,
                    clientSecret: clientSecret
                }
            }).then(function() {
                process(uuid, clientSecret);
            })
        });
    });

    return state;
});

plugify.controller('Page', function($scope, stateService) {
    $scope.state = stateService;
});

plugify.controller('Status', function($scope, $http, stateService) {
    $scope.state = stateService;
    $scope.displayStatus = true;
});

plugify.controller('Creator', function($scope, $http, stateService) {
    stateService.loading = false;
    this.create = function() {
        $http.get("/create", {
            params: {
                uuid: stateService.uuid,
                clientSecret: stateService.clientSecret
            },
            cache: false
        }).then(function(res) {
            window.location.href = "/" + res.data.id
        }, function(err) {
            console.error(err);
        });
    }
});

plugify.controller('Room', function($scope, $http, $timeout, stateService) {
    $scope.state = stateService;
    this.playing = null;
    this.queueURI = "";
    var roomID = window.location.pathname.replace(/[^a-z0-9]/g, '');

    this.playNext = function() {
        $http({
            method: "GET",
            url: "/" + roomID + "/next",
            params: {
                uuid: stateService.uuid,
                clientSecret: stateService.clientSecret
            }
        });
    }

    this.play = function(uri) {
        if(uri === undefined) {
            uri = this.playing.uri;
        }
        $http.get("http://localhost:3030/play/" + uri);
    }

    this.queuePush = function() {
        var matched = this.queueURI.match(/(?:(?:spotify:)?(?:track:)?([A-Za-z0-9]+)|(?:track\/)?([A-Za-z0-9]+))$/i);
        if(!matched) {
            return;
        }
        var uri = matched[1] || matched[2];
        this.queueURI = "";
        $http({
            method: "GET",
            url: "/" + roomID + "/queue/" + uri,
            params: {
                uuid: stateService.uuid,
                clientSecret: stateService.clientSecret
            }
        });
    }

    var url = "ws://" + window.location.hostname + "?uuid=" + stateService.uuid
        + "&clientSecret=" + stateService.clientSecret
        + "&room="+roomID;

    console.log(url);

	var wsCtor = window['MozWebSocket'] ? MozWebSocket : WebSocket;
	this.socket = new wsCtor(url, 'plugify');

	var self = this;

	this.socket.onopen = function () {
		console.log("Connected to server");
	}

    this.socket.onclose = function() {

    }

    var inital = true;

    this.handleWebsocketMessage = function(message) {
        console.log(message);
        var data = JSON.parse(message.data);
        $timeout(function() {
            stateService.loading = false;
            self.queue = data.queue;
            console.log(self.playing, data.playing);
            if((self.playing === null && data.playing !== null) || (self.playing !== null &&self.playing.nonce != data.playing.nonce)) {
                if(!inital) {
                    self.play(data.playing.uri);
                }
            }
            inital = false;
            self.playing = data.playing;
        });
    }

	this.socket.onmessage = this.handleWebsocketMessage.bind(this);
});
