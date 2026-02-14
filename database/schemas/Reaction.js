// MongoDB JSON Schema for mongosh - reactions/likes (MVP)
var reactionSchema = {
  bsonType: "object",
  required: ["capsuleId", "userId", "type"],
  properties: {
    _id: { bsonType: "objectId" },
    capsuleId: { bsonType: "objectId" },
    userId: { bsonType: "objectId" },
    type: { enum: ["like", "love", "wow", "bookmark"] },
    createdAt: { bsonType: "date" },
    deletedAt: { bsonType: "date" }
  }
};

