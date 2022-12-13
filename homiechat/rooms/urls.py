from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('login/', views.login_view, name='login_view'),
    path('logout/', views.logout_view, name='logout_view'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('user-update-view/', views.user_update_view, name='user_update_view'),
    path('prepare-chat-view/', views.prepare_chat_view, name='prepare_chat_view'),
    path('room/<str:room_code>/', views.room, name='room'),
    path('create-room/', views.room_creation_view, name='room_creation_view'),
    path('select-room-view/', views.select_room_view, name='select_room_view'),
    path('delete-room/<str:room_code>/', views.delete_room, name='delete_room'),
    path('edit-room/<str:room_code>/', views.edit_room, name="edit_room")
]