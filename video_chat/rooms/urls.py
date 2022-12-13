from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('login/', views.login_view, name='login_view'),
    path('logout/', views.logout_view, name='logout_view'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('update-user/', views.user_update_view, name='user_update_view'),
    path('room/<str:room_code>/', views.room, name='room'),
    path('create-room/', views.room_creation_view, name='room_creation_view'),
    path('delete-room/<str:room_code>/', views.delete_room, name='delete_room'),
    path('edit-room/<str:room_code>/', views.edit_room, name="edit_room")
]