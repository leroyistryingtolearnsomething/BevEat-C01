import { useEffect, useState } from "react";
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

    const [error, setError] = useState("");

    useEffect(()=>{
        getDishPhotos(token, itemId).then((d)=> setPhotos(d.photos)).catch((err) => setError(err.message));
        getDish(token, itemId).then((data)=> setDishName(data.dish.name)).catch(() => {});
    }, [itemId]);

    function toggleHeart(p){
        const call = p.likedByMe ? unvotePhoto : votePhoto;
            call(token, p.photo)
                .then((res)=>{
                    setPhotos(photos.map((x)=> (x.photo === p.photo ?  {...x,
                        hearts: res.hearts, likedByMe: res.likedByMe } : x)));
                })
                .catch ((err)=> setError(err.message));
    }

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
                  className={p.likedByMe ? "dp-heart dp-heart--liked" : "dp-heart"}
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

      </main>
    )
}