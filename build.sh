#!/usr/bin/env bash
set -o errexit

pip install -r zansupermarket/requirements.txt
cd zansupermarket
python manage.py collectstatic --noinput
