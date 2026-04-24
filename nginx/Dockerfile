FROM nginx:1.25-alpine

RUN apk add --no-cache curl openssl

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/10-generate-self-signed-cert.sh /docker-entrypoint.d/10-generate-self-signed-cert.sh
RUN chmod +x /docker-entrypoint.d/10-generate-self-signed-cert.sh

HEALTHCHECK CMD sh -c "curl -kfsS https://localhost/healthz || exit 1"
