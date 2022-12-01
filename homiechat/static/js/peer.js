console.log(new Date().toLocaleString().replace(",","").replace("/", "-").replace(":", "-"));

// Nap peer usernames to corresponding RTCPeerConnections
let mapPeers = {};

// Nap peers that stream own screen to remote peers
let mapScreenPeers = {};

// Screen share state
let screenShared = false;

// Local video element
const localVideo = document.querySelector('#local-video');

// Button to start or stop screen sharing
let btnShareScreen = document.querySelector('#btn-share-screen');

// Local video stream
let localStream = new MediaStream();

// Local screen stream
let localDisplayStream = new MediaStream();

// Buttons to toggle self audio and video
btnToggleAudio = document.querySelector("#btn-toggle-audio");
btnToggleVideo = document.querySelector("#btn-toggle-video");

// Locks
let videoLockedByHost = false;
let audioLockedByHost = false;

// Send button and input field to type message
let btnSendMsg = document.querySelector('#btn-send-msg');
let messageInput = document.querySelector('#msg');

// Button to start or stop screen recording
let btnRecordScreen = document.querySelector('#btn-record-screen');

// Object that will start or stop screen recording
let recorder;

// Recording state
let recording = false;

// Chat
let chat = document.querySelector("#message-list");

let loc = window.location;
let wsStart = loc.protocol == 'https:' ? 'wss://' : 'ws://';
let endPoint = wsStart + loc.host + loc.pathname;
let webSocket;
let btnJoin = document.querySelector('#btn-join');

function kickUser(username) {
    sendSignal('kick-user', {
        "target": username
    });
}

function muteUserVideo(username) {
    sendSignal('mute-user-video', {
        "target": username
    });
}

function muteUserAudio(username) {
    sendSignal('mute-user-audio', {
        "target": username
    });
}

function closeRoom() {
    sendSignal("change-room-entry", {
        "state": "false"
    });
}

function openRoom() {
    sendSignal("change-room-entry", {
        "state": "true"
    });
}

// Join room (initiate websocket connection) on button click
btnJoin.onclick = () => {
    // Disable the join button
    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';

    // Configure the websocket connection
    webSocket = new WebSocket(endPoint);    

    // When the connection opens or successfully starts with the server
    webSocket.onopen = function(e) {
        console.log('Connection opened', e);

        // Notify other peers about user's joining
        sendSignal('new-peer', {
            'local_screen_sharing': false,
        });
    }
    
    // When the connection recieves a message
    webSocket.onmessage = webSocketOnMessage;
    
    // When the connection closes
    webSocket.onclose = function(e) {
        console.log('Connection closed ', e);
    }
    
    // When some error occurs related to the connection
    webSocket.onerror = function(e) {
        console.log('Error occured ', e);
    }

    // enable message input and send button
    btnSendMsg.disabled = false;
    messageInput.disabled = false;
}

/**
 * Message handler for the web socket
 * @param {Event} event Event object
 * @returns null
 */
function webSocketOnMessage(event) {
    let parsedData = JSON.parse(event.data);
    let action = parsedData['action'];
    let peerUsername = parsedData['peer'];
    console.log(parsedData)

    // Ignore all messages from oneself
    if (peerUsername == username)
        return;

    // Indicates whether the other peer is sharing screen
    let remoteScreenSharing = parsedData['message']['local_screen_sharing'];
    
    // Channel name of the sender of the message
    let receiverChannelName = parsedData['message']['receiver_channel_name'];

    // Case: New peer
    if (action == 'new-peer') {
        // create new RTCPeerConnection
        createOfferer(peerUsername, false, remoteScreenSharing, receiverChannelName);

        // If local screen is being shared and the remote peer isn't sharing screen, send offer to access screen sharing
        if (screenShared && !remoteScreenSharing) {
            createOfferer(peerUsername, true, remoteScreenSharing, receiverChannelName);
        }
        
        return;
    }

    // Case: Kicked out by the host
    if (action == "kick-user") {
        window.location = "/"
        return;
    }

    // Case: Host muted your video
    if (action == 'mute-video') {
        videoLockedByHost = true;
        btnToggleVideo.disabled = true;
        videoTracks[0].enabled = false;
        btnToggleVideo.innerHTML = 'Video On';
    }

    // Case: Host muted your audio
    if (action == 'mute-audio') {
        audioLockedByHost = true;
        btnToggleAudio.disabled = true;
        audioTracks[0].enabled = false;
        btnToggleAudio.innerHTML = 'Unmute';
    }

    // Case: Host unmuted your video
    if (action == 'unmute-video') {
        videoLockedByHost = false;
        btnToggleVideo.disabled = false;
    }

    // Case: Host unmuted your audio
    if (action == 'unmute-audio') {
        audioLockedByHost = false;
        btnToggleAudio.disabled = false;
    }

    // Case: Host unmuted your audio
    if (action == 'toggle-room-entry') {
        audioLockedByHost = false;
        btnToggleAudio.disabled = false;
    }

    // remote_screen_sharing from the remote peer
    // will be local screen sharing info for this peer
    let localScreenSharing = parsedData['message']['remote_screen_sharing'];

    if (action == 'new-offer') {
        let offer = parsedData['message']['sdp'];
        createAnswerer(offer, peerUsername, localScreenSharing, remoteScreenSharing, receiverChannelName);
        return;
    }
    
    // Case: Answer to the previous offer
    if (action == 'new-answer') {
        let peer = null;
        
        if (remoteScreenSharing) { // If the answerer is sharing screen
            peer = mapPeers[peerUsername + '-screen-share'][0];
        } else if (localScreenSharing) { // If offerer is sharing screen
            peer = mapScreenPeers[peerUsername][0];
        } else { // If non of them is sharing screen
            peer = mapPeers[peerUsername][0];
        }

        let answer = parsedData['message']['sdp'];
        
        // Set the remote description of the RTCPeerConnection
        peer.setRemoteDescription(answer);
        return;
    }
}

