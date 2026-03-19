// MongoDB JSON Schema for pending_users collection
var pendingUserSchema = {
  bsonType: "object",
  required: ["username", "email", "password"],
  properties: {
    _id: { bsonType: "objectId" },
    username: { bsonType: "string" },
    email: { bsonType: "string" },
    password: { bsonType: "string" },
    verificationCode: { bsonType: "string" },
    verificationCodeExpiresAt: { bsonType: "date" },
    createdAt: { bsonType: "date" }
  }
};

