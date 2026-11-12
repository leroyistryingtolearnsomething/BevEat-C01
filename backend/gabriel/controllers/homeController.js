const homeModel = require('../models/homeModel');
const Menu = require('../../raghav/models/menuModel');
const { loadChildContext, buildDishCards, toDishFacts, isAllowed } = require('../../raghav/services/menuService');
const {decideDish} = require('../../raghav/services/dishSafety');
const FoodRuleSettings = require('../../leslie/models/foodRuleSettingsModel');

// Mum's rules switches (Leslie, CB69-18) as chips: the page shows "No " + label
const FOOD_RULE_CHIPS = [
    { type: "no_fried", label: "fried food", icon: "🍟" },
    { type: "no_sugary", label: "sugary drinks", icon: "🧋" },
];

const HOME_PICS = 10; // the row on Home
const ALL_PICS = 50;  // the "See all" page

// Today's most-hearted pics as the same dish cards the stall menu uses (Raghav's DishCard),
// so a dish is locked for allergies or "Mum says no" exactly like on the menu, with the same Figma look
async function topPicCards(childId, limit) {
    const pics = await homeModel.getTopPics(childId, limit);
    if (pics.length === 0) return [];
    const [child, rows] = await Promise.all([
        loadChildContext(childId),
        Menu.getAvailableDishesByIds(pics.map((p) => p.item_id)),
    ]);
    if (!child) return [];
    const cards = new Map((await buildDishCards(rows, child)).map(({ card }) => [card.id, card]));
    return pics.map((p) => cards.get(p.item_id)).filter(Boolean); // most hearts first; sold-out dishes drop out
}

async function countSafePicks(childId, stalls) {
    const child = await loadChildContext(childId)
    const counts = {};
    if (!child) return counts;
    for (const s of stalls){
        const dishes = await Menu.getAvailableDishesForStall(s.stall_id)
        counts[s.stall_id] = dishes.filter((d) =>
        isAllowed(decideDish(toDishFacts(d), child))).length
    }
    return counts;
}

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
        const pics = await topPicCards(childId, HOME_PICS);
        const safeCounts = await countSafePicks(childId, stalls);

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
        const foodRulesOn = await FoodRuleSettings.listForChild(childId);
        for (const r of FOOD_RULE_CHIPS) {
            if (foodRulesOn.has(r.type)) ruleChips.push({ label: r.label, icon: r.icon, type: "parent" });
        }
        const stallCards = stalls.map((s) => ({
            stall: s.stall_id,
            name: s.name,
            unit: s.unit_no,
            image: s.cover_image_url,
            safePicks : safeCounts[s.stall_id] ?? 0,
        }));

        res.json({ // respond with data pulled using the query
            child: {name : child.display_name, avatarEmoji: child.avatar_emoji},
            money: {left, spentToday, dailyLimit, wallet: Number(child.wallet_balance)}, // wallet is shown on the kid's Wallet tab
            rules: ruleChips,
            stalls: stallCards,
            pics, // same shape as a stall menu dish card
        });
    
    }
    catch (err){
        next(err);
    }
}

// GET /api/home/pics: the "See all" page for Today's yummiest pics
async function getAllPics(req, res, next) {
    try {
        res.json({ pics: await topPicCards(req.user.id, ALL_PICS) });
    } catch (err) {
        next(err);
    }
}

module.exports = {getHome, getAllPics};