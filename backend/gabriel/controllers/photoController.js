const photoModel = require("../models/photoModel");
const supabase = require("../../config/supabase");

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
        res.status(201).json({ photo: { photo: row.photo_id, imageUrl: row.image_url, aiStatus: row.ai_status } });

    } catch(err){
        next(err);
    }
}

module.exports = {getMyDishes, createPhoto};