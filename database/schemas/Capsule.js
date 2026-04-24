// MongoDB JSON Schema for mongosh - capsules (MVP)
var capsuleSchema = {
  bsonType: "object",
  required: ["ownerId", "title", "visibility", "status"],
  properties: {
    _id: { bsonType: "objectId" },
    ownerId: { bsonType: "objectId" },
    title: { bsonType: "string" },
    body: { bsonType: "string" },
    media: {
      bsonType: "array",
      items: {
        bsonType: "object",
        properties: {
          url: { bsonType: "string" },
          type: { enum: ["image", "video", "audio", "file"] },
          meta: { bsonType: "object" }
        }
      }
    },
    visibility: { enum: ["private", "public", "shared"] },
    status: { enum: ["draft", "sealed", "opened"] },
    unlockAt: { bsonType: ["date", "null"] },
    openedAt: { bsonType: ["date", "null"] },
    expiresAt: { bsonType: ["date", "null"] },
    geoMarkerId: { bsonType: "objectId" },
    location: {
      bsonType: "object",
      required: ["type", "coordinates"],
      properties: {
        type: { enum: ["Point"] },
        coordinates: {
          bsonType: "array",
          items: { bsonType: "double" },
          minItems: 2,
          maxItems: 2
        }
      }
    },
    allowComments: { bsonType: "bool" },
    allowReactions: { bsonType: "bool" },
    shareToken: { bsonType: "string" },
    tags: {
      bsonType: "array",
      items: { bsonType: "string" },
      maxItems: 20
    },
    coverImageUrl: { bsonType: "string" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
    deletedAt: { bsonType: "date" }
  }
};


