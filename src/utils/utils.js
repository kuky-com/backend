function findUnique(arr1, arr2) {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);

    const uniqueToArr1 = arr1.filter(num => !set2.has(num));

    const uniqueToArr2 = arr2.filter(num => !set1.has(num));

    return [...uniqueToArr1, ...uniqueToArr2];
}

module.exports = {
    findUnique
}