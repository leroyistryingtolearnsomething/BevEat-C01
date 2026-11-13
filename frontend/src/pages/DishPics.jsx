import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import{ getDish, getDishPhotos, votePhoto, unvotePhoto} from "../api.js"
import { getSession } from "../session.js";
import BackCircle from "../components/menu/BackCircle.jsx"
import heartVote from "../assets/figma/menu/heart-vote.svg";
import heartVoteLiked from "../assets/figma/menu/heart-vote-liked.svg";
import "./kidMenu.css";

export default function DishPics(){
    const {token} = getSession();
    const { itemId } = useParams();

    const [dishName, setDishName ] = useState("");
    const [photos, setPhotos] = useState(null);

    const [error, setError] = useState(""); // the pics could not load: nothing to show
    const [voteError, setVoteError] = useState(""); // one heart failed: a small message, the pics stay
    const [popId, setPopId] = useState(null); // the pic whose heart was just tapped on: it pops once
    const inFlight = useRef(new Set()); // photos with a vote on its way, so a second tap cannot race the first

    useEffect(()=>{
        getDishPhotos(token, itemId).then((d)=> setPhotos(d.photos)).catch((err) => setError(err.message));
        getDish(token, itemId).then((data)=> setDishName(data.dish.name)).catch(() => {});
    }, [itemId]);

    // The heart answers on the same frame (optimistic). If the server says no, it goes back and a message appears.
    function toggleHeart(p){
        if (inFlight.current.has(p.photo)) return;
        inFlight.current.add(p.photo);
        const liked = !p.likedByMe;
        if (liked) setPopId(p.photo);
        const patch = (change) => setPhotos((list) => list.map((x) => (x.photo === p.photo ? { ...x, ...change(x) } : x)));
        patch((x) => ({ likedByMe: liked, hearts: x.hearts + (liked ? 1 : -1) }));
        (liked ? votePhoto : unvotePhoto)(token, p.photo)
            .then((res) => patch(() => ({ hearts: res.hearts, likedByMe: res.likedByMe })))
            .catch((err) => {
                patch((x) => ({ likedByMe: !liked, hearts: x.hearts + (liked ? -1 : 1) }));
                setVoteError(err.message);
            })
            .finally(() => inFlight.current.delete(p.photo));
    }

    useEffect(() => { // the message goes away by itself
        if (!voteError) return undefined;
        const timer = setTimeout(() => setVoteError(""), 4000);
        return () => clearTimeout(timer);
    }, [voteError]);

    if (error) return <main className="screen kid dp-kid"><p>{error}</p></main>;
    if (!photos) return <main className="screen kid dp-kid"><p>Loading...</p></main>;

    return(
        <main className = "screen kid dp-kid">
            <header className="dp-head">
                <BackCircle to={`/kid/dishes/${itemId}`} back/>
                <div>
                    <h1>{dishName || "All pics"}</h1>
                    <p>{photos.length} {photos.length === 1 ? "pic" : "pics"} · tap ❤️ for your favourite</p>
                </div>
            </header>

      {photos.length === 0 ? (
        <div className="dp-empty">
          <p>No pics yet. Be the first! 📸</p>
          <Link to={`/kid/snap?item=${itemId}`} className="dp-snap">Snap this dish</Link>
        </div>
      ) : (
        <div className="dp-grid">
            {photos.map((p, i) => (
            <article key={p.photo} className="dp-card">
              {i === 0 && p.hearts > 0 && <span className="dp-top">👑 Top pic</span>}
              <img className="dp-photo" src={p.imageUrl} alt={`Pic by ${p.uploaderUsername}`} />
              <div className="dp-meta">
                <span className="dp-by">by @{p.uploaderUsername}</span>
                <button
                  className={`dp-heart${p.likedByMe ? " dp-heart--liked" : ""}${popId === p.photo ? " dp-heart--pop" : ""}`}
                  onAnimationEnd={(e) => { if (e.target === e.currentTarget) setPopId(null); }} // the ring (on the button itself) is the last to finish
                  onClick={() => toggleHeart(p)}
                  disabled={p.mine}
                  aria-label={p.mine ? "Your pic" : "Heart this pic"}
                >
                  <img src={p.likedByMe ? heartVoteLiked : heartVote} alt="" /> {p.hearts}
                </button>
              </div>
            </article>
          ))}
        </div>
            
        
      )}

      {voteError && <p className="dp-toast" role="alert">{voteError}</p>}

      </main>
    )
}