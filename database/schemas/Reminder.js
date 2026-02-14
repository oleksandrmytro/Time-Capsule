// MongoDB JSON Schema for mongosh - reminders (MVP)
var reminderSchema = {
  bsonType: "object",
  required: ["userId", "capsuleId", "nextFireAt", "status"],
  properties: {
    _id: { bsonType: "objectId" },
    userId: { bsonType: "objectId" },
    capsuleId: { bsonType: "objectId" },
    channel: { enum: ["email"] },
    message: { bsonType: "string" },
    nextFireAt: { bsonType: "date" },
    repeat: {
      bsonType: "object",
      properties: {
        cron: { bsonType: "string" },
        until: { bsonType: "date" }
      }
    },
    status: { enum: ["scheduled", "sent", "cancelled"] },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
    deletedAt: { bsonType: "date" }
  }
};


