"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type ScanResult = {
  name: string;
  distillery?: string;
  price?: string;
  tastingNotes: string[];
  verdict: string;
  rating?: string;
  palateMatch?: string;
};

type ScanCandidate = {
  name: string;
  distillery?: string;
  hint?: string;
};

type ApiResponse =
  | { type: "result"; data: ScanResult }
  | { type: "ambiguous"; question: string; candidates: ScanCandidate[] }
  | { type: "not_found"; message: string }
  | { error: string };

type Mode = "camera" | "text";
type Phase = "idle" | "preview" | "loading" | "result" | "ambiguous" | "not_found" | "error";

export function WhiskyScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("camera");
  const [phase, setPhase] = useState<Phase>("idle");
  const [capturedDataUrl, setCapturedDataUrl] = useState<string>("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [disambigQuestion, setDisambigQuestion] = useState<string>("");
  const [notFoundMsg, setNotFoundMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [textQuery, setTextQuery] = useState<string>("");
  const [addingStatus, setAddingStatus] = useState<"owned" | "wishlist" | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("Camera not available. Use the upload button below.");
    }
  }, []);

  useEffect(() => {
    if (mode === "camera" && phase === "idle") {
      void startCamera();
    }
    return stopStream;
  }, [mode, phase, startCamera, stopStream]);

  function switchMode(next: Mode) {
    stopStream();
    setMode(next);
    reset(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    stopStream();
    setCapturedDataUrl(dataUrl);
    setPhase("preview");
    void runImageScan(dataUrl);
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      stopStream();
      setCapturedDataUrl(dataUrl);
      setPhase("preview");
      void runImageScan(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function runImageScan(dataUrl: string) {
    setPhase("loading");
    const base64 = dataUrl.split(",")[1];
    const mimeType = dataUrl.split(";")[0].split(":")[1] ?? "image/jpeg";
    await callScanApi({ imageBase64: base64, imageMimeType: mimeType });
  }

  async function handleTextSearch(e: FormEvent) {
    e.preventDefault();
    const q = textQuery.trim();
    if (!q) return;
    setPhase("loading");
    await callScanApi({ query: q });
  }

  async function handleCandidatePick(candidate: ScanCandidate) {
    setPhase("loading");
    await callScanApi({ query: candidate.name });
  }

  async function callScanApi(body: Record<string, string>) {
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = (await res.json()) as ApiResponse;

      if ("error" in data) {
        setErrorMsg(data.error);
        setPhase("error");
        return;
      }

      if (data.type === "result") {
        setResult(data.data);
        setPhase("result");
      } else if (data.type === "ambiguous") {
        setCandidates(data.candidates);
        setDisambigQuestion(data.question);
        setPhase("ambiguous");
      } else {
        setNotFoundMsg(data.message);
        setPhase("not_found");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Scan failed. Try again.");
      setPhase("error");
    }
  }

  async function handleQuickAdd(status: "owned" | "wishlist") {
    if (!result) return;
    setAddingStatus(status);
    try {
      const res = await fetch("/api/scan/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name,
          distilleryName: result.distillery,
          tastingNotes: result.tastingNotes,
          description: result.verdict,
          status
        })
      });
      if (!res.ok) throw new Error("Could not add bottle.");
      const { itemId } = (await res.json()) as { itemId: string };
      window.location.assign(`/collection/${itemId}`);
    } catch {
      setAddingStatus(null);
    }
  }

  function reset(restartCamera = true) {
    setResult(null);
    setCandidates([]);
    setDisambigQuestion("");
    setNotFoundMsg("");
    setErrorMsg("");
    setCapturedDataUrl("");
    setAddingStatus(null);
    setPhase("idle");
    if (restartCamera && mode === "camera") {
      void startCamera();
    }
  }

  const isLoading = phase === "loading" || phase === "preview";

  return (
    <div className="scanner-wrap">
      {/* Mode tabs */}
      <div className="scanner-tabs">
        <button
          className={`scanner-tab${mode === "camera" ? " scanner-tab-active" : ""}`}
          onClick={() => switchMode("camera")}
          type="button"
        >
          Camera
        </button>
        <button
          className={`scanner-tab${mode === "text" ? " scanner-tab-active" : ""}`}
          onClick={() => switchMode("text")}
          type="button"
        >
          Search by name
        </button>
      </div>

      {/* Camera mode */}
      {mode === "camera" && phase === "idle" && (
        <>
          <div className="scanner-viewfinder">
            {!cameraError ? (
              <video autoPlay className="scanner-video" muted playsInline ref={videoRef} />
            ) : (
              <div className="scanner-no-camera">
                <p className="muted">{cameraError}</p>
              </div>
            )}
          </div>
          <div className="scanner-controls">
            {!cameraError && (
              <button
                aria-label="Capture photo"
                className="scanner-capture-btn"
                onClick={captureFrame}
                type="button"
              />
            )}
            <label className="button-subtle scanner-upload-btn" htmlFor="scan-upload">
              {cameraError ? "Upload photo" : "Upload instead"}
            </label>
            <input
              accept="image/*"
              className="sr-only"
              id="scan-upload"
              onChange={handleFileUpload}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </>
      )}

      {/* Camera loading / preview */}
      {mode === "camera" && isLoading && capturedDataUrl && (
        <div className="scanner-viewfinder">
          <Image
            alt="Captured bottle"
            className="scanner-captured"
            height={480}
            src={capturedDataUrl}
            unoptimized
            width={640}
          />
          <div className="scanner-overlay">
            <span className="scanner-spinner" />
            <p>Identifying whisky...</p>
          </div>
        </div>
      )}

      {/* Text search mode */}
      {mode === "text" && (phase === "idle" || phase === "not_found" || phase === "error") && (
        <form className="scanner-search-form" onSubmit={(e: FormEvent) => void handleTextSearch(e)}>
          <div className="scanner-search-row">
            <input
              autoComplete="off"
              autoFocus
              className="scanner-search-input"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTextQuery(e.target.value)}
              placeholder="e.g. Springbank 15, Boplaas 8 Year..."
              type="text"
              value={textQuery}
            />
            <button className="button" disabled={!textQuery.trim()} type="submit">
              Search
            </button>
          </div>
          <p className="scanner-search-hint muted">
            Be as specific as you can. If there are multiple expressions, you'll get to pick.
          </p>
          {phase === "not_found" && (
            <p className="status-note status-note-error">{notFoundMsg}</p>
          )}
          {phase === "error" && (
            <p className="status-note status-note-error">{errorMsg}</p>
          )}
        </form>
      )}

      {/* Text search loading */}
      {mode === "text" && phase === "loading" && (
        <div className="scanner-text-loading">
          <span className="scanner-spinner" />
          <p>Searching for "{textQuery}"...</p>
        </div>
      )}

      {/* Disambiguation */}
      {phase === "ambiguous" && (
        <div className="scanner-disambig">
          <p className="scanner-disambig-question">{disambigQuestion}</p>
          <div className="scanner-candidates">
            {candidates.map((c: ScanCandidate) => (
              <button
                className="scanner-candidate"
                key={c.name}
                onClick={() => void handleCandidatePick(c)}
                type="button"
              >
                <span className="scanner-candidate-name">{c.name}</span>
                {(c.distillery || c.hint) && (
                  <span className="scanner-candidate-meta muted">
                    {[c.distillery, c.hint].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button className="scanner-reset" onClick={() => reset()} type="button">
            Start over
          </button>
        </div>
      )}

      {/* Result */}
      {phase === "result" && result && (
        <div className="scanner-result">
          <div className="scanner-result-header">
            <div>
              <h2 className="scanner-result-name">{result.name}</h2>
              {result.distillery && result.distillery !== result.name && (
                <p className="muted">{result.distillery}</p>
              )}
            </div>
            <div className="scanner-result-badges">
              {result.rating && <span className="pill">{result.rating}</span>}
              {result.price && <span className="scanner-price">{result.price}</span>}
            </div>
          </div>

          {result.palateMatch && (
            <div className="scanner-palate-match">
              <span className="scanner-palate-icon" aria-hidden="true">◆</span>
              {result.palateMatch}
            </div>
          )}

          <div className="scanner-notes">
            {result.tastingNotes.map((note: string) => (
              <span className="pill" key={note}>{note}</span>
            ))}
          </div>

          {result.verdict && <p className="scanner-verdict">{result.verdict}</p>}

          <div className="scanner-actions">
            <button
              className="button"
              disabled={addingStatus !== null}
              onClick={() => void handleQuickAdd("owned")}
              type="button"
            >
              {addingStatus === "owned" ? "Adding..." : "Add to Collection"}
            </button>
            <button
              className="button-subtle"
              disabled={addingStatus !== null}
              onClick={() => void handleQuickAdd("wishlist")}
              type="button"
            >
              {addingStatus === "wishlist" ? "Adding..." : "Add to Wishlist"}
            </button>
          </div>

          <button className="scanner-reset" onClick={() => reset()} type="button">
            {mode === "camera" ? "Scan another" : "Search another"}
          </button>
        </div>
      )}
    </div>
  );
}
