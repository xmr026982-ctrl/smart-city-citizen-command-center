import { clockSec } from "../../utils/time";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  User, ShieldCheck, Bell, Gauge, Database, Cpu, Radio, Users, Eye, Search, Download,
} from "lucide-react";
import "../../styles/settings.css";
import { ROLE_META, SCHEMA, VALIDATORS, zoneNameOf } from "../../config/settingsSchema";
import { useAuth, logout, setSignOutNote, updateSessionUser } from "../../store/authStore";
import { useSettings, useSavedAt, setSetting, setMany, resetKeys, resetAll, exportSettingsJson, ACCOUNT_PREFS } from "../../store/settingsStore";
import { onServer, saveProfile, deleteAccount, downloadFile, processAvatar } from "../../services/settingsService";
import { Panel, Row, Toaster, toast } from "../../components/settings/Controls";
import { SignInPanel, AlertsPanel, DevicePanel, RosterPanel, RolesMatrix, DiagPanel, DataPanel, ConfirmModal } from "../../components/settings/Panels";
import VisibilityPanel from "../../components/settings/VisibilityPanel";
import OperatorCard from "../../components/settings/OperatorCard";

/* ------------------------------------------------------------------
   Settings: one page per role, built from config/settingsSchema.js.
   Every control does something now. Account fields are saved to the
   server (and kept here for speed), so are the away limit and the alert
   preferences (settingsStore ACCOUNT_PREFS); screen preferences stay in
   this browser. Sign-in changes always go through the server.
------------------------------------------------------------------- */

const ICONS = { user: User, shield: ShieldCheck, bell: Bell, gauge: Gauge, database: Database, cpu: Cpu, radio: Radio, users: Users, eye: Eye };
const ALERT_KEYS = ["inboxMuted", "popups", "quietHours", "quietFrom", "quietTo"];
/* the account field each row saves to (PATCH /users/me) */
const SERVER_FIELD = { displayName: "displayName", homeWard: "zone", designation: "designation", office: "office" };

