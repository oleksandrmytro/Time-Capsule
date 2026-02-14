// MongoDB JSON Schema for mongosh
var notificationSchema = {
  bsonType: "object",
  required: ["userId"],
  properties: {
    _id: { bsonType: "objectId" },
    userId: { bsonType: "objectId" },
    notifications: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["type", "title"],
        properties: {
          type: { enum: ["invite", "capsule_opened", "comment", "reaction", "share", "service"] },
          title: { bsonType: "string" },
          data: { bsonType: "object" },
          read: { bsonType: "bool" },
          createdAt: { bsonType: "date" }
        }
      }
    }
  }
};
