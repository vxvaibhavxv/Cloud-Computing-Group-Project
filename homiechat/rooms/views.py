from django.shortcuts import render, redirect, HttpResponse
from .models import User, Room
from .forms import (
    CreateUserForm,
    UserAuthenticationForm,
    UpdateUserForm,
    RoomCreationForm
)
from django.contrib.auth import login, authenticate, logout
from django.views.generic import DetailView, ListView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from .decorators import is_authenticated
from .utils import generate_room_code
from django.contrib import messages

@is_authenticated
def home(request):
    context = {}

    if request.method == 'POST':
        usercreationform = CreateUserForm(request.POST, request.FILES)

        if usercreationform.is_valid():
            user = usercreationform.save()
            email = usercreationform.cleaned_data.get('email')
            raw_password = usercreationform.cleaned_data.get('password1')
            authenticated_account = authenticate(email=email, password=raw_password)
            login(request, authenticated_account)
            return redirect('dashboard')
        else:
            context['form'] = usercreationform
    elif request.method == "GET":
        usercreationform = CreateUserForm()
        context['form'] = usercreationform

    return render(request, 'rooms/home.html', context=context)

@is_authenticated
def login_view(request):
    context = {}
    form = None

    if request.method == 'POST':
        form = UserAuthenticationForm(request.POST)

        if form.is_valid():
            email = request.POST['email']
            password = request.POST['password']
            user = authenticate(email=email, password=password)

            if user:
                login(request, user)
                return redirect('dashboard')
    else:
        form = UserAuthenticationForm()

    context['form'] = form
    return render(request, 'rooms/login.html', context)

@login_required
def logout_view(request):
    logout(request)
    return redirect('home')

@login_required
def dashboard(request):
    context = {}
    user = request.user
    rooms = Room.objects.filter(user = user)
    context['rooms'] = rooms
    context['user'] = user

    if request.method == "POST":
        room_code = request.POST.get('room-input')
        print("Room Code:", room_code)
        context['warning'] = True
        
        if room_code != None:
            room_exists = Room.objects.filter(code=room_code).exists()

            if room_exists:
                context['warning'] = False
                return redirect('room', room_code=room_code)

    return render(request, 'rooms/dashboard.html', context)

@login_required
def user_update_view(request):
    context = {}
    user = request.user

    if request.method == 'POST':
        form = UpdateUserForm(request.POST, request.FILES, instance=user)

        if form.is_valid():
            user = form.save()
            form = UpdateUserForm(instance=user)
            context['form'] = form
            messages.success(request, "Profile updated successfully!")
            return render(request, 'rooms/user_update_view.html', context=context)
        else:
            context['form'] = form
    else: # GET request
        form = UpdateUserForm(instance=user)
        context['form'] = form

    return render(request, 'rooms/user_update_view.html', context=context)

@login_required
def room_creation_view(request):
    context = {}

    if request.method == 'POST':
        roomcreationform = RoomCreationForm(request.POST)

        if roomcreationform.is_valid():
            rooms = Room.objects.all()
            new_id = int(0)

            if rooms:
                new_id = rooms[len(rooms) - 1].id + 1

            room = roomcreationform.save(commit=False)
            room.user = request.user
            room.code = generate_room_code(new_id)
            room.save()
            messages.success(request, "Room created successfully!")
            return redirect('dashboard')
        else:
            context['form'] = roomcreationform
    elif request.method == "GET":
        roomcreationform = RoomCreationForm()
        context['form'] = roomcreationform

    return render(request, 'rooms/room_creation_view.html', context=context)

@login_required
def prepare_chat_view(request):
    context = {}
    return render(request, 'rooms/prepare_chat_view.html', context=context)

@login_required
def room(request, room_code):
    context = {}
    room = Room.objects.get(code = room_code)
    context['room_code'] = room_code
    context["is_host"] = room.user.username == request.user.username
    context["room_host"] = room.user.username
    context["room_name"] = room.name
    context["room_description"] = room.description

    if request.method == "POST":
        context["waiting_room"] = request.POST.get("waiting_room") == "true"
        context["limit"] = int(request.POST.get("limit"))
    
    return render(request, 'rooms/room.html', context=context)

@login_required
def select_room_view(request):
    context = {}
    room_code = request.GET.get('room-input')
    context['placeholder'] = 'Enter room code ...'

    if room_code == None:
        context['warning'] = False
        return render(request, 'rooms/select_room_view.html', context=context)
    
    room_exists = Room.objects.filter(code=room_code).exists()

    if room_exists:
        return redirect('room', room_code=room_code)
    
    context['warning'] = True
    return render(request, 'rooms/select_room_view.html', context)

@login_required
def delete_room(request, room_code):
    if room_code:
        room_exists = Room.objects.filter(code=room_code)

        if room_exists:
            room = room_exists.first()

            if room.user == request.user:
                room.delete()
                messages.success(request, "Room deleted successfully.")
            else:
                messages.error(request, "Room doesn't belong to you.")
        else:
            messages.error(request, "Room doesn't exist.")

    return redirect("dashboard")

@login_required
def edit_room(request, room_code):
    if room_code:
        room_exists = Room.objects.filter(code=room_code)

        if room_exists:
            room = room_exists.first()

            if room.user == request.user:
                print(request.POST.get("roomName"))
                print(request.POST.get("roomCode"))
                print(request.POST.get("roomDescription"))
                room.name = request.POST.get("roomName")
                room.code = request.POST.get("roomCode")
                room.description = request.POST.get("roomDescription")
                room.save()
                messages.success(request, "Room updated successfully!")
            else:
                messages.error(request, "Room doesn't belong to you.")
        else:
            messages.error(request, "Room doesn't exist.")

    return redirect("dashboard")