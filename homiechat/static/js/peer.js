document.getElementById("navbar").remove();
document.getElementById("body-container").classList.remove("p-3");
document.getElementById("body-container").classList.remove("container");

// Map peer usernames to corresponding RTCPeerConnections
let mapPeers = {};

// Map peers that stream own screen to remote peers
let mapScreenPeers = {};

// Screen share state
let screenShared = false;

// Local video element
const localVideo = document.querySelector('#local-video');
let mainScreenVideo = document.getElementById("main-screen-video");
let mainScreenUsername = '';

// Local video stream
let localStream = new MediaStream();

// my username
let myUsername = username;

// Map users to their video stream
let userStreamMapping = {};

// Toasts
let toastsContainer = document.getElementById("toasts");

// Message Name Suggestions
let messageNameSuggestionsContainer = document.getElementById("message-name-suggestions");

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
let chatContainer = document.querySelector("#chat");
let chat = document.querySelector("#messages");
// chatContainer.style.display = "none";

let loc = window.location;
let wsStart = loc.protocol == 'https:' ? 'wss://' : 'ws://';
let endPoint = wsStart + loc.host + loc.pathname;
let webSocket;

function kickUser(username) {
    sendSignal('kick-user', {
        "target": username
    });
}

function changeRoomVisibility(element) {
    if (element.innerText == "Close Room") {
        closeRoom();
        element.innerHTML = `<i class="fa-solid fa-door-open me-2"></i>Open Room`;
    } else {
        openRoom();
        element.innerHTML = `<i class="fa-solid fa-door-closed me-2"></i>Close Room`;
    }
}

function muteUserVideo(element, username) {
    element.onclick = () => unmuteUserVideo(element, username);
    element.innerHTML = `<i class="fa-solid fa-video"></i>`;
    sendSignal('mute-user-video', {
        "target": username
    });
}

function muteUserAudio(element, username) {
    element.onclick = () => unmuteUserAudio(element, username);
    element.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
    sendSignal('mute-user-audio', {
        "target": username
    });
}

function unmuteUserVideo(element, username) {
    element.onclick = () => muteUserVideo(element, username);
    element.innerHTML = `<i class="fa-solid fa-video-slash"></i>`;
    sendSignal('unmute-user-video', {
        "target": username
    });
}

