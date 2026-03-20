# Pollux Image Cache

Pollux Image Cache is a lightweight HTTP service that provides caching for astronomical images
retrieved from CDS HiPS-to-FITS services.

It is designed to reduce latency, avoid redundant remote requests, and efficiently serve a
finite set of sky images (e.g. galaxies) using Redis as a backend cache.

---

## Features

- Transparent caching using Redis
- HTTP API for retrieving sky images (JPEG)
- Automatic fallback across multiple CDS endpoints
- Deterministic cache key based on query parameters
- Designed for finite datasets (no expiration by default)

---

## API

### Endpoint

    GET /api/hips2fits

### Query parameters

| Parameter | Type   | Description                  |
|----------|--------|------------------------------|
| ra       | float  | Right ascension (degrees)    |
| dec      | float  | Declination (degrees)        |
| fov      | float  | Field of view (degrees)      |
| width    | int    | Image width (pixels)         |
| height   | int    | Image height (pixels)        |

### Example

http://localhost:3999/api/hips2fits?ra=10.684&dec=41.269&fov=0.5&width=512&height=512

### Response headers

- Content-Type: `image/jpeg`
- X-Cache: `cache` or `cds`

---

## Architecture

Client → Pollux Image Cache → Redis → CDS HiPS servers

- Cache lookup is performed before any remote request
- On cache miss, the image is fetched and stored in Redis

---

## Installation

### Requirements

- Node.js >= 18
- Redis >= 6

### Install dependencies

    npm install

### Run

    node server.js

---

## Redis Configuration

Pollux Image Cache is designed to use Redis as a persistent cache with controlled memory usage.

### Recommended configuration

Edit your Redis configuration file (redis.conf) or apply dynamically:

    maxmemory 2gb
    maxmemory-policy allkeys-lru

### Explanation

- `maxmemory`: limits total memory usage
- `allkeys-lru`: evicts least recently used keys when memory is full

This ensures:

- No expiration is required at application level
- Cache remains bounded in memory

---

### Optional: configure via CLI

    redis-cli CONFIG SET maxmemory 2gb
    redis-cli CONFIG SET maxmemory-policy allkeys-lru
    
Persist configuration:
    
    redis-cli CONFIG REWRITE

---

## Systemd Service

A systemd service file is provided:

    pollux-image-cache.service

### Install

    sudo cp pollux-image-cache.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable pollux-image-cache
    sudo systemctl start pollux-image-cache

### Status

    sudo systemctl status pollux-image-cache

---

## Notes

- The number of unique images depends on parameter combinations
- For optimal cache efficiency, consider quantizing input parameters
- Redis memory usage should be monitored in production

---

## License

GPL-3.0-or-later
