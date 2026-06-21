.PHONY: help up down up-prod down-prod build build-prod logs logs-server logs-web status clean restart restart-prod shell-db shell-server

# ─── Default target ───────────────────────────────────────────
.DEFAULT_GOAL := help

# ─── Droplet config (for deploy) ─────────────────────────────
DROPLET_USER := root
DROPLET_IP   := 159.203.188.143
DROPLET_DIR  := /app/freestyle

# ─── Colors for output ────────────────────────────────────────
GREEN  := \033[0;32m
YELLOW := \033[1;33m
CYAN   := \033[0;36m
NC     := \033[0m

# ─── Help ─────────────────────────────────────────────────────
help: ## Show this help
	@echo "$(CYAN)Freestyle Platform — Docker Management$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Usage examples:$(NC)"
	@echo "  make up          → Start dev environment (DB + Redis)"
	@echo "  make up-prod     → Start full production stack"
	@echo "  make down        → Stop dev environment"
	@echo "  make down-prod   → Stop production stack"
	@echo "  make restart     → Restart dev environment"
	@echo "  make logs        → Tail all dev logs"
	@echo "  make status      → Show running containers"

# ─── Development environment ──────────────────────────────────
up: ## Start dev containers (DB + Redis) in background
	@echo "$(GREEN)▶ Starting dev environment...$(NC)"
	docker compose -f docker-compose.yml up -d
	@echo "$(GREEN)✔ Dev environment ready.$(NC)"
	@make status-dev

down: ## Stop and remove dev containers
	@echo "$(YELLOW)■ Stopping dev environment...$(NC)"
	docker compose -f docker-compose.yml down
	@echo "$(YELLOW)✔ Dev environment stopped.$(NC)"

restart: down up ## Restart dev containers

status-dev: ## Show dev container status
	@docker compose -f docker-compose.yml ps

logs-dev: ## Tail logs for all dev services
	docker compose -f docker-compose.yml logs -f

logs-db: ## Tail PostgreSQL logs
	docker logs -f freestyle-db

logs-redis: ## Tail Redis logs
	docker logs -f freestyle-redis

shell-db: ## Open psql shell in the dev database
	docker exec -it freestyle-db psql -U freestyle

shell-redis: ## Open redis-cli in the dev Redis container
	docker exec -it freestyle-redis redis-cli

# ─── Production environment ───────────────────────────────────
up-prod: ## Start full production stack (rebuilds images, shows logs)
	@echo "$(GREEN)▶ Building and starting production stack...$(NC)"
	docker compose -f docker-compose.prod.yml up -d --build
	@echo "$(GREEN)✔ Production stack ready. Mostrando logs...$(NC)"
	docker compose -f docker-compose.prod.yml logs -f

down-prod: ## Stop and remove production containers
	@echo "$(YELLOW)■ Stopping production stack...$(NC)"
	docker compose -f docker-compose.prod.yml down
	@echo "$(YELLOW)✔ Production stack stopped.$(NC)"

restart-prod: down-prod up-prod ## Restart production stack

build: ## Build dev images (if any custom ones are added)
	docker compose -f docker-compose.yml build

build-prod: ## Build all production images (sequential for low-RAM)
	@echo "$(GREEN)▶ Building server...$(NC)"
	docker compose -f docker-compose.prod.yml build --no-cache server
	@echo "$(GREEN)▶ Building web...$(NC)"
	docker compose -f docker-compose.prod.yml build --no-cache web
	@echo "$(GREEN)✔ Builds complete.$(NC)"

status-prod: ## Show production container status
	@docker compose -f docker-compose.prod.yml ps

status: status-dev status-prod ## Show status of all containers

logs-prod: ## Tail logs for all production services
	docker compose -f docker-compose.prod.yml logs -f

logs-server: ## Tail server logs
	docker logs -f freestyle-server

logs-web: ## Tail web logs
	docker logs -f freestyle-web

logs-nginx: ## Tail nginx logs
	docker logs -f freestyle-nginx

# ─── Utilities ────────────────────────────────────────────────
clean: down down-prod ## Stop all containers and remove volumes (⚠️ destroys DB data)
	@echo "$(YELLOW)⚠ Removing volumes...$(NC)"
	docker volume rm freestyle-platform_pgdata 2>/dev/null || true
	@echo "$(YELLOW)✔ Cleanup complete.$(NC)"

# ─── Deploy to Droplet ────────────────────────────────────────
deploy: ## Push to GitHub + update droplet (git pull + rebuild)
	@echo "$(GREEN)▶ Pushing to GitHub...$(NC)"
	git push origin main
	@echo "$(GREEN)▶ Updating droplet ($(DROPLET_USER)@$(DROPLET_IP))...$(NC)"
	ssh $(DROPLET_USER)@$(DROPLET_IP) \
		'cd $(DROPLET_DIR) && git checkout -- nginx.conf && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build && docker restart freestyle-nginx'
	@echo "$(GREEN)✔ Deploy complete!$(NC)"
	@echo "$(CYAN)🌐 http://$(DROPLET_IP)$(NC)"

prune: ## Remove all unused Docker data (images, containers, volumes, networks)
	@echo "$(YELLOW)⚠ This will remove all unused Docker data!$(NC)"
	docker system prune -a --volumes
