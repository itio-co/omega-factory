FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The ingress serves the Wish API under the game prefix (/omega-factory/api -> /api).
ARG VITE_WISH_API_URL=/omega-factory/api/wishes
RUN VITE_WISH_API_URL="$VITE_WISH_API_URL" npm run build

FROM nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94
COPY deploy/nginx.conf deploy/security-headers.conf /etc/nginx/
COPY --from=build /app/dist /usr/share/nginx/html/omega-factory
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
