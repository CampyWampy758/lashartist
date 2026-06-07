import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import {
  requestPasswordReset,
  deleteAccount,
  updateProfile,
} from "../api";

export default function Account() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState({ fullName: "", phone: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/sign-in");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.user_metadata?.full_name || "",
        phone: user.user_metadata?.phone || "",
      });
    }
  }, [user]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      await updateProfile(profile);
      setMessage("Profile updated.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResetPassword() {
    if (!confirm("Send a password reset email to your account?")) return;
    try {
      await requestPasswordReset();
      setMessage("Password reset email sent.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Delete your account permanently? This cannot be undone.")) return;
    try {
      await deleteAccount();
      await signOut();
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  if (authLoading || !user) {
    return <div className="page centered"><p className="muted">Loading...</p></div>;
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="My Account"
        title={profile.fullName || user.email}
        subtitle={user.email}
      />

      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}

      <form className="booking-form section" onSubmit={handleSaveProfile}>
        <label>
          Full name
          <input
            type="text"
            value={profile.fullName}
            onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
          />
        </label>
        <label>
          Phone
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block">Save Profile</button>

        <div className="account-actions">
          <button type="button" className="btn btn-outline btn-block" onClick={handleResetPassword}>
            Reset Password
          </button>
          <button type="button" className="btn btn-danger-outline btn-block" onClick={handleDeleteAccount}>
            Delete Account
          </button>
        </div>
      </form>
    </div>
  );
}
