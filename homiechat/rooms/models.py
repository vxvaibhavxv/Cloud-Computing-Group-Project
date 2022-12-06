from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.templatetags.static import static

MALE_NUMBER = 1
FEMALE_NUMBER = 2
MALE = 'Male'
FEMALE = 'Female'

GENDER_CHOICES = [
    (MALE_NUMBER, MALE),
    (FEMALE_NUMBER, FEMALE),
]

class MyAccountManager(BaseUserManager):
    def create_user(self, username, email, password=None):
        if not email:
            raise ValueError("Users must have an email address.")
        if not username:
            raise ValueError("Users must have a username.")

        user = self.model(
            email=self.normalize_email(email),
            username=username,
        )

        user.set_password(password)
        user.save(self, using=self._db)
        return user

    def create_superuser(self, email, username, password):
        user=self.create_user(
            email=self.normalize_email(email),
            password=password,
            username=username,
        )

        user.is_admin = True
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)

class User(AbstractBaseUser):
    email = models.EmailField(verbose_name='Email', unique=True, max_length=60)
    username = models.CharField(max_length=60, unique=True)
    date_joined = models.DateField(verbose_name='Date Joined', auto_now_add=True)
    last_login = models.DateField(verbose_name='Last Login', auto_now=True)
    is_admin = models.BooleanField(default=False, verbose_name="Admin?")
    is_active = models.BooleanField(default=True, verbose_name="Active?")
    is_staff = models.BooleanField(default=False, verbose_name="Staff?")
    is_superuser = models.BooleanField(default=False, verbose_name="Superuser?")

    first_name = models.CharField(max_length=60, verbose_name='First Name')
    last_name = models.CharField(max_length=60, verbose_name='Last Name', blank = True)
    bio = models.CharField(max_length=60, verbose_name='Bio', null=True, blank=True, default=None)
    image = models.ImageField(upload_to='user_images', null=True, blank=True)
    gender = models.SmallIntegerField(choices=GENDER_CHOICES, null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', ]

    @property
    def image_url(self):
        try:
            url = self.image.url
        except:
            if self.gender == FEMALE_NUMBER:
                url = static('images/default_female_picture.png')
            elif self.gender == MALE_NUMBER:
                url = static('images/default_male_picture.png')
            else:
                url = static('images/default_profile_picture.png')

        return url

    objects = MyAccountManager()

    def __str__(self):
        return self.email

    def has_perm(self, perm, obj=None):
        return self.is_admin

    def has_module_perms(self, app_label):
        return True

    class Meta:
        verbose_name_plural = "Homie Chat Users"

class Room(models.Model):
    code = models.CharField(max_length=44, unique=True)
    name = models.CharField(max_length=40, null=True, blank=True, default=None)
    description = models.TextField(blank = True)
    user = models.ForeignKey(to=User, on_delete=models.CASCADE)
    

class Video(models.Model):
    video_file = models.FileField(upload_to='room_videos')
    room = models.ForeignKey(to=Room, on_delete=models.CASCADE)

    @property
    def video_url(self):
        return self.video_file.url

