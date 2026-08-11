# Milestone 1 — Project Foundation & Infrastructure

**Assigned to:** Roman (rkravche)

## Milestone Goal (context)

Create a complete development environment.

After this milestone:

- The complete stack starts successfully.
- Developers can work independently.
- Frontend, backend, and database communicate.

## Roman's issues in this milestone, in build order

### 1. Setup Nginx & HTTPS

**Your role:** Infrastructure

## Checklist

- [ ] Configure Nginx reverse proxy
- [ ] Configure HTTPS
- [ ] Configure TLS certificates
- [ ] Configure WebSocket proxying
- [ ] Redirect HTTP to HTTPS
- [ ] Document local HTTPS setup

---

### 2. Setup Background Task Processing

**Your role:** Infrastructure (Celery/Redis)

## Checklist

- [ ] Configure Celery
- [ ] Configure Redis broker
- [ ] Create worker service
- [ ] Create scheduled task service
- [ ] Verify background task execution

---

### 3. Setup Docker Development Environment

**Your role:** Infrastructure & database containers

## Description

Create a containerized development environment where all services can run together.

## Checklist

- [ ] Create Docker Compose configuration
- [ ] Setup backend container
- [ ] Setup frontend container
- [ ] Setup database container
- [ ] Setup Redis container
- [ ] Configure service communication
- [ ] Configure environment variables
- [ ] Create development documentation

## Acceptance Criteria

- All services start using Docker Compose.
- Backend can communicate with database.
- Frontend can communicate with backend API.

---

### 4. Initialize Backend Application

**Your role:** DB connection/ORM/migrations setup

**Also touches this issue:** Martin (Backend framework setup), Lenka (Backend framework setup)

## Description

Create the backend foundation required for future API development.

## Checklist

- [ ] Initialize Python backend framework
- [ ] Create application structure
- [ ] Configure project settings
- [ ] Configure database connection
- [ ] Setup ORM
- [ ] Setup migrations
- [ ] Create API base structure

## Acceptance Criteria

- Backend server starts successfully.
- Database connection works.
- Migration system is functional.
- API base route responds correctly.

---

### 5. Setup Development Tools

**Your role:** CI/tooling infrastructure

## Description

Configure tools that ensure consistent code quality.

## Checklist

- [ ] Setup code formatting
- [ ] Setup linting
- [ ] Setup testing framework
- [ ] Setup CI pipeline
- [ ] Setup API documentation workflow

## Acceptance Criteria

- Code style is automatically checked.
- Tests can run automatically.
- CI pipeline executes successfully.

---

---

# Milestone 1 Completion Criteria

Milestone is completed when:

- [ ] Development environment runs
- [ ] Backend runs
- [ ] Frontend runs
- [ ] Database is connected
- [ ] Team workflow is documented
