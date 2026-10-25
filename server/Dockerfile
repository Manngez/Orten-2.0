FROM node:24-bookworm-slim AS data
RUN apt-get update && apt-get install -y --no-install-recommends unzip ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN node scripts/build-world-data.mjs && node scripts/validate-world-data.mjs
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=data --chown=node:node /app /app
RUN mkdir -p /var/lib/orten && chown node:node /var/lib/orten
USER node
ENV PORT=8080 ORTEN_DB_PATH=/var/lib/orten/rooms.sqlite
EXPOSE 8080
VOLUME ["/var/lib/orten"]
CMD ["node", "server/index.mjs"]
