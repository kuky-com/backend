function findUnique(arr1, arr2) {
    return [...new Set([...arr1, ...arr2])];
}

function getRandomElements(arr, count) {
    const shuffled = arr.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}


module.exports = {
    findUnique,
    getRandomElements
}