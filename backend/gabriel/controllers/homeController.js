const homeModel = require('../models/homeModel');

async function getHome(req, res, next) {
    try{
        const childId = req.user.id; // who is requesting

        const child = await homeModel.getChildSummary(childId); // get the data from the database using the query in the model
        //await means to wait for the database to answer before moving on
        if (!child) return res.status(404).json({error: "Child not found"}); 
        //if the id doesnt match the child, child is undefined daily limit would crash if not checked

        const spent = await homeModel.getSpentToday(childId); // same as the home.getchildsummary
        const rules = await homeModel.getRules(childId);
        const stalls = await homeModel.getStalls(childId);
        const pics = await homeModel.getTopPics(childId);

        const dailyLimit = Number(child.daily_limit);
        const spentToday = Number(spent); // Number function turns it from a text to a number
        const left = Math.max(dailyLimit - spentToday, 0); // arranging the data pulled from the 2 await funcs
        //Math.max stops left from being negative if somehow overspent (x,0) takes the left parameter
        //in this case (dailyLimit - spentToday) and checks if its bigger than 0 so anything below 0 becomes 0
        const ruleChips = rules.map((r) => ({
            label: r.name, //value from row
            icon: r.icon,
            severity: r.severity,
            type: "allergy", // this is a fixed text thats why its in ""
        }));
        const stallCards = stalls.map((s) => ({
            stall: s.stall_id,
            name: s.name,
            unit: s.unit_no,
            image: s.cover_image_url,
            safePicks : Number(s.safe_picks)
        }));

        const picCards = pics.map((p) => ({
            photo: p.photo_id,
            item: p.item_id,
            dish: p.name,
            price : Number(p.price),
            imageUrl: p.image_url,
            likes: Number(p.likes),
            status: p.blocked ? "allergy" : "ok",
        }));

        res.json({ // respond with data pulled using the query
            child: {name : child.display_name, avatarEmoji: child.avatar_emoji},
            money: {left, spentToday, dailyLimit, wallet: Number(child.wallet_balance)}, // wallet is shown on the kid's Wallet tab
            rules: ruleChips,
            stalls: stallCards,
            pics: picCards,
        });
    
    }
    catch (err){
        next(err);
    }
}


module.exports = {getHome};