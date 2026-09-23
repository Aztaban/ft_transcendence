.PHONY: up down build logs test

up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

# Django creates a throwaway test_<db> database, which the app user may not be
# allowed to create. The GRANT is idempotent, so it also repairs volumes that
# were initialised before db-init/ existed.
test:
	docker compose exec -T db sh -c 'mysql -uroot -p"$$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON \`test_%\`.* TO \"$$MYSQL_USER\"@\"%\"; FLUSH PRIVILEGES;"'
	docker compose exec -T backend sh -c 'pip install -q -r requirements-dev.txt && pytest'
