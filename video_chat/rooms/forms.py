from django import forms
from django.db import models
from .models import User, Room

from django.contrib.auth.forms import UserCreationForm, UserChangeForm

from django.contrib.auth import authenticate

class CreateUserForm(UserCreationForm):
    email = forms.EmailField(max_length=60, help_text='Required. Add a valid email address.')
    bio = forms.CharField(max_length=60, widget=forms.Textarea, help_text='Type something about yourself.', required=False)

    def __init__(self, *args, **kwargs):
        super(CreateUserForm, self).__init__(*args, **kwargs)
    
        self.fields['first_name'].widget.attrs['class'] = 'form-control'
        self.fields['first_name'].widget.attrs['order'] = 's'
        self.fields['first_name'].widget.attrs['placeholder'] = 'Enter your first name'

        self.fields['username'].widget.attrs['class'] = 'form-control'
        self.fields['username'].widget.attrs['order'] = 'x'
        self.fields['username'].widget.attrs['placeholder'] = 'Enter your username'

        self.fields['last_name'].widget.attrs['class'] = 'form-control'
        self.fields['last_name'].widget.attrs['order'] = 'e'
        self.fields['last_name'].widget.attrs['placeholder'] = 'Enter your last name'
        
        self.fields['password1'].widget.attrs['class'] = 'form-control'
        self.fields['password1'].widget.attrs['order'] = 's'
        self.fields['password1'].widget.attrs['placeholder'] = 'Enter a password'

        self.fields['password2'].widget.attrs['class'] = 'form-control'
        self.fields['password2'].widget.attrs['order'] = 'e'
        self.fields['password2'].widget.attrs['placeholder'] = 'Reenter your password'

        self.fields['gender'].widget.attrs['class'] = 'form-select'
        self.fields['gender'].widget.attrs['order'] = 's'

        self.fields['image'].widget.attrs['class'] = 'form-control'
        self.fields['image'].widget.attrs['order'] = 'x'

        self.fields['email'].widget.attrs['class'] = 'form-control'
        self.fields['email'].widget.attrs['order'] = 'e'
        self.fields['email'].widget.attrs['placeholder'] = 'Enter your email'

        self.fields['bio'].widget.attrs['class'] = 'form-control'
        self.fields['bio'].widget.attrs['order'] = 'a'  
        self.fields['bio'].widget.attrs['placeholder'] = 'Enter a bio'


    class Meta:
        model = User
        fields = (
            'first_name',
            'username',
            'last_name',
            'password1',
            'password2',
            'gender',
            'image',
            'email',
            'bio'
        )

class UserAuthenticationForm(forms.ModelForm):
    password = forms.CharField(label='Password', widget=forms.PasswordInput)

    def __init__(self, *args, **kwargs):
        super(UserAuthenticationForm, self).__init__(*args, **kwargs)
    
        self.fields['email'].widget.attrs['class'] = 'form-control'
        self.fields['email'].widget.attrs['order'] = 'a'
        self.fields['email'].widget.attrs['placeholder'] = 'Enter your email'

        self.fields['password'].widget.attrs['class'] = 'form-control'
        self.fields['password'].widget.attrs['order'] = 'a'
        self.fields['password'].widget.attrs['placeholder'] = 'Enter your password'

    class Meta:
        model = User
        fields = (
            'email',
        )

    def clean(self):
        email = self.cleaned_data['email']
        password = self.cleaned_data['password']

        if not authenticate(email=email, password=password):
            raise forms.ValidationError('Invalid login.')

class UpdateUserForm(forms.ModelForm):
    email = forms.EmailField(max_length=60, help_text='Required. Add a valid email address.')
    bio = forms.CharField(max_length=60, widget=forms.Textarea, help_text='Type something about yourself.', required=False)

    def __init__(self, *args, **kwargs):
        super(UpdateUserForm, self).__init__(*args, **kwargs)
    
        self.fields['first_name'].widget.attrs['class'] = 'form-control'
        self.fields['first_name'].widget.attrs['order'] = 's'

        self.fields['username'].widget.attrs['class'] = 'form-control'
        self.fields['username'].widget.attrs['order'] = 'x'

        self.fields['last_name'].widget.attrs['class'] = 'form-control'
        self.fields['last_name'].widget.attrs['order'] = 'e'

        self.fields['gender'].widget.attrs['class'] = 'form-select'
        self.fields['gender'].widget.attrs['order'] = 's'

        self.fields['image'].widget.attrs['class'] = 'form-control'
        self.fields['image'].widget.attrs['order'] = 'x'

        self.fields['email'].widget.attrs['class'] = 'form-control'
        self.fields['email'].widget.attrs['order'] = 'e'

        self.fields['bio'].widget.attrs['class'] = 'form-control'
        self.fields['bio'].widget.attrs['order'] = 'a'  

    class Meta:
        model = User
        fields = (
            'first_name',
            'username',
            'last_name',
            'gender',
            'image',
            'email',
            'bio'
        )
        widgets = {
            'image': forms.FileInput(),
        }

class RoomCreationForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super(RoomCreationForm, self).__init__(*args, **kwargs)
    
        self.fields['name'].widget.attrs['class'] = 'form-control'
        self.fields['name'].widget.attrs['order'] = 'a'
        self.fields['name'].widget.attrs['placeholder'] = 'Enter a room name'

        self.fields['description'].widget.attrs['class'] = 'form-control'
        self.fields['description'].widget.attrs['order'] = 'a'
        self.fields['description'].widget.attrs['placeholder'] = 'Enter a room description'

    class Meta:
        model = Room
        fields = (
            'name',
            'description'
        )