from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']
CSRF_TRUSTED_ORIGINS = ["https://ac7f-103-25-231-102.in.ngrok.io"]
CSRF_TRUSTED_ORIGINS = ["https://a907-180-151-15-242.in.ngrok.io"]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}
