import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import dbConnect from "../../../lib/db";
import { Email } from "../../../models/Email";
import { User } from "../../../models/User";
import { resend } from "../../../lib/resend";
import { NextResponse } from "next/server";

// Helper to extract clean email address (e.g. "John Doe <john@example.com>" -> "john@example.com")
function extractEmail(address: string): string {
  if (!address) return "";
  const match = address.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase().trim() : address.toLowerCase().trim();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const userEmail = session.user.email ? (session.user.email as string).toLowerCase().trim() : "";
  if (!userEmail) {
    return NextResponse.json({ error: "Session email is missing" }, { status: 400 });
  }

  // Clean up legacy simulated inbound emails lacking a resendId
  try {
    await Email.deleteMany({ direction: "INBOUND", resendId: { $exists: false } });
  } catch (cleanError) {
    console.error("Cleanup of legacy emails failed:", cleanError);
  }

  // Synchronize received emails from Resend API (Direct Retrieval)
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const isApiKeyMock = !apiKey || apiKey === "re_your_api_key_here" || apiKey === "mock_key";

    if (!isApiKeyMock && userEmail) {
      // Find the user and resolve all their associated email addresses (primary + aliases)
      const user = await User.findOne({ email: userEmail });
      const allUserEmails = user 
        ? [user.email.toLowerCase(), ...(user.aliases || []).map((a: string) => a.toLowerCase())] 
        : [userEmail.toLowerCase()];

      // List received emails from the Resend Receiving API
      const resendList = await resend.emails.receiving.list();
      
      if (resendList.data && resendList.data.data) {
        for (const item of resendList.data.data) {
          const fromEmail = extractEmail(item.from);
          const toEmails = Array.isArray(item.to) ? item.to : [item.to || ""];

          for (const rawTo of toEmails) {
            const toEmail = extractEmail(rawTo);
            if (!toEmail) continue;

            // ONLY synchronize emails where the recipient matches one of the user's addresses
            if (allUserEmails.includes(toEmail)) {
              // Check if this received email is already saved locally for this specific recipient
              const exists = await Email.findOne({ resendId: item.id, to: toEmail });
              if (!exists) {
                // Fetch the full content (html/text body) from Resend Inbound API
                const resendGet = await resend.emails.receiving.get(item.id);
                
                if (resendGet.data) {
                  const emailContent = resendGet.data;
                  const textBody = emailContent.text || "";
                  const htmlBody = emailContent.html || "";

                  await Email.create({
                    resendId: item.id,
                    from: fromEmail,
                    to: toEmail,
                    subject: item.subject || "(No Subject)",
                    textBody,
                    htmlBody,
                    direction: "INBOUND",
                    timestamp: new Date(item.created_at || Date.now()),
                  });
                  console.log(`Synced received email ${item.id} from Resend API for alias/email ${toEmail}`);
                }
              }
            }
          }
        }
      }
    }
  } catch (syncError) {
    console.error("Failed to sync inbound emails from Resend API:", syncError);
  }

  // Resolve user's associated email addresses for local query
  const user = await User.findOne({ email: userEmail });
  const allUserEmails = user 
    ? [user.email.toLowerCase(), ...(user.aliases || []).map((a: string) => a.toLowerCase())] 
    : [userEmail.toLowerCase()];

  // Retrieve emails where user or any of their aliases is either sender or recipient
  const emails = await Email.find({
    $or: [
      { from: { $in: allUserEmails } },
      { to: { $in: allUserEmails } },
    ],
  }).sort({ timestamp: -1 });

  return NextResponse.json(emails);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const primaryFromEmail = session.user.email ? (session.user.email as string).toLowerCase().trim() : "";
  if (!primaryFromEmail) {
    return NextResponse.json({ error: "Session email is missing" }, { status: 400 });
  }

  try {
    const { from, to, subject, textBody, htmlBody } = await req.json();

    if (!to) {
      return NextResponse.json({ error: "Recipient ('to') is required" }, { status: 400 });
    }

    // Resolve allowed sender addresses for the logged-in user
    const user = await User.findOne({ email: primaryFromEmail });
    const allowedEmails = user 
      ? [user.email.toLowerCase(), ...(user.aliases || []).map((a: string) => a.toLowerCase())] 
      : [primaryFromEmail.toLowerCase()];

    const senderAddress = from ? from.toLowerCase().trim() : primaryFromEmail.toLowerCase();

    if (!allowedEmails.includes(senderAddress)) {
      return NextResponse.json({ error: "Unauthorized sender address alias" }, { status: 403 });
    }

    let isMock = false;
    let resendId = "";

    const apiKey = process.env.RESEND_API_KEY;
    const isApiKeyMock = !apiKey || apiKey === "re_your_api_key_here" || apiKey === "mock_key";

    if (isApiKeyMock) {
      isMock = true;
      resendId = "simulated_" + Math.random().toString(36).substring(7);
      console.log(`[Simulated Send] From: ${senderAddress}, To: ${to}, Subject: ${subject}`);
    } else {
      try {
        const { data, error } = await resend.emails.send({
          from: senderAddress,
          to: to.toLowerCase().trim(),
          subject: subject || "(No Subject)",
          text: textBody || "",
          html: htmlBody || textBody || "",
        });
        
        if (error) {
          throw new Error(error.message);
        }
        resendId = data?.id || "";
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn("Resend API failed, falling back to simulated send:", errMsg);
        isMock = true;
        resendId = "fallback_simulated_" + Math.random().toString(36).substring(7);
      }
    }

    // Save sent email record in MongoDB
    const newEmail = await Email.create({
      from: senderAddress,
      to: to.toLowerCase().trim(),
      subject: subject || "(No Subject)",
      textBody: textBody || "",
      htmlBody: htmlBody || textBody || "",
      direction: "OUTBOUND",
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      email: newEmail,
      simulated: isMock,
      resendId,
    });
  } catch (error: unknown) {
    console.error("Failed to process send email request:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
