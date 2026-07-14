import dbConnect from "../../../../lib/db";
import { User } from "../../../../models/User";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { username, password, emailPrefix } = await req.json();

    if (!username || !password || !emailPrefix) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanPrefix = emailPrefix.toLowerCase().trim();

    // Validate inputs
    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters long" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }
    if (!/^[a-z0-9._-]+$/.test(cleanPrefix)) {
      return NextResponse.json({ error: "Invalid email prefix. Use letters, numbers, dots, hyphens or underscores." }, { status: 400 });
    }

    const fullEmail = `${cleanPrefix}@metainfosci.com`;

    await dbConnect();

    // Check if username already exists
    const usernameExists = await User.findOne({ username: cleanUsername });
    if (usernameExists) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 400 });
    }

    // Check if email already exists either as a primary address or as an alias
    const emailExists = await User.findOne({
      $or: [
        { email: fullEmail },
        { aliases: fullEmail }
      ]
    });
    if (emailExists) {
      return NextResponse.json({ error: "Email address is already registered or in use as an alias" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      username: cleanUsername,
      email: fullEmail,
      password: hashedPassword,
      role: "USER",
      status: "PENDING", // Accounts require admin approval before accessing dashboard functions
    });

    return NextResponse.json({
      success: true,
      message: "Registration successful. Your account is pending admin approval.",
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        email: newUser.email,
        status: newUser.status,
      },
    });
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
