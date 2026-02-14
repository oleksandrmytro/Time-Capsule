FROM mongo:7.0.12

# Copy the MongoDB keyfile
COPY mongodb-keyfile /data/mongodb-keyfile

# Set proper permissions for the keyfile
RUN chmod 600 /data/mongodb-keyfile
RUN chown mongodb:mongodb /data/mongodb-keyfile
