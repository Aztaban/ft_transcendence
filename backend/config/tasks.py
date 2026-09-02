import time

import redis

from config.celery import app
from config.settings import REDIS_URL


@app.task(name="config.tasks.heartbeat")
def heartbeat():
    redis.from_url(REDIS_URL).set("celery_heartbeat", str(int(time.time())))
