"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { startGoogleRedirect } from "@/lib/google-gis";
import { setGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SendOtpData = { via?: "auth0" | "dev"; debugOtp?: string };

function PinMark() {
  return (
    <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-white shadow-[0_8px_24px_rgba(59,130,246,0.14)]">
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
        <path
          fill="#3B82F6"
          d="M18.2 4.2c-5.35 0-9.7 4.22-9.7 9.42 0 6.95 8.3 16.85 8.85 17.48.45.52 1.25.52 1.7 0 .55-.63 8.85-10.53 8.85-17.48 0-5.2-4.35-9.42-9.7-9.42Zm0 12.7a3.35 3.35 0 1 1 0-6.7 3.35 3.35 0 0 1 0 6.7Z"
        />
        <circle cx="27.4" cy="25.6" r="4.15" fill="#F5B942" />
      </svg>
    </span>
  );
}

function MailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="2.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 7.2 12 12.4 20 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[#C5CDD6]" aria-hidden="true">
      <path d="M9 6.5 15 12l-6 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LineMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#06C755" />
      <path
        fill="#fff"
        d="M14 7.1c-3.86 0-7 2.48-7 5.54 0 2.74 2.43 5.04 5.72 5.48.22.05.52.15.6.34.07.16.05.42.02.59l-.09.55c-.03.16-.13.64.56.35.7-.29 3.78-2.23 5.16-3.8.95-1.04 1.4-2.1 1.4-3.51 0-3.06-3.14-5.54-7.37-5.54Z"
      />
    </svg>
  );
}

export default function WelcomePage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const otpRef = useRef<HTMLInputElement>(null);

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

  function onGoogleClick() {
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

  return (
    <main className="min-h-dvh bg-[#F4F8FC]">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        <div className="pointer-events-none absolute inset-x-0 -top-16 h-80 overflow-hidden">
          <Image
            src="/welcome/login-bg.jpg"
            alt=""
            fill
            priority
            sizes="430px"
            className="object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-[#F4F8FC]" />
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#F4F8FC] to-transparent" />
        </div>

        <header className="relative z-10 px-6 pb-2 pt-8">
          <PinMark />
          <h1 className="mt-5 text-[30px] font-bold leading-tight tracking-tight text-[#1B2430]">
            {t("welcomeTitle")}
          </h1>
          <p className="mt-1.5 text-[15px] font-medium text-[#8B95A1]">{t("welcomeLead")}</p>
          <p className="mt-1 text-[13px] text-[#A0A8B3]">{t("welcomeFeatures")}</p>
        </header>

        <section className="relative z-10 mx-4 mb-5 mt-5 flex flex-1 flex-col rounded-[28px] bg-white px-5 pb-6 pt-6 shadow-[0_12px_40px_rgba(40,80,140,0.06)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8F1FF] text-[#3B82F6]">
              <MailIcon />
            </span>
            <div>
              <p className="text-[16px] font-bold text-[#1B2430]">{t("welcomeEmailTitle")}</p>
              <p className="text-[13px] text-[#8B95A1]">
                {otpStep ? `${t("loginOtpSent")}` : t("welcomeEmailHint")}
              </p>
            </div>
          </div>

          <form
            className="mt-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void (otpStep ? verifyOtp() : sendOtp());
            }}
          >
            <label className="sr-only" htmlFor="welcome-email">
              {t("loginEmailLabel")}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#C3CAD3]">
                <MailIcon className="h-[18px] w-[18px]" />
              </span>
              <input
                id="welcome-email"
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
                placeholder={t("welcomeEmailPlaceholder")}
                className="w-full rounded-2xl border border-[#E6EBF1] bg-white py-3.5 pl-11 pr-4 text-[15px] text-[#1B2430] placeholder:text-[#C3CAD3] disabled:bg-[#F7F9FB] focus:border-[#3B82F6]"
              />
            </div>

            {otpStep ? (
              <div className="mt-3">
                <label className="sr-only" htmlFor="welcome-otp">
                  {t("loginOtpLabel")}
                </label>
                <input
                  id="welcome-otp"
                  ref={otpRef}
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder={t("loginOtpLabel")}
                  className="w-full rounded-2xl border border-[#E6EBF1] bg-white px-4 py-3.5 text-center text-xl tracking-[0.35em] text-[#1B2430] placeholder:tracking-normal placeholder:text-[#C3CAD3] focus:border-[#3B82F6]"
                />
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-[#3B82F6]"
                  onClick={() => {
                    setOtpStep(false);
                    setOtp("");
                  }}
                >
                  {t("loginChangeEmail")}
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-[#3B82F6] py-3.5 text-[16px] font-semibold text-white shadow-[0_8px_18px_rgba(59,130,246,0.28)] disabled:opacity-70"
            >
              {busy
                ? otpStep
                  ? t("loggingInShort")
                  : t("sendingOtp")
                : otpStep
                  ? t("welcomeSignIn")
                  : t("welcomeSendOtp")}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-[13px] text-[#A0A8B3]">
            <span className="h-px flex-1 bg-[#E8EDF3]" />
            <span>{t("welcomeOrContinue")}</span>
            <span className="h-px flex-1 bg-[#E8EDF3]" />
          </div>

          <button
            type="button"
            disabled={googleBusy}
            onClick={onGoogleClick}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[#E7EDF4] bg-white px-4 py-3.5 text-left text-[15px] font-semibold text-[#1B2430] disabled:opacity-70"
          >
            <Image src="/icon/google.png" alt="" width={22} height={22} />
            <span className="flex-1">{googleBusy ? t("loggingInShort") : t("loginWithGoogle")}</span>
            <Chevron />
          </button>

          <button
            type="button"
            onClick={() =>
              setDialog({ title: t("welcomeLine"), message: t("welcomeLineSoon") })
            }
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[#E7EDF4] bg-white px-4 py-3 text-left text-[15px] font-semibold text-[#1B2430]"
          >
            <LineMark />
            <span className="flex-1">{t("welcomeLine")}</span>
            <Chevron />
          </button>

          <p className="mt-auto px-2 pt-8 text-center text-[12px] leading-5 text-[#A0A8B3]">
            {t("welcomeConsent")}
            <br />
            <Link href="/terms" className="font-semibold text-[#3B82F6]">
              {t("welcomeTermsLink")}
            </Link>{" "}
            <span>{t("welcomeAnd")}</span>{" "}
            <Link href="/privacy" className="font-semibold text-[#3B82F6]">
              {t("welcomePrivacyLink")}
            </Link>
          </p>
        </section>
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-dialog-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 id="welcome-dialog-title" className="text-lg font-semibold text-[#1B2430]">
              {dialog.title}
            </h2>
            <p className="mt-2 text-sm text-[#8B95A1]">{dialog.message}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-[#3B82F6] py-2.5 font-semibold text-white"
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
