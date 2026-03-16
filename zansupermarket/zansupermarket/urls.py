import re
from pathlib import Path
from urllib.parse import urlsplit

from django.contrib import admin
from django.conf import settings
from django.http import Http404
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [

    path('admin/', admin.site.urls),

    path('api/', include('supermarketzanzibar.urls')),

]


def serve_media_with_fallback(request, path, **kwargs):
    media_roots = []
    for root in (settings.MEDIA_ROOT, Path(settings.BASE_DIR) / "media"):
        normalized_root = str(root)
        if normalized_root not in media_roots:
            media_roots.append(normalized_root)

    for root in media_roots:
        try:
            return serve(request, path, document_root=root, show_indexes=False)
        except Http404:
            continue

    raise Http404("Media file not found.")

if settings.MEDIA_URL and not urlsplit(settings.MEDIA_URL).netloc:
    media_prefix = re.escape(settings.MEDIA_URL.lstrip("/"))
    urlpatterns += [
        re_path(
            rf"^{media_prefix}(?P<path>.*)$",
            serve_media_with_fallback,
        ),
    ]
