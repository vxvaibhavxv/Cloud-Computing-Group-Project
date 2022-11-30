from django import forms

from .models import User, Room

from django.contrib.auth.forms import UserCreationForm, UserChangeForm

from django.contrib.auth import authenticate

class CreateUserForm(UserCreationForm):
    email = forms.EmailField(max_length=60, help_text='Required. Add a valid email address.')
    bio = forms.CharField(max_length=60, widget=forms.Textarea, help_text='Type something about yourself.', required=False)

    class Meta:
        model = User
        fields = (
            'first_name',
            'last_name',
            'gender',
            'email',
            'username',
            'password1',
            'password2',
            'bio',
            'image',
        )

class UserAuthenticationForm(forms.ModelForm):
    password = forms.CharField(label='Password', widget=forms.PasswordInput)

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

    class Meta:
        model = User
        fields = (
            'first_name',
            'last_name',
            'gender',
            'email',
            'username',
            'bio',
            'image',
        )

class RoomCreationForm(forms.ModelForm):
    name = forms.CharField(max_length=40, required=True)
    class Meta:
        model = Room
        fields = (
            'name',
        )