function Settings() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const me = useAuth();
  const role = me?.role || "citizen";
  const meta = ROLE_META[role] || ROLE_META.citizen;
  const sections = SCHEMA[role] || SCHEMA.citizen;
  const s = useSettings();
  const savedAt = useSavedAt();

  const pageRef = useRef(null);
  const searchRef = useRef(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(sections[0].id);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState("");

  const needle = q.trim().toLowerCase();
  const view = useMemo(() => {
    if (!needle) return sections.map((sec) => ({ sec, rows: sec.rows }));
    const out = [];
    sections.forEach((sec) => {
      const secHit = `${sec.title} ${sec.keywords || ""}`.toLowerCase().includes(needle);
      const rows = sec.rows ? sec.rows.filter((r) => secHit || `${r.label} ${r.hint || ""}`.toLowerCase().includes(needle)) : sec.rows;
      if (secHit || (rows && rows.length)) out.push({ sec, rows });
    });
    return out;
  }, [needle, sections]);

  // highlight the rail item for the section in view
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id.replace("sec-", ""));
      },
      { root, rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    root.querySelectorAll(".st-panel").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [view]);

  // press "/" to jump to search
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && !["input", "select", "textarea"].includes(tag)) {
        e.preventDefault();
        if (searchRef.current) searchRef.current.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const jump = useCallback((id) => {
    setActive(id);
    const el = pageRef.current && pageRef.current.querySelector(`#sec-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // /settings#alerts (from Notifications) opens on that section
  useEffect(() => {
    const id = (hash || "").replace("#", "");
    if (!id) return undefined;
    const t = setTimeout(() => jump(id), 120);
    return () => clearTimeout(t);
  }, [hash, jump]);

  if (!me) return null;

  /* one row changed */
  const change = async (r, v) => {
    if (!r.key) return;
    const field = r.scope === "account" ? SERVER_FIELD[r.key] : null;
    if (!field || !onServer()) {
      if (r.key === "homeWard") setMany({ homeWard: v, homeWardFrom: "local" });
      else setSetting(r.key, v);
      return;
    }
    // account field: the server keeps it, this browser mirrors it
    const before = s[r.key];
    if (r.key !== "homeWard") setSetting(r.key, v);
    setSaving(r.key);
    try {
      const value = r.key === "homeWard" ? zoneNameOf(v) : v;
      const user = await saveProfile({ [field]: value });
      if (user) updateSessionUser(user);
      if (r.key === "homeWard" && !user) setMany({ homeWard: v, homeWardFrom: "local" });
      toast(r.key === "homeWard" ? `Home zone set to ${zoneNameOf(v)}` : `${r.label} saved to your account`);
    } catch (e) {
      if (r.key !== "homeWard") setSetting(r.key, before);
      toast(e.message || "Your account couldn't be updated", "warn");
    } finally {
      setSaving("");
    }
  };

  const changePhoto = async (file) => {
    try {
      const url = await processAvatar(file);
      setSetting("avatar", url);
      if (onServer()) {
        try { await saveProfile({ avatar: url }); toast("Profile photo updated"); } catch { toast("Photo set on this device; your account didn't take it yet", "warn"); }
      } else toast("Profile photo updated");
    } catch (e) {
      toast(e.message || "That photo didn't work", "warn");
    }
  };
  const removePhoto = async () => {
    setSetting("avatar", "");
    toast("Profile photo removed", "info");
    if (onServer()) saveProfile({ avatar: "" }).catch(() => {});
  };

  const exportData = () => { downloadFile(`smart-kolkata-settings-${role}.json`, exportSettingsJson(), "application/json"); toast("Settings file downloaded"); };
  const askReset = () => setConfirm({
    title: "Reset this device?",
    body: "Screen preferences on this browser go back to their defaults. Your account, its preferences, password and reports are not touched.",
    confirm: "Reset", danger: true,
    run: async () => { resetAll(); toast("This device is back to the defaults", "info"); },
  });
  const askDelete = () => {
    const google = me.provider === "google";
    setConfirm({
      title: "Delete your account?",
      body: "This can't be undone. Your account is removed and you're signed out. Reports you filed stay on the board without your name.",
      confirm: "Delete my account", danger: true,
      password: !google, word: google ? "DELETE" : "",
      run: async ({ password }) => {
        await deleteAccount({ password });
        setSignOutNote("Your account was deleted.");
        resetAll();
        logout();
        navigate("/", { replace: true });
      },
    });
  };

  const stamp = savedAt ? `Saved ${clockSec(savedAt)}` : "Saves as you go";

  return (
    <main className="page settings" ref={pageRef} style={{ "--acc": meta.acc }}>
      <header className="st-head">
        <div>
          <span className="st-crumb">CONTROL CORE <b>/</b> {meta.console.toUpperCase()}</span>
          <h1>Settings</h1>
        </div>
        <div className="st-tools">
          <label className="st-search">
            <Search size={15} />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings…" aria-label="Search settings" />
            <kbd>/</kbd>
          </label>
          <span className="st-save"><i />{stamp}</span>
          <button type="button" className="st-btn" onClick={exportData}><Download size={14} />Export</button>
        </div>
      </header>

      <div className="st-grid">
        <nav className="st-rail" aria-label="Settings sections">
          {view.map(({ sec }, i) => (
            <button key={sec.id} type="button" className={active === sec.id ? "on" : ""} onClick={() => jump(sec.id)}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              {sec.title}
            </button>
          ))}
        </nav>

        <div className="st-main">
          <OperatorCard role={role} me={me} s={s} onJump={jump} onPhoto={changePhoto} onRemovePhoto={removePhoto} />

          <p className="st-legend">
            <em className="st-tag account">ACCOUNT</em> saved to your account, on every device
            <span aria-hidden>·</span>
            <em className="st-tag device">THIS DEVICE</em> kept in this browser only
          </p>

          {view.length === 0 && <div className="st-empty">No settings match “{q}”.</div>}

          {view.map(({ sec, rows }) => {
            const Icon = ICONS[sec.icon] || Gauge;
            const deviceKeys = sec.kind === "alerts" ? ALERT_KEYS : (sec.rows || []).filter((r) => r.scope === "device" && !ACCOUNT_PREFS.includes(r.key)).map((r) => r.key);
            const rowList = rows && rows.map((r) => (
              <Row key={r.key} row={r} value={s[r.key]} busy={saving === r.key} onChange={(v) => change(r, v)} onAction={() => {}} validators={VALIDATORS} />
            ));
            return (
              <Panel
                key={sec.id}
                id={sec.id}
                code={sec.code}
                title={sec.title}
                icon={Icon}
                onReset={deviceKeys.length ? () => { resetKeys(deviceKeys); toast(sec.kind === "alerts" ? "Alerts are back to the defaults" : `${sec.title} reset on this device`, "info"); } : null}
              >
                {sec.kind === "signin" && <SignInPanel role={role} me={me} s={s} onConfirm={setConfirm} />}
                {sec.kind === "device" ? <>{rowList}<DevicePanel s={s} /></> : null}
                {sec.kind === "roster" ? <>{rowList}<RosterPanel me={me} /></> : null}
                {!["device", "roster"].includes(sec.kind) && rowList}
                {sec.kind === "alerts" && <AlertsPanel role={role} s={s} />}
                {sec.kind === "visibility" && <VisibilityPanel role={role} s={s} me={me} />}
                {sec.kind === "roles" && <RolesMatrix />}
                {sec.kind === "diag" && <DiagPanel />}
                {sec.kind === "data" && <DataPanel role={role} onExport={exportData} onReset={askReset} onDelete={askDelete} />}
              </Panel>
            );
          })}
        </div>
      </div>

      <Toaster />
      <ConfirmModal cfg={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

export default Settings;
