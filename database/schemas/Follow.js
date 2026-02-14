// MongoDB JSON Schema for mongosh - followers (MVP)
var followSchema = {
  bsonType: "object",
  required: ["userId", "followerId"],
  properties: {
    _id: { bsonType: "objectId" },
    userId: { bsonType: "objectId" },
    followerId: { bsonType: "objectId" },
    createdAt: { bsonType: "date" },
    deletedAt: { bsonType: "date" }
  }
};


