FROM mongo:7.0.12

# Install docker client for running docker exec commands
RUN apt-get update && apt-get install -y \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /scripts
