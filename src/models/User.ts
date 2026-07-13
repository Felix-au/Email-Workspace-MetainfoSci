import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["ADMIN", "USER"],
    default: "USER",
  },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING",
  },
  aliases: {
    type: [String],
    default: [],
  },
  footers: [
    {
      name: { type: String, required: true },
      content: { type: String, required: true },
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Helper method to compare passwords
UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

export const User = mongoose.models.User || mongoose.model("User", UserSchema);

export async function seedAdmin() {
  try {
    const adminEmail = "admin@metainfosci.com";
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      console.log("Seeding administrator account...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await User.create({
        username: "admin",
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        status: "APPROVED",
      });
      console.log("Administrator account successfully seeded.");
    }
  } catch (error) {
    console.error("Failed to seed administrator account:", error);
  }
}
