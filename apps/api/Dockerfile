FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

COPY apps/api/package.json apps/api/package.json
COPY packages/crypto/package.json packages/crypto/package.json
COPY packages/merkle/package.json packages/merkle/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/vsl-core/package.json packages/vsl-core/package.json

RUN npm ci

COPY tsconfig.json tsconfig.json
COPY apps/api apps/api
COPY packages packages
COPY database database
COPY scripts scripts

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

RUN addgroup -S vsl && adduser -S vsl -G vsl

COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist

COPY --from=build /app/packages/crypto/package.json packages/crypto/package.json
COPY --from=build /app/packages/crypto/dist packages/crypto/dist

COPY --from=build /app/packages/merkle/package.json packages/merkle/package.json
COPY --from=build /app/packages/merkle/dist packages/merkle/dist

COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist

COPY --from=build /app/packages/vsl-core/package.json packages/vsl-core/package.json
COPY --from=build /app/packages/vsl-core/dist packages/vsl-core/dist

COPY --from=build /app/scripts scripts
COPY --from=build /app/database database
COPY --from=build /app/node_modules node_modules

RUN node -e 'const fs = require("fs"); for (const pkg of ["crypto", "merkle", "shared", "vsl-core"]) {   const path = `/app/packages/${pkg}/package.json`;   const json = JSON.parse(fs.readFileSync(path, "utf8"));   json.exports = { ".": "./dist/index.js" };   fs.writeFileSync(path, JSON.stringify(json, null, 2) + "\n"); } '

RUN chown -R vsl:vsl /app

USER vsl

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