// Send the message on pressing `Enter` while focusing on the message input
messageInput.addEventListener('keyup', function(event) {
    if (event.keyCode == 13) {
        event.preventDefault();
        btnSendMsg.click();
    }
});

btnSendMsg.onclick = btnSendMsgOnClick;

function btnSendMsgOnClick() {
    let message = messageInput.value;
    let li = document.createElement("li");
    li.appendChild(document.createTextNode("You: " + message));
    chat.appendChild(li);
    let dataChannels = getDataChannels();

    // Send to all data channels
    for (index in dataChannels) {
        dataChannels[index].send(username + ': ' + message);
    }
    
    // Clear the message field
    messageInput.value = '';
}

const constraints = {
    'video': true,
    'audio': true
}

const iceConfiguration = {
    iceServers: [
        {
            urls: ['turn:numb.viagenie.ca'],
            credential: '{{numb_turn_credential}}',
            username: '{{numb_turn_username}}'
        }
    ]
};

userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;
        window.stream = stream; // make variable available to browser console

        audioTracks = stream.getAudioTracks();
        videoTracks = stream.getVideoTracks();

        // Mute audio and video by default
        audioTracks[0].enabled = false;
        videoTracks[0].enabled = false;

        // Handler for audio toggle button
        btnToggleAudio.onclick = function() {
            if (audioLockedByHost)
                return;

            audioTracks[0].enabled = !audioTracks[0].enabled;

            if (audioTracks[0].enabled) {
                btnToggleAudio.innerHTML = 'Mute';
            } else {
                btnToggleAudio.innerHTML = 'Unmute';
            }
        };

        // Handler for video toggle button
        btnToggleVideo.onclick = function() {
            if (videoLockedByHost)
                return;

            videoTracks[0].enabled = !videoTracks[0].enabled;

            if (videoTracks[0].enabled) {
                btnToggleVideo.innerHTML = 'Video Off';
            } else {
                btnToggleVideo.innerHTML = 'Video On';
            }
        };
    })
    .then(e => {
        btnShareScreen.onclick = event => {
            // Case: If the screen is being shared, turn it off
            if (screenShared) {
                screenShared = !screenShared;

                // set to own video
                // if screen already shared
                localVideo.srcObject = localStream;
                btnShareScreen.innerHTML = 'Share Screen';

                // Get the screen sharing video element and remove your stream
                let localScreen = document.querySelector('#my-screen-video');
                removeVideo(localScreen);

                // Close all the screen share peer connections
                let screenPeers = getPeers(mapScreenPeers);

                for (index in screenPeers) {
                    screenPeers[index].close();
                }
                
                // Empty the screen sharing peer storage object
                mapScreenPeers = {};
                return;
            }
            
            // Case: If the screen is not being shared, turn it on
            screenShared = !screenShared;

            navigator.mediaDevices.getDisplayMedia(constraints)
                .then(stream => {
                    localDisplayStream = stream;
                    let localScreen = createVideo('my-screen');
                    localScreen.srcObject = localDisplayStream;

                    // Notify other peers regaring the screen sharing
                    sendSignal('new-peer', {
                        'local_screen_sharing': true,
                    });
                })
                .catch(error => {
                    console.log('Error occurred while accessing the display media.', error);
                });

            btnShareScreen.innerHTML = 'Stop Sharing';
        }
    })
    .then(e => {
        btnRecordScreen.addEventListener('click', () => {
            if (recording) { // Case: If recording, turn it off
                recording = !recording;
                btnRecordScreen.innerHTML = 'Record Screen';

                // Saving the screen recording
                recorder.stopRecording(function() {
                    let blob = recorder.getBlob();
                    let fileName = new Date().toLocaleString().replaceAll(",","").replaceAll("/", "-").replaceAll(":", "-");
                    invokeSaveAsDialog(blob, fileName);
                });
            } else { // Case: If not recording, turn it on
                recording = !recording;
                navigator.mediaDevices.getDisplayMedia(constraints)
                    .then(stream => {
                        // Configuring the screen recorder
                        recorder = RecordRTC(stream, {
                            type: 'video',
                            MimeType: 'video/webm'
                        });
                        
                        // Starting the screen recorder
                        recorder.startRecording();
                    })
                    .catch(error => {
                        console.log('Error occurred while accessing display media.', error);
                    });

                btnRecordScreen.innerHTML = 'Stop Recording';
            }
        });
    })
    .catch(error => {
        console.error('Error occurred while accessing media devices.', error);
    });

