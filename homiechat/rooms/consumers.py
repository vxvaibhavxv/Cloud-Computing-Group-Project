import json
from .models import User, Room
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

rooms = {}

class ChatConsumer(AsyncWebsocketConsumer):
    def get_room(self):
        return Room.objects.get(code = self.scope['url_route']['kwargs']['room_code'])

    def get_room_owner(self):
        return Room.objects.get(code = self.scope['url_route']['kwargs']['room_code']).user

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
        
        if room_code not in rooms.keys():
            rooms[room_code] = {
                "config": {
                    "open": True,
                    "limit": None
                },
                "members": {}
            }

        if not rooms[room_code]["config"]["open"]:
            await self.close()
        
        if self.room_owner.username == user.username:
            rooms[room_code]["members"][user.username] = ["host", self.channel_name]
        else:
            rooms[room_code]["members"][user.username] = ["participant", self.channel_name]

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        room_code = self.scope['url_route']['kwargs']['room_code']
        user = self.scope['user']
        del rooms[room_code]["members"][user.username]

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        receive_dict = json.loads(text_data)
        peer_username = receive_dict['peer'] # the one who sent this message
        action = receive_dict['action']

        if action == "kick-user" and self.is_room_owner(self.room_group_name, peer_username):
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

            # kicking user out of the group and detracking it
            await self.channel_layer.group_discard(
                self.room_group_name,
                rooms[self.room_group_name]["members"][target][1]
            )

            del rooms[self.room_group_name]["members"][target]
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
        else:
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