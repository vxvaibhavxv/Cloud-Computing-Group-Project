# Video Conferencing Application

Video Conferencing Application for CSE569 Cloud Computing

## How to run the project?

Follow the steps ahead to set up and run the project.

1. Install `Python 3.8.9`
2. Run `pip install virtualenv`
3. Create a virtual environment using `virtualenv environment` in the project directory.
4. Activate the virtual environment using `environment\Scripts\activate`. This will only work for Windows.
5. Install the dependencies using `pip install -r requirements.txt`
6. Create an `.env` file in the project directory and add the following to the file. Add values for all the variables.
    ```text
    SECRET_KEY=<any-hash-value>

    # Development
    LOCAL_SETTINGS_MODULE=video_chat.settings.development

    # Production
    LOCAL_SETTINGS_MODULE=video_chat.settings.production
    ```
7. Create database migrations using `python manage.py makemigrations` and then migrate them using `python manage.py migrate`.
8. Create a superuser using the following `python manage.py createsuperuser` and fill the required details.
9. Run the server using `python manage.py runserver`.
10. Visit `http://127.0.0.1:8000/` to access the website and `http://127.0.0.1:8000/admin` to access the Django admin panel.

## Features: DONE
* Audio Streaming
* Video Streaming
* Record Screen
* Chatting
* Roll-based access
    * Host
        * Open and close entry to the meeting
        * Manage meeting credentials and settings
        * Mute and unmute participants audio
        * Mute and unmute participants video
        * Kick participants out of the meeting
* Update project details
* Waiting Rooms
* Raise hand
* Update UI
* Global and private messages

## Features: TODO
* Extend support to users over different internet connections (TBD)
* Host (optional)