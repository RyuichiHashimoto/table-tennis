.PHONY: up-container

up-container:
	docker compose up -d --build table-tennis-frontend table-tennis-backend

down-container:
	docker compose down --build table-tennis-frontend table-tennis-backend

log-container:
	docker logs table-tennis-app-1 -f 

