.PHONY: up-container

up-container:
	docker compose up -d --build table-tennis-frontend table-tennis-backend

down-container:
	docker compose down table-tennis-frontend table-tennis-backend

restart-container: down-container up-container

log-backend:
	docker logs table-tennis-backend -f 

log-frontend:
	docker logs table-tennis-frontend -f 

