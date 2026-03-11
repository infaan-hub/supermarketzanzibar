#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
cd zansupermarket
python manage.py collectstatic --noinput
