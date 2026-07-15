"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Mail, Inbox, Send, LogOut, Users, RefreshCw,
  SendHorizontal, X, AlertTriangle, Sun, Moon,
  Settings, Trash2, Plus, Clock
} from "lucide-react";
import styles from "../dashboard/dashboard.module.css";
import Image from "next/image";

interface EmailType {
  _id: string;
  from: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  direction: "INBOUND" | "OUTBOUND";
  timestamp: string;
}

interface UserType {
  _id: string;
  username: string;
  email: string;
  role: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

interface FooterType {
  _id: string;
  name: string;
  content: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"inbox" | "sent" | "approvals" | "accounts" | "settings">("inbox");
  const hasFetched = useRef(false);
  const [emails, setEmails] = useState<EmailType[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailType | null>(null);

  // Compose Modal States
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeFrom, setComposeFrom] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeFooterId, setComposeFooterId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Settings States
  const [aliases, setAliases] = useState<string[]>([]);
  const [footers, setFooters] = useState<FooterType[]>([]);
  const [newAliasPrefix, setNewAliasPrefix] = useState("");
  const [newFooterName, setNewFooterName] = useState("");
  const [newFooterContent, setNewFooterContent] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme from document element
  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light-theme');
    const timer = setTimeout(() => {
      setTheme(isLight ? 'light' : 'dark');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.remove('dark-theme', 'light-theme');
    document.documentElement.classList.add(nextTheme + '-theme');
  };

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    } else if (status === "authenticated" && session?.user) {
      if (session.user.role !== "ADMIN") {
        router.replace("/dashboard");
      }
    }
  }, [status, session, router]);

  const fetchEmails = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/emails");
      if (res.ok) {
        const data = await res.json();
        setEmails(data);

        if (selectedEmail) {
          const stillExists = data.some((e: EmailType) => e._id === selectedEmail._id);
          if (!stillExists) setSelectedEmail(null);
        }
      }
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedEmail]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        setAliases(data.aliases || []);
        setFooters(data.footers || []);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ADMIN" && !hasFetched.current) {
      hasFetched.current = true;
      const timer = setTimeout(() => {
        fetchEmails(true);
        fetchUsers();
        fetchSettings();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [status, session, fetchEmails, fetchUsers, fetchSettings]);

  // Set default compose sender when modal opens or aliases load
  useEffect(() => {
    if (session?.user?.email) {
      const timer = setTimeout(() => {
        setComposeFrom(session.user.email as string);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [session, isComposeOpen]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo) {
      setSendError("Recipient is required.");
      return;
    }

    setSending(true);
    setSendError(null);

    // Compile message content including templates
    let textBody = composeBody;
    let htmlBody = composeBody.replace(/\n/g, "<br />");

    if (composeFooterId) {
      const foot = footers.find(f => f._id === composeFooterId);
      if (foot) {
        textBody = composeBody + "\n\n---\n" + foot.content;
        const formattedSig = foot.content.replace(/\n/g, "<br />");
        htmlBody = composeBody.replace(/\n/g, "<br />") + "<br /><br />---<br />" + formattedSig;
      }
    }

    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: composeFrom,
          to: composeTo,
          subject: composeSubject,
          textBody,
          htmlBody,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error || "Failed to send email");
      } else {
        setIsComposeOpen(false);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
        setComposeFooterId("");
        
        await fetchEmails(false);
      }
    } catch (err) {
      console.error("Failed to send email:", err);
      setSendError("Failed to dispatch request. Try again.");
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update user status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  // Reset User Password
  const handleResetPassword = async (userId: string, newPass: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPass }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Password reset successfully!");
      } else {
        alert(data.error || "Failed to reset password");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      alert("An error occurred. Try again.");
    }
  };

  // Delete User and Cascade Emails
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`WARNING: Are you sure you want to delete account "${username}"? This will permanently delete the user AND all emails sent to/from their primary address and all their aliases.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "User and associated emails deleted successfully!");
        await fetchUsers();
        await fetchEmails(false);
      } else {
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error("Delete user error:", err);
      alert("An error occurred. Try again.");
    }
  };

  // Settings Actions
  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasPrefix) return;

    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_alias",
          aliasPrefix: newAliasPrefix,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSettingsError(data.error || "Failed to add alias");
      } else {
        setSettingsSuccess(data.message || "Alias added successfully");
        setNewAliasPrefix("");
        await fetchSettings();
        await fetchEmails(false);
      }
    } catch (err) {
      console.error("Add alias error:", err);
      setSettingsError("An error occurred. Try again.");
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    if (!confirm(`Are you sure you want to remove alias ${alias}?`)) return;

    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_alias",
          alias,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSettingsError(data.error || "Failed to remove alias");
      } else {
        setSettingsSuccess(data.message || "Alias removed");
        await fetchSettings();
        await fetchEmails(false);
      }
    } catch (err) {
      console.error("Remove alias error:", err);
      setSettingsError("An error occurred. Try again.");
    }
  };

  const handleSaveFooter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFooterName || !newFooterContent) return;

    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_footer",
          name: newFooterName,
          content: newFooterContent,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSettingsError(data.error || "Failed to save footer");
      } else {
        setSettingsSuccess(data.message || "Footer template saved");
        setNewFooterName("");
        setNewFooterContent("");
        await fetchSettings();
      }
    } catch (err) {
      console.error("Save footer error:", err);
      setSettingsError("An error occurred. Try again.");
    }
  };

  const handleRemoveFooter = async (footerId: string) => {
    if (!confirm("Are you sure you want to delete this template footer?")) return;

    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_footer",
          footerId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSettingsError(data.error || "Failed to remove footer");
      } else {
        setSettingsSuccess(data.message || "Footer template deleted");
        await fetchSettings();
      }
    } catch (err) {
      console.error("Remove footer error:", err);
      setSettingsError("An error occurred. Try again.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    setSettingsError(null);
    setSettingsSuccess(null);
    setPasswordUpdating(true);

    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSettingsError(data.error || "Failed to update password");
      } else {
        setSettingsSuccess(data.message || "Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch (err) {
      console.error("Change password error:", err);
      setSettingsError("An error occurred. Try again.");
    } finally {
      setPasswordUpdating(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.spinner} style={{ width: "32px", height: "32px" }}></div>
      </div>
    );
  }

  // Approved Dashboard Screen
  const filteredEmails = emails.filter((email) => {
    if (activeTab === "inbox") {
      return email.direction === "INBOUND";
    } else if (activeTab === "sent") {
      return email.direction === "OUTBOUND";
    }
    return false;
  });

  const getInitials = (name: string) => {
    return name ? name.substring(0, 2).toUpperCase() : "A";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logoContainer}>
          <Image src="/logo.png" alt="metainfosci Logo" width={170} height={44} className={styles.sidebarLogo} priority />
        </div>
        <div className={styles.profile}>
          <h2 className={styles.profileName}>{session?.user?.name} (Admin)</h2>
          <p className={styles.profileEmail}>{session?.user?.email}</p>
        </div>

        <button className={styles.composeBtn} onClick={() => setIsComposeOpen(true)}>
          Compose Email
        </button>

        <nav className={styles.nav}>
          <div 
            className={`${styles.navItem} ${activeTab === "inbox" ? styles.navItemActive : ""}`}
            onClick={() => { setActiveTab("inbox"); setSelectedEmail(null); }}
          >
            <Inbox size={18} />
            <span>Inbox</span>
            <span className={`${styles.badge} ${activeTab === "inbox" ? styles.badgeActive : ""}`}>
              {emails.filter(e => e.direction === "INBOUND").length}
            </span>
          </div>
          
          <div 
            className={`${styles.navItem} ${activeTab === "sent" ? styles.navItemActive : ""}`}
            onClick={() => { setActiveTab("sent"); setSelectedEmail(null); }}
          >
            <Send size={18} />
            <span>Sent</span>
            <span className={`${styles.badge} ${activeTab === "sent" ? styles.badgeActive : ""}`}>
              {emails.filter(e => e.direction === "OUTBOUND").length}
            </span>
          </div>

          <div 
            className={`${styles.navItem} ${activeTab === "approvals" ? styles.navItemActive : ""}`}
            onClick={() => { setActiveTab("approvals"); setSelectedEmail(null); }}
          >
            <Clock size={18} />
            <span>Approvals</span>
            <span className={`${styles.badge} ${activeTab === "approvals" ? styles.badgeActive : ""}`} style={{ backgroundColor: "rgba(210,153,34,0.15)", color: "var(--warning)" }}>
              {users.filter(u => u.status === "PENDING").length}
            </span>
          </div>

          <div 
            className={`${styles.navItem} ${activeTab === "accounts" ? styles.navItemActive : ""}`}
            onClick={() => { setActiveTab("accounts"); setSelectedEmail(null); }}
          >
            <Users size={18} />
            <span>Accounts</span>
          </div>

          <div 
            className={`${styles.navItem} ${activeTab === "settings" ? styles.navItemActive : ""}`}
            onClick={() => { setActiveTab("settings"); setSelectedEmail(null); }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={toggleTheme} className={styles.logoutBtn} style={{ color: "var(--foreground)", marginBottom: "8px" }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button onClick={() => signOut()} className={styles.logoutBtn}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      {activeTab === "settings" ? (
        <section className={styles.settingsPane}>
          <div className={styles.settingsHeader}>
            <h1 className={styles.settingsTitle}>Settings</h1>
            <p className={styles.settingsSubtitle}>Manage your custom aliases and template footers</p>
          </div>

          <div className={styles.settingsContent}>
            {settingsError && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <AlertTriangle size={16} />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsSuccess && (
              <div className={`${styles.alert} ${styles.alertSuccess}`}>
                <Inbox size={16} />
                <span>{settingsSuccess}</span>
              </div>
            )}

            {/* Email Aliases */}
            <div className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>Sender Email Aliases</h2>
              <div className={styles.settingsCard}>
                <div className={styles.settingsItem}>
                  <div className={styles.settingsItemText}>
                    <span className={styles.settingsItemLabel}>Primary Address</span>
                    <span className={styles.settingsItemVal} style={{ color: "var(--primary-hover)" }}>{session?.user?.email}</span>
                  </div>
                </div>

                {aliases.map((alias) => (
                  <div key={alias} className={styles.settingsItem}>
                    <div className={styles.settingsItemText}>
                      <span className={styles.settingsItemLabel}>Alias Address</span>
                      <span className={styles.settingsItemVal}>{alias}</span>
                    </div>
                    <button className={styles.deleteAction} onClick={() => handleRemoveAlias(alias)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddAlias} className={styles.addForm}>
                <h4 style={{ fontSize: "13px", fontWeight: "600" }}>Register Custom Suffix Alias</h4>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input 
                    type="text" 
                    className={styles.addInput} 
                    placeholder="support"
                    value={newAliasPrefix}
                    onChange={(e) => setNewAliasPrefix(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>@metainfosci.com</span>
                  <button type="submit" className={styles.addButton}>
                    <Plus size={16} />
                  </button>
                </div>
              </form>
            </div>

            {/* Template Footers */}
            <div className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>Signature Template Footers</h2>
              <div className={styles.settingsCard}>
                {footers.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", padding: "12px", textAlign: "center" }}>No signature footers registered yet.</p>
                ) : (
                  footers.map((footer) => (
                    <div key={footer._id} className={styles.settingsItem} style={{ alignItems: "flex-start" }}>
                      <div className={styles.settingsItemText}>
                        <span className={styles.settingsItemLabel}>{footer.name}</span>
                        <pre className={styles.settingsItemVal} style={{ fontFamily: "inherit" }}>{footer.content}</pre>
                      </div>
                      <button className={styles.deleteAction} onClick={() => handleRemoveFooter(footer._id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSaveFooter} className={styles.addForm}>
                <h4 style={{ fontSize: "13px", fontWeight: "600" }}>Create New Footer Signature</h4>
                <input 
                  type="text" 
                  className={styles.addInput} 
                  placeholder="e.g. Work Signature"
                  value={newFooterName}
                  onChange={(e) => setNewFooterName(e.target.value)}
                  required
                />
                <textarea 
                  className={styles.addTextarea} 
                  placeholder="Regards,&#10;Felix&#10;Support Representative"
                  value={newFooterContent}
                  onChange={(e) => setNewFooterContent(e.target.value)}
                  required
                />
                <button type="submit" className={styles.addButton}>Save Signature</button>
              </form>
            </div>

            {/* Change Password */}
            <div className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>Security</h2>
              <form onSubmit={handleChangePassword} className={styles.addForm}>
                <h4 style={{ fontSize: "13px", fontWeight: "600" }}>Change Account Password</h4>
                <input 
                  type="password" 
                  className={styles.addInput} 
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <input 
                  type="password" 
                  className={styles.addInput} 
                  placeholder="New Password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button type="submit" className={styles.addButton} disabled={passwordUpdating}>
                  {passwordUpdating ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : activeTab === "approvals" ? (
        <section className={`${styles.approvalsPane} animate-fade-in`}>
          <div className={styles.paneHeader}>
            <h1 className={styles.paneTitle}>Account Registration Approvals</h1>
            <p className={styles.paneSubtitle}>Review custom email address registration requests</p>
          </div>

          <div className={styles.tableContainer}>
            {users.filter(u => u.status === "PENDING").length === 0 ? (
              <div className={styles.emptyState}>
                <Clock size={32} strokeWidth={1.5} />
                <p>No pending approvals found.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email Address</th>
                    <th>Date Requested</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.status === "PENDING").map((user) => (
                    <tr key={user._id}>
                      <td style={{ fontWeight: 600 }}>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => handleUpdateStatus(user._id, "APPROVED")} className={styles.approveBtn}>
                            Approve
                          </button>
                          <button onClick={() => handleUpdateStatus(user._id, "REJECTED")} className={styles.rejectBtn}>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : activeTab === "accounts" ? (
        <section className={`${styles.approvalsPane} animate-fade-in`}>
          <div className={styles.paneHeader}>
            <h1 className={styles.paneTitle}>User Accounts Management</h1>
            <p className={styles.paneSubtitle}>Reset credentials or delete accounts (cascade deletes all primary and alias emails)</p>
          </div>

          <div className={styles.tableContainer}>
            {users.length === 0 ? (
              <div className={styles.emptyState}>
                <Users size={32} strokeWidth={1.5} />
                <p>No user accounts found.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "4px", backgroundColor: u.role === "ADMIN" ? "rgba(37,99,235,0.1)" : "var(--active-bg)", color: u.role === "ADMIN" ? "var(--primary-hover)" : "var(--foreground)" }}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${
                          u.status === "APPROVED" ? styles.statusApproved :
                          u.status === "REJECTED" ? styles.statusRejected :
                          styles.statusPending
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          {/* Reset Password Form */}
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.target as HTMLFormElement;
                              const input = form.elements.namedItem("newPassword") as HTMLInputElement;
                              if (input.value) {
                                handleResetPassword(u._id, input.value);
                                input.value = "";
                              }
                            }}
                            style={{ display: "flex", gap: "6px" }}
                          >
                            <input 
                              type="password" 
                              name="newPassword" 
                              placeholder="New password" 
                              className={styles.addInput} 
                              style={{ width: "120px", padding: "4px 8px", fontSize: "12px", marginTop: 0 }}
                              required 
                            />
                            <button type="submit" className={styles.addButton} style={{ padding: "4px 8px", fontSize: "12px" }}>
                              Reset
                            </button>
                          </form>

                          {u.role !== "ADMIN" && (
                            <button 
                              onClick={() => handleDeleteUser(u._id, u.username)} 
                              className={styles.rejectBtn}
                              style={{ padding: "4px 8px", fontSize: "12px" }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* Email List Column */}
          <section className={styles.listPane}>
            <div className={styles.paneHeader}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className={styles.paneTitle}>{activeTab === "inbox" ? "Inbox" : "Sent"}</h1>
                <button 
                  onClick={() => fetchEmails(false)} 
                  disabled={refreshing} 
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                >
                  <RefreshCw size={14} className={refreshing ? "spin" : ""} />
                </button>
              </div>
              <p className={styles.paneSubtitle}>
                {filteredEmails.length} {filteredEmails.length === 1 ? "email" : "emails"} found
              </p>
            </div>

            <div className={styles.listScroll}>
              {filteredEmails.length === 0 ? (
                <div className={styles.emptyState}>
                  <Mail size={32} strokeWidth={1.5} />
                  <p>No messages here.</p>
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <div 
                    key={email._id}
                    className={`${styles.mailCard} ${selectedEmail?._id === email._id ? styles.mailCardActive : ""}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardSender}>
                        {activeTab === "inbox" ? email.from : `To: ${email.to}`}
                      </span>
                      <span className={styles.cardDate}>{formatDate(email.timestamp)}</span>
                    </div>
                    <div className={styles.cardSubject}>{email.subject}</div>
                    <div className={styles.cardSnippet}>{email.textBody || "No text body"}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Reading Pane */}
          <section className={styles.detailPane}>
            {selectedEmail ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }} className="animate-fade-in">
                <div className={styles.detailHeader}>
                  <h1 className={styles.detailTitle}>{selectedEmail.subject}</h1>
                  <div className={styles.senderBlock}>
                    <div className={styles.avatar}>{getInitials(selectedEmail.from)}</div>
                    <div className={styles.senderDetails}>
                      <div className={styles.senderName}>{selectedEmail.from}</div>
                      <div className={styles.recipientName}>to {selectedEmail.to}</div>
                    </div>
                    <div className={styles.detailDate}>{formatDate(selectedEmail.timestamp)}</div>
                  </div>
                </div>
                <div className={styles.detailScroll}>
                  {selectedEmail.htmlBody ? (
                    <div 
                      className={styles.emailBody} 
                      dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }}
                    />
                  ) : (
                    <div className={styles.emailBody}>{selectedEmail.textBody}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState} style={{ height: "100%" }}>
                <Mail size={48} strokeWidth={1.2} />
                <p>Select an email to read its content</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* Compose Email Modal */}
      {isComposeOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>New Message</h3>
              <button onClick={() => setIsComposeOpen(false)} className={styles.closeBtn}>
                <X size={16} />
              </button>
            </div>

            {sendError && (
              <div className={`${styles.alert} ${styles.alertError}`} style={{ margin: "16px 20px 0" }}>
                <AlertTriangle size={16} />
                <span>{sendError}</span>
              </div>
            )}

            <form onSubmit={handleSendEmail} className={styles.modalForm}>
              <div className={styles.modalRow}>
                <span className={styles.modalRowLabel}>From</span>
                <select 
                  className={styles.modalRowSelect}
                  value={composeFrom}
                  onChange={(e) => setComposeFrom(e.target.value)}
                  disabled={sending}
                >
                  <option value={session?.user?.email || ""}>{session?.user?.email} (Primary)</option>
                  {aliases.map((alias) => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
              </div>

              <div className={styles.modalRow}>
                <span className={styles.modalRowLabel}>To</span>
                <input 
                  type="email" 
                  className={styles.modalRowInput} 
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  disabled={sending}
                  required
                />
              </div>

              <div className={styles.modalRow}>
                <span className={styles.modalRowLabel}>Subject</span>
                <input 
                  type="text" 
                  className={styles.modalRowInput} 
                  placeholder="Topic of discussion"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  disabled={sending}
                />
              </div>

              {footers.length > 0 && (
                <div className={styles.modalRow}>
                  <span className={styles.modalRowLabel}>Footer</span>
                  <select 
                    className={styles.modalRowSelect}
                    value={composeFooterId}
                    onChange={(e) => setComposeFooterId(e.target.value)}
                    disabled={sending}
                  >
                    <option value="">None</option>
                    {footers.map((foot) => (
                      <option key={foot._id} value={foot._id}>{foot.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <textarea 
                className={styles.textarea}
                placeholder="Write your email here..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                disabled={sending}
              />

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsComposeOpen(false)} disabled={sending}>
                  Cancel
                </button>
                <button type="submit" className={styles.sendSubmitBtn} disabled={sending}>
                  {sending ? (
                    <div className={styles.spinner}></div>
                  ) : (
                    <>
                      Send <SendHorizontal size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