function unmuteUserAudio(element, username) {
    element.onclick = () => muteUserAudio(element, username);
    element.innerHTML = `<i class="fa-solid fa-microphone-slash"></i>`;
    sendSignal('unmute-user-audio', {
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
function joinRoom() {
    console.log("JPining room!")
    // Configure the websocket connection
    webSocket = new WebSocket(endPoint);    

    // When the connection opens or successfully starts with the server
    webSocket.onopen = function(e) {
        console.log('Connection opened', e);

        if (isHost) {
            sendSignal('room-config', {
                'waiting-rooms': waitingRooms,
                'limit': limit
            });
        }
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

joinRoom();

function waitingUserHTML(username) {
    return `<div class="waiting-user d-flex align-items-center justify-content-between bg-light p-2">
        <div>
            <p class="m-0">${username}</p>
        </div>
        <div class="btn-group">
            <button type="button" onclick="acceptWaitingUser(this, '${username}')" class="btn accept-button btn-sm btn-success"><i class="fa-solid fa-check"></i></button>
            <button type="button" onclick="rejectWaitingUser(this, '${username}')" class="btn reject-button btn-sm btn-danger"><i class="fa-solid fa-xmark me-1 ms-1"></i></button>
        </div>
    </div>`;
}

function acceptWaitingUser(element, username) {
    if (isHost) {
        sendSignal('accept-waiting-user', {
            'user': username
        });
        element.closest(".waiting-user").remove();
    }
}

function sendRaiseHand() {
    sendSignal('raise-hand', {
        'user': myUsername
    });
}

function rejectWaitingUser(element, username) {
    if (isHost) {
        sendSignal('reject-waiting-user', {
            'user': username
        });
        element.closest(".waiting-user").remove();
    }
}

function acceptAllWaitingUsers() {
    if (isHost) {
        let wuNodes = document.getElementById("waiting-users").querySelectorAll(".waiting-user");
        wuNodes.forEach((item, index) => {
            item.querySelector(".accept-button").click();
        })
    }
}

function rejectAllWaitingUsers() {
    if (isHost) {
        let wuNodes = document.getElementById("waiting-users").querySelectorAll(".waiting-user");
        wuNodes.forEach((item, index) => {
            item.querySelector(".reject-button").click();
        })
    }
}

/**
 * Message handler for the web socket
 * @param {Event} event Event object
 * @returns null
 */
function webSocketOnMessage(event) {
    let parsedData = JSON.parse(event.data);
    let action = parsedData['action'];
    let message = parsedData['message'];
    let peerUsername = parsedData['peer']; // user message meant for
    
    console.log(parsedData)
    
    if (action == "start-setup") {
        // Notify other peers about user's joining
        sendSignal('new-peer', {
            'local_screen_sharing': false,
        });
        setUp();
    } else if (action == "waiting-user") {
        let wu = document.getElementById("waiting-users");
        wu.insertAdjacentHTML("beforeend", waitingUserHTML(message["peerUsername"]));
        let wuButton = document.getElementById("waiting-users-button");

        if (!wu.closest("#collapseOne").classList.contains("show")) {
            wuButton.classList.add("bg-warning");
        }
    } else if (action == "kick-user") { // Case: Kicked out by the host
        window.location = "/"
        return;
    } else if (action == "hand-raised") { // Case: Kicked out by the host
        handRaised(message);
    } else if (action == 'mute-video') { // Case: Host muted your video
        videoLockedByHost = true;
        btnToggleVideo.disabled = true;
        videoTracks[0].enabled = false;
        btnToggleVideo.innerHTML = 'Video On';
    } else if (action == 'mute-audio') { // Case: Host muted your audio
        audioLockedByHost = true;
        btnToggleAudio.disabled = true;
        audioTracks[0].enabled = false;
        btnToggleAudio.innerHTML = 'Unmute';
    } else if (action == 'unmute-video') { // Case: Host unmuted your video
        videoLockedByHost = false;
        btnToggleVideo.disabled = false;
    } else if (action == 'unmute-audio') { // Case: Host unmuted your audio
        audioLockedByHost = false;
        btnToggleAudio.disabled = false;
    } else if (action == 'toggle-room-entry') { // Case: Host unmuted your audio
        audioLockedByHost = false;
        btnToggleAudio.disabled = false;
    }

    // Ignore all messages from oneself
    if (peerUsername == myUsername)
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

function addSuggestionToMessageInput(element) {
    messageInput.value = '@' + element.innerHTML + " ";
    messageNameSuggestionsContainer.innerHTML = "";
    messageInput.focus();
}

messageInput.addEventListener("input", function(event) {
    messageNameSuggestionsContainer.innerHTML = "";

    if (messageInput.value.startsWith("@")) {
        let index = messageInput.value.indexOf(" ");
        let caret = this.selectionStart;

        if (caret >= 1 && (index == -1 || caret <= index)) {
            let users = Object.keys(mapPeers);

            for (let i in users) {
                if (users[i].startsWith(messageInput.value.slice(1))) {
                    messageNameSuggestionsContainer.innerHTML += `<div class='m-0 p-2 message-suggestion' onclick='addSuggestionToMessageInput(this)'>${users[i]}</div>`;
                }
            }
        }
    }
});

btnSendMsg.onclick = btnSendMsgOnClick;

function createMessageHTML(username, message, private = false) {
    return `<div class="list-group-item list-group-item-action p-3 mb-3 ${private ? "bg-warning" : "bg-white"}" aria-current="true">
        <div class="d-flex w-100 justify-content-between mb-0">
            <p class="m-0 fw-bold">${username}</p>
            <small>${new Date().toLocaleTimeString()}</small>
        </div>
        <small class="mb-1">${message}</small>
    </div>`;
}

function scrollToBottom(element) {
    element.scroll({ top: element.scrollHeight, behavior: 'smooth' });
}

function btnSendMsgOnClick() {
    let message = messageInput.value;
    let dataChannels = getDataChannels();
    let messageHTML = createMessageHTML("You", message);
    
    if (message.startsWith("@")) {
        let index = message.indexOf(" ");
        messageHTML = createMessageHTML("You", message.slice(index + 1), true);

        if (index != 1 || index != -1) {
            let targetUsername = message.substr(1, index - 1).trim();
            let dt = getTargetDataChannel(targetUsername);

            if (dt != undefined) {
                dt.send(createMessageHTML(myUsername, message.slice(index + 1), true));
                chat.insertAdjacentHTML("beforeend", messageHTML);
                scrollToBottom(chat);
            }
        }
    } else { // Send to all data channels
        for (index in dataChannels) {
            dataChannels[index].send(createMessageHTML(myUsername, message));
        }
        
        chat.insertAdjacentHTML("beforeend", messageHTML);
        scrollToBottom(chat);
    }
    
    // Clear the message field
    messageInput.value = '';
}

const constraints = {
    video: {
        width: 1280,
        height: 720,
        facingMode: "user"
    },
    audio: true
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

function setUp() {
    userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;
        myUsername = username;
        userStreamMapping[myUsername] = stream;
        myUsername = myUsername;
        mainScreenUsername = myUsername;
        mainScreenVideo.srcObject = localStream;
        mainScreenVideo.muted = true;
        window.stream = stream; // make variable available to browser console

        audioTracks = stream.getAudioTracks();
        videoTracks = stream.getVideoTracks();

        // Mute audio and video by default
        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        // Handler for audio toggle button
        btnToggleAudio.onclick = function() {
            if (audioLockedByHost)
                return;

            audioTracks[0].enabled = !audioTracks[0].enabled;

            if (audioTracks[0].enabled) {
                btnToggleAudio.innerHTML = '<i class="fa-solid fa-microphone-slash me-2"></i>Mute';
            } else {
                btnToggleAudio.innerHTML = '<i class="fa-solid fa-microphone me-2"></i>Unmute';
            }
        };

        // Handler for video toggle button
        btnToggleVideo.onclick = function() {
            if (videoLockedByHost)
                return;

            videoTracks[0].enabled = !videoTracks[0].enabled;

            if (videoTracks[0].enabled) {
                btnToggleVideo.innerHTML = '<i class="fa-solid fa-video-slash me-2"></i>Video Off';
            } else {
                btnToggleVideo.innerHTML = '<i class="fa-solid fa-video me-2"></i>Video On';
            }
        };
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
}

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

    dc.onmessage = dcOnMessage;
    remoteVideo = createVideo(peerUsername);
    setOnTrack(peerUsername, peer, remoteVideo);
    mapPeers[peerUsername] = [peer, dc];

    peer.oniceconnectionstatechange = () => {
        let iceConnectionState = peer.iceConnectionState;

        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed"){
            alert("here 585");
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }

            removeVideo(remoteVideo);
            pinToMainScreen(myUsername);
        }
    };

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

function createAnswerer(offer, peerUsername, localScreenSharing, remoteScreenSharing, receiverChannelName) {
    let peer = new RTCPeerConnection(null);
    addLocalTracks(peer, localScreenSharing);
    let newConnectionSound = document.querySelector('#new-connection');

    let remoteVideo = createVideo(peerUsername);

    // Add tracks to remote video
    setOnTrack(peerUsername, peer, remoteVideo);

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
        console.log("state", iceConnectionState);

        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
            alert("here 688");
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }

            removeVideo(remoteVideo);
            pinToMainScreen(myUsername);
        }
    };

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
    chat.insertAdjacentHTML("beforeend", message);
    scrollToBottom(chat);

    let chatSound = document.querySelector('#chat-sound');
    chatSound.play();
}

function getTargetDataChannel(targetUsername) {
    if (targetUsername in mapPeers) {
        return mapPeers[targetUsername][1];
    }

    return undefined;
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

function pinToMainScreen(username) {
    mainScreenUsername = username;
    mainScreenVideo.srcObject = userStreamMapping[username];
}

function createVideoOverlay(username) {
    let html = `<div class="video-overlay">
    <button class="btn-pin-video-to-showcase rounded-pill btn btn-light" onclick="pinToMainScreen('${username}')"><i class="fa-solid fa-thumbtack"></i></button>`;
    
    if (isHost && username != myUsername)
        html += `<button class="btn-toggle-video-lock ms-2 rounded-pill btn btn-light" onclick="muteUserVideo(this, '${username}')"><i class="fa-solid fa-video-slash"></i></button>
        <button class="btn-toggle-audio-lock ms-2 rounded-pill btn btn-light"  onclick="muteUserAudio(this, '${username}')"><i class="fa-solid fa-microphone-slash"></i></button>
        <button class="btn-kick-user ms-2 rounded-pill btn btn-light"  onclick="kickUser('${username}')"><i class="fa-solid fa-trash"></i></button>`;

    html += `</div>`;
    return html;
}

function simpleToastHTML(text) {
    return `<div class="toast align-items-center" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
        <div class="toast-body">
            ${text}
        </div>
        </div>
    </div>`;
}

function raiseHandHTML(text) {
    return `<div class="toast fade" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
            <p class="m-0 me-2">🖐️</p>
            <strong class="me-auto me-2">${text}</strong>
            <small>${new Date().toLocaleTimeString()}</small>
        </div>
    </div>`;
}

function handRaised(text) {
    toastsContainer.insertAdjacentHTML("beforeend", raiseHandHTML(text));
    activateToasts();
}

function activateToasts() {
    const toastElList = document.querySelectorAll('.toast');
    const toastList = [...toastElList].map(toastEl => new bootstrap.Toast(toastEl));
    toastList.forEach((item, index) => {
        item.show();
        addEventListener('hidden.bs.toast', () => {
            toastElList[index].remove();
        });
    });
}

function createVideo(peerUsername) {
    let videoContainer = document.querySelector('#participants');

    let remoteVideo = document.createElement('video');
    remoteVideo.id = peerUsername + '-video';
    remoteVideo.className = "participant-video";
    remoteVideo.autoplay = true;
    remoteVideo.playsinline = true;

    let videoWrapper = document.createElement('div');
    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteVideo);
    videoWrapper.insertAdjacentHTML("beforeend", createVideoOverlay(peerUsername));
    videoWrapper.className = "participant-video-container";
    return remoteVideo;
}

function setOnTrack(peerUsername, peer, remoteVideo) {
    let remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;
    userStreamMapping[peerUsername] = remoteStream;
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