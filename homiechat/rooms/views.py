from django.shortcuts import render, redirect
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
def user_creation_view(request):
    context = {}

    if request.method == 'POST':
        usercreationform = CreateUserForm(request.POST, request.FILES)

        if usercreationform.is_valid():
            user = usercreationform.save()
            email = usercreationform.cleaned_data.get('email')
            raw_password = usercreationform.cleaned_data.get('password1')
            authenticated_account = authenticate(email=email, password=raw_password)
            login(request, authenticated_account)
            return redirect('user_detail_view', pk=user.id)
        else:
            context['form'] = usercreationform
    elif request.method == "GET":
        usercreationform = CreateUserForm()
        context['form'] = usercreationform

    return render(request, 'rooms/user_creation_view.html', context=context)

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
                return redirect('user_detail_view', pk=user.id)
    else:
        form = UserAuthenticationForm()

    context['form'] = form
    return render(request, 'rooms/login_view.html', context)

@login_required
def logout_view(request):
    logout(request)
    return redirect('user_creation_view')

class UserDetailView(LoginRequiredMixin, DetailView):
    model = User
    template_name = 'rooms/user_detail_view.html'

    def get(self, request, pk):
        context = {}
        user = User.objects.get(id=pk)
        display_btn_update = False

        if request.user == user:
            display_btn_update = True

        context['user'] = user
        context['display_btn_update'] = display_btn_update
        return render(request, self.template_name, context)

class RoomListView(LoginRequiredMixin, ListView):
    model = Room
    template_name = 'rooms/room_list_view.html'

    def get(self, request):
        context = {}
        rooms = Room.objects.filter(user=request.user)
        context['rooms'] = rooms
        context['json_rooms'] = rooms
        return render(request, self.template_name, context)

@login_required
def user_update_view(request):
    context = {}
    user = request.user

    if request.method == 'POST':
        form = UpdateUserForm(request.POST, request.FILES, instance=user)

        if form.is_valid():
            user = form.save()
            return redirect('user_detail_view', pk=request.user.id)
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
            return redirect('room_list_view')
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
def join_chat_view(request, room_code):
    context = {}
    room = Room.objects.get(code = room_code)
    context['room_code'] = room_code
    context["is_host"] = room.user.username == request.user.username
    return render(request, 'rooms/join_chat_view.html', context=context)

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
        return redirect('join_chat_view', room_code=room_code)
    
    context['warning'] = True
    return render(request, 'rooms/select_room_view.html', context)
