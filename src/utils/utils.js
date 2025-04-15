const Users = require("../models/users");

function findUnique(arr1, arr2) {
    return [...new Set([...arr1, ...arr2])];
}

function getRandomElements(arr, count) {
    const shuffled = arr.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

function isStringInteger(value) {
    return (Number.isInteger(value) || (typeof value === 'string' && Number.isInteger(Number(value))));
}

function parseFormattedCallSeconds(formattedString) {
    try {
        console.log({formattedString})
        const timeUnits = {
            hour: 3600,
            minute: 60,
            second: 1,
        };
    
        const duration = formattedString.split(', ').reduce((totalMilliseconds, part) => {
            const [value, unit] = part.split(' ');
            const singularUnit = unit.replace(/s$/, ''); // Remove plural 's' if present
            return totalMilliseconds + (parseInt(value, 10) * (timeUnits[singularUnit] || 0));
        }, 0);

        return duration
    } catch (error) {
        console.log({error})
        return 0
    }
};

function formatNamesWithType(objects) {
    if (!Array.isArray(objects) || objects.length === 0) return '';

    const uniqueTags = [...new Set(objects
        .filter(obj => obj.type === 'like' && obj.tag && obj.tag.length > 0)
        .map(obj => obj.tag))];

    if (uniqueTags.length === 0) {
        return ''
    } else if (uniqueTags.length === 1) {
        return uniqueTags[0]
    } else {
        const last = uniqueTags.pop();
        return `${uniqueTags.join(', ')} and ${last}`;
    }
}

async function generateReferralCode(fullName) {    
    let normalized = fullName
                    .normalize("NFD") // Decomposes accents (e.g., "é" -> "é")
                    .replace(/[\u0300-\u036f]/g, "") // Remove accents
                    .replace(/\s+/g, "_") // Replace spaces with underscores
                    .replace(/[^a-zA-Z0-9_]/g, "") // Remove special characters
                    .toLowerCase();

    if(normalized === '_' || normalized === '__' || normalized === '___' || normalized === '____' || normalized === '_____' || normalized === '______' || normalized === '_______') {
        normalized = 'kuky'
    }

    let baseCode = `${normalized}`;
    let referralCode = baseCode;
    let count = 1;

    while (await Users.findOne({ where: { referral_id: referralCode } })) {
        referralCode = `${baseCode}_${count}`;
        count++;
    }

    return referralCode;
}


module.exports = {
    findUnique,
    getRandomElements,
    isStringInteger,
    formatNamesWithType,
    generateReferralCode,
    parseFormattedCallSeconds
}