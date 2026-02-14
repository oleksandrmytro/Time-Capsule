#!/bin/bash

# Use environment variables (automatically passed via docker exec -e)
ADMIN_USER="${MONGO_ADMIN_USER:-time-capsule-admin}"
ADMIN_PASS="${MONGO_ADMIN_PASSWORD:-password}"

mongosh <<EOF
use admin;
db.createUser({user: "$ADMIN_USER", pwd: "$ADMIN_PASS", roles:[{role: "root", db: "admin"}]});
exit;
EOF
