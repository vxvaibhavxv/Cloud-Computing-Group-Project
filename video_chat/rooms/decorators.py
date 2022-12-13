from django.shortcuts import redirect

def is_authenticated(function):
    def wrapper(request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('dashboard')
        
        return function(request, *args, **kwargs)

    return wrapper