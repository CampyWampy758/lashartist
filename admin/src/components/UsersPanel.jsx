import { useCallback, useEffect, useState } from "react";
import { adminDeleteUser, adminFetchUsers, adminResetUserPassword } from "../api";

export default function UsersPanel({ token }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await adminFetchUsers(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReset(user) {
    if (!user.email) {
      setError("User has no email on file.");
      return;
    }
    if (!confirm(`Send password reset email to ${user.email}?`)) return;
    try {
      await adminResetUserPassword(token, user.id, user.email);
      setMessage(`Reset email sent to ${user.email}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Permanently delete ${user.fullName || user.email}? This cannot be undone.`)) return;
    try {
      await adminDeleteUser(token, user.id);
      setMessage("User deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Loading users...</p>;

  return (
    <div className="panel">
      <p className="muted panel-desc">
        Manage client accounts. Reset passwords or delete accounts as needed.
      </p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}

      {users.length === 0 ? (
        <p className="muted">No registered users yet.</p>
      ) : (
        <div className="user-list">
          {users.map((user) => (
            <article key={user.id} className="user-card">
              <div>
                <strong>{user.fullName || "No name"}</strong>
                <p className="muted">{user.email || "No email"}</p>
                {user.phone && <p className="muted">{user.phone}</p>}
                <p className="muted user-meta">
                  Joined {new Date(user.createdAt).toLocaleDateString()} · {user.role}
                </p>
              </div>
              <div className="user-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleReset(user)}>
                  Reset password
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(user)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
