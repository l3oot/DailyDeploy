"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountPlans } from "@/components/account-plans";
import { AppFooter } from "@/components/app-footer";
import { BentoWave } from "@/components/bento-wave";
import { LanguageRowSelector } from "@/components/language-switcher";
import { TopoPattern } from "@/components/topo-pattern";
import { api, errorText, type SessionUser } from "@/lib/api";
import { formatAccountBirthdate, fromBirthInputValue, toBirthInputValue } from "@/lib/birthdate";
import { isValidThaiMobile, nextThaiMobileInput } from "@/lib/phone";
import { isGuest, setGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";
import { fetchPlanOverview } from "@/lib/plan-api";
import type { PlanOverview } from "@/lib/plans";

type UserProfile = {
  userUuid: string;
  userName: string;
  userPhone: string;
  userBirthdate: string | null;
};

export default function AccountPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [guest, setGuestState] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [planOverview, setPlanOverview] = useState<PlanOverview | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  function fillEdit(p: UserProfile | null) {
    setName(p?.userName && p.userName !== "—" ? p.userName : "");
    setPhone(p?.userPhone && p.userPhone !== "—" && p.userPhone !== "-" ? p.userPhone : "");
    setBirth(toBirthInputValue(p?.userBirthdate ?? null));
  }

  async function load() {
    const guestMode = isGuest();
    setGuestState(guestMode);
    if (guestMode) {
      setResolved(true);
      setLoading(false);
      setSession(null);
      return;
    }
    const me = await api<SessionUser>("/api/v1/auth/me");
    if (!me.body.data) {
      setResolved(true);
      setLoading(false);
      setSession(null);
      return;
    }
    setSession(me.body.data);
    setResolved(true);
    setPlanLoading(true);
    const [users, plans] = await Promise.all([
      api<UserProfile>(`/api/v1/users/${me.body.data.authUuid}`),
      fetchPlanOverview(),
    ]);
    setPlanOverview(plans);
    setPlanLoading(false);
    if (users.status === 404 || users.body.errorType === 4) {
      setMissing(true);
      setProfile(null);
      setError("");
      setLoading(false);
      fillEdit(null);
      return;
    }
    if (!users.body.isSuccess || !users.body.data) {
      setError(errorText(users.body, t("accountLoadFailed")));
      setLoading(false);
      return;
    }
    setMissing(false);
    setProfile(users.body.data);
    setError("");
    setLoading(false);
    if (!editing) fillEdit(users.body.data);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!name.trim()) {
      showToast(t("accountNameRequired"));
      return;
    }
    if (!birth) {
      showToast(t("accountBirthdateRequired"));
      return;
    }
    const phoneDigits = phone.trim();
    if (phoneDigits && !isValidThaiMobile(phoneDigits)) {
      showToast(t("accountPhoneInvalid"));
      return;
    }
    setSaving(true);
    const payload = {
      userName: name.trim(),
      userPhone: phoneDigits || "-",
      userBirthdate: fromBirthInputValue(birth),
      ...(profile ? { userUuid: profile.userUuid } : {}),
    };
    const res = missing
      ? await api<UserProfile>("/api/v1/users", { method: "POST", body: JSON.stringify(payload) })
      : await api<UserProfile>("/api/v1/users", { method: "PUT", body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.body.isSuccess) {
      showToast(errorText(res.body, t("accountProfileSaveFailed")));
      return;
    }
    setEditing(false);
    showToast(t("accountProfileSaved"));
    await load();
  }

  async function signOut() {
    await api("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({}) });
    setGuest(false);
    router.replace("/welcome");
  }

  const loggedIn = Boolean(session) && !guest;
  const displayName =
    profile?.userName && profile.userName !== "—" ? profile.userName : t("accountUser");

  return (
    <main className="relative min-h-dvh pb-28">
      <TopoPattern />
      <header className="relative z-10 flex h-12 items-center justify-center pt-6">
        <p className="text-xl font-bold tracking-wide">{t("welcomeBrand")}</p>
      </header>

      <div className="relative z-10 mx-auto max-w-lg px-5 pt-2">
        <section className="rounded-3xl bg-white px-5 py-5 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
          {!resolved || (loggedIn && loading) ? (
            <p className="py-10 text-center text-sm text-[#8E8E93]">{t("restoringSession")}</p>
          ) : !loggedIn ? (
            <Link
              href="/welcome"
              className="relative flex overflow-hidden rounded-[14px] bg-[#4A89EA] py-3.5 text-center text-base font-semibold text-white"
            >
              <BentoWave color="#6BA3F0" animate={false} progress={0.34} cloudLike />
              <span className="relative z-10 w-full">{t("createAccount")}</span>
            </Link>
          ) : (
            <>
              <div className="flex items-start gap-3.5">
                <Avatar url={session?.pictureUrl} />
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold">{displayName}</p>
                  {planOverview?.mine ? (
                    <p className="mt-0.5 text-xs font-semibold text-[#4A89EA]">
                      {planOverview.mine.planCode === "plus"
                        ? t("planNamePlus")
                        : planOverview.mine.planCode === "pro"
                          ? t("planNamePro")
                          : t("planNameFree")}
                    </p>
                  ) : null}
                  {!editing && !loading && !error ? (
                    <button
                      type="button"
                      onClick={() => {
                        fillEdit(profile);
                        setEditing(true);
                      }}
                      className="mt-1 rounded-full bg-[#9FD356] px-4 py-1.5 text-[13px] font-semibold text-white"
                    >
                      {t("accountEditProfile")}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-full bg-[#ECECEF] p-1">
                <div className="grid grid-cols-3">
                  <TabButton
                    label={t("accountTabGeneral")}
                    selected={tab === 0}
                    onClick={() => setTab(0)}
                  />
                  <TabButton
                    label={t("accountTabPlan")}
                    selected={tab === 1}
                    onClick={() => {
                      setEditing(false);
                      setTab(1);
                    }}
                  />
                  <TabButton
                    label={t("accountTabSettings")}
                    selected={tab === 2}
                    onClick={() => {
                      setEditing(false);
                      setTab(2);
                    }}
                  />
                </div>
              </div>

              <div className="mt-4">
                {tab === 1 ? (
                  <AccountPlans
                    overview={planOverview}
                    loading={planLoading}
                    onUpdated={setPlanOverview}
                    onToast={showToast}
                  />
                ) : error ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-[#8E8E93]">{error}</p>
                    <button
                      type="button"
                      className="mt-2 text-sm font-semibold text-[#4A89EA]"
                      onClick={() => void load()}
                    >
                      {t("retry")}
                    </button>
                  </div>
                ) : tab === 0 ? (
                  editing ? (
                    <div className="space-y-3">
                      <Field
                        label={t("accountFieldUsername")}
                        value={name}
                        onChange={setName}
                        icon="user"
                      />
                      <Field
                        label={t("accountFieldPhone")}
                        value={phone}
                        onChange={(value) => {
                          const next = nextThaiMobileInput(phone, value);
                          setPhone(next.value);
                          if (next.invalid) showToast(t("accountPhoneInvalid"));
                        }}
                        icon="phone"
                        inputMode="numeric"
                        maxLength={10}
                        autoComplete="tel"
                      />
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-[#8E8E93]">
                          {t("accountFieldBirthdate")}
                        </span>
                        <input
                          type="date"
                          value={birth}
                          onChange={(e) => setBirth(e.target.value)}
                          className="w-full rounded-xl border border-[#E5E5EA] bg-white px-3 py-3"
                        />
                      </label>
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          className="flex-1 rounded-xl border border-[#29292E] py-2.5 font-semibold"
                          onClick={() => {
                            fillEdit(profile);
                            setEditing(false);
                          }}
                        >
                          {t("cancel")}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="flex-1 rounded-xl bg-[#4A89EA] py-2.5 font-semibold text-white disabled:opacity-70"
                          onClick={() => void save()}
                        >
                          {saving ? "…" : t("accountSave")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ReadField
                        label={t("accountFieldUsername")}
                        value={profile?.userName || "—"}
                        icon="user"
                      />
                      <ReadField
                        label={t("accountFieldPhone")}
                        value={!profile?.userPhone || profile.userPhone === "-" ? "—" : profile.userPhone}
                        icon="phone"
                      />
                      <ReadField
                        label={t("accountFieldBirthdate")}
                        value={
                          profile?.userBirthdate
                            ? formatAccountBirthdate(profile.userBirthdate, locale)
                            : "—"
                        }
                        icon="cake"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <p className="text-sm font-semibold text-[#8E8E93]">{t("language")}</p>
                    <LanguageRowSelector />
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {loggedIn && tab === 2 ? (
          <div className="mt-5 space-y-3">
            <Link
              href="/settings/notifications"
              className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#4A89EA]/10 text-[#4A89EA]">
                <BellIcon />
              </span>
              <span className="flex-1 font-semibold">{t("notifications")}</span>
              <Chevron />
            </Link>
            <button
              type="button"
              onClick={() => setConfirmOut(true)}
              className="flex w-full items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-red-50 text-red-700">
                <LogoutIcon />
              </span>
              <span className="flex-1 text-left font-semibold text-red-700">{t("accountLogout")}</span>
              <Chevron />
            </button>
          </div>
        ) : null}
      </div>

      {confirmOut ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h2 className="text-lg font-semibold">{t("logoutConfirmTitle")}</h2>
            <p className="mt-2 text-sm text-[#8E8E93]">{t("logoutConfirmMessage")}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#F2F2F7] py-2 font-semibold"
                onClick={() => setConfirmOut(false)}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-red-700 py-2 font-semibold text-white"
                onClick={() => void signOut()}
              >
                {t("accountLogout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#29292E] px-4 py-2 text-sm text-white">
          {toast}
        </div>
      ) : null}

      <AppFooter active="account" />
    </main>
  );
}

function TabButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full py-2.5 text-[13px] font-semibold ${
        selected ? "bg-[#29292E] text-white" : "text-[#1A1A1A]"
      }`}
    >
      {label}
    </button>
  );
}

function Avatar({ url }: { url?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-[72px] w-[72px] rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#4A89EA]/12 text-[#4A89EA]">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12Zm0 2.2c-3.4 0-8 1.7-8 5V21h16v-1.8c0-3.3-4.6-5-8-5Z" />
      </svg>
    </div>
  );
}

function ReadField({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E5E5EA] bg-white px-3 py-3">
      <FieldIcon name={icon} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#8E8E93]">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  icon,
  inputMode,
  maxLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: IconName;
  inputMode?: "numeric" | "tel" | "text";
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[#E5E5EA] bg-white px-3 py-2">
      <FieldIcon name={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-[#8E8E93]">{label}</span>
        <input
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent py-0.5 font-medium"
        />
      </span>
    </label>
  );
}

type IconName = "user" | "phone" | "cake";

function FieldIcon({ name }: { name: IconName }) {
  if (name === "phone") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#8E8E93" aria-hidden>
        <path d="M6.6 3.8h2.3l1.2 4.2-1.8 1.1a12.6 12.6 0 0 0 5.6 5.6l1.1-1.8 4.2 1.2v2.3c0 .9-.8 1.7-1.7 1.7C9.8 18.1 5 13.3 5 7.5c0-.9.8-1.7 1.6-1.7Z" />
      </svg>
    );
  }
  if (name === "cake") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#8E8E93" aria-hidden>
        <path d="M12 2c.8 1.4.8 2.6 0 4-.8-1.4-.8-2.6 0-4Zm-5 8.5c0-1.4 1.1-2.5 2.5-2.5S12 9.1 12 10.5 10.9 13 9.5 13 7 11.9 7 10.5Zm5 0C12 9.1 13.1 8 14.5 8S17 9.1 17 10.5 15.9 13 14.5 13 12 11.9 12 10.5ZM5 14h14v7H5v-7Z" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#8E8E93" aria-hidden>
      <path d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12Zm0 2.2c-3.4 0-8 1.7-8 5V21h16v-1.8c0-3.3-4.6-5-8-5Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm7-5.5V11a7 7 0 1 0-14 0v5.5L3 18.8V20h18v-1.2L19 16.5Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10 17v2H4V5h6v2H6v10h4Zm9.2-5-3.6-3.6L17 7l6 6-6 6-1.4-1.4L19.2 14H10v-2h9.2Z" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
