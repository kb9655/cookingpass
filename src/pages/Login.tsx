import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { user, signIn, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <h1 className="text-3xl font-semibold tracking-tight">로그인</h1>
      <p className="mt-2 text-sm text-muted">학습 진행도와 재료 목록을 이어서 봅니다.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {!configured ? (
          <p className="text-sm text-muted">Supabase 환경 변수가 없어 로그인을 시험할 수 없습니다.</p>
        ) : null}
        <button className="btn-primary w-full" type="submit" disabled={submitting || !configured}>
          {submitting ? "확인 중" : "로그인"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        계정이 없나요?{" "}
        <Link to="/signup" className="font-semibold text-accent">
          회원가입
        </Link>
      </p>
    </main>
  );
}