function createOfferer(peerUsername, localScreenSharing, remoteScreenSharing, receiverChannelName){
    let peer = new RTCPeerConnection(null);
    addLocalTracks(peer, localScreenSharing);
    let dc = peer.createDataChannel("channel");
    let newConnectionSound = document.querySelector('#new-connection');
    dc.onopen = () => {
        console.log("Connection opened.");
        newConnectionSound.play();
    };
    let remoteVideo = null;

    if (!localScreenSharing && !remoteScreenSharing) { // Case: When no one is sharing screen in the room    
        dc.onmessage = dcOnMessage;

        remoteVideo = createVideo(peerUsername);
        setOnTrack(peer, remoteVideo);
        mapPeers[peerUsername] = [peer, dc];

        peer.oniceconnectionstatechange = () => {
            let iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
                delete mapPeers[peerUsername];

                if (iceConnectionState != 'closed') {
                    peer.close();
                }

                removeVideo(remoteVideo);
            }
        };
    } else if (localScreenSharing && !remoteScreenSharing) { // Case: When you're sharing your screen
        dc.onmessage = (e) => {
            console.log('New message from %s\'s screen: ', peerUsername, e.data);
        };

        remoteVideo = createVideo(peerUsername + '-screen');
        setOnTrack(peer, remoteVideo);
        mapPeers[peerUsername + '-screen-share'] = [peer, dc];

        peer.oniceconnectionstatechange = () => {
            let iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                delete mapPeers[peerUsername + '-screen-share'];

                if (iceConnectionState != 'closed') {
                    peer.close();
                }

                removeVideo(remoteVideo);
            }
        };
    } else { // Case: Offerer itself is sharing his/her screen
        dc.onmessage = (e) => {
            console.log('New message from %s: ', peerUsername, e.data);
        };

        mapScreenPeers[peerUsername] = [peer, dc];

        peer.oniceconnectionstatechange = () => {
            let iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                delete mapScreenPeers[peerUsername];

                if (iceConnectionState != 'closed') {
                    peer.close();
                }
            }
        };
    }

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            return;
        }
                
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiverChannelName,
            'local_screen_sharing': localScreenSharing,
            'remote_screen_sharing': remoteScreenSharing,
        });
    }
    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(function(event) {
            console.log("Local Description Set successfully.");
        });
    return peer;
}

