"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonWave, WaveBackground } from "@/components/wave-bg";
import { api, errorText } from "@/lib/api";
import { startGoogleRedirect } from "@/lib/google-gis";
import { setGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const canSkipToHome =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_AUTH_DEV_OTP === "true";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SendOtpData = { via?: "auth0" | "dev"; debugOtp?: string };

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [terms, setTerms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [confirm, setConfirm] = useState("");
  const otpRef = useRef<HTMLInputElement>(null);

  function onGoogleClick() {
    if (!requireTerms()) return;
    if (!googleClientId) {
      setDialog({ title: t("dialogIncomplete"), message: t("googleNotConfigured") });
      return;
    }
    setGoogleBusy(true);
    try {
      startGoogleRedirect(googleClientId);
    } catch {
      setGoogleBusy(false);
      setDialog({ title: t("loginFailed"), message: t("googleSignInFailed") });
    }
  }

  function requireTerms() {
    if (terms) return true;
    setDialog({ title: t("dialogIncomplete"), message: t("loginAcceptTermsPrompt") });
    return false;
  }

  async function enterHomeNow() {
    if (!requireTerms()) return;
    const target = email.trim();
    if (!target) {
      setDialog({ title: t("dialogIncomplete"), message: t("dialogFillEmail") });
      return;
    }
    setBusy(true);
    try {
      const { body } = await api("/api/v1/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ email: target }),
      });
      if (!body.isSuccess) {
        setDialog({
          title: t("loginFailed"),
          message: errorText(body, t("loginFailed")),
        });
        setBusy(false);
        return;
      }
      setGuest(false);
      window.location.replace("/home");
    } catch {
      setDialog({ title: t("cannotConnect"), message: t("cannotReachServer") });
      setBusy(false);
    }
  }

  function requireEmail() {
    const target = email.trim();
    if (!target) {
      setDialog({ title: t("dialogIncomplete"), message: t("dialogFillEmail") });
      return "";
    }
    if (!EMAIL_RE.test(target)) {
      setDialog({ title: t("dialogIncomplete"), message: t("loginInvalidEmail") });
      return "";
    }
    return target;
  }

  async function sendOtp() {
    if (!requireTerms()) return;
    const target = requireEmail();
    if (!target) return;
    setBusy(true);
    try {
      const { body } = await api<SendOtpData>("/api/v1/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email: target }),
      });
      if (!body.isSuccess) {
        setDialog({
          title: t("dialogIncomplete"),
          message: errorText(body, t("sendOtpFailed")),
        });
        return;
      }
      setEmail(target);
      setOtpStep(true);
      setOtp("");
      const debugOtp = body.data?.debugOtp;
      if (debugOtp) {
        setDialog({
          title: t("loginOtpSent"),
          message: `${t("loginDevOtp")} ${debugOtp}`,
        });
      }
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch {
      setDialog({ title: t("cannotConnect"), message: t("cannotReachServer") });
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!requireTerms()) return;
    const target = requireEmail();
    if (!target) return;
    if (otp.trim().length < 4) {
      setDialog({ title: t("dialogIncomplete"), message: t("dialogFillOtp") });
      return;
    }
    setBusy(true);
    try {
      const { body } = await api("/api/v1/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: target, otp: otp.trim() }),
      });
      if (!body.isSuccess) {
        setDialog({ title: t("wrongOtp"), message: errorText(body, t("wrongOtp")) });
        setBusy(false);
        return;
      }
      setGuest(false);
      window.location.replace("/home");
    } catch {
      setDialog({ title: t("cannotConnect"), message: t("cannotReachServer") });
      setBusy(false);
    }
  }

  async function passwordSubmit() {
    if (!requireTerms()) return;
    if (!email.trim() || !password) {
      setDialog({ title: t("dialogIncomplete"), message: t("dialogFillEmail") });
      return;
    }
    if (registerMode && password !== confirm) {
      setDialog({ title: t("passwordMismatch"), message: t("passwordMismatch") });
      return;
    }
    setBusy(true);
    try {
      if (registerMode) {
        const created = await api("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ authEmail: email.trim(), password }),
        });
        if (!created.body.isSuccess) {
          setDialog({
            title: t("loginFailed"),
            message: errorText(created.body, t("loginFailed")),
          });
          setBusy(false);
          return;
        }
      }
      const { body } = await api("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ authEmail: email.trim(), password }),
      });
      if (!body.isSuccess) {
        setDialog({ title: t("loginFailed"), message: errorText(body, t("loginFailed")) });
        setBusy(false);
        return;
      }
      setGuest(false);
      window.location.replace("/home");
    } catch {
      setDialog({ title: t("cannotConnect"), message: t("cannotReachServer") });
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <WaveBackground className="absolute inset-0" />
      <div className="relative z-10 flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10">
        <Image src="/icon/logo.png" alt="" width={72} height={72} className="mx-auto" />
        <h1 className="mt-6 text-center text-[22px] font-semibold text-[#1A1A1A]">
          {t("loginGreeting")}
        </h1>

        <form
          className="mt-8 flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void (otpStep ? verifyOtp() : sendOtp());
          }}
        >
          <label className="text-sm font-medium text-[#8E8E93]" htmlFor="login-email">
            {t("loginEmailLabel")}
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            disabled={otpStep || busy}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("loginEmailHint")}
            className="mt-2 rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3.5 text-base disabled:bg-[#F2F2F7]"
          />

          {otpStep ? (
            <>
              <label className="mt-4 text-sm font-medium text-[#8E8E93]" htmlFor="login-otp">
                {t("loginOtpLabel")}
              </label>
              <p className="mt-1 text-xs text-[#8E8E93]">
                {t("loginOtpSent")} ({email})
              </p>
              <input
                id="login-otp"
                ref={otpRef}
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="mt-2 rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3.5 text-center text-2xl tracking-[0.4em]"
              />
              <button
                type="button"
                className="mt-2 self-start text-sm font-semibold text-[#4A89EA]"
                onClick={() => {
                  setOtpStep(false);
                  setOtp("");
                }}
              >
                {t("loginChangeEmail")}
              </button>
            </>
          ) : null}

          <label className="mt-5 flex items-center gap-2 text-sm text-[#1A1A1A]">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="h-4 w-4 accent-[#4A89EA]"
            />
            <span>
              {t("loginAgreeTermsPrefix")}
              <Link href="/terms" className="font-semibold text-[#5DADE2]">
                {t("loginTermsLink")}
              </Link>
            </span>
          </label>

          {canSkipToHome ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void enterHomeNow()}
              className="relative mt-6 overflow-hidden rounded-3xl bg-[#4A89EA] py-3.5 text-lg font-semibold text-white disabled:opacity-70"
            >
              <ButtonWave />
              <span className="relative">
                {busy ? t("loggingInShort") : t("skipToHome")}
              </span>
            </button>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className={`relative overflow-hidden rounded-3xl py-3.5 text-lg font-semibold disabled:opacity-70 ${
              canSkipToHome
                ? "mt-3 border border-[#E5E5EA] bg-white text-[#1A1A1A]"
                : "mt-6 bg-[#4A89EA] text-white"
            }`}
          >
            {canSkipToHome ? null : <ButtonWave />}
            <span className="relative">
              {busy
                ? otpStep
                  ? t("loggingInShort")
                  : t("sendingOtp")
                : otpStep
                  ? t("welcomeSignIn")
                  : t("sendOtp")}
            </span>
          </button>
        </form>

        <button
          type="button"
          disabled={googleBusy}
          onClick={onGoogleClick}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-3xl border border-[#E5E5EA] bg-white py-3 font-semibold text-[#1A1A1A] disabled:opacity-70"
        >
          <Image src="/icon/google.png" alt="" width={22} height={22} />
          {googleBusy ? t("loggingInShort") : t("loginWithGoogle")}
        </button>

        <button
          type="button"
          className="mt-6 text-sm font-semibold text-[#8E8E93]"
          onClick={() => setShowPassword((v) => !v)}
        >
          {t("passwordLogin")}
        </button>

        {showPassword ? (
          <div className="mt-3 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")}
              className="w-full rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3"
            />
            {registerMode ? (
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t("confirmPassword")}
                className="w-full rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3"
              />
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void passwordSubmit()}
              className="w-full rounded-3xl bg-[#29292E] py-3 font-semibold text-white"
            >
              {registerMode ? t("createAccount") : t("passwordLogin")}
            </button>
            <button
              type="button"
              className="w-full text-sm font-semibold text-[#4A89EA]"
              onClick={() => setRegisterMode((v) => !v)}
            >
              {registerMode ? t("passwordLogin") : t("register")}
            </button>
          </div>
        ) : null}
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#FFF8F0] p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{dialog.title}</h2>
            <p className="mt-2 text-sm text-[#8E8E93]">{dialog.message}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-[#4A89EA] py-2 font-semibold text-white"
              onClick={() => setDialog(null)}
            >
              {t("ok")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
