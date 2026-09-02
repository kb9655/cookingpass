import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function Signup() {
  const { user, signUp, configured } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await signUp(email, password, displayName);
      setMessage("가입이 완료되었습니다. 이메일 확인이 켜져 있으면 메일함도 확인해 주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <h1 className="text-3xl font-semibold tracking-tight">회원가입</h1>
      <p className="mt-2 text-sm text-muted">이메일과 비밀번호로 학습 기록을 만듭니다.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="displayName">이름</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        <button className="btn-primary w-full" type="submit" disabled={submitting || !configured}>
          {submitting ? "가입 중" : "계정 만들기"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        이미 계정이 있나요?{" "}
        <Link to="/login" className="font-semibold text-accent">
          로그인
        </Link>
      </p>
    </main>
  );
}
