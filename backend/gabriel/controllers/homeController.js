const homeModel = require('../models/homeModel');
const Menu = require('../../raghav/models/menuModel');
const { loadChildContext, buildDishCards, toDishFacts, isAllowed } = require('../../raghav/services/menuService');
const {decideDish} = require('../../raghav/services/dishSafety');
const FoodRuleSettings = require('../../leslie/models/foodRuleSettingsModel');
const DayLimit = require('../../xinsheng/models/dayLimitModel'); // weekday limits (Xin Sheng)
const { limitFor, sgWeekdayToday } = require('../../xinsheng/services/moneyService');

// Mum's rules switches (Leslie, CB69-18) as chips: the page shows "No " + label these are the fixed rules
const FOOD_RULE_CHIPS = [
    { type: "no_fried", label: "fried food", icon: "🍟" },
    { type: "no_sugary", label: "sugary drinks", icon: "🧋" },
];

const HOME_PICS = 10; // the row on Home
const ALL_PICS = 50;  // the "See all" page
const COMING_SOON_CENTRES = [2]; // maple grove stalls arent finished yet, so the cards cannot be opened

// Today's most-hearted pics as the same dish cards the stall menu uses (Raghav's DishCard),
// so a dish is locked for allergies or "Mum says no" exactly like on the menu, with the same Figma look
async function topPicCards(childId, limit) {
    const pics = await homeModel.getTopPics(childId, limit); // takes pics from the homeModel, one row per dish, most hearts first
    if (pics.length === 0) return []; // if there are no pics at all, early return an empty list.
    const [child, rows] = await Promise.all([ //Promise means start both, loadChildContext and getAvailableDishes.. at once and wait until its done
        loadChildContext(childId), // the kids allergies and rules, countSafePicks
        Menu.getAvailableDishesByIds(pics.map((p) => p.item_id)), //the full details of the dishes, based on the itemid from pics.map
        //pics.map turns the list of rows into a plain list of id
    ]);
    if (!child) return []; // if no child profile return no cards
    //Without the kid’s rules, the dishes can’t be judged safely, so it shows nothing rather than risk showing a dish as safe when it isn’t.
    const cards = new Map((await buildDishCards(rows, child)).map(({ card }) => [card.id, card]));
    //buildDishCards is a function that judges each dish with decideDish and builds its card returning card and photo
    //.map({card}) takes only the card from the card and photo.
    //new Map turns the [card.id, card] into a Map, a lookup table where u find the card by its id.
    return pics.map((p) => cards.get(p.item_id)).filter(Boolean); // most hearts first; sold-out dishes drop out
    //pics.map goes through the list, the list has the most likes as first
}

async function countSafePicks(childId, stalls) {
    //countSafePicks loads the kid’s rules once, then for each stall gets its dishes
    //keeps the ones Raghav’s decideDish allows, and saves how many in a table by stall id.

    const child = await loadChildContext(childId) // loadChildContext loads everything about the kid once:
    // allergies, custom allergies, Mum's rules and today's Ask Mum approvals - raghavs function

    const counts = {};
    //starts as an empty object and will become a lookup table like { 6: 3, 7: 3, 8: 3 }, meaning “stall 6 has 3 safe dishes”
    if (!child) return counts; // if the kid has no profile, it gives back an empty table straight away
    for (const s of stalls){ // a loop, for each stall in the list, run the code inside the {}
        const dishes = await Menu.getAvailableDishesForStall(s.stall_id) // gets the stall dishes available and the allergens
        counts[s.stall_id] = dishes.filter((d) =>
        isAllowed(decideDish(toDishFacts(d), child))).length
        // takes the dish row into the format Raghav's judge, decideDish requires, it returns a status, where the isAllowed
        //changes it to true or false, the dishes.filter only keeps the dishes that returned true, .length counts how many true
        //dishes were kept. counts[s.stall_id] saves the number under the stalls id.
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
        const centres = await homeModel.getCentres();
        let centreId = Number(req.query.centre);// checks the hawker centre id, returning it as a Number
        if (!centres.some((c) => c.centre_id === centreId)) centreId = centres[0].centre_id; // uses first hawker centre if not real id

        const stalls = await homeModel.getStalls(childId, centreId);
        const pics = await topPicCards(childId, HOME_PICS);
        const safeCounts = await countSafePicks(childId, stalls);

        // today's limit: a weekday limit if the parent set one, otherwise the normal daily limit
        const dailyLimit = limitFor(child.daily_limit, await DayLimit.getDayLimits(childId), sgWeekdayToday());
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
            centres: centres.map((c) => ({
                id: c.centre_id,
                name: c.name,
                nearSchool:c.near_school,
            })),
             centre: centreId,
             comingSoon: COMING_SOON_CENTRES.includes(centreId), //.include(centreId) asks if centreId is in the coming soon centres list
             //and returns true or false, since the list contains centreId as 2, it marks centreId2: maple grove, as true
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