const photoModel = require("../models/photoModel");
const supabase = require("../../config/supabase");
const aiCheck = require("../services/aiCheck");

async function getMyDishes(req, res, next) {
    try{
        const childId = req.user.id;

        const rows = await photoModel.getMyDishes(childId);

        const dishes = rows.map((d) => ({
            item : d.item_id,
            order: d.order_id,
            dish : d.name,
            imageUrl: d.default_image_url
        }));
    
        res.json({
            dishes
        })
    }
    catch (err){
        next(err);
    }
}

async function createPhoto(req, res, next) {
    try{
        // no Supabase keys on this server (see config/supabase.js): say so instead of crashing
        if (!supabase) return res.status(503).json({ error: "Photo upload isn't set up yet. Try again later." });

        const childId = req.user.id;
        const itemId = Number(req.body.itemId);
        const orderId = Number(req.body.orderId);

        if (!req.file) return res.status(400).json({error : "No photo"});

        const photo = await photoModel.didOrder(childId, orderId, itemId);

        if (!photo) return res.status(403).json({ error: "You can only snap food you ordered"})

        const path = `kids/${childId}/${Date.now()}.jpg`; //creates unique file name for the uploaded pic
        const {error} = await supabase.storage
            .from("photos")
            .upload(path, req.file.buffer, { contentType: req.file.mimetype});
                if (error) throw error; // goes to catch -> next(err)
                const imageUrl = 
        supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;

        const row = await photoModel.addPhoto(itemId, childId, orderId, imageUrl);
        const dishName = await photoModel.getDishName(itemId);

// ask the AI. If the AI service is down, don't fail the upload: the photo just stays "pending"
let result = null;
try {
    result = await aiCheck.checkPhoto(req.file.buffer, req.file.mimetype, dishName);
} catch (err) {
    console.error("AI check failed:", err.message);
}

let aiStatus = "pending";
if (result) {
    aiStatus = aiCheck.passed(result) ? "passed" : "failed";
    await photoModel.setAiResults(row.photo_id, aiStatus, result.confidence / 100, result.label);
    //result. because it is defined as the Ai results in line 56
    //the photo id is row.photo_id, and confidence must be result.confidence / 100 (so 98 → 0.98)
}

res.status(201).json({
    photo: { photo: row.photo_id, imageUrl: row.image_url, aiStatus },
    check: result,          // the 3 answers for the "AI says yum" page (null if the AI couldn't check)
});

    } catch(err){
        next(err);
    }
}

async function removePhoto(req, res, next){
    try{

        const retake = await photoModel.deletePhoto(Number(req.params.id), req.user.id);
        if (!retake) return res.status(404).json({error: "Photo not found"});

        const path = retake.image_url.split("/object/public/photos/")[1];
        // also delete pic file from storage
        if (supabase && path ) await
        supabase.storage.from("photos").remove([path]);

            res.json({deleted : true});
    } catch (err) {
        next(err);
    }
}

module.exports = {getMyDishes, createPhoto, removePhoto};