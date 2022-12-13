import json
from .models import User, Room
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

rooms = {}

class ChatConsumer(AsyncWebsocketConsumer):
    def get_room(self):
        return Room.objects.get(code = self.scope['url_route']['kwargs']['room_code'])

    def get_room_owner(self):
        return Room.objects.get(code = self.scope['url_route']['kwargs']['room_code']).user.username

    def is_room_owner(self, room_code, username):
        return rooms[room_code]["members"][username][0] == "host"

    def is_room_participant(self, room_code, username):
        return rooms[room_code]["members"][username][0] == "participant"

    async def connect(self):
        room_code = self.scope['url_route']['kwargs']['room_code']

        self.room = await database_sync_to_async(self.get_room)()
        self.room_owner = await database_sync_to_async(self.get_room_owner)()
        self.room_group_name = room_code

        user = self.scope['user']

        # only room owner/host can start the room
        if room_code not in rooms.keys():
            if self.room_owner == user.username:
                rooms[room_code] = {
                    "config": {
                        "open": True,
                        "joined": 0
                    },
                    "members": {}
                }
            else:
                await self.close()
                return

        config = rooms[room_code]["config"]

        if self.room_owner != user.username:
            if not config["open"]:
                await self.close()
                
            if config["limit"] <= config["joined"]:
                await self.close()


        if self.room_owner == user.username:
            rooms[room_code]["members"][user.username] = ["host", self.channel_name]
        else:
            rooms[room_code]["members"][user.username] = ["participant", self.channel_name]

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        rooms[room_code]["config"]["joined"] += 1

        if self.room_owner != user.username:
            if not config["open"]:
                await self.channel_layer.send(
                    self.channel_name,
                    {
                        'type': 'send.sdp',
                        'receive_dict': {
                            "peer": user.username,
                            "action": "no-entry",
                            "message": "Host has disabled entry to the room"
                        },
                    }
                ) 
                await self.close()
                return
                
            if config["limit"] <= config["joined"]:
                await self.channel_layer.send(
                    self.channel_name,
                    {
                        'type': 'send.sdp',
                        'receive_dict': {
                            "peer": user.username,
                            "action": "limit-reached",
                            "message": "Room limit reached"
                        },
                    }
                ) 
                await self.close()
                return
                
        await self.accept()

        # If waiting rooms enabled, send a message to the host
        if self.room_owner != user.username and rooms[room_code]["config"]["waiting-rooms"]:
            await self.channel_layer.send(
                rooms[self.room_group_name]["members"][self.room_owner][1],
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": self.room_owner,
                        "action": "waiting-user",
                        "message": {
                            "peerUsername": user.username
                        }
                    },
                }
            )
        elif self.room_owner != user.username:
            await self.channel_layer.send(
                rooms[self.room_group_name]["members"][user.username][1],
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": user.username,
                        "action": "start-setup",
                        "message": "Host accepted your request to join the room."
                    },
                }
            )
        
        print(json.dumps(rooms[room_code], indent = 4))

    async def disconnect(self, close_code):
        room_code = self.scope['url_route']['kwargs']['room_code']
        user = self.scope['user']
        
        # if the host leaves, remove everyone and close the room
        if self.room_owner == user:
            for memKey in rooms[room_code]["members"].keys():
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    rooms[room_code]["members"][memKey][1]
                )

            del rooms[room_code]
        else:
            del rooms[room_code]["members"][user.username]
            rooms[room_code]["config"]["joined"] -= 1

            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

        print(json.dumps(rooms[room_code], indent = 4))

    # Receive message from WebSocket
    async def receive(self, text_data):
        receive_dict = json.loads(text_data)
        peer_username = receive_dict["peer"] # sender
        action = receive_dict['action']
        
        print()
        print("Recieved Dictionary")
        print(json.dumps(receive_dict, indent = 4))
        print()

        if action == 'accept-waiting-user' and self.is_room_owner(self.room_group_name, peer_username):
            user = receive_dict["message"]["user"]

            await self.channel_layer.send(
                rooms[self.room_group_name]["members"][user][1],
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": user,
                        "action": "start-setup",
                        "message": "Host accepted your request to join the room."
                    },
                }
            )
        elif action == 'reject-waiting-user' and self.is_room_owner(self.room_group_name, peer_username):
            user = receive_dict["message"]["user"]
            receiver_channel_name = rooms[self.room_group_name]["members"][user][1] # channel name of the user to kick out

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": user,
                        "action": "kick-user",
                        "message": "Host declied your request to join the room."
                    },
                }
            )
        elif action == 'room-config' and self.is_room_owner(self.room_group_name, peer_username):
            rooms[self.room_group_name]["config"]["waiting-rooms"] = receive_dict["message"]["waiting-rooms"]
            rooms[self.room_group_name]["config"]["limit"] = receive_dict["message"]["limit"]
            
            await self.channel_layer.send(
                rooms[self.room_group_name]["members"][peer_username][1],
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": peer_username,
                        "action": "start-setup",
                        "message": "Room configured successfully!"
                    },
                }
            )
        elif action == "kick-user" and self.is_room_owner(self.room_group_name, peer_username):
            target = receive_dict["message"]["target"] # user to kick out
            receiver_channel_name = rooms[self.room_group_name]["members"][target][1] # channel name of the user to kick out

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": target,
                        "action": "kick-user",
                        "message": "host kicked you out, lol!"
                    },
                }
            )
        elif action == "mute-user-video" and self.is_room_owner(self.room_group_name, peer_username):
            target = receive_dict["message"]["target"]
            receiver_channel_name = rooms[self.room_group_name]["members"][target][1]

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": target,
                        "action": "mute-video",
                        "message": "Host has muted your video"
                    },
                }
            )
        elif action == "mute-user-audio" and self.is_room_owner(self.room_group_name, peer_username):
            target = receive_dict["message"]["target"]
            receiver_channel_name = rooms[self.room_group_name]["members"][target][1]

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": target,
                        "action": "mute-audio",
                        "message": "Host has muted your audio"
                    },
                }
            )
        elif action == "unmute-user-video" and self.is_room_owner(self.room_group_name, peer_username):
            target = receive_dict["message"]["target"]
            receiver_channel_name = rooms[self.room_group_name]["members"][target][1]

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": target,
                        "action": "unmute-video",
                        "message": "Host has unmuted your video"
                    },
                }
            )
        elif action == "unmute-user-audio" and self.is_room_owner(self.room_group_name, peer_username):
            target = receive_dict["message"]["target"]
            receiver_channel_name = rooms[self.room_group_name]["members"][target][1]

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": target,
                        "action": "unmute-audio",
                        "message": "Host has unmuted your audio"
                    },
                }
            )
        elif action == "change-room-entry" and self.is_room_owner(self.room_group_name, peer_username):
            receiver_channel_name = rooms[self.room_group_name]["members"][peer_username][1]
            state = receive_dict["message"]["state"] == "true"
            rooms[self.room_group_name]["config"]["open"] = state
            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': {
                        "peer": peer_username,
                        "action": "room-open" if rooms[self.room_group_name]["config"]["open"] else "room-close",
                        "message": "Entry to room enabled" if rooms[self.room_group_name]["config"]["open"] else "Entry to room disabled"
                    },
                }
            )
        elif (action == 'new-offer') or (action =='new-answer'):
            receiver_channel_name = receive_dict['message']['receiver_channel_name']
            receive_dict['message']['receiver_channel_name'] = self.channel_name

            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': receive_dict,
                }
            )
        elif action == "raise-hand":
            for key, value in rooms[self.room_group_name]["members"].items():
                await self.channel_layer.send(
                    value[1],
                    {
                        'type': 'send.sdp',
                        'receive_dict': {
                            "peer": key,
                            "action": "hand-raised",
                            "message": f"{peer_username} raised their hand."
                        },
                    }
                )
        elif action == "new-peer":
            receive_dict['message']['receiver_channel_name'] = self.channel_name

            # send to all peers
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': receive_dict,
                }
            )

    async def send_sdp(self, event):
        receive_dict = event['receive_dict']

        this_peer = receive_dict['peer']
        action = receive_dict['action']
        message = receive_dict['message']

        await self.send(text_data=json.dumps({
            'peer': this_peer,
            'action': action,
            'message': message,
        }))