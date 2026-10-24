import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Mail, KeyRound, ShieldCheck, Bell, MapPin, Lock, Gauge, Globe, Database, Cpu, Radio, Siren,
  SlidersHorizontal, Wrench, Users, Eye, Search, Download, RotateCcw,
} from "lucide-react";
import "../../styles/settings.css";
import { ROLE_META, SCHEMA, VALIDATORS } from "../../config/settingsSchema";
import { getRole, clearRole } from "../../store/authStore";
import {
  useSettings, useSavedAt, setSetting, resetKeys, resetAll, exportSettingsJson, auditCsv,
} from "../../store/settingsStore";
import { downloadFile, clearOfflineCache, installApp, backupNow, deleteAccount, processAvatar } from "../../services/settingsService";
import { Panel, Row, Segmented, Toaster, toast } from "../../components/settings/Controls";
import { EmailPanel, PasswordPanel, SessionsPanel, RolesMatrix, DiagPanel, ConfirmModal } from "../../components/settings/Panels";
import VisibilityPanel from "../../components/settings/VisibilityPanel";
import OperatorCard from "../../components/settings/OperatorCard";

const ICONS = {
  user: User, mail: Mail, key: KeyRound, shield: ShieldCheck, bell: Bell, pin: MapPin, lock: Lock, gauge: Gauge,
  globe: Globe, database: Database, cpu: Cpu, radio: Radio, siren: Siren, sliders: SlidersHorizontal, wrench: Wrench,
  users: Users, eye: Eye,
};

// sections that always make sense in "Working now" mode
const LIVE_KINDS = ["diag", "visibility"];

function Settings() {
  const navigate = useNavigate();
  const role = getRole() || "citizen";
  const meta = ROLE_META[role] || ROLE_META.citizen;
  const sections = SCHEMA[role] || SCHEMA.citizen;
  const s = useSettings();
  const savedAt = useSavedAt();

  const pageRef = useRef(null);
  const searchRef = useRef(null);
  const [q, setQ] = useState("");
  const [onlyLive, setOnlyLive] = useState(false);
  const [active, setActive] = useState(sections[0].id);
  const [confirm, setConfirm] = useState(null);

  const needle = q.trim().toLowerCase();
  const view = useMemo(() => {
    const out = [];
    sections.forEach((sec) => {
      let rows = sec.rows;
      if (onlyLive) {
        if (rows) rows = rows.filter((r) => r.tag === "live" || r.type === "readonly");
        if (!(rows && rows.length) && !LIVE_KINDS.includes(sec.kind)) return;
      }
      if (needle) {
        const secHit = `${sec.title} ${sec.keywords || ""}`.toLowerCase().includes(needle);
        if (rows) rows = rows.filter((r) => secHit || `${r.label} ${r.hint || ""}`.toLowerCase().includes(needle));
        if (!secHit && !(rows && rows.length)) return;
      }
      out.push({ sec, rows });
    });
    return out;
  }, [needle, onlyLive, sections]);

  // highlight the rail item for the section currently in view
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

  const jump = (id) => {
    setActive(id);
    const el = pageRef.current && pageRef.current.querySelector(`#sec-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changePhoto = async (file) => {
    try {
      const url = await processAvatar(file);
      setSetting("avatar", url);
      toast("Profile photo updated");
    } catch (e) {
      toast(e.message || "That photo didn't work", "warn");
    }
  };
  const removePhoto = () => { setSetting("avatar", ""); toast("Profile photo removed", "info"); };

  const handleAction = async (a) => {
    try {
      if (a === "exportData") { downloadFile(`smartcity-settings-${role}.json`, exportSettingsJson(), "application/json"); toast("Settings file downloaded"); }
      else if (a === "exportAudit") { downloadFile(`audit-trail-${role}.csv`, auditCsv(), "text/csv"); toast("Audit trail downloaded"); }
      else if (a === "backupNow") { toast("Backup started…", "info"); await backupNow(); toast("Backup complete"); }
      else if (a === "clearCache") { const n = await clearOfflineCache(); toast(n ? `Cleared ${n} cache${n === 1 ? "" : "s"}` : "No offline cache to clear", "info"); }
      else if (a === "installApp") { await installApp(); }
      else if (a === "deleteAccount") {
        setConfirm({
          title: "Delete your account?",
          body: "This removes your profile and settings and signs you out. Demo mode: only data on this device is cleared.",
          word: "DELETE", confirm: "Delete account", danger: true,
          onConfirm: async () => { await deleteAccount(); resetAll(); clearRole(); navigate("/"); },
        });
      }
    } catch (e) {
      toast(e.message || "That didn't work", "warn");
    }
  };

  const askResetAll = () => setConfirm({
    title: "Reset all settings?",
    body: "Every setting on this page returns to its default for this role.",
    word: "RESET", confirm: "Reset everything", danger: true,
    onConfirm: () => { resetAll(); toast("Settings restored to defaults", "info"); },
  });

  const stamp = savedAt
    ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "Autosave on";

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
          <Segmented
            value={onlyLive ? "live" : "all"}
            options={[{ v: "all", l: "All settings" }, { v: "live", l: "Working now" }]}
            onChange={(v) => setOnlyLive(v === "live")}
            label="Which settings to show"
          />
          <span className="st-save"><i />{stamp}</span>
          <button type="button" className="st-btn" onClick={() => handleAction("exportData")}><Download size={14} />Export</button>
          <button type="button" className="st-btn danger" onClick={askResetAll}><RotateCcw size={14} />Reset all</button>
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
          <OperatorCard role={role} s={s} onJump={jump} onPhoto={changePhoto} onRemovePhoto={removePhoto} />

          <p className="st-legend">
            <em className="st-tag live">LIVE</em> works right now &nbsp;·&nbsp; <em className="st-tag sync">NEEDS SERVER</em> saved on this device, takes effect once the server is connected
          </p>

          {view.length === 0 && <div className="st-empty">No settings match.</div>}

          {view.map(({ sec, rows }) => {
            const Icon = ICONS[sec.icon] || Gauge;
            const keys = (sec.rows || []).filter((r) => r.type !== "readonly").map((r) => r.key).filter(Boolean);
            return (
              <Panel
                key={sec.id}
                id={sec.id}
                code={sec.code}
                title={sec.title}
                icon={Icon}
                onReset={keys.length ? () => { resetKeys(keys); toast(`${sec.title} reset`, "info"); } : null}
              >
                {sec.kind === "email" && <EmailPanel s={s} />}
                {sec.kind === "password" && <PasswordPanel s={s} />}
                {sec.kind === "diag" && <DiagPanel />}
                {sec.kind === "visibility" && <VisibilityPanel role={role} s={s} />}
                {rows && rows.map((r, i) => (
                  <Row
                    key={r.key || r.action || i}
                    row={r}
                    value={r.key ? s[r.key] : undefined}
                    onChange={(v) => r.key && setSetting(r.key, v)}
                    onAction={handleAction}
                    validators={VALIDATORS}
                  />
                ))}
                {sec.kind === "security" && <SessionsPanel s={s} />}
                {sec.kind === "roles" && <RolesMatrix />}
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