import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../lib/db";
import { User } from "../../../../models/User";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const sessionEmail = session.user.email ? session.user.email.toLowerCase().trim() : "";
  const user = await User.findOne({ email: sessionEmail });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    aliases: user.aliases || [],
    footers: user.footers || [],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const userEmail = session.user.email ? session.user.email.toLowerCase().trim() : "";
  if (!userEmail) {
    return NextResponse.json({ error: "Invalid session email" }, { status: 400 });
  }

  try {
    const { action, aliasPrefix, alias, footerId, name, content, currentPassword, newPassword } = await req.json();

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action === "add_alias") {
      if (!aliasPrefix) {
        return NextResponse.json({ error: "Alias prefix is required" }, { status: 400 });
      }

      const cleanPrefix = aliasPrefix.toLowerCase().trim();
      if (!/^[a-z0-9._-]+$/.test(cleanPrefix)) {
        return NextResponse.json({ error: "Invalid prefix format" }, { status: 400 });
      }

      const fullAlias = `${cleanPrefix}@metainfosci.com`;

      // Check if alias is already taken by anyone as primary email or alias
      const taken = await User.findOne({
        $or: [
          { email: fullAlias },
          { aliases: fullAlias },
        ],
      });

      if (taken) {
        return NextResponse.json({ error: "Email address is already in use by another user" }, { status: 400 });
      }

      await User.updateOne(
        { email: userEmail },
        { $addToSet: { aliases: fullAlias } }
      );

      return NextResponse.json({ success: true, message: `Alias ${fullAlias} added successfully` });
    }

    if (action === "remove_alias") {
      if (!alias) {
        return NextResponse.json({ error: "Alias email is required" }, { status: 400 });
      }

      await User.updateOne(
        { email: userEmail },
        { $pull: { aliases: alias.toLowerCase().trim() } }
      );

      return NextResponse.json({ success: true, message: `Alias ${alias} removed successfully` });
    }

    if (action === "save_footer") {
      if (!name || !content) {
        return NextResponse.json({ error: "Footer name and content are required" }, { status: 400 });
      }

      if (footerId) {
        // Update existing footer
        await User.updateOne(
          { email: userEmail, "footers._id": footerId },
          { $set: { "footers.$.name": name, "footers.$.content": content } }
        );
      } else {
        // Push new footer
        await User.updateOne(
          { email: userEmail },
          { $push: { footers: { name, content } } }
        );
      }

      return NextResponse.json({ success: true, message: "Footer saved successfully" });
    }

    if (action === "remove_footer") {
      if (!footerId) {
        return NextResponse.json({ error: "Footer ID is required" }, { status: 400 });
      }

      await User.updateOne(
        { email: userEmail },
        { $pull: { footers: { _id: footerId } } }
      );

      return NextResponse.json({ success: true, message: "Footer removed successfully" });
    }

    if (action === "change_password") {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: "Current and new passwords are required" }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters long" }, { status: 400 });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await User.updateOne({ email: userEmail }, { password: hashedPassword });

      return NextResponse.json({ success: true, message: "Password updated successfully" });
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Settings update failed:", error);
    const msg = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
