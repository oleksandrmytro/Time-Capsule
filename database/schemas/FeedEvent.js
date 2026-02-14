// MongoDB JSON Schema for mongosh - feed events (later/optional)
var feedEventSchema = {
  bsonType: "object",
  required: ["actorId", "capsuleId", "type", "createdAt"],
  properties: {
    _id: { bsonType: "objectId" },
    actorId: { bsonType: "objectId" },
    capsuleId: { bsonType: "objectId" },
    type: { enum: ["created", "opened", "commented", "reacted", "shared"] },
    payload: { bsonType: "object" },
    createdAt: { bsonType: "date" }
  }
};

// Suggested indexes:
// db.feed_events.createIndex({ actorId: 1, createdAt: -1 })
// db.feed_events.createIndex({ capsuleId: 1, createdAt: -1 })
