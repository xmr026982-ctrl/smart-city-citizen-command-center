import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CitizenReportForm from "../../components/issues/citizen/CitizenReportForm";
import IssuePhotoUpload from "../../components/issues/citizen/IssuePhotoUpload";
import { useToast } from "../../components/ui/Toast";
import { addIssue, nextIssueId } from "../../store/issueStore";
import { useAuth } from "../../store/authStore";

const STEPS = [
  { id: "describe", n: "01", label: "Describe the issue", body: "Tell us what happened with a clear and simple description." },
  { id: "locate", n: "02", label: "Add the location", body: "Provide the affected area so the right department can respond." },
  { id: "evidence", n: "03", label: "Attach evidence", body: "Upload photos to help the team understand the problem faster." },
];

function ReportIssue() {
  const user = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState([]);
  const [step, setStep] = useState("describe");
  const [params, setParams] = useSearchParams();
  const [returnedPin, setReturnedPin] = useState(null);

  useEffect(() => {
    const lat = params.get("lat");
    const lng = params.get("lng");
    const zone = params.get("zone");
    if (!lat || !lng || !zone) return;
    setReturnedPin({ zone, lat, lng, label: params.get("label") || "Dropped pin" });
    setStep("locate");
    setParams({}, { replace: true });
  }, [params, setParams]);

  const handleSubmit = (draft) => {
    const createdAt = new Date().toISOString();
    addIssue({
      id: nextIssueId(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      location: draft.location.trim(),
      ward: draft.ward,
      lat: Number(draft.lat),
      lng: Number(draft.lng),
      photos,
      reportedBy: user.name,
      reporterId: user.id,
      status: "submitted",
      priority: "medium",
      assignedTo: null,
      assignedAt: null,
      comments: [],
      timeline: [{ status: "submitted", at: createdAt, by: user.name }],
      createdAt,
      updatedAt: createdAt,
      saved: false,
      slaHours: 48,
    });
    toast("Report filed");
    setPhotos([]);
    setStep("describe");
  };

  return (
    <main className="page-wrap">
      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(240px, 0.8fr)", gap: 14 }}>
        <article style={hero}>
          <div style={hair} />
          <p style={eyebrow}>Citizen services / Issue reporting</p>
          <h1 style={heroTitle}>Report a city issue</h1>
          <p style={heroBody}>Help improve your city by reporting problems around you. Share the details, add the location, and track the progress of your report from one place.</p>
          <div style={liveLine}><span style={liveDot} /> Every report helps build a better city</div>
        </article>
        <article style={impact}>
          <div style={hair} />
          <p style={eyebrow}>Your impact</p>
          <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1.1 }}>Make your city better.</h2>
          <p style={{ marginTop: 10, color: "var(--muted)", lineHeight: 1.55 }}>Report civic problems responsibly and help local teams understand what needs attention.</p>
        </article>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
        {STEPS.map((item) => {
          const active = step === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setStep(item.id)} style={{
              textAlign: "left", borderRadius: 16, padding: "14px 16px", cursor: "pointer",
              background: active ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.72)",
              border: active ? "1px solid rgba(14,165,233,0.4)" : "1px solid rgba(255,255,255,0.8)",
              boxShadow: "0 8px 24px rgba(14,165,233,0.06)",
            }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: active ? "var(--primary-deep)" : "var(--subtle)" }}>{item.n}</p>
              <p style={{ marginTop: 6, fontWeight: 700 }}>{item.label}</p>
              <p style={{ marginTop: 4, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>{item.body}</p>
            </button>
          );
        })}
      </section>

      <section style={formBox}>
        <div style={hair} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <p style={eyebrow}>New report</p>
            <h2 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontSize: 28 }}>Tell us what needs attention</h2>
            <p style={{ marginTop: 6, color: "var(--muted)" }}>Complete the details below. Required fields are marked.</p>
          </div>
          <div style={liveChip}><span style={liveDot} /> Citizen report</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.8fr)", gap: 18, alignItems: "start", marginTop: 18 }}>
          <CitizenReportForm onSubmit={handleSubmit} returnedPin={returnedPin} step={step} onStep={setStep} />
          <IssuePhotoUpload files={photos} onChange={setPhotos} active={step === "evidence"} onFocus={() => setStep("evidence")} />
        </div>
      </section>
      <style>{`@keyframes livePulse { 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.12); } }`}</style>
    </main>
  );
}

const hero = { position: "relative", overflow: "hidden", borderRadius: 22, padding: 24, background: "rgba(255,255,255,0.74)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 8px 28px rgba(14,165,233,0.07)" };
const impact = { ...hero, background: "linear-gradient(180deg, rgba(224,242,254,0.85), rgba(255,255,255,0.78))" };
const formBox = { position: "relative", overflow: "hidden", marginTop: 14, padding: 22, borderRadius: 22, background: "rgba(255,255,255,0.74)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 8px 28px rgba(14,165,233,0.07)" };
const hair = { position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.65), transparent)" };
const eyebrow = { fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary-deep)", fontWeight: 650 };
const heroTitle = { margin: "10px 0 0", fontFamily: "var(--font-display)", fontSize: 40, lineHeight: 1.05 };
const heroBody = { marginTop: 10, maxWidth: 560, color: "var(--muted)", lineHeight: 1.6 };
const liveLine = { marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, color: "var(--fg)", fontSize: 13.5 };
const liveDot = { width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "livePulse 1.8s ease infinite" };
const liveChip = { display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 12px", borderRadius: 999, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#059669", fontSize: 12.5, fontWeight: 650 };

export default ReportIssue;