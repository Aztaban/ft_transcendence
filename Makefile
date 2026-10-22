.PHONY: up down build logs test env

up: env
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

# Creates .env from the example with a random DJANGO_SECRET_KEY. Never overwrites an existing .env.
env: .env

.env:
	cp .env.example .env
	key=$$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))'); \
	sed -i.bak "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$$key|" .env && rm -f .env.bak
	@echo "Created .env with a random DJANGO_SECRET_KEY. Fill in the other values if needed."


# Django creates a throwaway test_<db> database, which the app user may not be
# allowed to create. The GRANT is idempotent, so it also repairs volumes that
# were initialised before db-init/ existed.
test:
	docker compose exec -T db sh -c 'mysql -uroot -p"$$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON \`test_%\`.* TO \"$$MYSQL_USER\"@\"%\"; FLUSH PRIVILEGES;"'
	docker compose exec -T backend sh -c 'pip install -q -r requirements-dev.txt && pytest'
