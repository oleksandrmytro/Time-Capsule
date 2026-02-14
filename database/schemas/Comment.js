// MongoDB JSON Schema for mongosh - comments (MVP)
var commentSchema = {
  bsonType: "object",
  required: ["capsuleId", "userId", "body"],
  properties: {
    _id: { bsonType: "objectId" },
    capsuleId: { bsonType: "objectId" },
    userId: { bsonType: "objectId" },
    body: { bsonType: "string" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
    deletedAt: { bsonType: "date" }
  }
};

