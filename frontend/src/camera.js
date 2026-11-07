// Camera helpers for the Snap your food page (Gabriel).
// The browser camera API is awkward, so it lives here; Snap.jsx just uses these 3 things:
//   useCamera(videoRef, facing, on)  -> starts/stops the live camera in a <video>, returns an error message or ""
//   snapVideo(video)                 -> takes a picture of what the <video> shows right now (a JPEG Blob)
//   shrinkFile(file)                 -> turns a photo picked from the gallery into a small JPEG Blob
// Both pictures are shrunk to max 1080px / ~200 KB so uploads are fast and fit under Vercel's 4.5 MB limit.
import { useEffect, useState } from "react";

const MAX_SIDE = 1080; // longest side of the saved photo, in pixels
const QUALITY = 0.8;   // JPEG quality, 0..1

// Live camera inside a <video>. Runs again when `facing` or `on` changes, and switches the old camera off.
// facing: "environment" = back camera, "user" = front (selfie) camera
// on: false = keep the camera off (e.g. while showing the photo you just took)
export function useCamera(videoRef, facing, on) {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!on) return;
    let stream = null;
    let cancelled = false; // the page may close before the camera finishes starting

    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      // camera only works on https:// pages or localhost
      setError("This browser can't open the camera here. Pick a photo from your gallery instead.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) return stopStream(s); // too late, the page moved on
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;          // show the camera in the <video>
        video.play().catch(() => {}); // some phones need this nudge
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.name === "NotAllowedError"
            ? "Camera is blocked. Allow camera access, or pick a photo from your gallery."
            : "Couldn't open the camera. Pick a photo from your gallery instead."
        );
      });

    // "cleanup": React runs this when the page closes or before running the effect again
    return () => {
      cancelled = true;
      stopStream(stream); // turns the camera (and its light) off
    };
  }, [facing, on]);

  return error;
}

function stopStream(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}

// Take a picture of the current camera frame
export function snapVideo(video) {
  return toJpeg(video, video.videoWidth, video.videoHeight);
}

// Shrink a photo picked from the gallery (phones' photos are often 3-8 MB)
export async function shrinkFile(file) {
  const bitmap = await createImageBitmap(file); // decodes the image, keeps it the right way up
  try {
    return await toJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    if (bitmap.close) bitmap.close();
  }
}

// Draw the picture onto an invisible <canvas> at a smaller size, then save it as a JPEG
function toJpeg(source, width, height) {
  if (!width || !height) return Promise.reject(new Error("The camera isn't ready yet. Try again."));
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't save the photo."))), "image/jpeg", QUALITY)
  );
}
