// MongoDB JSON Schema for chat messages
var chatMessageSchema = {
  bsonType: "object",
  required: ["fromUserId", "toUserId", "createdAt", "type"],
  properties: {
    _id: { bsonType: "objectId" },
    fromUserId: { bsonType: "objectId" },
    toUserId: { bsonType: "objectId" },
    text: { bsonType: ["string", "null"] },
    type: { enum: ["text", "image", "video", "capsule_share"] },
    mediaUrl: { bsonType: ["string", "null"] },
    mediaKind: { enum: ["image", "video", null] },
    mimeType: { bsonType: ["string", "null"] },
    capsuleId: { bsonType: ["objectId", "null"] },
    capsuleTitle: { bsonType: ["string", "null"] },
    replyToMessageId: { bsonType: ["objectId", "null"] }, // ID повідомлення, на яке це є відповіддю
    status: { bsonType: ["string", "null"] },
    createdAt: { bsonType: "date" },
    deletedAt: { bsonType: ["date", "null"] }
  }
};

