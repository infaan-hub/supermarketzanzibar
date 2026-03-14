import re
from urllib.parse import urlsplit

from django.contrib import admin
from django.conf import settings
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [

    path('admin/', admin.site.urls),

    path('api/', include('supermarketzanzibar.urls')),

]

if settings.MEDIA_URL and not urlsplit(settings.MEDIA_URL).netloc:
    media_prefix = re.escape(settings.MEDIA_URL.lstrip("/"))
    urlpatterns += [
        re_path(
            rf"^{media_prefix}(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT, "show_indexes": False},
        ),
    ]
