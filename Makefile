.PHONY: up-container

up-container:
	docker compose up -d --build

up-container:
	docker compose up -d --build

log-container:
	docker logs table-tennis-app-1 -f 

