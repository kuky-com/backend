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


function formatNamesWithType(objects) {
    if (!Array.isArray(objects) || objects.length === 0) return '';

    const filtered = objects.filter(obj => obj.type === 'like' && obj.tag && obj.tag.length > 0);

    const names = filtered.map(obj => obj.tag);

    if (names.length === 0) {
        return ''
    } else if (names.length === 1) {
        return names[0]
    } else {
        const last = names.pop();
        return `${names.join(', ')} and ${last}`;
    }
}

module.exports = {
    findUnique,
    getRandomElements,
    isStringInteger,
    formatNamesWithType
}