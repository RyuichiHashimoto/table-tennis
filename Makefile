.PHONY: up-container


## ------------------  frontend  ------------------

up-app-container:
	docker compose up -d --build table-tennis-frontend table-tennis-backend 

down-app-container:
	docker compose down table-tennis-frontend table-tennis-backend

restart-app-container: down-app-container up-app-container

## ------------------  frontend  ------------------

up-frontend-container:
	docker compose up -d --build table-tennis-frontend

down-frontend-container:
	docker compose down table-tennis-frontend

restart-frontend-container: down-frontend-container up-frontend-container

log-frontend-container:
	docker logs table-tennis-frontend -f 

## ------------------  backend  ------------------

up-backend-container:
	docker compose up -d --build table-tennis-backend

down-backend-container:
	docker compose down table-tennis-backend

restart-backend-container: down-backend-container up-backend-container

log-backend-container:
	docker logs table-tennis-backend -f 

## ------------------  DB ------------------

up-db-container:
	docker compose up -d --build table-tennis-db

down-db-container:
	docker compose down table-tennis-db

restart-db-container: down-db-container up-db-container

log-db-container:
	docker logs table-tennis-db -f 

exec-db-container:
	docker exec -it table-tennis-db /bin/bash



log-frontend:
	docker logs table-tennis-frontend -f 

exec-backend:
	docker exec -it table-tennis-backend /bin/bash

exec-frontend:
	docker exec -it table-tennis-frontend /bin/bash
