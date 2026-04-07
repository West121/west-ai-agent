FROM node:22-alpine AS build

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/customer-h5 ./apps/customer-h5

RUN pnpm install --frozen-lockfile
RUN pnpm --filter customer-h5 build

FROM nginx:1.27-alpine

COPY apps/customer-h5/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/customer-h5/dist /usr/share/nginx/html

EXPOSE 80
