import mongoose, { Schema } from "mongoose";

const EmailSchema = new Schema({
  resendId: {
    type: String,
    index: true,
  },
  from: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  to: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  subject: {
    type: String,
    default: "(No Subject)",
  },
  textBody: {
    type: String,
    default: "",
  },
  htmlBody: {
    type: String,
    default: "",
  },
  direction: {
    type: String,
    enum: ["INBOUND", "OUTBOUND"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export const Email = mongoose.models.Email || mongoose.model("Email", EmailSchema);
