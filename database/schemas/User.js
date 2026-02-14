// MongoDB JSON Schema for User collection
// Used directly in mongosh for database initialization

var userSchema = {
  bsonType: "object",
  required: ["username", "email", "password", "role", "enabled"],
  properties: {
    _id: { bsonType: "objectId" },
    username: { bsonType: "string" },
    email: { bsonType: "string" },
    password: { bsonType: "string" },
    role: { enum: ["admin", "regular"] },
    enabled: { bsonType: "bool" },
    isOnline: { bsonType: "bool" },
    
    // JWT authentication fields
    verificationCode: { bsonType: "string" },
    verificationCodeExpiresAt: { bsonType: "date" },
    avatarUrl: { bsonType: "string" },
    
    // OAuth providers support (unified approach)
    authProviders: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["provider", "providerId"],
        properties: {
          provider: { bsonType: "string" },
          providerId: { bsonType: "string" },
          email: { bsonType: "string" },
          name: { bsonType: "string" }
        }
      }
    },
    
    // Timestamps
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" }
  }
};

// Enforce shard key and indexes outside schema definition
