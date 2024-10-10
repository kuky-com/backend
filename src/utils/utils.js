function findUnique(arr1, arr2) {
    return [...new Set([...arr1, ...arr2])];
}

module.exports = {
    findUnique
}