// MongoDB JSON Schema for chat messages
var chatMessageSchema = {
  bsonType: "object",
  required: ["fromUserId", "toUserId", "createdAt", "type", "text"],
  properties: {
    _id: { bsonType: "objectId" },
    fromUserId: { bsonType: "objectId" },
    toUserId: { bsonType: "objectId" },
    text: { bsonType: "string" },
    type: { enum: ["text", "capsule_share"] },
    capsuleId: { bsonType: ["objectId", "null"] },
    capsuleTitle: { bsonType: ["string", "null"] },
    status: { bsonType: ["string", "null"] },
    createdAt: { bsonType: "date" },
    deletedAt: { bsonType: ["date", "null"] }
  }
};

