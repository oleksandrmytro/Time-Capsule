FROM nginx:1.25-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK CMD sh -c "curl -fsS http://localhost/ || exit 1"
