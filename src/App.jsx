import "./styles.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileAudio,
  FileImage,
  FileText,
  Fingerprint,
  FolderClock,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  Search,
  ScanSearch,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserRound,
  X
} from "lucide-react";

import AuthPage from "./AuthPage";

const API_URL = "http://localhost:5000";

function App() {
  const [page, setPage] = useState("Overview");
  const [mediaType, setMediaType] = useState("Image");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);

  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");

  const [search, setSearch] = useState("");

  const [profileName, setProfileName] = useState("Sai Omkar");
  const [email, setEmail] = useState("");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const fileInput = useRef(null);
  const previewUrl = useRef("");

  // --------------------------------------------------
  // CHECK EXISTING LOGIN SESSION
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/me`, {
          method: "GET",
          credentials: "include"
        });

        const data = await response.json();

        if (!mounted) return;

        if (response.ok && data.success && data.user) {
          setAuthUser(data.user);
          setProfileName(data.user.name);
          setEmail(data.user.email);
        }
      } catch (error) {
        console.error("Session verification failed:", error);
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  // --------------------------------------------------
  // CLEAN UP IMAGE PREVIEW
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (previewUrl.current) {
        URL.revokeObjectURL(previewUrl.current);
      }
    };
  }, []);

  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------

  const navGroups = [
    {
      label: "WORKSPACE",
      items: [
        ["Overview", LayoutDashboard],
        ["Analyze", ScanSearch],
        ["History", FolderClock],
        ["Reports", FileText]
      ]
    },
    {
      label: "SYSTEM",
      items: [
        ["Account", Settings],
        ["Help", CircleHelp]
      ]
    }
  ];

  const go = (next) => {
    setPage(next);
    setMobileOpen(false);
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    setAuthUser(null);
    setProfileName("Sai Omkar");
    setEmail("");

    setFile(null);
    setPreview("");
    setResult(null);
    setHistory([]);

    setPage("Overview");
    setMobileOpen(false);
  };

  // --------------------------------------------------
  // FILE UPLOAD
  // --------------------------------------------------

  const onFile = (selected) => {
    if (!selected) return;

    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = "";
    }

    setFile(selected);
    setResult(null);

    if (selected.type.startsWith("image/")) {
      const url = URL.createObjectURL(selected);

      previewUrl.current = url;
      setPreview(url);
    } else {
      setPreview("");
    }
  };

  const removeFile = () => {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = "";
    }

    setFile(null);
    setPreview("");
    setResult(null);

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  };

  // --------------------------------------------------
  // IMAGE ANALYSIS - REAL FLASK API
  // --------------------------------------------------

  const runAnalysis = async () => {
  if (!file || busy) return;

  const isAudio = mediaType === "Audio";
  const endpoint = isAudio ? "audio" : "image";
  const modelName = isAudio ? "Wav2Vec2" : "ResNet50";

  setBusy(true);
  setProgress(20);
  setStage(`Preparing ${mediaType.toLowerCase()}...`);

  try {
    const formData = new FormData();
    formData.append("file", file);

    setProgress(40);
    setStage(`Uploading ${mediaType.toLowerCase()} to DeepTrace...`);

    const response = await fetch(
      `${API_URL}/api/analyze/${endpoint}`,
      {
        method: "POST",
        body: formData,
        credentials: "include"
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        setAuthUser(null);
        throw new Error("Your session expired. Please log in again.");
      }

      throw new Error(
        data.message || `${mediaType} analysis failed.`
      );
    }

    if (!data.result) {
      throw new Error("The backend returned an invalid prediction.");
    }

    setProgress(80);
    setStage(`Processing ${modelName} prediction...`);

    const prediction = data.result;

    const item = {
      id: Date.now(),
      file: file.name,
      type: mediaType,
      model: modelName,
      result: prediction.label,
      confidence: Number(
        (Number(prediction.confidence) * 100).toFixed(2)
      ),
      fakeProbability: Number(
        (Number(prediction.fake_probability) * 100).toFixed(2)
      ),
      realProbability: Number(
        (Number(prediction.real_probability) * 100).toFixed(2)
      ),
      time: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    setProgress(100);
    setStage("Analysis completed!");

    setResult(item);
    setHistory((previous) => [item, ...previous]);

  } catch (error) {
    console.error("DeepTrace analysis error:", error);
    alert(error.message || "Something went wrong.");

  } finally {
    setBusy(false);

    setTimeout(() => {
      setProgress(0);
      setStage("");
    }, 800);
  }
};

  // --------------------------------------------------
  // REPORT GENERATION
  // --------------------------------------------------

  const downloadReport = (item) => {
    if (!item) return;

    const report = `
