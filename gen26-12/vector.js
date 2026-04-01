// Utility functions for **VECTORS**
//
//
//
//

function dot(v1, v2) {
    let sum = 0;
    if (!checkDimensions(v1, v2)) {
        return;
    } else {
        for (var dim in v1) {
            if (v1.hasOwnProperty(dim) && v2.hasOwnProperty(dim)) {
                sum += v1[dim] * v2[dim];
            } else {
                console.warn(
                    "Vector dimension definitions  not match! Check dimension key names.",
                );
                return;
            }
        }
    }
    return sum;
}

function cross(v1, v2) {
    const product = {};
    const checker = fullCheckDimensions(v1, v2);
    if (!checker.checkDim) {
        console.warn(
            "Vectors do not have the same number of dimensions! Check the amount of dimenions for each vector.",
        );
        return;
    } else if (!checker.checkKeys1 || !checker.checkKeys2) {
        console.warn(
            "Vector dimension definitions not match! Check dimension key names.",
        );
        return;
    } else if (checker.count1 !== 3 || checker.count2 !== 3) {
        console.warn("Currently only 3-dimensional vectors are supported");
        return;
    } else {
        let dims = [];
        for (var dim in v1) {
            dims.push(dim);
        }
        dims.forEach((dim, id) => {
            if (id === 0) {
                product.x =
                    v1[dims[1]] * v2[dims[2]] - v2[dims[1]] * v1[dims[2]];
            } else if (id === 1) {
                product.y =
                    -v1[dims[0]] * v2[dims[2]] + v2[dims[0]] * v1[dims[2]];
            } else if (id === 2) {
                product.z =
                    v1[dims[0]] * v2[dims[1]] - v2[dims[0]] * v1[dims[1]];
            }
        });
        return product;
    }
}

module.exports = { dot, cross };

// Utility

function checkDimensions(v1, v2) {
    const entries1 = Object.entries(v1);
    const entries2 = Object.entries(v2);
    if (entries1.length !== entries2.length) {
        console.warn(
            "Vectors do not have the same number of dimensions! Check the amount of dimenions for each vector.",
        );
        return false;
    } else {
        return true;
    }
}

function fullCheckDimensions(v1, v2) {
    const entries1 = Object.entries(v1);
    const entries2 = Object.entries(v2);
    const count1 = entries1.length;
    const count2 = entries2.length;
    let checkDim = false;
    if (count1 !== count2) {
        checkDim = false;
    } else {
        checkDim = true;
    }
    let checkKeys1 = true;
    let checkKeys2 = true;
    for (var dim in v1) {
        if (v1.hasOwnProperty(dim) && v2.hasOwnProperty(dim)) {
        } else {
            checkKeys1 = false;
        }
    }

    for (var dim in v2) {
        if (v1.hasOwnProperty(dim) && v2.hasOwnProperty(dim)) {
        } else {
            checkKeys2 = false;
        }
    }
    return {
        checkDim: checkDim,
        count1: count1,
        count2: count2,
        checkKeys1: checkKeys1,
        checkKeys2: checkKeys2,
    };
}
