# Builds λRush as one container: the game, the Node server and the Haskell engine.
# Used by Render (see render.yaml). Run locally: docker build -t lambda-rush . && docker run -p 8080:8080 lambda-rush

FROM node:22-trixie AS build
RUN apt-get update && apt-get install -y --no-install-recommends ghc && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lambda-rush/web run build
# Also compiles math-engine/dist/lambda-math
RUN pnpm --filter @lambda-rush/server run build

FROM node:22-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgmp10 libffi8 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/assets server/assets
COPY --from=build /app/math-engine/dist/lambda-math math-engine/dist/lambda-math
COPY --from=build /app/web/dist/public web/dist/public
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "--enable-source-maps", "server/dist/index.mjs"]