function createAnswerer(offer, peerUsername, localScreenSharing, remoteScreenSharing, receiverChannelName){
    let peer = new RTCPeerConnection(null);
    addLocalTracks(peer, localScreenSharing);
    let newConnectionSound = document.querySelector('#new-connection');

    if (!localScreenSharing && !remoteScreenSharing) { // Case: When no one is sharing screen in the room
        // Set remote video
        let remoteVideo = createVideo(peerUsername);

        // Add tracks to remote video
        setOnTrack(peer, remoteVideo);

        peer.ondatachannel = e => {
            peer.dc = e.channel;
            peer.dc.onmessage = dcOnMessage;
            peer.dc.onopen = () => {
                console.log("Connection opened");
                newConnectionSound.play();
            }

            // store the RTCPeerConnection and the corresponding RTCDataChannel after the RTCDataChannel is ready. Otherwise, `peer.dc` may be `undefined` as `peer.ondatachannel` would not be called yet
            mapPeers[peerUsername] = [peer, peer.dc];
        }

        peer.oniceconnectionstatechange = () => {
            let iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                delete mapPeers[peerUsername];

                if (iceConnectionState != 'closed') {
                    peer.close();
                }

                removeVideo(remoteVideo);
            }
        };
    } else if (localScreenSharing && !remoteScreenSharing) { // Case: When you're sharing your screen
        peer.ondatachannel = e => {
            peer.dc = e.channel;
            peer.dc.onmessage = (event) => {
                console.log('New message from %s: ', peerUsername, event.data);
            }
            peer.dc.onopen = () => {
                console.log("Connection opened.");
                newConnectionSound.play();
            }
            mapScreenPeers[peerUsername] = [peer, peer.dc];
            peer.oniceconnectionstatechange = () => {
                let iceConnectionState = peer.iceConnectionState;

                if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                    delete mapScreenPeers[peerUsername];

                    if (iceConnectionState != 'closed') {
                        peer.close();
                    }
                }
            };
        }
    } else { // Case: Offerer is sharing his/her screen
        let remoteVideo = createVideo(peerUsername + '-screen');
        setOnTrack(peer, remoteVideo);
        peer.ondatachannel = e => {
            peer.dc = e.channel;
            peer.dc.onmessage = event => {
                console.log('New message from %s\'s screen: ', peerUsername, event.data);
            }
            peer.dc.onopen = () => {
                console.log("Connection opened.");
                newConnectionSound.play();
            }
            mapPeers[peerUsername + '-screen-share'] = [peer, peer.dc];
            
        }
        peer.oniceconnectionstatechange = () => {
            let iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
                delete mapPeers[peerUsername + '-screen-share'];

                if (iceConnectionState != 'closed') {
                    peer.close();
                }

                removeVideo(remoteVideo);
            }
        };
    }

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            return;
        }
        
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiverChannelName,
            'local_screen_sharing': localScreenSharing,
            'remote_screen_sharing': remoteScreenSharing,
        });
    }

    peer.setRemoteDescription(offer)
        .then(() => {
            console.log('Set offer from %s.', peerUsername);
            return peer.createAnswer();
        })
        .then(a => {
            console.log('Setting local answer for %s.', peerUsername);
            return peer.setLocalDescription(a);
        })
        .then(() => {
            console.log('Answer created for %s.', peerUsername);
            console.log('localDescription: ', peer.localDescription);
            console.log('remoteDescription: ', peer.remoteDescription);
        })
        .catch(error => {
            console.log('Error creating answer for %s.', peerUsername);
            console.log(error);
        });

    return peer
}

/**
 * Send an action and a message over the websocket connection
 * @param {String} action Type of action
 * @param {JSON} message Message body
 */
 function sendSignal(action, message) {
    webSocket.send(
        JSON.stringify(
            {
                'peer': username,
                'action': action,
                'message': message,
            }
        )
    )
}

function dcOnMessage(event) {
    let message = event.data;
    
    let li = document.createElement("li");
    li.appendChild(document.createTextNode(message));
    chat.appendChild(li);

    let chatSound = document.querySelector('#chat-sound');
    chatSound.play();
}

function getDataChannels() {
    let dataChannels = [];
    
    for (peerUsername in mapPeers) {
        let dataChannel = mapPeers[peerUsername][1];
        dataChannels.push(dataChannel);
    }

    return dataChannels;
}

function getPeers(peerStorageObj) {
    let peers = [];
    
    for (peerUsername in peerStorageObj) {
        let peer = peerStorageObj[peerUsername][0];
        peers.push(peer);
    }

    return peers;
}

function createVideo(peerUsername) {
    let videoContainer = document.querySelector('#video-container');

    let remoteVideo = document.createElement('video');
    remoteVideo.id = peerUsername + '-video';
    remoteVideo.autoplay = true;
    remoteVideo.playsinline = true;

    let videoWrapper = document.createElement('div');
    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteVideo);
    return remoteVideo;
}

function setOnTrack(peer, remoteVideo){
    let remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;
    peer.addEventListener('track', async (event) => {
        remoteStream.addTrack(event.track, remoteStream);
    });
}

function addLocalTracks(peer, localScreenSharing) {
    if (!localScreenSharing) {
        localStream.getTracks().forEach(track => {
            peer.addTrack(track, localStream);
        });

        return;
    }

    localDisplayStream.getTracks().forEach(track => {
        peer.addTrack(track, localDisplayStream);
    });
}

function removeVideo(video) {
    let videoWrapper = video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper);
}