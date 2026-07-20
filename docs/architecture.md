# Architecture

**Status:** placeholder
**Owner:** rkravche, IT Architect  
**Last updated:** TBD

## Purpose

This document will describe the final technical architecture.

## High-level architecture mockup

```txt
                        ┌────────────────────────┐
                        │        Browser          │
                        │ React + TypeScript FE   │
                        └───────────┬────────────┘
                                    │ HTTPS
                                    ▼
                        ┌────────────────────────┐
                        │         Nginx           │
                        │ reverse proxy + TLS     │
                        └───────────┬────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│      Frontend app       │ │     Python backend   │ │     Grafana          │
│ static build / Vite     │ │ REST API + realtime  │ │ monitoring UI        │
└────────────────────────┘ └──────────┬───────────┘ └──────────┬───────────┘
                                      │                         │
                     ┌────────────────┼───────────────┐         │
                     ▼                ▼               ▼         ▼
          ┌──────────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │   PostgreSQL      │ │    Redis    │ │  42 API     │ │ Prometheus  │
          │ relational DB     │ │ cache/pubsub│ │ OAuth/data  │ │ metrics     │
          └──────────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```
