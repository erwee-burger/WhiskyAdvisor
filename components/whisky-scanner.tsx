"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
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

type Phase = "camera" | "preview" | "loading" | "result" | "error";

export function WhiskyScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("camera");
  const [capturedDataUrl, setCapturedDataUrl] = useState<string>("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
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
    if (phase === "camera") {
      void startCamera();
    }
    return stopStream;
  }, [phase, startCamera, stopStream]);

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
    void runScan(dataUrl);
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
      void runScan(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function runScan(dataUrl: string) {
    setPhase("loading");
    try {
      const base64 = dataUrl.split(",")[1];
      const mimeType = dataUrl.split(";")[0].split(":")[1] ?? "image/jpeg";

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType })
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        throw new Error(error ?? "Scan failed.");
      }

      const data = (await res.json()) as ScanResult;
      setResult(data);
      setPhase("result");
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

  function reset() {
    setResult(null);
    setErrorMsg("");
    setCapturedDataUrl("");
    setAddingStatus(null);
    setPhase("camera");
  }

  return (
    <div className="scanner-wrap">
      {(phase === "camera" || phase === "preview" || phase === "loading") && (
        <div className="scanner-viewfinder">
          {phase === "camera" && !cameraError && (
            <video
              autoPlay
              className="scanner-video"
              muted
              playsInline
              ref={videoRef}
            />
          )}

          {phase === "camera" && cameraError && (
            <div className="scanner-no-camera">
              <p className="muted">{cameraError}</p>
            </div>
          )}

          {(phase === "preview" || phase === "loading") && capturedDataUrl && (
            <Image
              alt="Captured bottle"
              className="scanner-captured"
              height={480}
              src={capturedDataUrl}
              unoptimized
              width={640}
            />
          )}

          {phase === "loading" && (
            <div className="scanner-overlay">
              <span className="scanner-spinner" />
              <p>Identifying whisky...</p>
            </div>
          )}
        </div>
      )}

      {phase === "camera" && (
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
      )}

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

          <button className="scanner-reset" onClick={reset} type="button">
            Scan another
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="scanner-error">
          <p className="status-note status-note-error">{errorMsg}</p>
          <button className="button-subtle" onClick={reset} type="button">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
