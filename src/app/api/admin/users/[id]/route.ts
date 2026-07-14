import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import { User } from "../../../../../models/User";
import { Email } from "../../../../../models/Email";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// PATCH: Reset user password
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const { id: userId } = await params;

  try {
    const { password } = await req.json();

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await User.findByIdAndUpdate(userId, { password: hashedPassword });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Password reset successfully" });
  } catch (error: unknown) {
    console.error("Failed to reset password:", error);
    const msg = error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Delete user account and cascade delete all associated emails (primary + aliases)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const { id: userId } = await params;

  try {
    // 1. Fetch user to extract all associated email addresses (primary email + aliases)
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetEmails = [
      user.email.toLowerCase(), 
      ...(user.aliases || []).map((a: string) => a.toLowerCase())
    ];

    // 2. Cascade delete all emails matching user's primary or alias addresses (sent or received)
    await Email.deleteMany({
      $or: [
        { from: { $in: targetEmails } },
        { to: { $in: targetEmails } }
      ]
    });

    // 3. Delete user document
    await User.findByIdAndDelete(userId);

    console.log(`Cascade deleted user ${user.username} (${user.email}) and all emails for:`, targetEmails);

    return NextResponse.json({ 
      success: true, 
      message: `User ${user.username} and all associated emails deleted successfully.` 
    });
  } catch (error: unknown) {
    console.error("Failed to delete user and cascade emails:", error);
    const msg = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
