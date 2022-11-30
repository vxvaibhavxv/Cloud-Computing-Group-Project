from django.shortcuts import redirect

def is_authenticated(function):
    def wrapper(request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('user_detail_view', pk=request.user.id)
        
        return function(request, *args, **kwargs)

    return wrapper