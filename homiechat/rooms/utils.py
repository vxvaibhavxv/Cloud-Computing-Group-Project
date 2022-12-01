from django.core.signing import Signer

def generate_room_code(room_id):
    str_room_id = str(room_id)
    signer = Signer()
    room_code = signer.sign(str_room_id)[(len(str_room_id) + 1):]    
    return room_code