DEEPTRACE FORENSIC REPORT
=========================

CASE INFORMATION
----------------

File: ${item.file}
Media Type: ${item.type}
Analysis Time: ${item.time}

CLASSIFICATION
--------------

Prediction: ${item.result}
Model Confidence: ${item.confidence}%

MODEL PROBABILITIES
-------------------

Fake Probability: ${item.fakeProbability}%
Real Probability: ${item.realProbability}%

MODEL INFORMATION
-----------------

Architecture: ${item.model || (item.type === "Audio" ? "Wav2Vec2" : "ResNet50")}
Framework: PyTorch
Backend: Flask

INTERPRETATION NOTICE
---------------------

This report represents an AI-assisted model prediction.

The prediction should not be treated as definitive proof
of authenticity or manipulation.

Independent verification is recommended.

=========================
DEEPTRACE DIGITAL FORENSICS
`;

    const blob = new Blob(
      [report],
      { type: "text/plain" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `DeepTrace_Report_${item.id}.txt`;

    link.click();

    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------
  // HISTORY SEARCH
  // --------------------------------------------------

  const filteredHistory = useMemo(() => {
    return history.filter((item) =>
      item.file
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [history, search]);

  // --------------------------------------------------
  // REUSABLE UI COMPONENTS
  // --------------------------------------------------

  const Header = ({ section, title, description }) => (
    <div className="page-header">
      <div className="eyebrow">
        DEEPTRACE <span>/</span> {section}
      </div>

      <h1>{title}</h1>

      <p>{description}</p>

      <div className="rule" />
    </div>
  );

  const Metric = ({ label, value, note }) => (
    <div className="metric-card">
      <div className="metric-label">{label}</div>

      <div className="metric-value">{value}</div>

      {note && (
        <div className="metric-note">{note}</div>
      )}
    </div>
  );

  const Panel = ({ children, className = "" }) => (
    <section className={`panel ${className}`}>
      {children}
    </section>
  );

  const Badge = ({ children, good = false }) => (
    <span className={`status-badge ${good ? "good" : "warn"}`}>
      <span />
      {children}
    </span>
  );

  const EmptyState = ({ icon, title, text }) => (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>

      <strong>{title}</strong>

      <p>{text}</p>
    </div>
  );

  // --------------------------------------------------
  // HISTORY ROWS
  // --------------------------------------------------

  function HistoryRows({ items }) {
    return (
      <div className="history-list">
        {items.map((item) => (
          <div className="history-row" key={item.id}>

            <div className="history-file-icon">
              {item.type === "Image" ? (
                <ImageIcon size={18} />
              ) : (
                <AudioLines size={18} />
              )}
            </div>

            <div className="history-file">
              <strong>{item.file}</strong>

              <span>
                {item.type} · {item.time}
              </span>
            </div>

            <div className="history-status">
              <Badge good={
  item.result.includes("AUTHENTIC") ||
  item.result.includes("REAL")
}>
                {item.result}
              </Badge>
            </div>

            <div className="history-confidence">
              <span>CONFIDENCE</span>

              <strong>{item.confidence}%</strong>
            </div>

            <button
              className="icon-btn"
              title="Download report"
              onClick={() => downloadReport(item)}
            >
              <Download size={16} />
            </button>

          </div>
        ))}
      </div>
    );
  }

  // --------------------------------------------------
  // ANALYSIS RESULT
  // --------------------------------------------------

  function ResultSection({ result: r, onDownload }) {
    const indicators = [
      ["Fake probability", r.fakeProbability],
      ["Real probability", r.realProbability]
    ];

    return (
      <>
        <div className="result-heading">

          <div>
            <div className="eyebrow">FORENSIC RESULT</div>

            <h2>Assessment complete</h2>
          </div>

          <button
            className="secondary-btn compact"
            onClick={onDownload}
          >
            <Download size={15} />
            DOWNLOAD REPORT
          </button>

        </div>

        <div className="result-grid">

          <Panel>

            <div className="eyebrow">
              MODEL CONFIDENCE
            </div>

            <div className="confidence-value">
              {r.confidence}
              <small>%</small>
            </div>

            <div className="muted">
              Detection confidence
            </div>

            <div className="result-divider" />

           <Badge good={
  r.result.includes("AUTHENTIC") ||
  r.result.includes("REAL")
}>
              {r.result}
            </Badge>

            <div className="result-file">
              <span>FILE</span>
              <strong>{r.file}</strong>
            </div>

            <div className="result-file">
              <span>TYPE</span>
              <strong>{r.type.toUpperCase()}</strong>
            </div>

            <div className="result-file">
              <span>TIME</span>
              <strong>{r.time}</strong>
            </div>

          </Panel>

          <Panel>

            <div className="eyebrow">
              MODEL PROBABILITIES
            </div>

            <div className="indicator-list">

              {indicators.map(([name, value]) => (
                <div className="indicator" key={name}>

                  <div>
                    <strong>{name}</strong>

                    <b>{value}%</b>
                  </div>

                  <div className="progress-track">
                    <div
                      style={{
                        width: `${value}%`
                      }}
                    />
                  </div>

                </div>
              ))}

            </div>

          </Panel>

        </div>

        <Panel className="notice-panel">

          <div className="eyebrow">
            INTERPRETATION NOTICE
          </div>

          <p>
            The displayed percentages represent the trained
            model's estimated probabilities. They should be
            treated as AI-assisted forensic evidence rather
            than definitive proof of manipulation.
          </p>

        </Panel>
      </>
    );
  }
  // --------------------------------------------------
  // OVERVIEW PAGE
  // --------------------------------------------------

  const renderOverview = () => {
    const fakeCount = history.filter(
      (item) => item.result !== "LIKELY AUTHENTIC"
    ).length;

    const realCount = history.length - fakeCount;

    return (
      <>
        <Header
          section="OVERVIEW"
          title="Media intelligence."
          description="Monitor your DeepTrace investigations and detection activity."
        />

        <div className="metrics-grid">

          <Metric
            label="TOTAL ANALYZED"
            value={history.length}
            note="Completed in this session"
          />

          <Metric
            label="POTENTIALLY MANIPULATED"
            value={fakeCount}
            note="Flagged by the model"
          />

          <Metric
            label="LIKELY AUTHENTIC"
            value={realCount}
            note="Flagged as authentic"
          />

          <Metric
            label="ACTIVE SESSION"
            value="ONLINE"
            note="Authenticated workspace"
          />

        </div>

        <Panel className="new-investigation">

          <div className="eyebrow">
            NEW INVESTIGATION
          </div>

          <div className="new-investigation-row">

            <div>
              <h2>Analyze suspicious media</h2>

              <p>
                Upload an image or audio file and let
                DeepTrace perform AI-assisted forensic analysis.
              </p>
            </div>

            <div className="quick-actions">

              <button
                className="primary-btn"
                onClick={() => {
                  setMediaType("Image");
                  go("Analyze");
                }}
              >
                <ImageIcon size={16} />
                START IMAGE ANALYSIS
              </button>

              <button
                className="secondary-btn"
                onClick={() => {
                  setMediaType("Audio");
                  go("Analyze");
                }}
              >
                <AudioLines size={16} />
                START AUDIO ANALYSIS
              </button>

            </div>

          </div>

        </Panel>

        <div className="section-heading">

          <div>
            <div className="eyebrow">
              WORKSPACE ACTIVITY
            </div>

            <h2>Recent investigations</h2>
          </div>

          <button
            className="text-btn"
            onClick={() => go("History")}
          >
            View history <ChevronRight size={15} />
          </button>

        </div>

        {history.length ? (
          <HistoryRows items={history.slice(0, 3)} />
        ) : (
          <EmptyState
            icon={<Activity size={20} />}
            title="No recent activity"
            text="Your latest investigations will appear here."
          />
        )}

      </>
    );
  };

  // --------------------------------------------------
  // ANALYZE PAGE
  // --------------------------------------------------

  const renderAnalyze = () => (
    <>
      <Header
        section="FORENSIC ANALYSIS"
        title="Analyze media."
        description="Upload evidence and inspect the model's forensic assessment."
      />

      <div className="field-label">
        MEDIA TYPE
      </div>

      <div className="segmented">

        <button
          className={mediaType === "Image" ? "active" : ""}
          onClick={() => {
            setMediaType("Image");
            removeFile();
          }}
        >
          <ImageIcon size={16} />
          Image
        </button>

        <button
          className={mediaType === "Audio" ? "active" : ""}
          onClick={() => {
            setMediaType("Audio");
            removeFile();
          }}
        >
          <AudioLines size={16} />
          Audio
        </button>

      </div>

      <input
        ref={fileInput}
        type="file"
        hidden
        accept={
          mediaType === "Image"
            ? "image/jpeg,image/png,image/webp"
            : "audio/wav,audio/mpeg,audio/ogg,audio/mp4"
        }
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {!file ? (

        <div
          className="upload-zone"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0]);
          }}
        >

          <div className="upload-icon">
            {mediaType === "Image" ? (
              <FileImage size={25} />
            ) : (
              <FileAudio size={25} />
            )}
          </div>

          <h2>Drop your evidence here</h2>

          <p>
            Drag and drop your {mediaType.toLowerCase()} file,
            or{" "}
            <button
              className="inline-link"
              onClick={(e) => {
                e.stopPropagation();
                fileInput.current?.click();
              }}
            >
              browse files
            </button>.
          </p>

          <div className="upload-meta">

            <span>
              <ShieldCheck size={13} />
              SECURE BACKEND PROCESSING
            </span>

            <span>
              {mediaType === "Image"
                ? "JPG · JPEG · PNG · WEBP"
                : "WAV · MP3 · OGG · M4A"}
            </span>

          </div>

        </div>

      ) : (

        <div className="analysis-grid">

          <div>

            <div className="eyebrow block-label">
              MEDIA PREVIEW
            </div>

            <Panel className="preview-panel">

              {mediaType === "Image" && preview ? (

                <img
                  className="media-preview"
                  src={preview}
                  alt="Uploaded evidence preview"
                />

              ) : (

                <div className="audio-preview">

                  <div className="audio-art">
                    <AudioLines size={30} />
                  </div>

                  <div>
                    <strong>{file.name}</strong>
                    <span>Audio evidence selected</span>
                  </div>

                </div>

              )}

              <div className="file-details">

                <div>
                  <strong>{file.name}</strong>

                  <span>
                    {file.type || mediaType} ·{" "}
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>

                <button
                  className="icon-btn"
                  title="Remove file"
                  onClick={removeFile}
                >
                  <X size={16} />
                </button>

              </div>

            </Panel>

          </div>

          <div>

            <div className="eyebrow block-label">
              ANALYSIS ENGINE
            </div>

            <Panel className="engine-panel">

              <div className="engine-title">

                <div className="engine-icon">
                  <Fingerprint size={21} />
                </div>

                <div>
                  <strong>
  {mediaType === "Image"
    ? "ResNet50 · PyTorch"
    : "Wav2Vec2 · PyTorch"}
</strong>
                </div>

              </div>

              <div className="engine-detail">
  <span>MODEL</span>
  <strong>
    {mediaType === "Image"
      ? "ResNet50 Classifier"
      : "Wav2Vec2 Audio Classifier"}
  </strong>
</div>

<div className="engine-detail">
  <span>ANALYSIS</span>
  <strong>Fake / Real Classification</strong>
</div>

              <div className="engine-ready">
                <span className="pulse-dot" />
                ENGINE READY
              </div>

             <button
  className="primary-btn full-btn"
  disabled={busy}
  onClick={runAnalysis}
>
  <ScanSearch size={16} />

  {busy
    ? "ANALYZING EVIDENCE..."
    : "RUN FORENSIC ANALYSIS"}
</button>

              {busy && (

                <div className="progress-wrap">

                  <div className="progress-copy">
                    <span>{stage}</span>
                    <b>{progress}%</b>
                  </div>

                  <div className="progress-track">
                    <div
                      style={{
                        width: `${progress}%`
                      }}
                    />
                  </div>

                </div>

              )}

             <p className="demo-note">
  {mediaType === "Image"
    ? "Image detection powered by your trained ResNet50 model."
    : "Audio detection powered by your trained Wav2Vec2 model."}
</p>

            </Panel>

          </div>

        </div>

      )}

      {result && (
        <ResultSection
          result={result}
          onDownload={() => downloadReport(result)}
        />
      )}

      {!file && (

        <div className="security-note">

          <ShieldCheck size={16} />

          <span>
            <strong>Your evidence stays yours.</strong>
            {" "}Files are sent to your authenticated DeepTrace
            backend only when you run an analysis.
          </span>

        </div>

      )}

    </>
  );

  // --------------------------------------------------
  // HISTORY PAGE
  // --------------------------------------------------

  const renderHistory = () => (
    <>
      <Header
        section="INVESTIGATION LOG"
        title="Investigation history."
        description="Review previously analyzed media."
      />

      <div className="history-toolbar">

        <div className="search-box">
          <Search size={16} />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename..."
          />
        </div>

        <span>
          {filteredHistory.length} CASE
          {filteredHistory.length === 1 ? "" : "S"}
        </span>

      </div>

      {filteredHistory.length ? (

        <HistoryRows items={filteredHistory} />

      ) : (

        <EmptyState
          icon={<FolderClock size={20} />}
          title={
            history.length
              ? "No matching investigations"
              : "No investigations yet."
          }
          text={
            history.length
              ? "Try another filename."
              : "Run a forensic analysis to start building your investigation log."
          }
        />

      )}

    </>
  );

  // --------------------------------------------------
  // REPORTS PAGE
  // --------------------------------------------------

  const renderReports = () => {
    const latest = history[0];

    return (
      <>
        <Header
          section="REPORTS"
          title="Forensic reports."
          description="Generate a report from your latest investigation."
        />

        {latest ? (

          <Panel className="report-card">

            <div className="report-top">

              <div>
                <div className="eyebrow">
                  LATEST CASE
                </div>

                <h2>{latest.file}</h2>

                <p>
                  {latest.type} · {latest.time}
                </p>
              </div>

              <div className="report-icon">
                <FileText size={24} />
              </div>

            </div>

            <div className="rule" />

            <div className="report-summary">

              <div>
                <span>MODEL CONFIDENCE</span>

                <strong className="report-score">
                  {latest.confidence}%
                </strong>
              </div>

              <div>
                <span>CLASSIFICATION</span>

                <Badge good={latest.result === "LIKELY AUTHENTIC"}>
                  {latest.result}
                </Badge>
              </div>

            </div>

            <button
              className="primary-btn full-btn"
              onClick={() => downloadReport(latest)}
            >
              <Download size={16} />
              GENERATE FORENSIC REPORT
            </button>

          </Panel>

        ) : (

          <EmptyState
            icon={<FileText size={20} />}
            title="No reports available"
            text="Run an analysis first to generate a forensic report."
          />

        )}

      </>
    );
  };

  // --------------------------------------------------
  // ACCOUNT PAGE
  // --------------------------------------------------

  const renderAccount = () => (
    <>
      <Header
        section="ACCOUNT"
        title="Account settings."
        description="View your authenticated DeepTrace investigator profile."
      />

      <Panel className="account-panel">

        <div className="account-heading">

          <div className="avatar large">
            {profileName
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div>
            <h2>Investigator profile</h2>

            <p>
              <span className="pulse-dot" />
              AUTHENTICATED
            </p>
          </div>

        </div>

        <div className="rule" />

        <label className="form-label">
          DISPLAY NAME

          <input
            value={profileName}
            readOnly
          />
        </label>

        <label className="form-label">
          EMAIL

          <input
            value={email}
            readOnly
          />
        </label>

        <div className="saved-message">
          <ShieldCheck size={15} />
          Your account is authenticated.
        </div>

      </Panel>

    </>
  );

  // --------------------------------------------------
  // HELP PAGE
  // --------------------------------------------------

  const renderHelp = () => {

    const steps = [
      ["01", "UPLOAD", "Upload an image or audio file."],
      ["02", "PREPROCESS", "The media is prepared for forensic analysis."],
      ["03", "MODEL ANALYSIS", "The detection model evaluates manipulation patterns."],
      ["04", "FORENSIC RESULT", "DeepTrace presents model confidence and probabilities."]
    ];

    return (
      <>
        <Header
          section="DOCUMENTATION"
          title="How DeepTrace works."
          description="Understand the forensic analysis pipeline."
        />

        <div className="help-steps">

          {steps.map(([number, title, description]) => (

            <Panel className="help-step" key={number}>

              <div className="step-number">
                {number} <span>/ {title}</span>
              </div>

              <h2>{title}</h2>

              <p>{description}</p>

            </Panel>

          ))}

        </div>

        <Panel className="notice-panel">

          <div className="eyebrow">
            IMPORTANT
          </div>

          <p>
            DeepTrace is designed as an AI-assisted media
            review tool. A model score is not a definitive
            determination of authenticity. Review source
            provenance and other evidence before drawing
            conclusions.
          </p>

        </Panel>

      </>
    );
  };

  // --------------------------------------------------
  // PAGE ROUTING
  // --------------------------------------------------

  const pageContent = {
    Overview: renderOverview,
    Analyze: renderAnalyze,
    History: renderHistory,
    Reports: renderReports,
    Account: renderAccount,
    Help: renderHelp
  };

  // --------------------------------------------------
  // AUTHENTICATION LOADING
  // --------------------------------------------------

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#06110f",
          color: "#c8f66b",
          display: "grid",
          placeItems: "center"
        }}
      >
        Checking secure DeepTrace session...
      </div>
    );
  }

  // --------------------------------------------------
  // LOGIN / SIGNUP
  // --------------------------------------------------

  if (!authUser) {
    return (
      <AuthPage
        onAuthenticated={(user) => {
          setAuthUser(user);
          setProfileName(user.name);
          setEmail(user.email);
          setPage("Overview");
        }}
      />
    );
  }

  // --------------------------------------------------
  // MAIN APPLICATION
  // --------------------------------------------------

  return (
    <div className="app-shell">

      {mobileOpen && (
        <div
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>

        <div className="brand">

          <div className="brand-mark">
            <Fingerprint size={21} />
          </div>

          <div>
            <div className="brand-name">
              DEEPTRACE
            </div>

            <div className="brand-subtitle">
              DIGITAL MEDIA FORENSICS
            </div>
          </div>

          <button
            className="mobile-close icon-btn"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>

        </div>

        <div className="side-rule" />

        {navGroups.map((group) => (

          <div className="nav-group" key={group.label}>

            <div className="nav-label">
              {group.label}
            </div>

            {group.items.map(([label, Icon]) => (

              <button
                key={label}
                className={`nav-item ${page === label ? "selected" : ""}`}
                onClick={() => go(label)}
              >

                <Icon size={17} />

                <span>{label}</span>

                {page === label && (
                  <span className="nav-active-dot" />
                )}

              </button>

            ))}

          </div>

        ))}

        <div className="sidebar-bottom">

          <div className="side-rule" />

          <div className="user-card">

            <div className="avatar">
              {profileName
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div className="user-info">
              <strong>{profileName}</strong>
              <span>INVESTIGATOR</span>
            </div>

            <span className="online-dot" />

          </div>

          <button
            className="text-btn"
            onClick={handleLogout}
            style={{ marginTop: "12px" }}
          >
            SIGN OUT
          </button>

          <div className="version">
            DEEPTRACE WORKSPACE
            <span>v1.0.0</span>
          </div>

        </div>

      </aside>

      <main className="main-area">

        <div className="mobile-topbar">

          <button
            className="icon-btn"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>

          <span>DEEPTRACE</span>

          <div className="avatar">
            {profileName.slice(0, 2).toUpperCase()}
          </div>

        </div>

        <div className="topbar">

          <div className="breadcrumb">
            <span>WORKSPACE</span>

            <ChevronRight size={13} />

            <strong>{page.toUpperCase()}</strong>
          </div>

          <div className="topbar-right">

            <div className="system-status">
              <span className="pulse-dot" />
              ALL SYSTEMS OPERATIONAL
            </div>

            <div className="topbar-avatar">
              {profileName.slice(0, 2).toUpperCase()}
            </div>

          </div>

        </div>

        <div className="content-wrap">
          {pageContent[page]?.()}
        </div>

        <footer className="app-footer">

          <span>
            DEEPTRACE <b>·</b> DIGITAL MEDIA FORENSICS
          </span>

          <span>
            BUILT FOR INVESTIGATION <b>·</b> 2026
          </span>

        </footer>

      </main>

    </div>
  );
}

export default App;