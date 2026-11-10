import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deletePhoto, getMyDishes, uploadPhoto } from "../api.js";
import { getSession } from "../session.js";
import BackCircle from "../components/menu/BackCircle.jsx"
import {useCamera, snapVideo, shrinkFile} from "../camera.js"
import "./kidMenu.css";


export default function Snap() { // a page is a function that returns html
    const {token} = getSession();
    const [params] = useSearchParams();
    const [dishes, setDishes] = useState(null);
    const [itemId, setItemId] = useState(null);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");    // "" | "sending" | "sent" | "error"
    const [message, setMessage] = useState("");  // the error text, if something fails
    const videoRef =  useRef(null);
    const [facing, setFacing] = useState("environment");
    const [photo, setPhoto] = useState(null);
    const [preview, setPreview] = useState("");
    const [result, setResult] = useState(null); //what the upload sent back: {photo, check}
    const camError = useCamera(videoRef, facing, !photo && dishes?.length > 0);
    useEffect(() => {
        getMyDishes(token)
            .then((data) => {                                   // ← { opens: several lines run when the data arrives
                setDishes(data.dishes);                         //   1. put the list in the box

                const fromUrl = Number(params.get("item"));     //   2. the dish number in the URL (if any)
                const match = data.dishes.find((d) => d.item === fromUrl);
                setItemId(match ? match.item : data.dishes[0]?.item);   // 3. pick that dish, or the newest one
            })                                                  // ← } closes the {,  ) closes .then(
            .catch((err) => setError(err.message));             // if it fails, show the error
    }, []);                                                     // [] = only once, when the page opens

    
    if (error) return <main className="screen kid snap-kid"><p>{error}</p></main>;
  if (!dishes) return <main className="screen kid snap-kid"><p>Loading…</p></main>;

  // TODO 2: if dishes.length === 0, return the "nothing ordered" screen:
  if (dishes.length === 0) return(
  <main className="screen kid snap-kid">
  <div className="sn-empty"> <p>Order something first, then snap it! 🍜</p>
  <BackCircle to="/kid/home" />
  </div>
  </main>
  )

function keepPhoto(blob) {
  setPhoto(blob);
  setPreview(URL.createObjectURL(blob));
  setStatus("sending");

  const dish = dishes.find((d) => d.item === itemId);   // the picked dish, which also has its order number
  uploadPhoto(token, blob, dish.item, dish.order)
    .then((data) => {
  setStatus("sent");
  setResult(data);      // this makes the page switch to the "AI says yum" screen
})
    .catch(showError);
}

function showError(err) {
  setStatus("error");
  setMessage(err.message);
}

function retake(){
  if (result) deletePhoto(token, result.photo.photo).catch(() =>
  {});
    setResult(null);
    setPhoto(null);
    setStatus("");
}

if (result) {
  const check = result.check;                               // the AI's 3 answers (null if Bao couldn't check)
  const passed = result.photo.aiStatus === "passed";
  const dish = dishes.find((d) => d.item === itemId);       // for its name
    const rows = check ? [
    {
      ok: check.isFood,
      title: check.isFood ? "It's food!" : "Hmm, that's not food",
      note: `Bao is ${check.confidence}% sure`,
    },
    {
      ok: check.matchesDish,
      title: check.matchesDish ? `Looks like ${dish.dish}` : `Doesn't look like ${dish.dish}`,
      note: check.matchesDish ? "Matches what you ordered" : `Bao sees: ${check.label}`,
    },
    {
      ok: !check.hasFaces,
      title: check.hasFaces ? "There's a face in the pic" : "No faces in the pic",
      note: check.hasFaces ? "Take one with just the food" : "Keeps everyone private",
    },
  ] : [{
    ok: false, title: "Bao couldn't check your pic", note: "Please try again in a moment"
  }, ];
  

  return (
    <main className="screen kid yum-kid">
      <div className="blob blob--yum" aria-hidden="true" />
      <div className="yum-head"><BackCircle to="/kid/home" /></div>

      <div className="yum-polaroid">
        <span className={passed ? "yum-sticker" : "yum-sticker yum-sticker--bad"}>
          {passed ? "✓ YUM! It's food" : "✕ Hmm, try again"}
        </span>
        <div className="yum-polaroid__card">
          <img src={preview} alt="Your photo" />
          <p>My {dish.dish}!</p>
        </div>
      </div>

      <section className="yum-checks"> 
      {
        rows.map((r) => (
          <div key={r.title} className={r.ok ? "yum-row" : "yum-row yum-row--bad"}>
            <span className={r.ok ? "yum-dot" : "yum-dot yum-dot--bad"}>{r.ok ? "✓" : "✕"}</span>
            <div>
              <h3>{r.title}</h3>
              <p>{r.note}</p>
            </div>
          </div>
        ))
      }
      
      </section>

      <div className="yum-footer">
      {passed ? (
          <>
            <Link to="/kid/home" className="yum-post">Post my pic!</Link>
            <button className="yum-retake" onClick={retake}>Retake</button>
          </>
        ) : (
          <button className="yum-post" onClick={retake}>Try again 📷</button>
        )}
      </div>
    </main>
  );
}

  //That’s a whole working page. React calls the function and puts what it returns on the screen.
  // The HTML-looking part is called JSX. It’s basically HTML, except class is written className.
  // {} means its javascript
  return (
    <main className="screen kid snap-kid">
      <header className="sn-head">
        <BackCircle to="/kid/home" />
        <h1>Snap your food!</h1>
      </header>

      <label className="sn-dish">
        📸 Snapping:
        <select value={itemId} onChange={(e) => setItemId(Number(e.target.value))} disabled={!!photo}>
          {dishes.map((d) => (
            <option key={d.item} value={d.item}>{d.dish}</option>
          ))}
        </select>
      </label>

      <div className="sn-viewfinder">
        {photo ? (
  <img src={preview} alt="Your photo" />
    ) : (
  <video ref={videoRef} playsInline muted />
)}
{camError && !photo && <p className="sn-viewfinder__msg">{camError}</p>}
        <span className="sn-hint">Point at your food</span>
        <div className="sn-scan">
          <span className="sn-scan__corner sn-scan__corner--tl" />
          <span className="sn-scan__corner sn-scan__corner--tr" />
          <span className="sn-scan__corner sn-scan__corner--bl" />
          <span className="sn-scan__corner sn-scan__corner--br" />
          <span className="sn-scan__line" />
        </div>
      </div>
{status === "sending" && <p className="sn-status">⏳ Sending your photo…</p>}
{status === "sent" && <p className="sn-status">✨ Bao is checking it's food…</p>}
{status === "error" && <p className="sn-status sn-status--error">⚠️ {message}</p>}

<div className="sn-controls">
  <label className="sn-round" aria-label="Pick from gallery">
    🖼️
    <input type="file" accept="image/*"
      onChange={(e) => {
  const file = e.target.files[0];
  e.target.value = "";                        // reset, so picking the same photo again still works
  if (file) shrinkFile(file).then(keepPhoto).catch(showError);
}}/>
  </label>

  <button className="sn-shutter" aria-label="Take photo" disabled={!!photo}
    onClick={() => snapVideo(videoRef.current).then(keepPhoto).catch(showError)} />

  {photo ? (
    <button className="sn-round" aria-label="Retake" onClick={() => {setPhoto(null), setStatus("");}}>↩️
    </button>
  ) : (
    <button className="sn-round" aria-label="Flip camera"
      onClick={() => setFacing(facing === "user" ? "environment" : "user")}>🔄</button>
  )}
</div>
    </main>
  );
}
